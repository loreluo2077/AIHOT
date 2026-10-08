// Mirroring an event: their grouping, this site's heat. The assertions go through the read layer the
// pages use (`loadHot`, `loadStoryDetail`), so what is checked is what a reader would get.
import { tag } from "../../../tests/setup.ts";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { closeDb, sql } from "@aihot/backend/db";
import { computeHotRanking } from "@aihot/backend/events/hot";
import { importEvent } from "@aihot/backend/events/import";
import { stopBoss } from "@aihot/backend/jobs/queue";
import { latestHotRanking } from "@aihot/backend/publication/hot";
import { loadStoryDetail } from "@aihot/backend/publication/stories";
import { syncEvents } from "../backend/events.ts";
import { AihotHttpError, type AihotAnswer, type AihotClient } from "../backend/client.ts";
import type { AihotHotTopics, AihotStoryDetail } from "../backend/types.ts";

const T = tag();
let n = 0;

function fakeClient(routes: Record<string, unknown>): AihotClient {
  return {
    async get<T>(path: string): Promise<AihotAnswer<T>> {
      if (path in routes) return { data: routes[path] as T, notModified: false, etag: null };
      const hit = Object.keys(routes).filter((key) => path.startsWith(`${key}/`)).sort((a, b) => b.length - a.length)[0];
      return { data: (hit ? routes[hit] : null) as T | null, notModified: false, etag: null };
    },
    // The events feed reads no page; a detail read here would be a bug, and says so.
    async text(path: string): Promise<never> {
      throw new AihotHttpError(404, `${path}: 404`);
    },
  };
}

function report(index: number, source: string, at: Date) {
  n++;
  const id = `${T}r${n}`;
  return { index, id, source, at, aihot: { id, title: `报道 ${index}`, summary: `摘要 ${index}`, source: { name: source }, publishedAt: at.toISOString(), links: { aihot: `https://aihot.news/items/${id}`, original: `https://example.com/${id}` } } };
}

after(async () => {
  await stopBoss();
  await closeDb();
});

