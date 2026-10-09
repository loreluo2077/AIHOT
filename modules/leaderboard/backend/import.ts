// Writing what a source brought in. A catalogue row keeps what earlier sources knew (a benchmark usually
// has no prices, a catalogue usually has no scores), and a source's scores are replaced wholesale, so a
// model the benchmark stopped listing stops being ranked here too.
import { sql, type Db } from "@aihot/backend/db";
import type { SourceSnapshot } from "./sources.ts";

export interface StoredSource {
  models: number;
  scores: number;
}

export async function storeSource(snapshot: SourceSnapshot, db: Db = sql): Promise<StoredSource> {
  const write = (tx: Db) => store(tx, snapshot);
  return "begin" in db ? (db as typeof sql).begin(write) : write(db);
}

async function store(tx: Db, snapshot: SourceSnapshot): Promise<StoredSource> {
  if (snapshot.models.length > 0) {
    const rows = snapshot.models.map((model) => ({
      model_key: model.modelKey,
      name: model.name,
      vendor: model.vendor ?? null,
      released_at: model.releasedAt ?? null,
      context_length: model.contextLength ?? null,
      price_in: model.priceIn ?? null,
      price_out: model.priceOut ?? null,
      modality: model.modality ?? null,
      catalogue_url: model.catalogueUrl ?? null,
    }));
    await tx`
      INSERT INTO leaderboard_models ${tx(rows, "model_key", "name", "vendor", "released_at", "context_length", "price_in", "price_out", "modality", "catalogue_url")}
      ON CONFLICT (model_key) DO UPDATE SET
        name = EXCLUDED.name,
        vendor = coalesce(EXCLUDED.vendor, leaderboard_models.vendor),
        released_at = coalesce(EXCLUDED.released_at, leaderboard_models.released_at),
        context_length = coalesce(EXCLUDED.context_length, leaderboard_models.context_length),
        price_in = coalesce(EXCLUDED.price_in, leaderboard_models.price_in),
        price_out = coalesce(EXCLUDED.price_out, leaderboard_models.price_out),
        modality = coalesce(EXCLUDED.modality, leaderboard_models.modality),
        catalogue_url = coalesce(EXCLUDED.catalogue_url, leaderboard_models.catalogue_url),
        updated_at = now()`;
  }

  // This source's ranking is what it published this time: nothing older survives it.
  await tx`DELETE FROM leaderboard_scores WHERE source_key = ${snapshot.key}`;
  if (snapshot.scores.length > 0) {
    const rows = snapshot.scores.map((score) => ({
      model_key: score.modelKey,
      model_label: score.modelLabel,
      metric_key: score.metricKey,
      metric_label: score.metricLabel,
      metric_group: score.metricGroup,
      value: score.value,
      is_overall: score.isOverall === true,
      source_key: snapshot.key,
      source_url: snapshot.url,
    }));
    await tx`
      INSERT INTO leaderboard_scores ${tx(rows, "model_key", "model_label", "metric_key", "metric_label", "metric_group", "value", "is_overall", "source_key", "source_url")}
      ON CONFLICT (model_key, metric_key, source_key) DO UPDATE SET
        model_label = EXCLUDED.model_label,
        metric_label = EXCLUDED.metric_label,
        metric_group = EXCLUDED.metric_group,
        value = EXCLUDED.value,
        is_overall = EXCLUDED.is_overall,
        source_url = EXCLUDED.source_url,
        captured_at = now()`;
  }

  await tx`
    INSERT INTO leaderboard_sources (key, label, url, licence, snapshot, fetched_at, last_ok_at, last_error, models, scores)
    VALUES (${snapshot.key}, ${snapshot.label}, ${snapshot.url}, ${snapshot.licence}, ${snapshot.snapshot}, now(), now(), NULL, ${snapshot.models.length}, ${snapshot.scores.length})
    ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, url = EXCLUDED.url, licence = EXCLUDED.licence,
      snapshot = EXCLUDED.snapshot, fetched_at = now(), last_ok_at = now(), last_error = NULL,
      models = EXCLUDED.models, scores = EXCLUDED.scores`;
  return { models: snapshot.models.length, scores: snapshot.scores.length };
}

/** A source that could not be read keeps its last good rows; only the failure is recorded. */
export async function recordFailure(source: { key: string; label: string; url: string; licence?: string }, message: string, db: Db = sql): Promise<void> {
  await db`
    INSERT INTO leaderboard_sources (key, label, url, licence, fetched_at, last_error, models, scores)
    VALUES (${source.key}, ${source.label}, ${source.url}, ${source.licence ?? null}, now(), ${message.slice(0, 500)}, 0, 0)
    ON CONFLICT (key) DO UPDATE SET fetched_at = now(), last_error = ${message.slice(0, 500)}`;
}
