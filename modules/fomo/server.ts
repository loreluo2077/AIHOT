// This module's backend: today's index, one vote, one word, one signal, and the owner's own moderation
// routes. There is no schedule: the index is computed from the engine's own tables when it is read, so
// nothing has to be kept in step.
import { addDays, beijingDate, beijingMidnight } from "@aihot/contracts/time";
import { newShortId } from "@aihot/backend/lib/ids";
import { sessionPrincipal } from "@aihot/backend/admin/auth";
import { feedbackSourceHash } from "@aihot/backend/operations/feedback";
import { defineServerModule } from "@aihot/backend/modules";
import type { FastifyReply, FastifyRequest } from "fastify";
import { FOMO } from "./config.ts";
import { fomoInsightsPayload, fomoPayload } from "./backend/read.ts";
import { normalizeAuthor, normalizeSignalBody } from "./backend/signal.ts";
import {
  addReaderWord,
  addSignal,
  addSignalMark,
  castVote,
  countReaderWords,
  countSignalMarks,
  countSignalsWaiting,
  hideSignal,
  isFeeling,
  readSignalsForAdmin,
  removeSignal,
  setSignalHidden,
  signalAllowance,
  signalExists,
  type SignalMark,
} from "./backend/store.ts";
import { normalizeWord } from "./backend/words.ts";
import type { FomoAdminSignals } from "./types.ts";

/**
 * The reader behind a request, as an unreadable identifier. It is the engine's own feedback hash, so one
 * reader is one identifier across the site and no address is stored (site/pages/privacy.md).
 */
function voterOf(request: FastifyRequest): string {
  return feedbackSourceHash(request.ip, String(request.headers["user-agent"] ?? ""));
}

/** How long until a reader's daily allowance starts again. */
function untilTomorrow(): number {
  const now = new Date();
  const nextDay = beijingMidnight(addDays(beijingDate(now), 1)).getTime();
  return Math.max(60, Math.round((nextDay - now.getTime()) / 1000));
}

/**
 * The engine's admin guard, for this module's own admin routes: the same session and CSRF checks the
 * engine's `/api/admin/*` routes make (apps/api/src/routes/admin-auth.ts), from the same helpers. False
 * means the refusal has been sent.
 */
async function allowAdmin(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  const admin = await sessionPrincipal(request.headers.cookie);
  if (!admin) {
    await reply.code(401).send({ code: "unauthorized", detail: "Sign in to the admin first." });
    return false;
  }
  if (request.method !== "GET" && request.method !== "HEAD" && request.headers["x-csrf-token"] !== admin.csrf) {
    await reply.code(403).send({ code: "forbidden", detail: "Missing or stale CSRF token." });
    return false;
  }
  return true;
}

/** Agreeing and reporting are the same act with a different name. */
const markRoute = (kind: SignalMark) =>
  async (request: FastifyRequest, reply: FastifyReply) => {
    const id = (request.body as { id?: unknown } | null)?.id;
    if (typeof id !== "string" || !(await signalExists(id))) return reply.code(404).send({ error: "not_found" });
    const added = await addSignalMark(id, voterOf(request), kind);
    // A signal enough different readers reported comes down on its own and waits for the owner.
    if (kind === "report" && added && (await countSignalMarks(id, kind)) >= FOMO.signal.reportsToHide) {
      await hideSignal(id, "读者举报");
    }
    return reply.header("cache-control", "no-store").send(await fomoPayload());
  };

