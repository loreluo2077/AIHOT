// What the bridge writes, on a database of its own: an imported item becomes public through the same
// projection every other report uses, a withdrawal there takes it out of the selected set without
// taking the article away, and an issue is written once and only ever revised by this module.
// The network is never touched: the sync functions take a client, and these tests hand them a fake.
import { tag } from "../../../tests/setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { closeDb, sql } from "@aihot/backend/db";
import { stopBoss } from "@aihot/backend/jobs/queue";
import { dailyIssuesBetween, importItem, importReport, lookupFor, removeItem } from "../backend/import.ts";
import { dailyContent, sourceIdFor } from "../backend/mapping.ts";
import { syncChanges, syncItems, syncReports } from "../backend/sync.ts";
import { AihotHttpError, type AihotAnswer, type AihotClient } from "../backend/client.ts";
import type { AihotChanges, AihotDailyIndex, AihotDailyReport, AihotItem, AihotItemsPage, AihotPeriodIndex, AihotSnapshot } from "../backend/types.ts";

const T = tag();
let n = 0;

function item(overrides: Partial<AihotItem> = {}): AihotItem {
  n++;
  const id = `${T}item${n}`;
  return {
    id,
    title: `标题 ${id}`,
    originalTitle: `Original ${id}`,
    summary: `摘要 ${id}`,
    reason: `理由 ${id}`,
    score: 70 + n,
    category: "ai-models",
    selected: true,
    source: { name: `测试来源 ${T}` },
    links: { aihot: `https://aihot.news/items/${id}`, original: `https://example.com/${id}` },
    publishedAt: new Date(Date.now() - 3600_000).toISOString(),
    ...overrides,
  };
}

/** A client answering from memory, so the sync's own logic is what is under test. */
function fakeClient(answer: (path: string, query: Record<string, unknown>) => unknown, pages: (path: string) => string | null = () => null): AihotClient {
  return {
    async get<T>(path: string, query: Record<string, string | number | null | undefined> = {}): Promise<AihotAnswer<T>> {
      const data = answer(path, query);
      return { data: (data ?? null) as T | null, notModified: false, etag: null };
    },
    async text(path: string) {
      const html = pages(path);
      if (html === null) throw new AihotHttpError(404, `${path}: 404`);
      return { html, notModified: false, etag: null };
    },
  };
}

/** Answers by address: an exact key first, then the longest prefix, so `/dailies` never swallows `/dailies/<date>`. */
function routesClient(routes: Record<string, unknown>): AihotClient {
  return fakeClient((path) => {
    if (path in routes) return routes[path];
    const hit = Object.keys(routes).filter((key) => path.startsWith(`${key}/`)).sort((a, b) => b.length - a.length)[0];
    return hit ? routes[hit] : null;
  });
}

async function importOne(overrides: Partial<AihotItem> = {}) {
  const source = item(overrides);
  const outcome = await importItem(source);
  assert.ok(outcome.articleId, outcome.reason ?? "no article id");
  return { source, articleId: outcome.articleId!, outcome };
}

after(async () => {
  await stopBoss();
  await closeDb();
});

