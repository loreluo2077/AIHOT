// The shape rules of the bridge, without a database or a network call: what an AIHOT item becomes, and
// what an "issue" of theirs has to look like for this framework's report pages to read it.
import assert from "node:assert/strict";
import { test } from "node:test";
import { aihotIdFromUrl, canonicalJson, categoryFor, dailyContent, originalUrl, payloadHash, periodContent, sourceIdFor, storedSourceName } from "../backend/mapping.ts";
import type { BridgeLookup } from "../backend/mapping.ts";
import type { AihotDailyReport, AihotItem, AihotPeriodReport } from "../backend/types.ts";

const lookup: BridgeLookup = {
  articleId: (aihotId) => (aihotId === "known-item" ? "article-known" : null),
  sourceId: (name) => sourceIdFor(name),
};

function item(overrides: Partial<AihotItem> = {}): AihotItem {
  return {
    id: "known-item",
    title: "中文标题",
    originalTitle: "Original title",
    summary: "摘要",
    reason: "推荐理由",
    score: 72,
    category: "ai-models",
    selected: true,
    source: { name: "OpenAI：官网动态（RSS）" },
    links: { aihot: "https://aihot.news/items/known-item", original: "https://openai.com/index/x/" },
    publishedAt: "2026-10-01T08:00:00.000Z",
    ...overrides,
  };
}

test("an item's original link is what identifies it, and a missing one is refused", () => {
  assert.equal(originalUrl(item()), "https://openai.com/index/x/");
  assert.equal(originalUrl(item({ links: { aihot: "https://aihot.news/items/known-item" } })), null);
  assert.equal(originalUrl(item({ links: { original: "not a url" } })), null);
});

test("AIHOT item ids are read back out of the links inside a report", () => {
  assert.equal(aihotIdFromUrl("https://aihot.news/items/abc123"), "abc123");
  assert.equal(aihotIdFromUrl("https://aihot.news/items/abc123/"), "abc123");
  assert.equal(aihotIdFromUrl("https://aihot.news/daily/2026-10-07"), null);
  assert.equal(aihotIdFromUrl(null), null);
});

test("a source keeps its name and gets an id derived from it", () => {
  const name = "X：Google (@Google)";
  assert.equal(sourceIdFor(name), sourceIdFor(name));
  assert.notEqual(sourceIdFor(name), sourceIdFor("OpenAI：官网动态（RSS）"));
  assert.equal(storedSourceName("  spaced   name  "), "spaced name");
  assert.equal(storedSourceName("   "), "AIHOT");
});

test("the payload hash follows the editorial fields and nothing else", () => {
  const base = payloadHash(item());
  assert.equal(payloadHash(item()), base);
  assert.notEqual(payloadHash(item({ summary: "改了" })), base);
  assert.notEqual(payloadHash(item({ score: 73 })), base);
  assert.notEqual(payloadHash(item({ title: "换个标题" })), base);
  assert.equal(payloadHash(item({ discoveredAt: "2026-10-02T00:00:00.000Z" })), base);
});

test("categories can be pointed at this site's keys, and pass through otherwise", () => {
  assert.equal(categoryFor("ai-models"), "ai-models");
  assert.equal(categoryFor(null), null);
});

test("two issues are compared by content, not by the order their keys happened to be written in", () => {
  // Postgres jsonb returns keys in its own order: a round trip must not look like a change.
  assert.equal(canonicalJson({ b: 1, a: [{ d: 2, c: 3 }] }), canonicalJson({ a: [{ c: 3, d: 2 }], b: 1 }));
  assert.notEqual(canonicalJson({ a: 1 }), canonicalJson({ a: 2 }));
  assert.notEqual(canonicalJson({ a: [1, 2] }), canonicalJson({ a: [2, 1] }));
  assert.equal(canonicalJson(null), "null");
});

const daily: AihotDailyReport = {
  date: "2026-10-07",
  generatedAt: "2026-10-07T00:00:29.119Z",
  windowStart: "2026-10-06T00:00:00.000Z",
  windowEnd: "2026-10-07T00:00:00.000Z",
  links: { aihot: "https://aihot.news/daily/2026-10-07" },
  lead: { title: "头条标题", leadParagraph: "导语" },
  sections: [
    {
      label: "模型发布/更新",
      items: [
        { title: "头条标题", summary: "头条摘要", source: { name: "OpenAI：官网动态（RSS）" }, links: { aihot: "https://aihot.news/items/known-item", original: "https://openai.com/index/x/" }, publishedAt: "2026-10-01T08:00:00.000Z" },
        { title: "第二条", summary: "第二条摘要", source: { name: "The Verge：AI（RSS）" }, links: { aihot: "https://aihot.news/items/unknown-item", original: "https://theverge.com/x" }, publishedAt: "2026-10-02T08:00:00.000Z" },
      ],
    },
  ],
  flashes: [{ title: "快讯", summary: "快讯摘要", source: { name: "Hacker News：AI 热帖" }, links: { aihot: "https://aihot.news/items/known-item", original: "https://news.ycombinator.com/item" }, publishedAt: "2026-10-03T08:00:00.000Z" }],
};

