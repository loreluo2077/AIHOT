// What a run writes and what the page reads, on a database of its own. The sources are handed in as
// snapshots: no test here touches the network.
import { tag } from "../../../tests/setup.ts";
import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { closeDb, sql } from "@aihot/backend/db";
import { recordFailure, storeSource } from "../backend/import.ts";
import { leaderboardPayload } from "../backend/read.ts";
import type { SourceSnapshot } from "../backend/sources.ts";

const T = tag();

after(async () => {
  await closeDb();
});

// Each test starts from an empty module: the main table is whichever benchmark this test wrote.
beforeEach(async () => {
  await sql`DELETE FROM leaderboard_scores`;
  await sql`DELETE FROM leaderboard_sources`;
  await sql`DELETE FROM leaderboard_models`;
});

function scores(sourceKey: string, count: number, prefix: string): SourceSnapshot {
  return {
    key: sourceKey,
    label: `测试基准 ${sourceKey}`,
    url: `https://benchmark.example/${sourceKey}`,
    licence: "测试数据",
    snapshot: "2026-01-01",
    models: [],
    scores: Array.from({ length: count }, (_, index) => [
      { modelKey: `${prefix}-${index}`, modelLabel: `${prefix}-${index}`, metricKey: "task-a", metricLabel: "task-a", metricGroup: "推理", value: 70 + index },
      { modelKey: `${prefix}-${index}`, modelLabel: `${prefix}-${index}`, metricKey: "overall", metricLabel: "综合", metricGroup: "总体", value: 68 + index, isOverall: true },
    ]).flat(),
  };
}

test("a benchmark's scores are stored, the overall row kept apart, and the page reads them ranked", async () => {
  const source = `${T}-bench`;
  const stored = await storeSource(scores(source, 6, `${T}m`));
  assert.equal(stored.scores, 12);

  const payload = await leaderboardPayload();
  const benchmark = payload.benchmark;
  assert.ok(benchmark, "the source drives the main table");
  assert.equal(benchmark!.sourceKey, source);
  assert.deepEqual(benchmark!.columns.map((column) => column.label), ["综合", "推理"]);
  assert.equal(benchmark!.rows.length, 6);
  assert.equal(benchmark!.rows[0]!.overall, 73);
  assert.equal(benchmark!.rows[0]!.rank, 1);
  assert.equal(benchmark!.rows[5]!.rank, 6);
  assert.equal(benchmark!.rows[0]!.scores["group:推理"], 75, "the top row is the highest overall, and its category sits beside it");
  assert.equal(benchmark!.rows[5]!.overall, 68);
  assert.equal(benchmark!.matched, 0, "nothing in the catalogue to match yet");
  assert.deepEqual(payload.tables, [], "the only source is the main table");
  const sourceView = payload.sources.find((entry) => entry.key === source);
  assert.equal(sourceView?.snapshot, "2026-01-01");
  assert.equal(sourceView?.error, null);
  assert.equal(sourceView?.licence, "测试数据");
});

test("a source that is read again replaces its own ranking and nothing else", async () => {
  const source = `${T}-refresh`;
  const mine = `${T}a`;
  const theirs = `${T}b`;
  await storeSource(scores(source, 6, mine));
  await storeSource(scores(theirs, 6, `${T}other`));

  const shortened = scores(source, 6, mine);
  shortened.scores = shortened.scores.slice(0, 4);
  shortened.snapshot = "2026-02-02";
  await storeSource(shortened);

  const rows = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM leaderboard_scores WHERE source_key = ${source}`;
  assert.equal(rows[0]!.n, 4);
  const other = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM leaderboard_scores WHERE source_key = ${theirs}`;
  assert.equal(other[0]!.n, 12, "another source's ranking is untouched");
  const [view] = await sql<{ snapshot: string }[]>`SELECT snapshot FROM leaderboard_sources WHERE key = ${source}`;
  assert.equal(view!.snapshot, "2026-02-02");
});