test("an imported item becomes a public, selected article without any model call", async () => {
  const { source, articleId, outcome } = await importOne();
  assert.equal(outcome.status, "created");

  const [article] = await sql<{ processing_state: string; grouping_status: string; body_status: string; url: string; source_id: string; backfill: boolean; identity_key: string }[]>`
    SELECT processing_state, grouping_status, body_status, url, source_id, backfill, identity_key FROM articles WHERE id = ${articleId}`;
  assert.equal(article.processing_state, "analyzed");
  assert.equal(article.grouping_status, "complete");
  assert.equal(article.body_status, "none");
  assert.equal(article.url, source.links.original);
  assert.equal(article.source_id, sourceIdFor("测试来源 " + T));

  const [analysis] = await sql<{ origin: string; selected: boolean; score: string; title_zh: string; summary_zh: string; reason_zh: string; category: string; relevance: string }[]>`
    SELECT origin, selected, score::text, title_zh, summary_zh, reason_zh, category, relevance FROM analyses WHERE article_id = ${articleId}`;
  assert.equal(analysis.origin, "replay");
  assert.equal(analysis.selected, true);
  assert.equal(Number(analysis.score), source.score);
  assert.equal(analysis.title_zh, source.title);
  assert.equal(analysis.summary_zh, source.summary);
  assert.equal(analysis.reason_zh, source.reason);
  assert.equal(analysis.category, "ai-models");
  assert.equal(analysis.relevance, "pass");

  const [publication] = await sql<{ selected: boolean; eligible: boolean; visibility: string; seat: boolean; summary: string; reason: string; source_id: string; body_mode: string; syndicate: boolean }[]>`
    SELECT selected, eligible, visibility, seat, summary, reason, source_id, body_mode, syndicate FROM publications WHERE article_id = ${articleId}`;
  assert.equal(publication.selected, true);
  assert.equal(publication.eligible, true);
  assert.equal(publication.visibility, "public");
  assert.equal(publication.seat, true);
  assert.equal(publication.summary, source.summary);
  assert.equal(publication.reason, source.reason);
  assert.equal(publication.body_mode, "summary");
  assert.equal(publication.syndicate, false);

  const [landing] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM aihot_bridge_items WHERE aihot_id = ${source.id} AND selected AND owned`;
  assert.equal(landing.n, 1);
  const [ledger] = await sql<{ op: string }[]>`SELECT op FROM selected_ledger WHERE article_id = ${articleId} ORDER BY seq DESC LIMIT 1`;
  assert.equal(ledger.op, "upsert");
});

test("re-importing nothing new changes nothing; a real change revises the analysis and the publication", async () => {
  const { source, articleId } = await importOne();
  assert.equal((await importItem(source)).status, "unchanged");
  const [before] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM analyses WHERE article_id = ${articleId}`;
  assert.equal(before.n, 1);

  const revised = { ...source, summary: "改过的摘要", score: 91 };
  assert.equal((await importItem(revised)).status, "updated");
  const [after] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM analyses WHERE article_id = ${articleId}`;
  assert.equal(after.n, 2);
  const [publication] = await sql<{ summary: string; score: string }[]>`SELECT summary, score::text FROM publications WHERE article_id = ${articleId}`;
  assert.equal(publication.summary, "改过的摘要");
  assert.equal(Number(publication.score), 91);
  const [hash] = await sql<{ payload_hash: string }[]>`SELECT payload_hash FROM aihot_bridge_items WHERE aihot_id = ${source.id}`;
  assert.notEqual(hash.payload_hash, "");
});

test("an article this site's own collectors found first is left to them", async () => {
  const mine = item();
  await sql`INSERT INTO sources (id, name, kind, tier, participation_mode, next_fetch_at)
    VALUES (${`mine-${T}`}, '我自己的信源', 'rss', 'T1', 'editorial', '2100-01-01')`;
  const { upsertMaterial } = await import("@aihot/backend/content/materials");
  const material = await upsertMaterial({ sourceId: `mine-${T}`, url: mine.links.original!, title: "我自己的标题", via: "fetch" });
  const outcome = await importItem(mine);
  assert.equal(outcome.status, "observed");
  assert.equal(outcome.articleId, material.articleId);
  const [analysis] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM analyses WHERE article_id = ${material.articleId}`;
  assert.equal(analysis.n, 0);
});

test("a withdrawal there takes the article out of the selected set, not off the site", async () => {
  const { source, articleId } = await importOne();
  const outcome = await removeItem(source.id);
  assert.equal(outcome.status, "updated");
  const [publication] = await sql<{ selected: boolean; eligible: boolean; visibility: string }[]>`
    SELECT selected, eligible, visibility FROM publications WHERE article_id = ${articleId}`;
  assert.equal(publication.selected, false);
  assert.equal(publication.eligible, true);
  assert.equal(publication.visibility, "public");
  const [ledger] = await sql<{ op: string }[]>`SELECT op FROM selected_ledger WHERE article_id = ${articleId} ORDER BY seq DESC LIMIT 1`;
  assert.equal(ledger.op, "remove");
  const [item] = await sql<{ selected: boolean }[]>`SELECT selected FROM aihot_bridge_items WHERE aihot_id = ${source.id}`;
  assert.equal(item.selected, false);
});