test("an event from elsewhere becomes a hot topic this site ranks itself", async () => {
  const publicId = randomUUID();
  const now = new Date();
  const at = (hours: number) => new Date(now.getTime() - hours * 3600_000);
  // Two reports from two different sources: the hot rule needs two independent participants.
  const first = report(1, `来源甲 ${T}`, at(3));
  const second = report(2, `来源乙 ${T}`, at(2));
  const topic: AihotHotTopics = {
    schemaVersion: 1,
    count: 1,
    items: [
      {
        rank: 1,
        id: first.id,
        title: "被镜像的事件",
        links: { aihot: `https://aihot.news/items/${first.id}`, story: `https://aihot.virxact.com/story/${publicId}` },
        sourceCount: 2,
        participantCount: 2,
        latestAt: second.at.toISOString(),
      },
    ],
  };
  const story: AihotStoryDetail = {
    publicId,
    title: "被镜像的事件",
    firstReportAt: first.at.toISOString(),
    latestAt: second.at.toISOString(),
    latest: "最新进展：报道 2",
    digest: "这是镜像过来的事件综述。",
    digestUpdatedAt: now.toISOString(),
    reports: [second.aihot, first.aihot],
  };
  const client = fakeClient({ "/api/v1/hot-topics": topic, [`/api/v1/stories/${publicId}`]: { story } });

  const summary = await syncEvents(client);
  assert.equal(summary.created, 1);
  assert.equal(summary.failed, 0);

  const [stored] = await sql<{ id: string; origin: string; title: string; latest: string; digest: string }[]>`
    SELECT id::text, origin, title, latest, digest FROM stories WHERE public_id = ${publicId}`;
  assert.equal(stored.origin, "replay");
  assert.equal(stored.title, "被镜像的事件");
  assert.equal(stored.digest, "这是镜像过来的事件综述。");

  const members = await sql<{ role: string; article_id: string }[]>`
    SELECT fa.role, fa.article_id FROM fact_articles fa JOIN facts f ON f.id = fa.fact_id WHERE f.story_id = ${stored.id}`;
  assert.equal(members.length, 2);
  assert.deepEqual(members.map((m) => m.role).sort(), ["primary", "report"]);

  const signals = await sql<{ kind: string; participant_key: string }[]>`
    SELECT kind, participant_key FROM story_signals WHERE story_id = ${stored.id}`;
  assert.equal(signals.length, 2);
  assert.ok(signals.every((s) => s.kind === "editorial"));
  assert.equal(new Set(signals.map((s) => s.participant_key)).size, 2);

  // The published reports carry the event, which is what the event page and the hot list read.
  const linked = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM publications WHERE fact_id IN (SELECT id FROM facts WHERE story_id = ${stored.id}) AND story_id = ${stored.id}`;
  assert.equal(linked[0]!.n, 2);

  // Their digest is shown while the evidence behind it is public, and the hot list ranks it here.
  const detail = await loadStoryDetail(Number(stored.id));
  assert.ok(detail, "the event page exists");
  assert.equal(detail!.digest, "这是镜像过来的事件综述。");

  await computeHotRanking();
  const hot = await latestHotRanking();
  const entry = hot?.entries.find((candidate) => candidate.storyPublicId === publicId);
  assert.ok(entry, "the event is on the hot list");
  assert.equal(entry!.participantCount, 2);
  assert.equal(entry!.sourceCount, 2);
  assert.equal(entry!.title, "被镜像的事件");
});

test("an event this site grouped itself is never rewritten by an import", async () => {
  const publicId = randomUUID();
  const articleId = `${T}owned`;
  await sql`INSERT INTO sources (id, name, kind, tier, participation_mode, next_fetch_at)
    VALUES (${`own-${T}`}, '自己的信源', 'rss', 'T1', 'editorial', '2100-01-01')`;
  await sql`INSERT INTO articles (id, source_id, identity_key, url, title, discovered_at, timeline_at, body_status, processing_state, grouping_status)
    VALUES (${articleId}, ${`own-${T}`}, ${`own:${articleId}`}, 'https://example.com/own', '自己的事件', now(), now(), 'none', 'analyzed', 'complete')`;
  await sql`INSERT INTO stories (public_id, title, first_report_at, latest_at, origin)
    VALUES (${publicId}, '引擎自己归的事件', now(), now(), 'model')`;

  const result = await importEvent({
    publicId,
    title: "镜像想改的标题",
    firstReportAt: new Date(),
    latestAt: new Date(),
    digest: "镜像想写的综述",
    members: [{ articleId, role: "primary", observedAt: new Date() }],
  });
  assert.equal(result.status, "owned");
  assert.equal(result.storyId, null);
  const [kept] = await sql<{ title: string; digest: string | null }[]>`SELECT title, digest FROM stories WHERE public_id = ${publicId}`;
  assert.equal(kept.title, "引擎自己归的事件");
  assert.equal(kept.digest, null);
});

test("an event member the site does not hold yet arrives as an ordinary pool item, never as selected", async () => {
  const publicId = randomUUID();
  const now = new Date();
  const fresh = report(9, `来源丙 ${T}`, new Date(now.getTime() - 3600_000));
  const also = report(10, `来源丁 ${T}`, new Date(now.getTime() - 7200_000));
  const topic: AihotHotTopics = {
    schemaVersion: 1,
    count: 1,
    items: [{ rank: 1, id: fresh.id, title: "新事件", links: { aihot: `https://aihot.news/items/${fresh.id}`, story: `https://aihot.virxact.com/story/${publicId}` } }],
  };
  const story: AihotStoryDetail = { publicId, title: "新事件", firstReportAt: also.at.toISOString(), latestAt: fresh.at.toISOString(), reports: [fresh.aihot, also.aihot] };
  const summary = await syncEvents(fakeClient({ "/api/v1/hot-topics": topic, [`/api/v1/stories/${publicId}`]: { story } }));
  assert.equal(summary.created, 1);

  const [article] = await sql<{ id: string; processing_state: string }[]>`
    SELECT a.id, a.processing_state FROM articles a WHERE a.url = ${`https://example.com/${fresh.id}`}`;
  assert.ok(article, "the missing report was imported as an article");
  assert.equal(article!.processing_state, "analyzed");
  const [publication] = await sql<{ selected: boolean; eligible: boolean }[]>`
    SELECT selected, eligible FROM publications WHERE article_id = ${article!.id}`;
  assert.equal(publication.selected, false);
  assert.equal(publication.eligible, true);
  const [analysis] = await sql<{ origin: string; selected: boolean }[]>`
    SELECT origin, selected FROM analyses WHERE article_id = ${article!.id}`;
  assert.equal(analysis.origin, "replay");
  assert.equal(analysis.selected, false);
});

test("re-importing the same event keeps one story, one fact and one digest row", async () => {
  const publicId = randomUUID();
  const now = new Date();
  const one = report(21, `来源戊 ${T}`, new Date(now.getTime() - 3600_000));
  const two = report(22, `来源己 ${T}`, new Date(now.getTime() - 1800_000));
  const topic: AihotHotTopics = {
    schemaVersion: 1,
    count: 1,
    items: [{ rank: 1, id: one.id, title: "重复事件", links: { aihot: `https://aihot.news/items/${one.id}`, story: `https://aihot.virxact.com/story/${publicId}` } }],
  };
  const story: AihotStoryDetail = { publicId, title: "重复事件", firstReportAt: one.at.toISOString(), latestAt: two.at.toISOString(), digest: "第一版综述", reports: [two.aihot, one.aihot] };
  const client = fakeClient({ "/api/v1/hot-topics": topic, [`/api/v1/stories/${publicId}`]: { story } });
  assert.equal((await syncEvents(client)).created, 1);
  assert.equal((await syncEvents(client)).updated, 1);

  const [counts] = await sql<{ stories: number; facts: number; digests: number }[]>`
    SELECT (SELECT count(*)::int FROM stories WHERE public_id = ${publicId}) AS stories,
           (SELECT count(*)::int FROM facts WHERE public_id = ${`${publicId}:1`}) AS facts,
           (SELECT count(*)::int FROM story_digests sd JOIN stories s ON s.id = sd.story_id WHERE s.public_id = ${publicId}) AS digests`;
  assert.deepEqual([counts!.stories, counts!.facts, counts!.digests], [1, 1, 1]);
  const detail = await loadStoryDetail(Number((await sql<{ id: string }[]>`SELECT id::text FROM stories WHERE public_id = ${publicId}`)[0]!.id));
  assert.equal(detail!.digest, "第一版综述");
});
