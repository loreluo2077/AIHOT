// The model leaderboard page: one ranked table, the way a leaderboard is read — rank, model, the
// benchmark's overall score, its ability categories side by side, and the catalogue's release date and
// price on the same row. It reads this module's own API over HTTP (the web never touches the database)
// and every number keeps the source it came from. Sorting happens in the browser.
import { useMemo, useState } from "react";
import { pageMeta } from "@aihot/web/lib/seo";
import { useLoaderData } from "react-router";
import type { Screen } from "@aihot/web/components/shell/screens";
import { LEADERBOARD } from "../config.ts";
import { prettyModelName } from "../format.ts";
import type { BenchmarkRow, BenchmarkTable, BenchmarkView, CatalogueRow, LeaderboardPayload, SourceView } from "../types.ts";

const API = process.env.API_BASE_URL ?? "http://127.0.0.1:3001";

/** The phone shell: reached from 我的 (the phone bar has room for one module tab, and the index takes it). */
export const handle: Screen = { tab: "me", name: "模型榜" };

async function fetchPayload(signal?: AbortSignal): Promise<LeaderboardPayload> {
  const response = await fetch(`${API}/api/leaderboard`, {
    headers: { accept: "application/json", "x-aihot-ssr": "1" },
    signal: signal ?? AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Response("模型榜暂时不可用", { status: response.status === 404 ? 404 : 503 });
  return (await response.json()) as LeaderboardPayload;
}

export async function loader({ request }: { request: Request }): Promise<LeaderboardPayload> {
  return fetchPayload(request.signal);
}

export function meta() {
  // The share card is the site's own (site/site.ts CARDS.leaderboard).
  return pageMeta({ title: LEADERBOARD.title, description: LEADERBOARD.description, path: "/leaderboard", image: "/og/pages/leaderboard.png" });
}

function valueOf(row: BenchmarkRow, key: string): number | null {
  return key === "overall" ? row.overall : (row.scores[key] ?? null);
}

function formatScore(value: number | null): string {
  if (value === null) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatContext(length: number | null): string {
  if (!length) return "—";
  if (length >= 1_000_000) return `${Math.round(length / 100_000) / 10}M`;
  return `${Math.round(length / 1000)}K`;
}

function formatPrice(price: number | null): string {
  if (price === null) return "—";
  if (price === 0) return "免费";
  if (price < 1) return `$${price.toFixed(3)}`;
  return `$${price.toFixed(2)}`;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}` : "—";
}

const RANK_TONE = ["text-rank-1", "text-rank-2", "text-rank-3"];

/** One ability column: the number over a bar scaled to the best model in that column. */
function ScoreCell({ value, max }: { value: number | null; max: number }) {
  if (value === null) return <td className="px-2 py-2 text-right text-ink-4">—</td>;
  const width = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <td className="relative px-2 py-2 text-right tabular-nums">
      <span className="absolute inset-y-1 right-1 rounded-sm bg-accent/10" style={{ width: `${width}%` }} aria-hidden="true" />
      <span className="relative">{formatScore(value)}</span>
    </td>
  );
}

function MainTable({ benchmark }: { benchmark: BenchmarkView }) {
  const [sortKey, setSortKey] = useState("overall");
  const rows = useMemo(() => {
    const sorted = [...benchmark.rows].sort((a, b) => (valueOf(b, sortKey) ?? -1) - (valueOf(a, sortKey) ?? -1));
    return sorted.map((row, index) => ({ ...row, position: index + 1 }));
  }, [benchmark, sortKey]);
  const maxima = useMemo(() => {
    const result = new Map<string, number>();
    for (const column of benchmark.columns) result.set(column.key, Math.max(0, ...benchmark.rows.map((row) => valueOf(row, column.key) ?? 0)));
    return result;
  }, [benchmark]);
  const abilityColumns = benchmark.columns.filter((column) => !column.overall);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">
          {benchmark.sourceLabel} 评测
          <span className="ml-2 text-xs font-normal text-ink-3">
            {benchmark.snapshot ? `${benchmark.snapshot} 版 · ` : ""}前 {benchmark.rows.length} 名
          </span>
        </h2>
        <div className="flex flex-wrap items-center gap-1 text-xs">
          <span className="text-ink-4">按</span>
          {benchmark.columns
            .filter((column) => column.overall)
            .map((column) => (
              <button
                key={column.key}
                type="button"
                onClick={() => setSortKey(column.key)}
                className={`rounded px-2 py-0.5 ${sortKey === column.key ? "bg-accent-soft text-accent-ink" : "text-ink-3 hover:text-ink-2"}`}
              >
                {column.label}
              </button>
            ))}
          {abilityColumns.map((column) => (
            <button
              key={column.key}
              type="button"
              onClick={() => setSortKey(column.key)}
              className={`rounded px-2 py-0.5 ${sortKey === column.key ? "bg-accent-soft text-accent-ink" : "text-ink-3 hover:text-ink-2"}`}
            >
              {column.label}
            </button>
          ))}
          <span className="text-ink-4">排序</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[880px] text-sm">
          <thead className="bg-bg-muted text-xs text-ink-3">
            <tr>
              <th className="w-12 px-3 py-2 text-left font-normal">名次</th>
              <th className="px-3 py-2 text-left font-normal">模型</th>
              <th className="w-20 px-2 py-2 text-right font-normal">{benchmark.columns.find((column) => column.overall)?.label ?? "综合"}</th>
              {abilityColumns.map((column) => (
                <th key={column.key} className="w-20 px-2 py-2 text-right font-normal">
                  {column.label}
                </th>
              ))}
              <th className="w-24 px-3 py-2 text-left font-normal">上线</th>
              <th className="w-32 px-3 py-2 text-right font-normal">价格/百万</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.modelKey} className="border-t border-line-soft hover:bg-bg-muted/60">
                <td className={`px-3 py-2 font-medium tabular-nums ${RANK_TONE[row.position - 1] ?? "text-ink-3"}`}>{row.position}</td>
                <td className="px-3 py-2">
                  <span title={row.model} className="font-medium">
                    {prettyModelName(row.model)}
                  </span>
                  {row.url ? (
                    <a href={row.url} target="_blank" rel="noreferrer noopener" className="ml-2 text-xs text-ink-4 hover:underline">
                      {row.catalogueName ?? "目录"}
                    </a>
                  ) : (
                    <span className="ml-2 text-xs text-ink-4">目录未收录</span>
                  )}
                </td>
                <td className="px-2 py-2 text-right font-semibold tabular-nums">{formatScore(row.overall)}</td>
                {abilityColumns.map((column) => (
                  <ScoreCell key={column.key} value={valueOf(row, column.key)} max={maxima.get(column.key) ?? 0} />
                ))}
                <td className="px-3 py-2 text-ink-3">{formatDate(row.releasedAt)}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  <span className="text-ink-2">{formatPrice(row.priceIn)}</span>
                  <span className="text-ink-4"> / {formatPrice(row.priceOut)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-ink-4">
        「综合」是该基准自己发布的综合分；各能力列是该类别下各任务的平均分（按它公开的表格计算，未做任何跨基准换算）。
        上线日期与价格按模型名从目录匹配，本次匹配上 {benchmark.matched}/{benchmark.rows.length} 行，未匹配的显示「—」，
        点模型名后的目录名可打开该模型的目录页。
      </p>
    </section>
  );
}

function OtherTable({ table }: { table: BenchmarkTable }) {
  return (
    <section className="overflow-hidden rounded-lg border border-line">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line bg-bg-muted px-4 py-3">
        <h2 className="text-sm font-semibold">{table.label}</h2>
        <a className="text-xs text-ink-3 hover:underline" href={table.sourceUrl} target="_blank" rel="noreferrer noopener">
          来源：{table.sourceLabel}
        </a>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.modelKey} className="border-t border-line-soft">
                <td className="w-12 px-3 py-2 text-ink-3">{row.rank}</td>
                <td className="px-3 py-2">{prettyModelName(row.model)}</td>
                <td className="w-24 px-3 py-2 text-right font-medium">{formatScore(row.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Catalogue({ rows, source }: { rows: CatalogueRow[]; source: { label: string; url: string } | null }) {
  return (
    <details className="rounded-lg border border-line px-4 py-3">
      <summary className="cursor-pointer text-sm font-semibold">
        模型目录
        {source ? (
          <span className="ml-2 text-xs font-normal text-ink-3">
            来源：{source.label} · 最新 {rows.length} 个
          </span>
        ) : null}
      </summary>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[620px] text-sm tabular-nums">
          <thead className="text-xs text-ink-3">
            <tr>
              <th className="px-3 py-2 text-left font-normal">模型</th>
              <th className="px-3 py-2 text-left font-normal">上线</th>
              <th className="px-3 py-2 text-right font-normal">上下文</th>
              <th className="px-3 py-2 text-right font-normal">输入/百万</th>
              <th className="px-3 py-2 text-right font-normal">输出/百万</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.modelKey} className="border-t border-line-soft">
                <td className="px-3 py-2">
                  {row.url ? (
                    <a className="hover:underline" href={row.url} target="_blank" rel="noreferrer noopener">
                      {row.name}
                    </a>
                  ) : (
                    row.name
                  )}
                </td>
                <td className="px-3 py-2 text-ink-3">{formatDate(row.releasedAt)}</td>
                <td className="px-3 py-2 text-right">{formatContext(row.contextLength)}</td>
                <td className="px-3 py-2 text-right">{formatPrice(row.priceIn)}</td>
                <td className="px-3 py-2 text-right">{formatPrice(row.priceOut)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export default function LeaderboardPage() {
  const payload = useLoaderData() as LeaderboardPayload;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">{payload.title}</h1>
        <p className="max-w-3xl text-sm text-ink-3">{payload.description}</p>
        <p className="text-xs text-ink-4">数据更新于 {formatDate(payload.generatedAt)}</p>
      </header>

      <ul className="flex flex-col gap-1 rounded-lg border border-line px-4 py-3">
        {payload.sources.map((source: SourceView) => (
          <li key={source.key} className="text-xs text-ink-3">
            <a className="text-ink-2 hover:underline" href={source.url} target="_blank" rel="noreferrer noopener">
              {source.label}
            </a>
            {source.snapshot ? ` · ${source.snapshot} 版` : ""}
            {source.models > 0 ? ` · ${source.models} 个模型` : ""}
            {source.scores > 0 ? ` · ${source.scores} 条成绩` : ""}
            {source.licence ? ` · ${source.licence}` : ""}
            {source.error ? <span className="text-amber"> · 最近一次读取失败：{source.error}</span> : null}
          </li>
        ))}
      </ul>

      {payload.benchmark ? (
        <MainTable benchmark={payload.benchmark} />
      ) : (
        <p className="rounded-lg border border-line px-4 py-6 text-sm text-ink-3">
          还没有评测数据。在服务器上跑一次同步：
          <code className="ml-2 rounded bg-bg-muted px-1.5 py-0.5">node --env-file=.env modules/leaderboard/scripts/sync.ts</code>
        </p>
      )}

      {payload.tables.map((table) => (
        <OtherTable key={`${table.sourceKey}:${table.metricKey}`} table={table} />
      ))}

      {payload.catalogue.length > 0 ? <Catalogue rows={payload.catalogue} source={payload.catalogueSource} /> : null}
    </div>
  );
}