test("the catalogue's release date and price land on the benchmark's rows by name", async () => {
  const source = `${T}-join`;
  const catalogue = `${T}-catalogue-join`;
  await storeSource({
    key: catalogue,
    label: "测试目录",
    url: "https://catalogue.example",
    licence: "",
    snapshot: null,
    models: [
      { modelKey: `${T}m-0`, name: "Acme Opus 5.5", vendor: "acme", releasedAt: new Date("2026-03-04T00:00:00Z"), contextLength: 200000, priceIn: 2.5, priceOut: 10, modality: "text->text", catalogueUrl: "https://catalogue.example/acme" },
      { modelKey: `${T}m-1`, name: "Acme Mini", vendor: "acme", releasedAt: new Date("2026-02-02T00:00:00Z"), contextLength: 32000, priceIn: 0, priceOut: 0, modality: "text->text", catalogueUrl: "https://catalogue.example/mini" },
    ],
    scores: [],
  });
  // The benchmark names a run setting of the same model ("-max-effort", "-thinking"), not another model.
  await storeSource({
    key: source,
    label: "测试基准",
    url: "https://benchmark.example",
    licence: "",
    snapshot: null,
    models: [],
    scores: [0, 1, 2, 3, 4, 5].map((index) => ({
      modelKey: `${T}m-${index}${index < 2 ? (index === 0 ? "-max-effort" : "-thinking") : ""}`,
      modelLabel: `${T}m-${index}`,
      metricKey: "overall",
      metricLabel: "综合",
      metricGroup: "总体",
      value: 90 - index,
      isOverall: true,
    })),
  });

  const benchmark = (await leaderboardPayload()).benchmark;
  assert.equal(benchmark?.sourceKey, source);
  assert.equal(benchmark!.rows.length, 6);
  assert.equal(benchmark!.matched, 2);
  const top = benchmark!.rows[0]!;
  assert.equal(top.catalogueName, "Acme Opus 5.5");
  assert.equal(top.priceIn, 2.5);
  assert.equal(top.priceOut, 10);
  assert.ok(top.releasedAt?.startsWith("2026-03-04"));
  assert.equal(top.url, "https://catalogue.example/acme");
  assert.equal(benchmark!.rows[1]!.priceIn, 0, "a free model is not an unknown price");
  assert.equal(benchmark!.rows[2]!.priceIn, null, "a model the catalogue does not list shows nothing");
  assert.equal(benchmark!.rows[2]!.catalogueName, null);
});

test("a catalogue row keeps what an earlier source knew, and a failure keeps the last good ranking", async () => {
  const key = `${T}-model`;
  await storeSource({
    key: `${T}-catalogue`,
    label: "测试目录",
    url: "https://catalogue.example",
    licence: "",
    snapshot: null,
    models: [{ modelKey: key, name: "测试模型", vendor: "acme", releasedAt: new Date("2026-01-02T00:00:00Z"), contextLength: 128000, priceIn: 1.5, priceOut: 6, modality: "text->text", catalogueUrl: "https://catalogue.example/x" }],
    scores: [],
  });
  // A later source knows the model but no prices: what the first one knew has to survive.
  await storeSource({ key: `${T}-benchmark`, label: "测试基准", url: "https://benchmark.example", licence: "", snapshot: null, models: [{ modelKey: key, name: "测试模型", priceIn: null, priceOut: null }], scores: [] });

  const payload = await leaderboardPayload();
  const row = payload.catalogue.find((entry) => entry.modelKey === key);
  assert.equal(row?.priceIn, 1.5);
  assert.equal(row?.contextLength, 128000);
  assert.equal(row?.vendor, "acme");
  assert.ok(row?.releasedAt?.startsWith("2026-01-02"));

  const source = `${T}-broken`;
  await storeSource(scores(source, 6, `${T}good`));
  await recordFailure({ key: source, label: "测试基准 broken", url: "https://benchmark.example" }, "读取超时");
  const after = await leaderboardPayload();
  const broken = after.sources.find((entry) => entry.key === source);
  assert.equal(broken?.error, "读取超时");
  assert.equal(broken?.scores, 12, "its last ranking is still stored after the failure");
  assert.equal((await sql<{ fetched_at: Date | null }[]>`SELECT fetched_at FROM leaderboard_sources WHERE key = ${source}`)[0]!.fetched_at !== null, true);
});
