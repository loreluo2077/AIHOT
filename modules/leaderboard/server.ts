// This module's backend: one public read endpoint, one daily refresh, and the alerts that say when a
// source stops answering. Its page is declared in module.ts; nothing here touches the engine's tables.
import { sql } from "@aihot/backend/db";
import type { Finding } from "@aihot/backend/notify/feishu";
import { defineServerModule } from "@aihot/backend/modules";
import { leaderboardPayload } from "./backend/read.ts";
import { syncLeaderboard } from "./backend/sync.ts";

/** A source that has not answered for this long is worth telling the owner about. */
const STALE_HOURS = 72;

export default defineServerModule({
  name: "leaderboard",
  http: (app) => {
    app.get("/api/leaderboard", async (_request, reply) => {
      const payload = await leaderboardPayload();
      return reply.header("cache-control", "public, max-age=300, stale-while-revalidate=600").header("content-type", "application/json; charset=utf-8").send(payload);
    });
  },
  schedules: [
    // Public tables move slowly: once a day is plenty, and it is not a paid request.
    { name: "leaderboard.sync", cron: "10 6 * * *", missed: "once", run: () => syncLeaderboard() },
  ],
  alerts: async (now) => {
    const rows = await sql<{ key: string; label: string; last_ok_at: Date | null; last_error: string | null; fetched_at: Date | null }[]>`
      SELECT key, label, last_ok_at, last_error, fetched_at FROM leaderboard_sources`;
    const findings: Finding[] = [];
    for (const row of rows) {
      if (row.last_error) {
        findings.push({
          key: `leaderboard.${row.key}.error`,
          level: "later",
          title: `模型榜的数据源读取失败（${row.label}）`,
          impact: "该来源的排名停在上一次成功的时候。",
          heals: "下一次成功读取。",
          action: "看来源是否改了地址或结构，必要时更新 modules/leaderboard/config.ts。",
          detail: row.last_error,
          since: row.fetched_at ?? undefined,
        });
        continue;
      }
      const lastOk = row.last_ok_at?.getTime() ?? 0;
      if (now - lastOk > STALE_HOURS * 3600_000) {
        findings.push({
          key: `leaderboard.${row.key}.stale`,
          level: "today",
          title: `模型榜超过 ${STALE_HOURS} 小时没有更新（${row.label}）`,
          impact: "读者看到的是旧名次。",
          heals: "下一次成功读取。",
          action: "确认 worker 在跑，或手动跑一次同步。",
          since: row.last_ok_at ?? undefined,
        });
      }
    }
    return findings;
  },
});