export default defineServerModule({
  name: "fomo",
  http: (app) => {
    app.get("/api/fomo/today", async (_request, reply) => {
      const payload = await fomoPayload();
      return reply
        .header("cache-control", `public, max-age=${FOMO.cacheSeconds}, stale-while-revalidate=600`)
        .header("content-type", "application/json; charset=utf-8")
        .send(payload);
    });

    // What the timeline and the trends page read: one payload, the queries are the index's own kind.
    app.get("/api/fomo/insights", async (_request, reply) => {
      const payload = await fomoInsightsPayload();
      return reply
        .header("cache-control", `public, max-age=${FOMO.cacheSeconds}, stale-while-revalidate=600`)
        .header("content-type", "application/json; charset=utf-8")
        .send(payload);
    });

    app.post("/api/fomo/vote", async (request, reply) => {
      const feeling = (request.body as { feeling?: unknown } | null)?.feeling;
      if (!isFeeling(feeling)) return reply.code(400).send({ error: "invalid_feeling" });
      await castVote(beijingDate(new Date()), voterOf(request), feeling);
      return reply.header("cache-control", "no-store").send(await fomoPayload());
    });

    app.post("/api/fomo/hotword", async (request, reply) => {
      const raw = (request.body as { word?: unknown } | null)?.word;
      const word = typeof raw === "string" ? normalizeWord(raw, FOMO.hotword) : null;
      if (!word) return reply.code(400).send({ error: "invalid_word" });
      const day = beijingDate(new Date());
      const voter = voterOf(request);
      if ((await countReaderWords(day, voter)) >= FOMO.hotword.perDay) {
        return reply.code(429).header("retry-after", String(untilTomorrow())).send({ error: "too_many_words" });
      }
      await addReaderWord(day, word, voter);
      return reply.header("cache-control", "no-store").send(await fomoPayload());
    });

    app.post("/api/fomo/signal", async (request, reply) => {
      const input = (request.body ?? {}) as { body?: unknown; author?: unknown };
      const body = typeof input.body === "string" ? normalizeSignalBody(input.body, FOMO.signal) : null;
      if (!body) return reply.code(400).send({ error: "invalid_signal" });
      const day = beijingDate(new Date());
      const voter = voterOf(request);
      const { today, lastAt } = await signalAllowance(day, voter);
      if (today >= FOMO.signal.perDay) {
        return reply.code(429).header("retry-after", String(untilTomorrow())).send({ error: "too_many_signals" });
      }
      if (lastAt) {
        const waited = Date.now() - lastAt.getTime();
        const cooldown = FOMO.signal.cooldownSeconds * 1000;
        if (waited < cooldown) {
          return reply.code(429).header("retry-after", String(Math.ceil((cooldown - waited) / 1000))).send({ error: "slow_down" });
        }
      }
      await addSignal({ id: newShortId(), day, voter, body, author: normalizeAuthor(input.author) });
      return reply.header("cache-control", "no-store").send(await fomoPayload());
    });

    app.post("/api/fomo/agree", markRoute("agree"));
    app.post("/api/fomo/report", markRoute("report"));

    // The owner's own page: every signal, and putting one back or taking one down.
    app.get("/api/admin/fomo/signals", async (request, reply) => {
      if (!(await allowAdmin(request, reply))) return;
      const rows = await readSignalsForAdmin(200);
      const payload: FomoAdminSignals = {
        rows: rows.map((row) => ({
          id: row.id,
          day: row.day,
          body: row.body,
          author: row.author,
          voter: row.voter,
          at: row.at.toISOString(),
          hidden: row.hidden,
          hiddenReason: row.hiddenReason,
          agrees: row.agrees,
          reports: row.reports,
        })),
        waiting: await countSignalsWaiting(),
      };
      return reply.header("cache-control", "no-store").send(payload);
    });

    app.post("/api/admin/fomo/signals/:id/hidden", async (request, reply) => {
      if (!(await allowAdmin(request, reply))) return;
      const hidden = (request.body as { hidden?: unknown } | null)?.hidden;
      if (typeof hidden !== "boolean") return reply.code(400).send({ code: "invalid_request", detail: "hidden must be true or false." });
      const id = (request.params as { id: string }).id;
      if (!(await setSignalHidden(id, hidden))) return reply.code(404).send({ code: "not_found", detail: "No such signal." });
      return reply.header("cache-control", "no-store").send({ ok: true });
    });

    app.post("/api/admin/fomo/signals/:id/remove", async (request, reply) => {
      if (!(await allowAdmin(request, reply))) return;
      const id = (request.params as { id: string }).id;
      if (!(await removeSignal(id))) return reply.code(404).send({ code: "not_found", detail: "No such signal." });
      return reply.header("cache-control", "no-store").send({ ok: true });
    });
  },
  admin: {
    // What is waiting for the owner: signals that came down and want a look.
    counts: { fomoSignals: () => countSignalsWaiting() },
  },
});
