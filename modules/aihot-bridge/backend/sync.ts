// The three feeds this module follows: the selected items (newest first, until it meets one it already
// has), AIHOT's own selection ledger (so a withdrawal there follows here), and the issues.
import { sql, type Db } from "@aihot/backend/db";
import { BRIDGE } from "../config.ts";
import { importItem, importReport, lookupFor, removeItem, dailyIssuesBetween } from "./import.ts";
import { aihotIdFromUrl, dailyContent, periodContent, reportGeneratedAt, reportKey } from "./mapping.ts";
import { readItems, readSync, saveRun, saveSync } from "./state.ts";
import { syncEvents } from "./events.ts";
import type { AihotAnswer, AihotClient } from "./client.ts";
import { countOutcome, emptySummary, type SyncSummary } from "./summary.ts";
import type { AihotChanges, AihotDailyIndex, AihotDailyReport, AihotItemsPage, AihotPeriodIndex, AihotPeriodReport, AihotReportEntry, AihotSnapshot } from "./types.ts";

export type { SyncSummary } from "./summary.ts";

interface ChangesDetail {
  snapshotPage?: string | null;
  snapshotDone?: boolean;
  snapshotAsOf?: string;
}

function changesDetail(row: { detail: unknown } | null): ChangesDetail {
  return (row?.detail as ChangesDetail | null) ?? {};
}

/** Newest selected items, stopping at the first one already imported: their paging rule, not ours. */
export async function syncItems(client: AihotClient, db: Db = sql): Promise<SyncSummary> {
  const summary = emptySummary("items");
  let cursor: string | null = null;
  for (let page = 0; page < 40; page++) {
    const answer: AihotAnswer<AihotItemsPage> = await client.get<AihotItemsPage>("/api/v1/items", { mode: "selected", window: BRIDGE.itemsWindow, limit: BRIDGE.pageLimit, cursor });
    const data = answer.data;
    if (!data) break;
    summary.pages++;
    const known = await readItems(data.items.map((item) => item.id), db);
    for (const item of data.items) {
      summary.fetched++;
      if (known.has(item.id)) {
        summary.unchanged++;
        continue;
      }
      if (summary.created + summary.updated >= BRIDGE.maxItemsPerRun) {
        summary.skipped++;
        continue;
      }
      try {
        countOutcome(await importItem(item, db), summary);
      } catch (error) {
        summary.failed++;
        summary.detail = { error: (error as Error).message, item: item.id };
      }
    }
    // A page holding something already imported means everything after it is older than it: caught up.
    const reachedKnown = data.items.some((item) => known.has(item.id));
    cursor = data.page.nextCursor ?? null;
    if (reachedKnown || !data.page.hasMore || !cursor) break;
    if (summary.created + summary.updated >= BRIDGE.maxItemsPerRun) break;
  }
  await saveRun(summary, db);
  return summary;
}

/**
 * AIHOT's selection ledger. The first runs walk the snapshot (resuming where they stopped); after that
 * only the changes are read, so a withdrawal there is a withdrawal here.
 */
export async function syncChanges(client: AihotClient, db: Db = sql): Promise<SyncSummary> {
  const state = await readSync("changes", db);
  const detail = changesDetail(state);
  const summary = emptySummary("changes");

  const needsSnapshot = state === null || !state.cursor || (detail.snapshotPage ?? null) !== null;
  if (needsSnapshot) {
    const answer: AihotAnswer<AihotSnapshot> = await client.get<AihotSnapshot>("/api/v1/selected/snapshot", { limit: BRIDGE.pageLimit * 2, page: detail.snapshotPage ?? undefined });
    const snapshot = answer.data;
    if (!snapshot) {
      await saveRun(summary, db);
      return summary;
    }
    summary.pages++;
    const known = await readItems(snapshot.items.map((item) => item.id), db);
    for (const item of snapshot.items) {
      summary.fetched++;
      if (known.has(item.id)) {
        summary.unchanged++;
        continue;
      }
      if (summary.created + summary.updated >= BRIDGE.maxItemsPerRun) {
        summary.skipped++;
        continue;
      }
      try {
        countOutcome(await importItem(item, db), summary);
      } catch (error) {
        summary.failed++;
        summary.detail = { error: (error as Error).message, item: item.id };
      }
    }
    await saveSync(
      "changes",
      {
        cursor: snapshot.cursor,
        ok: summary.failed === 0,
        imported: summary.created + summary.updated,
        error: summary.failed ? `${summary.failed} item(s) failed` : null,
        detail: { snapshotPage: snapshot.hasMore ? (snapshot.nextPage ?? null) : null, snapshotDone: !snapshot.hasMore, snapshotAsOf: snapshot.asOf, lastRun: summary },
      },
      db,
    );
    return summary;
  }

  let cursor: string | null = state.cursor;
  for (let page = 0; page < 20 && cursor; page++) {
    const answer: AihotAnswer<AihotChanges> = await client.get<AihotChanges>("/api/v1/selected/changes", { cursor, limit: 100 });
    const data = answer.data;
    if (!data) break;
    summary.pages++;
    for (const change of data.changes) {
      summary.fetched++;
      try {
        if (change.op === "remove") {
          const outcome = await removeItem(change.id, db);
          if (outcome.status === "skipped") summary.skipped++;
          else summary.removed++;
        } else {
          countOutcome(await importItem(change.item, db), summary);
        }
      } catch (error) {
        summary.failed++;
        summary.detail = { error: (error as Error).message, change: change.op };
      }
    }
    cursor = data.cursor;
    if (!data.hasMore) break;
  }
  await saveSync(
    "changes",
    { cursor, ok: summary.failed === 0, imported: summary.created + summary.updated, error: summary.failed ? `${summary.failed} change(s) failed` : null, detail: { ...detail, snapshotPage: null, snapshotDone: true, lastRun: summary } },
    db,
  );
  return summary;
}

