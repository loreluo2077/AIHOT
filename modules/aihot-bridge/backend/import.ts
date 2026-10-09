// What the bridge writes. The engine owns the projections (publications, the selection ledger, the
// pool's search table), so this file builds the inputs they read — material, the editorial judgement,
// the report issue — and lets publication/publish.ts and the report tables do the rest. No model is
// called anywhere on this path: the judgement arrives with the item.
import { sql, type Db } from "@aihot/backend/db";
import { upsertMaterial } from "@aihot/backend/content/materials";
import { publishArticle } from "@aihot/backend/publication/publish";
import { BRIDGE } from "../config.ts";
import {
  BRIDGE_VERSION,
  canonicalJson,
  categoryFor,
  originalUrl,
  payloadHash,
  itemPublishedAt,
  sourceIdFor,
  sourceNameOf,
  storedSourceName,
  type BridgeLookup,
} from "./mapping.ts";
import { readItem, readItems, recordItem } from "./state.ts";
import type { AihotItem } from "./types.ts";

export interface ItemOutcome {
  aihotId: string;
  status: "created" | "updated" | "unchanged" | "observed" | "skipped" | "failed";
  articleId?: string;
  reason?: string;
}

/** One row per AIHOT source name. Readers see that name, so it is stored as it comes; the id is derived. */
export async function ensureSource(name: string, db: Db = sql): Promise<string> {
  const id = sourceIdFor(name);
  const stored = storedSourceName(name);
  await db`
    INSERT INTO sources (id, name, kind, config, tier, participation_mode, enabled, site_fulltext, syndicate_fulltext, health, interval_minutes)
    VALUES (${id}, ${stored}, 'external', '{}'::jsonb, ${BRIDGE.source.tier}, ${BRIDGE.source.participationMode}, false, false, false, 'paused', 1440)
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = now()`;
  return id;
}

/** Resolves AIHOT item ids to the articles they became, for the entries inside a report. */
export async function lookupFor(aihotIds: readonly string[], db: Db = sql): Promise<BridgeLookup> {
  const known = await readItems(aihotIds, db);
  return {
    articleId: (aihotId: string) => known.get(aihotId)?.article_id ?? null,
    sourceId: (sourceName: string) => sourceIdFor(sourceName),
  };
}

function analysisPayload(item: AihotItem, sourceName: string, articleId: string): Record<string, unknown> {
  return {
    bridge: {
      version: BRIDGE_VERSION,
      aihotItemId: item.id,
      aihotUrl: item.links?.aihot ?? null,
      sourceName,
      originalUrl: originalUrl(item),
      category: item.category ?? null,
      score: item.score ?? null,
      publishedAt: item.publishedAt ?? null,
      discoveredAt: item.discoveredAt ?? null,
      importedAt: new Date().toISOString(),
      attribution: item.attribution ?? BRIDGE.attribution,
      articleId,
    },
  };
}

/**
 * The editorial judgement the item already carries, stored as a replay: the framework's analysers write
 * `model`, an import writes `replay`, and both are read the same way afterwards.
 */
async function writeAnalysis(articleId: string, item: AihotItem, sourceName: string, judgedSelected: boolean, db: Db): Promise<void> {
  await db`
    INSERT INTO analyses (article_id, input_revision, origin, model, prompt_version, receipt_ids, relevance, category, tags, subjects, title_zh, summary_zh, reason_zh, score, selected, output)
    SELECT a.id, a.revision, 'replay', NULL, ${BRIDGE_VERSION}, '{}'::bigint[], 'pass', ${categoryFor(item.category)}, '{}'::text[], '{}'::text[],
           ${item.title}, ${item.summary ?? null}, ${item.reason ?? null}, ${item.score ?? null}, ${judgedSelected}, ${sql.json(analysisPayload(item, sourceName, articleId) as never)}
    FROM articles a WHERE a.id = ${articleId}`;
}

/**
 * Hand the article to the publication projection with the judgement already made, and mark it as done so
 * the engine's own sweeps leave it alone: an imported item is not waiting for this site's analysers.
 */
async function settle(articleId: string, releasedAt: Date | null, db: Db): Promise<void> {
  await db`
    UPDATE articles SET processing_state = 'analyzed', processing_error = NULL, processing_retry_at = NULL,
      processing_queued_at = NULL, grouping_status = 'complete', grouping_error = NULL,
      grouped_at = coalesce(grouped_at, ${releasedAt ?? new Date()}), selection_adds_value = true,
      selection_value_reason = ${`imported by ${BRIDGE_VERSION}`}, updated_at = now()
    WHERE id = ${articleId}`;
  await publishArticle(articleId, { releasedAt });
}

/**
 * One AIHOT item. A new article is imported whole; an article this module already imported is rewritten
 * when AIHOT changed it; an article this site's own collectors found first is left alone unless the site
 * asked to take it over (BRIDGE.takeoverExisting), because its editors and its paid analysis own it.
 */
