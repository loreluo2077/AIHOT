// What the page and the API answer with: one ranked table the way this site publishes a leaderboard —
// the benchmark's own overall row, its own categories beside it, and the catalogue's release date and
// price joined onto the same row — plus the sources behind every column.
import { sql, type Db } from "@aihot/backend/db";
import { LEADERBOARD } from "../config.ts";
import { matchCatalogue, matchIndex, type CatalogueEntry } from "./match.ts";
import type { BenchmarkColumn, BenchmarkRow, BenchmarkView, BenchmarkTable, CatalogueRow, LeaderboardPayload, RankedRow, SourceView } from "../types.ts";

interface ScoreRow {
  source_key: string;
  model_key: string;
  model_label: string;
  value: string;
  source_url: string;
}

interface GroupRow extends ScoreRow {
  metric_group: string;
}

interface CatalogueQueryRow {
  model_key: string;
  name: string;
  vendor: string | null;
  released_at: Date | null;
  context_length: number | null;
  price_in: string | null;
  price_out: string | null;
  modality: string | null;
  catalogue_url: string | null;
}

export async function leaderboardPayload(db: Db = sql): Promise<LeaderboardPayload> {
  const [sources, overall, groups, catalogue] = await Promise.all([
    db<Array<{ key: string; label: string; url: string; licence: string | null; snapshot: string | null; fetched_at: Date | null; last_ok_at: Date | null; last_error: string | null; models: number; scores: number }>>`
      SELECT key, label, url, licence, snapshot, fetched_at, last_ok_at, last_error, models, scores
      FROM leaderboard_sources ORDER BY label`,
    db<ScoreRow[]>`
      SELECT source_key, model_key, model_label, value, source_url
      FROM leaderboard_scores WHERE is_overall ORDER BY source_key, value DESC`,
    db<GroupRow[]>`
      SELECT source_key, metric_group, model_key, max(model_label) AS model_label, avg(value) AS value, max(source_url) AS source_url
      FROM leaderboard_scores WHERE NOT is_overall
      GROUP BY source_key, metric_group, model_key
      ORDER BY source_key, metric_group, value DESC`,
    db<CatalogueQueryRow[]>`
      SELECT model_key, name, vendor, released_at, context_length, price_in, price_out, modality, catalogue_url
      FROM leaderboard_models ORDER BY released_at DESC NULLS LAST`,
  ]);

  const enough = (count: number) => count >= LEADERBOARD.minModelsPerMetric;
  const sourceOf = new Map(sources.map((source) => [source.key, source]));

  // The main table: the source the site picked, else the first that publishes an overall score.
  const overallBySource = new Map<string, ScoreRow[]>();
  for (const row of overall) overallBySource.set(row.source_key, [...(overallBySource.get(row.source_key) ?? []), row]);
  const primaryKey =
    (LEADERBOARD.primarySource && enough(overallBySource.get(LEADERBOARD.primarySource)?.length ?? 0) ? LEADERBOARD.primarySource : null) ??
    sources.map((source) => source.key).find((key) => enough(overallBySource.get(key)?.length ?? 0)) ??
    null;

  const catalogueRows: CatalogueRow[] = catalogue.map((row) => ({
    modelKey: row.model_key,
    name: row.name,
    vendor: row.vendor,
    releasedAt: row.released_at?.toISOString() ?? null,
    contextLength: row.context_length,
    priceIn: row.price_in === null ? null : Number(row.price_in),
    priceOut: row.price_out === null ? null : Number(row.price_out),
    modality: row.modality,
    url: row.catalogue_url,
  }));

  const benchmark = primaryKey ? buildBenchmark(primaryKey, overallBySource.get(primaryKey) ?? [], groups, sourceOf, catalogueRows) : null;

  return {
    generatedAt: new Date().toISOString(),
    title: LEADERBOARD.title,
    description: LEADERBOARD.description,
    sources: sources.map(
      (source): SourceView => ({
        key: source.key,
        label: source.label,
        url: source.url,
        licence: source.licence ?? "",
        snapshot: source.snapshot,
        fetchedAt: source.fetched_at?.toISOString() ?? null,
        lastOkAt: source.last_ok_at?.toISOString() ?? null,
        error: source.last_error,
        models: source.models,
        scores: source.scores,
      }),
    ),
    benchmark,
    // Every other source keeps the per-category tables it published, so a second benchmark is not lost.
    tables: sources
      .filter((source) => source.key !== primaryKey && enough(overallBySource.get(source.key)?.length ?? 0))
      .map((source) => tableOf(source, "overall", "综合", "总体", true, overallBySource.get(source.key) ?? [])),
    catalogue: catalogueRows.slice(0, LEADERBOARD.catalogueRows),
    catalogueSource: sourceOf.has("openrouter") ? { label: sourceOf.get("openrouter")!.label, url: sourceOf.get("openrouter")!.url } : null,
  };
}

