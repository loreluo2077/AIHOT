// The community signals through this module's own HTTP routes: posting, agreeing, reporting one down, and
// the owner's moderation routes, which must refuse anyone without a session. The app here is the module's
// own (server.ts) on a bare Fastify instance: the engine's wiring is the engine's tests' business.
import { tag } from "../../../tests/setup.ts";
import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import Fastify, { type FastifyInstance } from "fastify";
import { SESSION_COOKIE, passwordLogin, sessionPrincipal } from "@aihot/backend/admin/auth";
import { config } from "@aihot/backend/config";
import { closeDb, sql } from "@aihot/backend/db";
import { feedbackSourceHash } from "@aihot/backend/operations/feedback";
import { beijingDate } from "@aihot/contracts/time";
import { FOMO } from "../config.ts";
import fomo from "../server.ts";
import { addSignal } from "../backend/store.ts";
import type { FomoAdminSignals, FomoPayload } from "../types.ts";

const T = tag();
const DAY = beijingDate(new Date());
const PASSWORD = `test-fomo-admin-${T}`;
const original = { password: config.adminPassword };

let app: FastifyInstance;
before(async () => {
  config.adminPassword = PASSWORD;
  app = Fastify({ logger: false });
  fomo.http!(app);
  await app.ready();
});
after(async () => {
  config.adminPassword = original.password;
  await app.close();
  await closeDb();
});

beforeEach(async () => {
  await sql`DELETE FROM fomo_signal_marks`;
  await sql`DELETE FROM fomo_signals`;
});

/** One reader: the module tells readers apart by address and browser family, so a different address is a different reader. */
const reader = (address: string) => ({ remoteAddress: address, headers: { "user-agent": "test-agent" } });

async function post(url: string, payload: object, who: { remoteAddress: string; headers: Record<string, string> }, headers: Record<string, string> = {}) {
  return await app.inject({ method: "POST", url, payload, ...who, headers: { ...who.headers, ...headers } });
}

async function today(): Promise<FomoPayload> {
  const response = await app.inject({ method: "GET", url: "/api/fomo/today" });
  assert.equal(response.statusCode, 200);
  return response.json() as FomoPayload;
}

test("a reader's signal shows up on the page, signed the way they wrote it", async () => {
  const response = await post("/api/fomo/signal", { body: "三家客户这周都在问同一个 Agent 产品", author: "老张" }, reader("10.0.0.1"));
  assert.equal(response.statusCode, 200);
  const payload = response.json() as FomoPayload;
  assert.equal(payload.signals.length, 1);
  assert.equal(payload.signals[0]!.body, "三家客户这周都在问同一个 Agent 产品");
  assert.equal(payload.signals[0]!.author, "老张");
  assert.equal(payload.signals[0]!.agrees, 0);
  assert.equal(payload.stats.signalsToday, 1);
  assert.equal(payload.stats.signalsTotal, 1);
});

test("a signal that is not one is refused", async () => {
  assert.equal((await post("/api/fomo/signal", { body: "一" }, reader("10.0.0.2"))).statusCode, 400);
  assert.equal((await post("/api/fomo/signal", { body: "   " }, reader("10.0.0.2"))).statusCode, 400);
  assert.equal((await post("/api/fomo/signal", { body: "字".repeat(FOMO.signal.maxLength + 1) }, reader("10.0.0.2"))).statusCode, 400);
  assert.equal((await post("/api/fomo/signal", {}, reader("10.0.0.2"))).statusCode, 400);
});

test("one reader posts once per cooldown, and the refusal says how long to wait", async () => {
  assert.equal((await post("/api/fomo/signal", { body: "第一条" }, reader("10.0.0.3"))).statusCode, 200);
  const again = await post("/api/fomo/signal", { body: "紧接着又来一条" }, reader("10.0.0.3"));
  assert.equal(again.statusCode, 429);
  assert.ok(Number(again.headers["retry-after"]) > 0);
  // Another reader is not affected by the first one's cooldown.
  assert.equal((await post("/api/fomo/signal", { body: "我是另一个人" }, reader("10.0.0.4"))).statusCode, 200);
  assert.equal((await today()).signals.length, 2);
});

test("the daily cap refuses the next signal from the same reader", async () => {
  // The cap counts the reader's identifier, so the rows are written with exactly the one this request gets.
  const voter = feedbackSourceHash("10.0.0.5", "test-agent");
  for (let i = 0; i < FOMO.signal.perDay; i += 1) {
    await addSignal({ id: `cap-${T}-${i}`, day: DAY, voter, body: `第 ${i + 1} 条`, author: null });
  }
  const response = await post("/api/fomo/signal", { body: "再多一条" }, reader("10.0.0.5"));
  assert.equal(response.statusCode, 429);
  assert.ok(Number(response.headers["retry-after"]) > 0);
});

