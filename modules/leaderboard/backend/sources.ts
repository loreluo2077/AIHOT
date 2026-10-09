// The sources this module reads, one adapter each. Every one of them is a published, machine-readable
// first-party artefact: a benchmark's own table in its own repository, a documented model API, or a file
// the operator points at. Nothing here scrapes a page, and nothing here guesses a metric it was not given.
import { readFile } from "node:fs/promises";
import { LEADERBOARD, type JsonSource } from "../config.ts";
import { cellNumber, modelKeyFor, parseCsv } from "./csv.ts";

export interface ModelRow {
  modelKey: string;
  name: string;
  vendor?: string | null;
  releasedAt?: Date | null;
  contextLength?: number | null;
  priceIn?: number | null;
  priceOut?: number | null;
  modality?: string | null;
  catalogueUrl?: string | null;
}

export interface ScoreRow {
  modelKey: string;
  /** The model as the benchmark writes it. */
  modelLabel: string;
  metricKey: string;
  metricLabel: string;
  metricGroup: string;
  value: number;
  /** The row the benchmark itself calls the overall score; the page ranks tasks without double counting it. */
  isOverall?: boolean;
}

export interface SourceSnapshot {
  key: string;
  label: string;
  url: string;
  licence: string;
  /** What this run read, in words: the table's own version. */
  snapshot: string | null;
  models: ModelRow[];
  scores: ScoreRow[];
}

export interface LeaderboardSource {
  key: string;
  label: string;
  url: string;
  licence: string;
  fetch: () => Promise<SourceSnapshot>;
}

async function fetchText(url: string, accept: string): Promise<string> {
  const response = await fetch(url, { headers: { accept, "user-agent": LEADERBOARD.userAgent() }, signal: AbortSignal.timeout(LEADERBOARD.timeoutMs) });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { accept: "application/json", "user-agent": LEADERBOARD.userAgent() }, signal: AbortSignal.timeout(LEADERBOARD.timeoutMs) });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return (await response.json()) as T;
}

/* ---------------------------------------------------------------- LiveBench */

interface LiveBenchTable {
  file: string;
  date: string | null;
}

/** The newest table in the benchmark's own repository; the fallback is the one this site was built against. */
async function newestLiveBenchTable(): Promise<LiveBenchTable> {
  const fallback: LiveBenchTable = { file: LEADERBOARD.livebench.fallbackTable, date: dateOf(LEADERBOARD.livebench.fallbackTable) };
  try {
    const entries = await fetchJson<Array<{ name?: string }>>(LEADERBOARD.livebench.directoryUrl);
    const tables = entries
      .map((entry) => entry.name ?? "")
      .filter((name) => /^table_\d{4}_\d{2}_\d{2}\.csv$/.test(name))
      .sort();
    const newest = tables.at(-1);
    return newest ? { file: newest, date: dateOf(newest) } : fallback;
  } catch {
    return fallback;
  }
}

