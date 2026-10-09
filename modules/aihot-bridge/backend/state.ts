// This module's own two tables: what it brought in, and where each feed's cursor was left. Both are
// the module's alone; the engine never reads them, so a site without the module runs unchanged.
import { sql, type Db } from "@aihot/backend/db";
import type { SyncSummary } from "./summary.ts";

export interface SyncState {
  feed: string;
  cursor: string | null;
  etag: string | null;
  last_run_at: Date | null;
  last_ok_at: Date | null;
  last_error: string | null;
  imported: number;
  detail: unknown;
}

export interface BridgeItem {
  aihot_id: string;
  article_id: string;
  source_name: string;
  payload_hash: string;
  selected: boolean;
  owned: boolean;
  imported_at: Date;
  updated_at: Date;
}

export async function readSync(feed: string, db: Db = sql): Promise<SyncState | null> {
  const [row] = await db<SyncState[]>`
    SELECT feed, cursor, etag, last_run_at, last_ok_at, last_error, imported, detail
    FROM aihot_bridge_sync WHERE feed = ${feed}`;
  return row ?? null;
}

export async function allSync(db: Db = sql): Promise<SyncState[]> {
  return db<SyncState[]>`
    SELECT feed, cursor, etag, last_run_at, last_ok_at, last_error, imported, detail
    FROM aihot_bridge_sync ORDER BY feed`;
}

export async function saveSync(
  feed: string,
  patch: { cursor?: string | null; etag?: string | null; imported?: number; ok?: boolean; error?: string | null; detail?: unknown },
  db: Db = sql,
): Promise<void> {
  await db`
    INSERT INTO aihot_bridge_sync (feed, cursor, etag, last_run_at, last_ok_at, last_error, imported, detail)
    VALUES (${feed}, ${patch.cursor ?? null}, ${patch.etag ?? null}, now(), ${patch.ok ? new Date() : null}, ${patch.error ?? null}, ${patch.imported ?? 0},
      ${patch.detail === undefined ? null : db.json(patch.detail as never)})
    ON CONFLICT (feed) DO UPDATE SET
      cursor = coalesce(${patch.cursor ?? null}, aihot_bridge_sync.cursor),
      etag = coalesce(${patch.etag ?? null}, aihot_bridge_sync.etag),
      last_run_at = now(),
      last_ok_at = CASE WHEN ${patch.ok ? true : false} THEN now() ELSE aihot_bridge_sync.last_ok_at END,
      last_error = ${patch.error ?? null},
      imported = ${patch.imported ?? 0},
      detail = coalesce(${patch.detail === undefined ? null : db.json(patch.detail as never)}, aihot_bridge_sync.detail)`;
}

export async function readItem(aihotId: string, db: Db = sql): Promise<BridgeItem | null> {
  const [row] = await db<BridgeItem[]>`
    SELECT aihot_id, article_id, source_name, payload_hash, selected, owned, imported_at, updated_at
    FROM aihot_bridge_items WHERE aihot_id = ${aihotId}`;
  return row ?? null;
}

/** Which of these AIHOT ids are already imported, and to which article each one points. */
export async function readItems(aihotIds: readonly string[], db: Db = sql): Promise<Map<string, BridgeItem>> {
  if (aihotIds.length === 0) return new Map();
  const rows = await db<BridgeItem[]>`
    SELECT aihot_id, article_id, source_name, payload_hash, selected, owned, imported_at, updated_at
    FROM aihot_bridge_items WHERE aihot_id = ANY(${aihotIds as string[]})`;
  return new Map(rows.map((row) => [row.aihot_id, row]));
}

export async function recordItem(
  item: { aihotId: string; articleId: string; sourceName: string; payloadHash: string; selected: boolean; owned: boolean },
  db: Db = sql,
): Promise<void> {
  await db`
    INSERT INTO aihot_bridge_items (aihot_id, article_id, source_name, payload_hash, selected, owned)
    VALUES (${item.aihotId}, ${item.articleId}, ${item.sourceName}, ${item.payloadHash}, ${item.selected}, ${item.owned})
    ON CONFLICT (aihot_id) DO UPDATE SET
      article_id = EXCLUDED.article_id,
      source_name = EXCLUDED.source_name,
      payload_hash = EXCLUDED.payload_hash,
      selected = EXCLUDED.selected,
      owned = EXCLUDED.owned,
      updated_at = now()`;
}

export async function markItemSelected(aihotId: string, selected: boolean, db: Db = sql): Promise<void> {
  await db`UPDATE aihot_bridge_items SET selected = ${selected}, updated_at = now() WHERE aihot_id = ${aihotId}`;
}

/** Records one run of one feed in this module's own table, for the admin and the alerts. */
export async function saveRun(summary: SyncSummary, db: Db = sql): Promise<void> {
  const ok = summary.failed === 0;
  await saveSync(summary.feed, { ok, imported: summary.created + summary.updated, error: ok ? null : `${summary.failed} item(s) failed`, detail: summary }, db);
}

export interface BridgeCounts {
  items: number;
  owned: number;
  selected: number;
  lastImportedAt: Date | null;
}

export async function bridgeCounts(db: Db = sql): Promise<BridgeCounts> {
  const [row] = await db<{ items: number; owned: number; selected: number; last_imported_at: Date | null }[]>`
    SELECT count(*)::int AS items,
           count(*) FILTER (WHERE owned)::int AS owned,
           count(*) FILTER (WHERE selected)::int AS selected,
           max(imported_at) AS last_imported_at
    FROM aihot_bridge_items`;
  return { items: row?.items ?? 0, owned: row?.owned ?? 0, selected: row?.selected ?? 0, lastImportedAt: row?.last_imported_at ?? null };
}

/** Imported issues this module owns, by kind: 'imported' is what the engine never writes. */
export async function importedReports(kind: string, db: Db = sql): Promise<Array<{ key: string; revision: number }>> {
  return db<Array<{ key: string; revision: number }>>`
    SELECT key, revision FROM reports WHERE kind = ${kind} AND origin = 'imported' ORDER BY key DESC`;
}
