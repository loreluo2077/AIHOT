// The detail lane on a database of its own: an item's two renderings land where this site keeps each
// kind of text, the imported judgement survives the revision the body forces, and none of it becomes
// public — the mirrored source keeps site_fulltext off, so the exits still read summary + link.
import { tag } from "../../../tests/setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { closeDb, sql } from "@aihot/backend/db";
import { stopBoss } from "@aihot/backend/jobs/queue";
import { AihotHttpError, type AihotClient } from "../backend/client.ts";
import { syncDetails } from "../backend/detail.ts";
import { importItem } from "../backend/import.ts";
import type { AihotItem } from "../backend/types.ts";

const T = tag();
let n = 0;

function item(overrides: Partial<AihotItem> = {}): AihotItem {
  n++;
  const id = `${T}d${n}`;
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

/** A page like theirs: the site's own marker, chrome, and a single `div.prose` holding the text. */
function page(text: string): string {
  return `<html><head><meta name="aihot-release" content="20261008060016-ea6464dab4"></head><body><nav>精选</nav><div class="prose"><p>${text}</p></div><footer>京ICP备</footer></body></html>`;
}

/** Their bot wall: a 200, in place of the page, carrying none of the page's own markup. */
const botWall = '<script>document.cookie="__tst_status="+1;setTimeout(function(){location.href=location.href.replace(/[?|&]tads/,"")},0x4b0)</script>';

/** One client for both entrances: JSON for the API, HTML for the pages, by address. */
function client(get: (path: string) => unknown, pages: Record<string, string | Error>): AihotClient {
  return {
    async get<T>(path: string) {
      return { data: (get(path) ?? null) as T | null, notModified: false, etag: null };
    },
    async text(path: string) {
      const page = pages[path];
      if (page === undefined) throw new AihotHttpError(404, `${path}: 404`);
      if (page instanceof Error) throw page;
      return { html: page, notModified: false, etag: null };
    },
  };
}

async function importOne(overrides: Partial<AihotItem> = {}) {
  const source = item(overrides);
  const outcome = await importItem(source);
  assert.ok(outcome.articleId, outcome.reason ?? "no article id");
  return { source, articleId: outcome.articleId! };
}

after(async () => {
  await stopBoss();
  await closeDb();
});

test("both renderings are stored, the judgement survives the revision, and neither becomes public", async () => {
  const { source, articleId } = await importOne();
  const c = client(() => null, {
    [`/items/${source.id}/original`]: page("Today, Waymo closed a $5 billion term loan, marking our first debt financing and an important step in our evolution into a scaling commercial enterprise. PIMCO, Blackstone, and Sixth Street participated as lead syndicated lenders."),
    [`/items/${source.id}`]: page("今天，Waymo 完成了一笔 50 亿美元的定期贷款，这是我们首次进行债务融资，也是我们向规模化商业企业演进的重要一步。PIMCO、Blackstone 与 Sixth Street 作为牵头银团贷款方参与。"),
  });
  const summary = await syncDetails(c);
  assert.equal(summary.fetched, 1);
  assert.equal(summary.updated, 1);
  assert.equal(summary.failed, 0);

  const [article] = await sql<{ revision: number; body_status: string; body_text: string; body_html: string; processing_state: string; grouping_status: string }[]>`
    SELECT revision, body_status, body_text, body_html, processing_state, grouping_status FROM articles WHERE id = ${articleId}`;
  assert.equal(article.body_status, "ok");
  assert.equal(article.revision, 2);
  assert.match(article.body_text, /Today, Waymo closed a \$5 billion term loan/);
  assert.match(article.body_html, /<p>Today, Waymo closed/);
  // A body is a revision, and a revision sends an article back to the paid analysers: this module must
  // leave it settled as analysed instead.
  assert.equal(article.processing_state, "analyzed");
  assert.equal(article.grouping_status, "complete");

  const [translation] = await sql<{ revision: number; origin: string; body_text: string }[]>`
    SELECT revision, origin, body_text FROM translations WHERE article_id = ${articleId} AND lang = 'zh'`;
  assert.equal(translation.origin, "replay");
  assert.equal(translation.revision, 2);
  assert.match(translation.body_text, /完成了一笔 50 亿美元的定期贷款/);

  // The judgement arrived with the item: one analysis, now stamped with the revision the body created.
  const analyses = await sql<{ input_revision: number; selected: boolean; title_zh: string; score: string }[]>`
    SELECT input_revision, selected, title_zh, score::text FROM analyses WHERE article_id = ${articleId} ORDER BY input_revision`;
  assert.equal(analyses.length, 2);
  assert.equal(analyses[1]!.input_revision, 2);
  assert.equal(analyses[1]!.selected, true);
  assert.equal(analyses[1]!.title_zh, source.title);

  const [publication] = await sql<{ selected: boolean; visibility: string; body_mode: string; syndicate: boolean }[]>`
    SELECT selected, visibility, body_mode, syndicate FROM publications WHERE article_id = ${articleId}`;
  assert.equal(publication.selected, true);
  assert.equal(publication.visibility, "public");
  assert.equal(publication.body_mode, "summary");
  assert.equal(publication.syndicate, false);

  // Caught up: a second run has nothing left to fetch.
  const again = await syncDetails(client(() => null, {}));
  assert.equal(again.fetched, 0);
});

test("an item AIHOT holds no text for is recorded as such, and not asked for again", async () => {
  const { source, articleId } = await importOne();
  let asked = 0;
  const c = client(() => null, {});
  const counting: AihotClient = {
    get: c.get,
    async text(path: string) {
      asked++;
      return { html: page(""), notModified: false, etag: null };
    },
  };
  const summary = await syncDetails(counting);
  assert.equal(summary.skipped, 1);
  assert.ok(asked >= 2);
  const [article] = await sql<{ body_status: string }[]>`SELECT body_status FROM articles WHERE id = ${articleId}`;
  assert.equal(article.body_status, "unconfirmed");

  const before = asked;
  await syncDetails(counting);
  assert.equal(asked, before, "an item with no text stayed a candidate");
  assert.ok(source.id);
});

test("a page their limiter refuses leaves the item a candidate for the next run", async () => {
  const { source, articleId } = await importOne();
  const refused = client(() => null, {
    [`/items/${source.id}/original`]: new AihotHttpError(403, "403"),
    [`/items/${source.id}`]: new AihotHttpError(403, "403"),
  });
  const summary = await syncDetails(refused);
  // Nothing was read, so the run says so instead of reporting a quiet success — but nothing is written off.
  assert.equal(summary.failed, 1);
  assert.match(String((summary.detail as { error?: string }).error), /not one page could be read/);
  assert.equal(summary.updated, 0);
  const [article] = await sql<{ body_status: string }[]>`SELECT body_status FROM articles WHERE id = ${articleId}`;
  assert.equal(article.body_status, "none");

  let asked = 0;
  const page404 = client(() => null, {});
  const counting: AihotClient = {
    get: page404.get,
    async text(path: string) {
      asked++;
      return { html: page("Today, the source published this article and the text is here."), notModified: false, etag: null };
    },
  };
  const next = await syncDetails(counting);
  assert.ok(next.fetched >= 1, "a refused page must not cost the item its place in the queue");
  assert.ok(asked > 0);
});

test("an item whose source-language page does not exist keeps AIHOT's own text as the body", async () => {
  const { source, articleId } = await importOne();
  const c = client(() => null, { [`/items/${source.id}`]: page("这是 AIHOT 自己写的中文正文，原文页面不存在时它就是这个条目的正文。") });
  const summary = await syncDetails(c);
  assert.equal(summary.updated, 1);
  const [article] = await sql<{ body_status: string; body_text: string }[]>`
    SELECT body_status, body_text FROM articles WHERE id = ${articleId}`;
  assert.equal(article.body_status, "ok");
  assert.match(article.body_text, /这是 AIHOT 自己写的中文正文/);
  const [translations] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM translations WHERE article_id = ${articleId}`;
  assert.equal(translations.n, 0);
});

test("their bot wall is not an answer: the item is not written off, and is asked for again", async () => {
  const { source, articleId } = await importOne();
  const walled = client(() => null, {
    [`/items/${source.id}/original`]: botWall,
    [`/items/${source.id}`]: botWall,
  });
  const summary = await syncDetails(walled);
  // A wall is not this module's bug, but a run that read nothing is reported rather than recorded as ok.
  assert.equal(summary.failed, 1);
  assert.equal(summary.skipped, summary.fetched);
  const [article] = await sql<{ body_status: string }[]>`SELECT body_status FROM articles WHERE id = ${articleId}`;
  assert.equal(article.body_status, "none", "a walled page must not be read as 'AIHOT has no text'");

  // A run after the wall: the same item is still a candidate, and now it lands.
  const through = client(() => null, {
    [`/items/${source.id}/original`]: page("Today, the source published this article and here is its text."),
    [`/items/${source.id}`]: page("今天，来源发布了这篇文章，这里是它的正文。"),
  });
  const next = await syncDetails(through);
  assert.equal(next.fetched, 1);
  assert.equal(next.updated, 1);
});

test("when no page is one of theirs any more, the run reports it instead of stalling in silence", async () => {
  const { source, articleId } = await importOne();
  const c = client(() => null, {
    [`/items/${source.id}/original`]: "<html><body>一个完全不同的页面</body></html>",
    [`/items/${source.id}`]: "<html><body>一个完全不同的页面</body></html>",
  });
  const summary = await syncDetails(c);
  assert.equal(summary.failed, 1);
  assert.match(String((summary.detail as { error?: string }).error), /markup changed/);
  const [article] = await sql<{ body_status: string }[]>`SELECT body_status FROM articles WHERE id = ${articleId}`;
  assert.equal(article.body_status, "none");
});