test("agreeing counts once per reader, and reporting twice takes a signal down", async () => {
  const posted = await post("/api/fomo/signal", { body: "这条会被举报下去" }, reader("10.0.0.6"));
  const id = (posted.json() as FomoPayload).signals[0]!.id;

  await post("/api/fomo/agree", { id }, reader("10.0.0.7"));
  const twice = await post("/api/fomo/agree", { id }, reader("10.0.0.7"));
  assert.equal((twice.json() as FomoPayload).signals[0]!.agrees, 1, "the same reader counts once");
  assert.equal((await today()).signals[0]!.agrees, 1);

  assert.equal((await post("/api/fomo/report", { id }, reader("10.0.0.8"))).statusCode, 200);
  assert.equal((await today()).signals.length, 1, "one report is not enough");

  assert.equal((await post("/api/fomo/report", { id }, reader("10.0.0.9"))).statusCode, 200);
  const after = await today();
  assert.deepEqual(after.signals, [], "the configured number of different readers takes it down");
  assert.equal(after.stats.signalsToday, 0);
});

test("marking a signal that is not there is a 404, not a new row", async () => {
  assert.equal((await post("/api/fomo/agree", { id: "no-such-signal" }, reader("10.0.0.10"))).statusCode, 404);
  assert.equal((await post("/api/fomo/report", { id: "" }, reader("10.0.0.10"))).statusCode, 404);
});

test("the owner's own routes refuse anyone without a session", async () => {
  const posted = await post("/api/fomo/signal", { body: "只有站长能下架这条" }, reader("10.0.0.11"));
  const id = (posted.json() as FomoPayload).signals[0]!.id;

  const list = await app.inject({ method: "GET", url: "/api/admin/fomo/signals" });
  assert.equal(list.statusCode, 401, "no session, no list");
  assert.ok(!list.body.includes("只有站长能下架这条"), "and nothing about the signals leaks with the refusal");

  const forged = await app.inject({ method: "GET", url: "/api/admin/fomo/signals", headers: { cookie: `${SESSION_COOKIE}=${"f".repeat(64)}` } });
  assert.equal(forged.statusCode, 401, "a made-up cookie is not a session");

  assert.equal((await post(`/api/admin/fomo/signals/${id}/hidden`, { hidden: true }, reader("10.0.0.11"))).statusCode, 401);
  assert.equal((await post(`/api/admin/fomo/signals/${id}/remove`, {}, reader("10.0.0.11"))).statusCode, 401);
  assert.equal((await today()).signals.length, 1, "nothing was taken down");
});

test("the owner lists, takes down, restores and removes", async () => {
  const posted = await post("/api/fomo/signal", { body: "一条普通的话", author: null }, reader("10.0.0.12"));
  const id = (posted.json() as FomoPayload).signals[0]!.id;
  await post("/api/fomo/agree", { id }, reader("10.0.0.13"));

  const token = (await passwordLogin(PASSWORD, "/admin", "test-agent")).token;
  const cookie = { cookie: `${SESSION_COOKIE}=${token}` };
  const csrf = (await sessionPrincipal(cookie.cookie))!.csrf;

  const list = await app.inject({ method: "GET", url: "/api/admin/fomo/signals", headers: cookie });
  assert.equal(list.statusCode, 200);
  const listed = list.json() as FomoAdminSignals;
  assert.equal(listed.rows.length, 1);
  assert.equal(listed.rows[0]!.agrees, 1);
  assert.equal(listed.rows[0]!.hidden, false);
  assert.equal(listed.waiting, 0);

  // A write without the CSRF token the session carries is refused, even for a signed-in admin.
  const noCsrf = await app.inject({ method: "POST", url: `/api/admin/fomo/signals/${id}/hidden`, payload: { hidden: true }, headers: cookie, remoteAddress: "10.0.0.12" });
  assert.equal(noCsrf.statusCode, 403);

  const hidden = await app.inject({ method: "POST", url: `/api/admin/fomo/signals/${id}/hidden`, payload: { hidden: true }, headers: { ...cookie, "x-csrf-token": csrf }, remoteAddress: "10.0.0.12" });
  assert.equal(hidden.statusCode, 200);
  assert.deepEqual((await today()).signals, [], "taken down by hand");
  assert.equal((await app.inject({ method: "GET", url: "/api/admin/fomo/signals", headers: cookie })).json<FomoAdminSignals>().waiting, 1, "and waiting for a look");

  const restored = await app.inject({ method: "POST", url: `/api/admin/fomo/signals/${id}/hidden`, payload: { hidden: false }, headers: { ...cookie, "x-csrf-token": csrf }, remoteAddress: "10.0.0.12" });
  assert.equal(restored.statusCode, 200);
  assert.equal((await today()).signals.length, 1, "back on the page");

  const removed = await app.inject({ method: "POST", url: `/api/admin/fomo/signals/${id}/remove`, headers: { ...cookie, "x-csrf-token": csrf }, remoteAddress: "10.0.0.12" });
  assert.equal(removed.statusCode, 200);
  assert.deepEqual((await today()).signals, []);
  assert.equal((await app.inject({ method: "GET", url: "/api/admin/fomo/signals", headers: cookie })).json<FomoAdminSignals>().rows.length, 0);
});
