// The owner's page for the community signals: everything readers posted, the reports that took one down,
// and the two ways to act on it. It reads and writes this module's own admin API (server.ts), which is
// behind the engine's session and CSRF guard.
import { SITE } from "@aihot/site";
import { useLoaderData } from "react-router";
import { adminGet } from "@aihot/web/lib/admin.server";
import { useAdminAction } from "@aihot/web/features/admin/action";
import { AdminPage, Badge, Button, Card, Empty, Stat, Time } from "@aihot/web/features/admin/ui";
import type { FomoAdminSignalView, FomoAdminSignals } from "../types.ts";

export async function loader({ request }: { request: Request }): Promise<FomoAdminSignals> {
  return adminGet<FomoAdminSignals>(request, "/api/admin/fomo/signals");
}

export function meta() {
  return [{ title: `社区信号 · ${SITE.name} 后台` }];
}

/** One signal, with what only the owner may see: which side it came from, and how many readers reported it. */
function SignalCard({ row }: { row: FomoAdminSignalView }) {
  const { run, pending } = useAdminAction();
  const base = `/api/admin/fomo/signals/${row.id}`;
  return (
    <article className="rounded-panel bg-surface p-4 ring-1 ring-line">
      <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-3">
        <Badge tone={row.hidden ? "bad" : "ok"}>{row.hidden ? (row.hiddenReason ?? "已下架") : "在线上"}</Badge>
        <Time at={row.at} />
        <span>{row.day}</span>
        <span className="num">认同 {row.agrees}</span>
        <span className="num">举报 {row.reports}</span>
        <span className="num text-ink-4" title="这个来源的不可逆标识（网络地址与浏览器类别经单向散列）">
          {row.voter.slice(0, 10)}…
        </span>
      </div>
      <p className="mt-2.5 whitespace-pre-wrap text-[14px] leading-relaxed text-ink">{row.body}</p>
      <p className="mt-1 text-[12.5px] text-ink-4">{row.author ?? "匿名"}</p>
      <div className="mt-3 flex gap-1.5">
        <Button
          size="sm"
          disabled={!!pending}
          onClick={() => run("POST", `${base}/hidden`, { hidden: !row.hidden }, { label: "hidden", success: row.hidden ? "已恢复" : "已下架" })}
        >
          {row.hidden ? "恢复" : "下架"}
        </Button>
        <Button
          size="sm"
          tone="danger"
          disabled={!!pending}
          onClick={() => {
            if (window.confirm("删除这条信号？不能撤销。")) run("POST", `${base}/remove`, {}, { label: "remove", success: "已删除" });
          }}
        >
          删除
        </Button>
      </div>
    </article>
  );
}

export default function FomoSignalsAdmin() {
  const { rows, waiting } = useLoaderData() as FomoAdminSignals;
  return (
    <AdminPage
      title="社区信号"
      subtitle="读者在焦虑指数页发的内容。举报到阈值会自动下架，在这里看一眼：恢复会清掉举报记录，删除不能撤销。"
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="全部" value={rows.length} />
          <Stat label="已下架" value={waiting} tone={waiting > 0 ? "warn" : undefined} hint="等你看一眼" />
          <Stat label="在线上" value={rows.length - waiting} />
        </div>
        {rows.length === 0 ? (
          <Card>
            <Empty>还没有读者发言。</Empty>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {rows.map((row) => (
              <SignalCard key={row.id} row={row} />
            ))}
          </div>
        )}
      </div>
    </AdminPage>
  );
}
