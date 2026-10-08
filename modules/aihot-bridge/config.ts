// This module's own arrangement: its two environment variables are the only ones it reads, everything
// else is edited here, like site/ is. See modules/aihot-bridge/README.md before switching it on.
import { SITE } from "@aihot/site";

export const BRIDGE = {
  /** Nothing leaves the site while this is false, like the engine's own safety valves. */
  enabled: (): boolean => process.env.AIHOT_BRIDGE_ENABLED === "true",
  /** AIHOT's public API. Override only to point at a copy of it. */
  baseUrl: (): string => (process.env.AIHOT_BRIDGE_BASE_URL ?? "https://aihot.news").replace(/\/+$/, ""),
  /** Their rules ask for at most one request a second or so: one at a time, this far apart. */
  minIntervalMs: 1_200,
  /** A bound on one run, so a first import cannot run all night. */
  maxItemsPerRun: 300,
  /** The window asked of /api/v1/items, and how many items a page holds. */
  itemsWindow: "7d",
  pageLimit: 50,
  /** Issues kept in sync per report kind, newest first. */
  reportHistory: { daily: 30, weekly: 12, monthly: 12 } as Record<string, number>,
  /**
   * The hot list and the events behind it. Heat is this site's own rule (48 h, one per source), so the
   * ranking is recomputed here from the reports that actually reach the site; the top few of AIHOT's
   * list are what gets mirrored. `importMissingReports` brings the reports of an event the site does
   * not hold yet (they arrive as ordinary pool items, never as selected ones).
   */
  hotTopics: { top: 10, maxReportsPerEvent: 20, importMissingReports: true },
  /** AIHOT categories mapped onto this site's keys; anything unmapped is stored as it comes. */
  categoryMap: {} as Record<string, string>,
  /** 镜像自己的来源行：媒体分级、进精选，站内只显示摘要和原文链接。 */
  source: { tier: "T2", participationMode: "editorial" },
  /**
   * Take over an article this site's own collectors found first. Off by default: their pipeline already
   * owns it, and overwriting it would both contradict their editors and stop their paid analysis.
   */
  takeoverExisting: false,
  /** Import every run regardless of the stored hash, to repair a half-finished import. */
  force: false,
  /** What the imported copy is attributed to, kept in the article's raw payload. */
  attribution: { name: "AIHOT", url: "https://aihot.news" },
  userAgent: (): string => `${SITE.crawlerName} (aihot-bridge)`,
};