function buildBenchmark(
  sourceKey: string,
  overall: ScoreRow[],
  groups: GroupRow[],
  sourceOf: Map<string, { label: string; url: string; licence: string | null; snapshot: string | null }>,
  catalogue: CatalogueRow[],
): BenchmarkView {
  const source = sourceOf.get(sourceKey);
  const rank = (order: string[]) => (name: string) => {
    const at = order.indexOf(name);
    return at < 0 ? order.length : at;
  };
  const ordered = rank(LEADERBOARD.domainOrder);
  const groupNames = [...new Set(groups.filter((row) => row.source_key === sourceKey).map((row) => row.metric_group))].sort((a, b) => ordered(a) - ordered(b) || a.localeCompare(b, "zh"));
  const columns: BenchmarkColumn[] = [
    { key: "overall", label: "综合", group: "总体", overall: true },
    ...groupNames
      .filter((group) => (groups.filter((row) => row.source_key === sourceKey && row.metric_group === group).length ?? 0) >= LEADERBOARD.minModelsPerMetric)
      .map((group) => ({ key: `group:${group}`, label: group, group, overall: false })),
  ];

  const index = matchIndex(catalogue.map((entry): CatalogueEntry => ({ key: entry.modelKey, name: entry.name })));
  const byKey = new Map(catalogue.map((entry) => [entry.modelKey, entry]));
  const groupOf = new Map<string, Map<string, number>>();
  for (const row of groups) {
    if (row.source_key !== sourceKey) continue;
    const forModel = groupOf.get(row.model_key) ?? new Map<string, number>();
    forModel.set(row.metric_group, Number(row.value));
    groupOf.set(row.model_key, forModel);
  }

  let matched = 0;
  const rows: BenchmarkRow[] = overall.slice(0, LEADERBOARD.rowsPerMetric).map((row, position) => {
    const entry = matchCatalogue(row.model_key, index, LEADERBOARD.modelAliases);
    const catalogueRow = entry ? byKey.get(entry.key) : undefined;
    if (catalogueRow) matched++;
    const scores: Record<string, number> = {};
    const values = groupOf.get(row.model_key);
    if (values) for (const [group, value] of values) scores[`group:${group}`] = Math.round(value * 100) / 100;
    return {
      rank: position + 1,
      modelKey: row.model_key,
      model: row.model_label,
      overall: Math.round(Number(row.value) * 100) / 100,
      scores,
      catalogueName: catalogueRow?.name ?? null,
      releasedAt: catalogueRow?.releasedAt ?? null,
      priceIn: catalogueRow?.priceIn ?? null,
      priceOut: catalogueRow?.priceOut ?? null,
      modality: catalogueRow?.modality ?? null,
      url: catalogueRow?.url ?? null,
    };
  });

  return {
    sourceKey,
    sourceLabel: source?.label ?? sourceKey,
    sourceUrl: source?.url ?? "",
    licence: source?.licence ?? "",
    snapshot: source?.snapshot ?? null,
    columns,
    rows,
    matched,
  };
}

function tableOf(source: { key: string; label: string; url: string }, metricKey: string, label: string, group: string, overall: boolean, rows: ScoreRow[]): BenchmarkTable {
  return {
    sourceKey: source.key,
    sourceLabel: source.label,
    sourceUrl: source.url,
    metricKey,
    label,
    group,
    overall,
    rows: rows.slice(0, LEADERBOARD.rowsPerMetric).map(
      (row, index): RankedRow => ({ rank: index + 1, modelKey: row.model_key, model: row.model_label, value: Math.round(Number(row.value) * 100) / 100 }),
    ),
  };
}