function dateOf(file: string): string | null {
  const match = /(\d{4})_(\d{2})_(\d{2})/.exec(file);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

/** task → category, from the benchmark's own categories file for the same table. Missing: everything is one group. */
async function liveBenchGroups(date: string | null): Promise<Map<string, string>> {
  const groups = new Map<string, string>();
  if (!date) return groups;
  try {
    const file = `categories_${date.replace(/-/g, "_")}.json`;
    const payload = await fetchJson<Record<string, string[]>>(LEADERBOARD.livebench.tableUrlTemplate.replace("{file}", file));
    for (const [group, tasks] of Object.entries(payload)) for (const task of tasks) groups.set(task, group);
  } catch {
    // No categories for this table: the metrics still rank, they just share one group.
  }
  return groups;
}

export const livebenchSource: LeaderboardSource = {
  key: "livebench",
  label: LEADERBOARD.livebench.label,
  url: LEADERBOARD.livebench.pageUrl,
  licence: LEADERBOARD.livebench.licence,
  async fetch(): Promise<SourceSnapshot> {
    const table = await newestLiveBenchTable();
    const url = LEADERBOARD.livebench.tableUrlTemplate.replace("{file}", table.file);
    const [text, groups] = await Promise.all([fetchText(url, "text/csv"), liveBenchGroups(table.date)]);
    const rows = parseCsv(text);
    const header = rows[0] ?? [];
    const tasks = header.slice(1).map((label) => label.trim());
    const scores: ScoreRow[] = [];
    for (const row of rows.slice(1)) {
      const name = (row[0] ?? "").trim();
      if (!name) continue;
      const modelKey = modelKeyFor(name);
      let sum = 0;
      let counted = 0;
      tasks.forEach((task, index) => {
        const value = cellNumber(row[index + 1]);
        if (value === null || !task) return;
        sum += value;
        counted++;
        scores.push({ modelKey, modelLabel: name, metricKey: modelKeyFor(task), metricLabel: task, metricGroup: groups.get(task) ?? "其他", value });
      });
      // The benchmark's own table has no average column; this is the mean of the row's own numbers.
      if (counted > 0) {
        scores.push({
          modelKey,
          modelLabel: name,
          metricKey: LEADERBOARD.livebench.overall.key,
          metricLabel: LEADERBOARD.livebench.overall.label,
          metricGroup: "总体",
          value: Math.round((sum / counted) * 1000) / 1000,
          isOverall: true,
        });
      }
    }
    return { key: "livebench", label: LEADERBOARD.livebench.label, url, licence: LEADERBOARD.livebench.licence, snapshot: table.date, models: [], scores };
  },
};

/* --------------------------------------------------------------- OpenRouter */

/** Dollars per thousand tokens the API quotes, as dollars per million; unknown and sentinel values are null. */
function priceOf(value: string | undefined): number | null {
  const perToken = cellNumber(value);
  if (perToken === null || perToken < 0) return null;
  return Math.round(perToken * 1_000_000 * 1e6) / 1e6;
}

interface OpenRouterModel {
  id?: string;
  name?: string;
  created?: number;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
  architecture?: { modality?: string };
}

/** A documented public API, no key: the catalogue, its prices and its release dates. */
export const openrouterSource: LeaderboardSource = {
  key: "openrouter",
  label: LEADERBOARD.openrouter.label,
  url: LEADERBOARD.openrouter.url,
  licence: LEADERBOARD.openrouter.licence,
  async fetch(): Promise<SourceSnapshot> {
    const payload = await fetchJson<{ data?: OpenRouterModel[] }>(LEADERBOARD.openrouter.url);
    const models: ModelRow[] = [];
    for (const entry of payload.data ?? []) {
      const id = entry.id?.trim();
      if (!id) continue;
      // A negative price is the API's "pricing is not fixed" sentinel (router models), not a price.
      const prompt = priceOf(entry.pricing?.prompt);
      const completion = priceOf(entry.pricing?.completion);
      models.push({
        modelKey: modelKeyFor(id),
        name: entry.name?.trim() || id,
        vendor: id.split("/")[0] ?? null,
        releasedAt: entry.created ? new Date(entry.created * 1000) : null,
        contextLength: Number.isFinite(entry.context_length) ? (entry.context_length ?? null) : null,
        // The API quotes dollars per token; readers compare per million.
        priceIn: prompt,
        priceOut: completion,
        modality: entry.architecture?.modality ?? null,
        catalogueUrl: `https://openrouter.ai/${id}`,
      });
    }
    return { key: "openrouter", label: LEADERBOARD.openrouter.label, url: LEADERBOARD.openrouter.url, licence: LEADERBOARD.openrouter.licence, snapshot: null, models, scores: [] };
  },
};

/* ------------------------------------------------------------------- JSON */

interface JsonPayload {
  models?: Array<Partial<ModelRow> & { name?: string }>;
  scores?: Array<Partial<ScoreRow> & { model?: string; metric?: string }>;
}

/** A benchmark of your own, or another catalogue: a JSON file, local or over https. Schema in README.md. */
export function jsonSource(config: JsonSource): LeaderboardSource {
  return {
    key: config.key,
    label: config.label,
    url: config.url,
    licence: config.licence ?? "",
    async fetch(): Promise<SourceSnapshot> {
      const text = /^https?:\/\//.test(config.url) ? await fetchText(config.url, "application/json") : await readFile(config.url, "utf8");
      const payload = JSON.parse(text) as JsonPayload;
      const models: ModelRow[] = [];
      for (const entry of payload.models ?? []) {
        const name = entry.name?.trim();
        if (!name) continue;
        models.push({
          modelKey: entry.modelKey?.trim() || modelKeyFor(name),
          name,
          vendor: entry.vendor ?? null,
          releasedAt: entry.releasedAt ? new Date(entry.releasedAt) : null,
          contextLength: entry.contextLength ?? null,
          priceIn: entry.priceIn ?? null,
          priceOut: entry.priceOut ?? null,
          modality: entry.modality ?? null,
          catalogueUrl: entry.catalogueUrl ?? null,
        });
      }
      const scores: ScoreRow[] = [];
      for (const entry of payload.scores ?? []) {
        const name = entry.model?.trim();
        const metric = entry.metric?.trim();
        if (!name || !metric || typeof entry.value !== "number" || !Number.isFinite(entry.value)) continue;
        scores.push({
          modelKey: entry.modelKey?.trim() || modelKeyFor(name),
          modelLabel: name,
          metricKey: metricKeyOf(entry.metricKey, metric),
          metricLabel: entry.metricLabel?.trim() || metric,
          metricGroup: entry.metricGroup?.trim() || "其他",
          value: entry.value,
          isOverall: entry.isOverall === true,
        });
      }
      return { key: config.key, label: config.label, url: config.url, licence: config.licence ?? "", snapshot: null, models, scores };
    },
  };
}

function metricKeyOf(given: string | undefined, label: string): string {
  const key = (given ?? label).trim();
  return modelKeyFor(key) || "metric";
}

/** Every source this site asked for, in the order the page shows them. */
export function configuredSources(): LeaderboardSource[] {
  const sources: LeaderboardSource[] = [];
  if (LEADERBOARD.livebench.enabled) sources.push(livebenchSource);
  if (LEADERBOARD.openrouter.enabled) sources.push(openrouterSource);
  if (LEADERBOARD.json) sources.push(jsonSource(LEADERBOARD.json));
  return sources;
}