test("an issue is written once, revised when theirs changes, and never overwrites this site's own", async () => {
  const { source: reported } = await importOne();
  const date = "2026-09-30";
  const report: AihotDailyReport = {
    date,
    generatedAt: "2026-09-30T00:00:00.000Z",
    windowStart: "2026-09-29T00:00:00.000Z",
    windowEnd: "2026-09-30T00:00:00.000Z",
    lead: { title: "镜像头条", leadParagraph: "镜像导语" },
    sections: [{ label: "模型发布/更新", items: [{ title: "镜像头条", summary: "镜像摘要", source: { name: `测试来源 ${T}` }, links: { aihot: `https://aihot.news/items/${reported.id}`, original: "https://example.com/a" }, publishedAt: "2026-09-29T08:00:00.000Z" }] }],
    flashes: [],
  };
  const content = dailyContent(report, await lookupFor([reported.id]));
  const first = await importReport("daily", date, content, new Date(report.generatedAt));
  assert.equal(first.status, "created");
  const [row] = await sql<{ id: string; origin: string; revision: number; content: Record<string, unknown> }[]>`
    SELECT id, origin, revision, content FROM reports WHERE kind = 'daily' AND key = ${date}`;
  assert.equal(row.origin, "imported");
  assert.equal(row.revision, 1);
  assert.equal((row.content.lead as { title: string }).title, "镜像头条");

  assert.equal((await importReport("daily", date, content, new Date(report.generatedAt))).status, "unchanged");

  const revised = { ...content, lead: { title: "改过的头条", leadParagraph: "改过的导语" } };
  assert.equal((await importReport("daily", date, revised, new Date(report.generatedAt))).status, "updated");
  const [after] = await sql<{ revision: number }[]>`SELECT revision FROM reports WHERE kind = 'daily' AND key = ${date}`;
  assert.equal(after.revision, 2);
  const [revision] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM report_revisions WHERE report_id = ${row.id}`;
  assert.equal(revision.n, 1);

  const own = "2026-09-29";
  await sql`INSERT INTO reports (kind, key, window_start, window_end, content, generated_at, origin)
    VALUES ('daily', ${own}, now(), now(), ${sql.json({ mine: true })}, now(), 'model')`;
  assert.equal((await importReport("daily", own, content, new Date())).status, "skipped");
  const [kept] = await sql<{ content: { mine?: boolean } }[]>`SELECT content FROM reports WHERE kind = 'daily' AND key = ${own}`;
  assert.equal(kept.content.mine, true);
});

test("the items feed imports what is new and stops at what it already has", async () => {
  const older = item();
  const newer = item();
  const third = item();
  const page1: AihotItemsPage = { schemaVersion: 1, items: [newer, older], page: { count: 2, hasMore: true, nextCursor: "page-2" } };
  const page2: AihotItemsPage = { schemaVersion: 1, items: [third], page: { count: 1, hasMore: false, nextCursor: null } };
  const client = fakeClient((path, query) => (path === "/api/v1/items" ? (query.cursor === "page-2" ? page2 : page1) : null));
  // The first run walks the window to its end: nothing is known yet, so there is nowhere to stop.
  const first = await syncItems(client);
  assert.equal(first.created, 3);
  assert.equal(first.pages, 2);

  // Afterwards the first page already holds something imported: everything after it is older, so it stops.
  const second = await syncItems(client);
  assert.equal(second.created, 0);
  assert.equal(second.unchanged, 2);
  assert.equal(second.pages, 1);
});

test("the selection ledger is walked once, then followed: removals arrive as removals", async () => {
  const target = item();
  const snapshot: AihotSnapshot = { schemaVersion: 1, asOf: new Date().toISOString(), cursor: `cursor-${T}`, count: 1, hasMore: false, nextPage: null, items: [target] };
  const first = await syncChanges(routesClient({ "/api/v1/selected/snapshot": snapshot }));
  assert.equal(first.created, 1);

  const changes: AihotChanges = { schemaVersion: 1, cursor: `cursor2-${T}`, count: 1, hasMore: false, changes: [{ op: "remove", changedAt: new Date().toISOString(), id: target.id }] };
  const second = await syncChanges(routesClient({ "/api/v1/selected/changes": changes }));
  assert.equal(second.removed, 1);
  const [publication] = await sql<{ selected: boolean }[]>`SELECT selected FROM publications WHERE article_id = ${(await sql<{ article_id: string }[]>`SELECT article_id FROM aihot_bridge_items WHERE aihot_id = ${target.id}`)[0]!.article_id}`;
  assert.equal(publication.selected, false);
});

test("the report feeds import the newest issues, and count the dailies a period covers", async () => {
  const date = "2026-08-15";
  const report: AihotDailyReport = { date, generatedAt: "2026-08-15T00:00:00.000Z", sections: [], flashes: [], lead: { title: "旧日报", leadParagraph: "导语" } };
  const index: AihotDailyIndex = { schemaVersion: 1, count: 1, items: [{ date, generatedAt: report.generatedAt }] };
  const weeklies: AihotPeriodIndex = { schemaVersion: 1, count: 0, items: [] };
  const monthlies: AihotPeriodIndex = { schemaVersion: 1, count: 0, items: [] };
  const client = routesClient({
    "/api/v1/dailies": index,
    [`/api/v1/dailies/${date}`]: { report },
    "/api/v1/weeklies": weeklies,
    "/api/v1/monthlies": monthlies,
  });
  const summary = await syncReports(client);
  assert.equal(summary.created, 1);
  assert.equal(await dailyIssuesBetween("2026-08-01", "2026-08-31"), 1);
});