function entriesOf(issue: AihotDailyReport | AihotPeriodReport): AihotReportEntry[] {
  const sections = (issue.sections ?? []).flatMap((section) => section.items);
  const flashes = "flashes" in issue ? (issue.flashes ?? []) : [];
  return [...sections, ...flashes];
}

function aihotIdsOf(issue: AihotDailyReport | AihotPeriodReport): string[] {
  return entriesOf(issue)
    .map((entry) => aihotIdFromUrl(entry.links?.aihot))
    .filter((id): id is string => !!id);
}

function tally(status: string, summary: SyncSummary): void {
  if (status === "created") summary.created++;
  else if (status === "updated") summary.updated++;
  else if (status === "skipped") summary.skipped++;
  else summary.unchanged++;
}

async function importOne(client: AihotClient, kind: "daily" | "weekly" | "monthly", key: string, db: Db): Promise<string> {
  const path = kind === "daily" ? `/api/v1/dailies/${key}` : kind === "weekly" ? `/api/v1/weeklies/${key}` : `/api/v1/monthlies/${key}`;
  if (kind === "daily") {
    const answer: AihotAnswer<{ report: AihotDailyReport }> = await client.get<{ report: AihotDailyReport }>(path);
    const issue = answer.data?.report;
    if (!issue) return "skipped";
    const look = await lookupFor(aihotIdsOf(issue), db);
    return (await importReport("daily", reportKey("daily", issue) ?? key, dailyContent(issue, look), reportGeneratedAt(issue), db)).status;
  }
  const answer: AihotAnswer<{ report: AihotPeriodReport }> = await client.get<{ report: AihotPeriodReport }>(path);
  const issue = answer.data?.report;
  if (!issue) return "skipped";
  const look = await lookupFor(aihotIdsOf(issue), db);
  const covered = await dailyIssuesBetween(issue.periodStart, issue.periodEnd, db);
  return (await importReport(kind, reportKey(kind, issue) ?? key, periodContent(kind, issue, look, covered), reportGeneratedAt(issue), db)).status;
}

/** The issues: the newest few of each kind, re-imported only when AIHOT's own copy changed. */
export async function syncReports(client: AihotClient, db: Db = sql): Promise<SyncSummary> {
  const summary = emptySummary("reports");
  try {
    const dailies: AihotAnswer<AihotDailyIndex> = await client.get<AihotDailyIndex>("/api/v1/dailies", { limit: BRIDGE.reportHistory.daily ?? 30 });
    for (const issue of dailies.data?.items ?? []) {
      summary.fetched++;
      tally(await importOne(client, "daily", issue.date, db), summary);
    }
    for (const kind of ["weekly", "monthly"] as const) {
      const list: AihotAnswer<AihotPeriodIndex> = await client.get<AihotPeriodIndex>(kind === "weekly" ? "/api/v1/weeklies" : "/api/v1/monthlies", { limit: BRIDGE.reportHistory[kind] ?? 12 });
      for (const issue of list.data?.items ?? []) {
        const key = kind === "weekly" ? issue.week : issue.month;
        if (!key) {
          summary.skipped++;
          continue;
        }
        summary.fetched++;
        tally(await importOne(client, kind, key, db), summary);
      }
    }
  } catch (error) {
    summary.failed++;
    summary.detail = { error: (error as Error).message };
  }
  await saveRun(summary, db);
  return summary;
}

/** Everything the scheduled runs do, in one call (the CLI uses this). */
export async function syncAll(client: AihotClient, db: Db = sql): Promise<SyncSummary[]> {
  return [await syncItems(client, db), await syncChanges(client, db), await syncEvents(client, db), await syncReports(client, db)];
}
