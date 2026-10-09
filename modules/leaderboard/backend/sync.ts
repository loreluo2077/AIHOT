// One run over every configured source. A source that cannot be read keeps whatever it brought last time;
// only its failure is recorded, so one broken benchmark never empties the page.
import { sql, type Db } from "@aihot/backend/db";
import { recordFailure, storeSource } from "./import.ts";
import { configuredSources } from "./sources.ts";

export interface SourceResult {
  key: string;
  label: string;
  ok: boolean;
  models: number;
  scores: number;
  error?: string;
}

export interface LeaderboardRun {
  sources: SourceResult[];
}

export async function syncLeaderboard(db: Db = sql): Promise<LeaderboardRun> {
  const results: SourceResult[] = [];
  for (const source of configuredSources()) {
    try {
      const snapshot = await source.fetch();
      const stored = await storeSource(snapshot, db);
      results.push({ key: source.key, label: source.label, ok: true, models: stored.models, scores: stored.scores });
    } catch (error) {
      const message = `${(error as Error).name === "TimeoutError" ? "读取超时" : ""}${(error as Error).message}`.trim();
      await recordFailure(source, message, db);
      results.push({ key: source.key, label: source.label, ok: false, models: 0, scores: 0, error: message });
    }
  }
  return { sources: results };
}
