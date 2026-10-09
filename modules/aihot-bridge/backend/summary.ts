// What one sync run did, shared by the feeds so the CLI, the alerts and the admin read the same shape.
export interface SyncSummary {
  feed: string;
  fetched: number;
  created: number;
  updated: number;
  unchanged: number;
  observed: number;
  skipped: number;
  removed: number;
  failed: number;
  pages: number;
  detail?: unknown;
}

export function emptySummary(feed: string): SyncSummary {
  return { feed, fetched: 0, created: 0, updated: 0, unchanged: 0, observed: 0, skipped: 0, removed: 0, failed: 0, pages: 0 };
}

/** Counts an import outcome, whatever feed produced it. */
export function countOutcome(outcome: { status: string }, summary: SyncSummary): void {
  if (outcome.status === "created") summary.created++;
  else if (outcome.status === "updated") summary.updated++;
  else if (outcome.status === "unchanged") summary.unchanged++;
  else if (outcome.status === "observed") summary.observed++;
  else if (outcome.status === "failed") summary.failed++;
  else summary.skipped++;
}