export async function importItem(item: AihotItem, db: Db = sql): Promise<ItemOutcome> {
  const url = originalUrl(item);
  if (!url) return { aihotId: item.id, status: "skipped", reason: "no original link" };
  const sourceName = sourceNameOf(item);
  const hash = payloadHash(item);
  const known = await readItem(item.id, db);
  if (known && !known.owned && !BRIDGE.takeoverExisting) return { aihotId: item.id, status: "observed", articleId: known.article_id };
  if (known?.owned && !BRIDGE.force && known.payload_hash === hash) return { aihotId: item.id, status: "unchanged", articleId: known.article_id };

  const sourceId = await ensureSource(sourceName, db);
  const publishedAt = itemPublishedAt(item);
  const material = await upsertMaterial(
    {
      sourceId,
      url,
      // The article keeps the source's own title; the Chinese title the readers see lives in the analysis.
      title: item.originalTitle?.trim() || item.title,
      publishedAt,
      bodyStatus: "none",
      via: "aihot-bridge",
      excerpt: null,
      raw: { aihot: { id: item.id, links: item.links ?? {}, source: sourceName, category: item.category ?? null, score: item.score ?? null, attribution: item.attribution ?? BRIDGE.attribution } },
    },
    db,
  );
  const articleId = material.articleId;
  // The article was already here under another source — this site's own collectors had it first, and
  // their editors and their paid analysis own it. Remember the link; decide nothing.
  if (!material.created && !known && !BRIDGE.takeoverExisting) {
    await recordItem({ aihotId: item.id, articleId, sourceName, payloadHash: hash, selected: item.selected !== false, owned: false }, db);
    return { aihotId: item.id, status: "observed", articleId };
  }
  await writeAnalysis(articleId, item, sourceName, item.selected !== false, db);
  await settle(articleId, publishedAt, db);
  await recordItem({ aihotId: item.id, articleId, sourceName, payloadHash: hash, selected: item.selected !== false, owned: true }, db);
  return { aihotId: item.id, status: material.created ? "created" : "updated", articleId };
}

/**
 * AIHOT dropped the item from its selection (or put it back). The article stays: it is still public
 * material, it simply leaves or re-enters the selected set, which every exit reads from the projection.
 */
export async function setItemSelected(item: AihotItem, selected: boolean, db: Db = sql): Promise<ItemOutcome> {
  const known = await readItem(item.id, db);
  if (!known) return importItem({ ...item, selected }, db);
  const sourceName = known.source_name;
  await writeAnalysis(known.article_id, { ...item, selected }, sourceName, selected, db);
  await settle(known.article_id, itemPublishedAt(item), db);
  await recordItem({ aihotId: item.id, articleId: known.article_id, sourceName, payloadHash: payloadHash({ ...item, selected }), selected, owned: known.owned }, db);
  return { aihotId: item.id, status: "updated", articleId: known.article_id };
}

/** A removal carries only the id: the article is re-settled with its judgement turned off. */
export async function removeItem(aihotId: string, db: Db = sql): Promise<ItemOutcome> {
  const known = await readItem(aihotId, db);
  if (!known) return { aihotId, status: "skipped", reason: "never imported" };
  await db`
    INSERT INTO analyses (article_id, input_revision, origin, model, prompt_version, receipt_ids, relevance, category, tags, subjects, title_zh, summary_zh, reason_zh, score, selected, output)
    SELECT a.article_id, a.input_revision, 'replay', NULL, ${`${BRIDGE_VERSION}:removed`}, '{}'::bigint[], 'pass', a.category, '{}'::text[], '{}'::text[],
           a.title_zh, a.summary_zh, a.reason_zh, a.score, false, ${sql.json({ bridge: { version: BRIDGE_VERSION, removedAt: new Date().toISOString() } } as never)}
    FROM analyses a WHERE a.article_id = ${known.article_id} ORDER BY a.input_revision DESC, a.id DESC LIMIT 1`;
  await publishArticle(known.article_id);
  await db`UPDATE aihot_bridge_items SET selected = false, updated_at = now() WHERE aihot_id = ${aihotId}`;
  return { aihotId, status: "updated", articleId: known.article_id };
}

export interface ReportOutcome {
  kind: string;
  key: string;
  status: "created" | "updated" | "unchanged" | "skipped";
  reason?: string;
}

/**
 * One issue. `origin = 'imported'` keeps the engine's own composer from ever treating it as its work,
 * and an issue the engine generated itself is never overwritten: this module only owns what it wrote.
 */
export async function importReport(
  kind: "daily" | "weekly" | "monthly",
  key: string,
  content: Record<string, unknown>,
  generatedAt: Date,
  db: Db = sql,
): Promise<ReportOutcome> {
  const window = { start: new Date(String(content.windowStart)), end: new Date(String(content.windowEnd)) };
  const [existing] = await db<{ id: string; revision: number; origin: string; content: unknown }[]>`
    SELECT id, revision, origin, content FROM reports WHERE kind = ${kind} AND key = ${key}`;
  if (!existing) {
    await db`
      INSERT INTO reports (kind, key, window_start, window_end, content, generated_at, origin, model, revision)
      VALUES (${kind}, ${key}, ${window.start}, ${window.end}, ${sql.json(content as never)}, ${generatedAt}, 'imported', NULL, 1)`;
    return { kind, key, status: "created" };
  }
  if (existing.origin !== "imported") return { kind, key, status: "skipped", reason: "this site generated the issue" };
  if (canonicalJson(existing.content) === canonicalJson(content)) return { kind, key, status: "unchanged" };
  const revision = existing.revision + 1;
  await db`
    UPDATE reports SET content = ${sql.json(content as never)}, generated_at = ${generatedAt}, revision = ${revision}, updated_at = now()
    WHERE id = ${existing.id}`;
  await db`
    INSERT INTO report_revisions (report_id, revision, content, generated_at, reason)
    VALUES (${existing.id}, ${revision}, ${sql.json(content as never)}, ${generatedAt}, ${`re-imported by ${BRIDGE_VERSION}`})`;
  return { kind, key, status: "updated" };
}

/** How many daily issues this site holds inside a period: the weekly/monthly metrics report it. */
export async function dailyIssuesBetween(start: string, end: string, db: Db = sql): Promise<number> {
  const [row] = await db<{ n: number }[]>`
    SELECT count(*)::int AS n FROM reports WHERE kind = 'daily' AND key >= ${start} AND key <= ${end}`;
  return row?.n ?? 0;
}
