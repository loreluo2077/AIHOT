// What the bridge is doing, for the admin's runs page and for the engine's alerts. Kept apart from the
// syncing itself so both can read it without pulling a network client in.
import type { Finding } from "@aihot/backend/notify/feishu";
import { BRIDGE } from "../config.ts";
import { allSync, bridgeCounts, importedReports } from "./state.ts";

/** Quiet for longer than this while enabled means something is wrong with the sync. */
export const STALE_HOURS = 12;

export interface FeedStatus {
  feed: string;
  lastRunAt: string | null;
  lastOkAt: string | null;
  lastError: string | null;
  imported: number;
  hasCursor: boolean;
}

export interface BridgeStatus {
  enabled: boolean;
  baseUrl: string;
  staleHours: number;
  items: { imported: number; owned: number; selected: number; lastImportedAt: string | null };
  feeds: FeedStatus[];
  reports: Array<{ kind: string; issues: number }>;
}

export async function bridgeStatus(): Promise<BridgeStatus> {
  const [counts, feeds, daily, weekly, monthly] = await Promise.all([
    bridgeCounts(),
    allSync(),
    importedReports("daily"),
    importedReports("weekly"),
    importedReports("monthly"),
  ]);
  return {
    enabled: BRIDGE.enabled(),
    baseUrl: BRIDGE.baseUrl(),
    staleHours: STALE_HOURS,
    items: {
      imported: counts.items,
      owned: counts.owned,
      selected: counts.selected,
      lastImportedAt: counts.lastImportedAt?.toISOString() ?? null,
    },
    feeds: feeds.map((row) => ({
      feed: row.feed,
      lastRunAt: row.last_run_at?.toISOString() ?? null,
      lastOkAt: row.last_ok_at?.toISOString() ?? null,
      lastError: row.last_error,
      imported: row.imported,
      hasCursor: !!row.cursor,
    })),
    reports: [
      { kind: "daily", issues: daily.length },
      { kind: "weekly", issues: weekly.length },
      { kind: "monthly", issues: monthly.length },
    ],
  };
}

/**
 * The bridge is off: nothing to say. It is on but silent past the stale window, or its last run failed:
 * the owner hears it, because only they can check the switch or the credentials of the copy.
 */
export async function staleFindings(nowMs: number): Promise<Finding[]> {
  if (!BRIDGE.enabled()) return [];
  const now = new Date(nowMs);
  const feeds = await allSync();
  if (feeds.length === 0) {
    return [
      {
        key: "aihot-bridge.never",
        level: "later",
        title: "AIHOT 镜像还没有成功同步过",
        impact: "镜像内容为空，站点上不会有 AIHOT 的精选和日报。",
        action: "检查 AIHOT_BRIDGE_ENABLED 与出网是否正常，或手动跑一次同步脚本。",
        since: now,
      },
    ];
  }
  const findings: Finding[] = [];
  for (const feed of feeds) {
    if (feed.last_error) {
      findings.push({
        key: `aihot-bridge.${feed.feed}.error`,
        level: "later",
        title: `AIHOT 镜像同步失败（${feed.feed}）`,
        impact: "这一路的内容会停在上一次成功的时候。",
        heals: "下一次同步成功。",
        action: "看模块的同步记录和 AIHOT 是否调整了接口。",
        detail: feed.last_error,
        since: feed.last_run_at ?? undefined,
      });
      continue;
    }
    const lastOk = feed.last_ok_at?.getTime() ?? 0;
    if (now.getTime() - lastOk > STALE_HOURS * 3600_000) {
      findings.push({
        key: `aihot-bridge.${feed.feed}.stale`,
        level: "today",
        title: `AIHOT 镜像超过 ${STALE_HOURS} 小时没有成功同步（${feed.feed}）`,
        impact: "镜像内容不再更新，读者看到的是旧内容。",
        heals: "下一次同步成功。",
        action: "确认 worker 在跑、AIHOT_BRIDGE_ENABLED 是 true。",
        since: feed.last_ok_at ?? undefined,
      });
    }
  }
  return findings;
}