test("a daily issue carries the entries, the lead, the flash line and the window the pages read", () => {
  const content = dailyContent(daily, lookup) as Record<string, any>;
  assert.equal(content.date, "2026-10-07");
  assert.equal(content.windowStart, "2026-10-06T00:00:00.000Z");
  assert.equal(content.windowEnd, "2026-10-07T00:00:00.000Z");
  assert.equal(content.lead.title, "头条标题");
  assert.equal(content.lead.leadParagraph, "导语");
  assert.equal(content.leadItemId, "article-known");
  assert.equal(content.sections.length, 1);
  assert.equal(content.sections[0].label, "模型发布/更新");
  assert.equal(content.sections[0].items.length, 2);
  assert.equal(content.sections[0].items[0].itemId, "article-known");
  assert.equal(content.sections[0].items[0].summary, "头条摘要");
  assert.equal(content.sections[0].items[0].sourceName, "OpenAI：官网动态（RSS）");
  assert.equal(content.sections[0].items[0].sourceId, sourceIdFor("OpenAI：官网动态（RSS）"));
  assert.equal(content.sections[0].items[0].sourceUrl, "https://openai.com/index/x/");
  assert.equal(content.sections[0].items[0].sources, 1);
  // An entry whose item was never imported stays readable, with no link into this site.
  assert.equal(content.sections[0].items[1].itemId, null);
  assert.equal(content.flashes.length, 1);
  assert.equal(content.metrics.totalEvents, 3);
  assert.deepEqual(content.highlights, ["第二条"]);
  // Whose work this is stays readable in the content: the framework's own attribution is the site's.
  assert.equal(content.bridge.aihotUrl, "https://aihot.news/daily/2026-10-07");
});

test("a period issue becomes themes, a story order and its own label", () => {
  const weekly: AihotPeriodReport = {
    week: "2026-W40",
    periodStart: "2026-09-28",
    periodEnd: "2026-10-04",
    generatedAt: "2026-10-05T02:00:27.342Z",
    windowStart: "2026-09-27T00:00:00.000Z",
    windowEnd: "2026-10-04T00:00:00.000Z",
    headline: "本周头条",
    overview: "总述",
    links: { aihot: "https://aihot.news/weekly/2026-W40" },
    sections: [{ label: "模型发布/更新", summary: "栏目导读", items: [{ title: "本周头条", summary: "摘要", source: { name: "OpenAI：官网动态（RSS）" }, links: { aihot: "https://aihot.news/items/known-item", original: "https://openai.com/index/x/" }, publishedAt: "2026-10-01T08:00:00.000Z" }] }],
  };
  const content = periodContent("weekly", weekly, lookup, 5) as Record<string, any>;
  assert.equal(content.kind, "weekly");
  assert.equal(content.isoLabel, "2026-W40");
  assert.equal(content.periodStart, "2026-09-28");
  assert.equal(content.periodEnd, "2026-10-04");
  assert.equal(content.headline, "本周头条");
  assert.equal(content.overview, "总述");
  assert.equal(content.themes[0].heading, "模型发布/更新");
  assert.equal(content.themes[0].summary, "栏目导读");
  assert.equal(content.themes[0].storyRefs[0].itemId, "article-known");
  assert.deepEqual(content.storyOrder, ["article-known"]);
  assert.equal(content.metrics.reportsCovered, 5);
  assert.equal(content.leadItemId, "article-known");
  assert.equal(content.bridge.aihotUrl, "https://aihot.news/weekly/2026-W40");
  assert.ok(String(content.title).includes("2026-W40"));

  const monthly = periodContent("monthly", { month: "2026-09", periodStart: "2026-09-01", periodEnd: "2026-09-30", generatedAt: "2026-10-01T00:00:00.000Z" }, lookup, 0) as Record<string, any>;
  assert.equal(monthly.kind, "monthly");
  assert.equal(monthly.monthLabel, "2026-09");
  assert.equal(monthly.themes.length, 0);
  assert.deepEqual(monthly.storyOrder, []);
});
