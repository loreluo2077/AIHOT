// The model leaderboard page: one ranked table the way a leaderboard is read — rank, model, the
// benchmark's own score for the chosen ability, and the catalogue's release date and price on the
// same row. Phones read the same ranking as a compact list (no sideways scrolling); desktop reads a
// table. It reads this module's own API over HTTP (the web never touches the database) and every
// number keeps the source it came from. Sorting happens in the browser.
import { useMemo, useState } from "react";
import { pageMeta } from "@aihot/web/lib/seo";
import { useLoaderData } from "react-router";
import type { Screen } from "@aihot/web/components/shell/screens";
import { PhoneBar } from "@aihot/web/components/shell/PhoneBar";
import { PillTabs } from "@aihot/web/components/ui/Tabs";
import { ToggleChip } from "@aihot/web/components/ui/Controls";
import { Sheet } from "@aihot/web/components/ui/Sheet";
import { IconFilter } from "@aihot/web/components/icons";
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

/** One decimal, the way scores are compared at a glance (79 → 79.0). */
function formatScore(value: number | null): string {
  if (value === null) return "—";
  return value.toFixed(1);
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

/** The benchmark's group names are English; the page reads them in Chinese (original kept in title). */
const ZH_LABEL: Record<string, string> = {
  Reasoning: "推理",
  Coding: "编程",
  "Agentic Coding": "智能体编程",
  Mathematics: "数学",
  "Data Analysis": "数据分析",
  Language: "语言",
  IF: "指令遵循",
};

function labelOf(column: { key: string; label: string }): string {
  return column.key === "overall" ? "综合" : (ZH_LABEL[column.label] ?? column.label);
}

/** Catalogue vendors come from an id prefix ("anthropic"); display them named. */
const VENDOR_NAMES: Record<string, string> = {
  openai: "OpenAI",
  deepseek: "DeepSeek",
  moonshotai: "Moonshot AI",
  zai: "Z.ai",
  "x-ai": "xAI",
  "stepfun-ai": "StepFun",
  minimax: "MiniMax",
  "01-ai": "01.AI",
};

function prettyVendor(vendor: string | null): string | null {
  if (!vendor) return null;
  return VENDOR_NAMES[vendor.toLowerCase()] ?? vendor.charAt(0).toUpperCase() + vendor.slice(1);
}

/** 「9月22日」 for this year's releases, 「2025年12月3日」 otherwise; null when unknown. */
function releaseShort(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return null;
  const year = date.getUTCFullYear();
  const core = `${date.getUTCMonth() + 1}月${date.getUTCDate()}日`;
  return year === new Date().getUTCFullYear() ? core : `${year}年${core}`;
}

const RANK_TONE = ["text-rank-1", "text-rank-2", "text-rank-3"];

interface Filters {
  query: string;
  freeOnly: boolean;
  /** Pretty vendor names; empty means all. */
  vendors: string[];
}

const EMPTY_FILTERS: Filters = { query: "", freeOnly: false, vendors: [] };

function activeFilterCount(filters: Filters): number {
  return (filters.query.trim() ? 1 : 0) + (filters.freeOnly ? 1 : 0) + (filters.vendors.length ? 1 : 0);
}

/** The model cell (desktop): an initial tile, the display name, and the catalogue's vendor under it. */
function ModelCell({ row }: { row: BenchmarkRow & { position: number } }) {
  const name = prettyModelName(row.model);
  const vendor = prettyVendor(row.vendor);
  const sub = vendor ?? (row.url ? row.catalogueName : "目录未收录");
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-bg-sunk text-[13px] font-bold text-ink-3">
        {name.slice(0, 1).toUpperCase()}
      </span>
      <span className="min-w-0">
        <span title={row.model} className="block truncate font-semibold text-ink">
          {row.url ? (
            <a href={row.url} target="_blank" rel="noreferrer noopener" className="hover:text-accent hover:underline">
              {name}
            </a>
          ) : (
            name
          )}
        </span>
        {sub && <span className="block truncate text-[12px] text-ink-4">{sub}</span>}
      </span>
    </div>
  );
}

function MainTable({ benchmark, sortKey, filters, onFilters, view, onView }: {
  benchmark: BenchmarkView;
  sortKey: string;
  filters: Filters;
  onFilters: (patch: Partial<Filters>) => void;
  view: "ranking" | "catalogue";
  onView: (view: "ranking" | "catalogue") => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const activeLabel = labelOf(benchmark.columns.find((column) => column.key === sortKey) ?? { key: "overall", label: "综合" });
  const all = useMemo(() => {
    const sorted = [...benchmark.rows].sort((a, b) => (valueOf(b, sortKey) ?? -1) - (valueOf(a, sortKey) ?? -1));
    return sorted.map((row, index) => ({ ...row, position: index + 1 }));
  }, [benchmark, sortKey]);
  const vendorOptions = useMemo(
    () => [...new Set(benchmark.rows.map((row) => prettyVendor(row.vendor)).filter((vendor): vendor is string => !!vendor))].sort((a, b) => a.localeCompare(b, "zh")),
    [benchmark],
  );
  // Filters narrow what shows; a row's score and rank stay the benchmark's own (筛选不改名次).
  const rows = useMemo(() => {
    const needle = filters.query.trim().toLowerCase();
    return all.filter((row) => {
      const vendor = prettyVendor(row.vendor) ?? "";
      return (
        (!filters.freeOnly || row.priceIn === 0) &&
        (filters.vendors.length === 0 || filters.vendors.includes(vendor)) &&
        (!needle || row.model.toLowerCase().includes(needle) || vendor.toLowerCase().includes(needle) || (row.catalogueName ?? "").toLowerCase().includes(needle))
      );
    });
  }, [all, filters]);
  const activeCount = activeFilterCount(filters);
  const toggleVendor = (vendor: string) =>
    onFilters({ vendors: filters.vendors.includes(vendor) ? filters.vendors.filter((entry) => entry !== vendor) : [...filters.vendors, vendor] });

  return (
    <section className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-4">
        <h2 className="text-[15px] font-semibold text-ink">
          {activeLabel}榜 <span className="ml-1 text-[12px] font-normal text-ink-4">{benchmark.rows.length} 个模型</span>
        </h2>
        <div className="hidden items-center gap-2 lg:flex">
          <input
            value={filters.query}
            onChange={(event) => onFilters({ query: event.target.value })}
            placeholder="搜索模型或厂商"
            aria-label="搜索模型或厂商"
            className="h-8 w-48 rounded-full border border-line-strong bg-surface px-3.5 text-[12.5px] text-ink outline-none transition-colors placeholder:text-ink-4 focus:border-accent"
          />
          <ToggleChip on={filters.freeOnly} onToggle={() => onFilters({ freeOnly: !filters.freeOnly })}>
            只看免费
          </ToggleChip>
        </div>
      </div>

      {/* Phones: the 筛选 sheet and the view switch live under the card title, as the reference reads. */}
      <div className="flex items-center justify-between gap-3 px-5 pb-3 lg:hidden">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className={`inline-flex h-11 items-center gap-1.5 rounded-full border px-4 text-[13.5px] font-medium transition-colors active:scale-[0.98] ${activeCount > 0 ? "border-accent/35 bg-accent-soft text-accent" : "border-line-strong bg-surface text-ink-2"}`}
        >
          <IconFilter size={16} />
          筛选{activeCount > 0 ? ` · ${activeCount}` : ""}
        </button>
        <PillTabs size="xs" layoutId="leaderboard-view-mobile" label="查看方式" active={view} onSelect={(key) => onView(key as "ranking" | "catalogue")} items={[{ key: "ranking", label: "榜单" }, { key: "catalogue", label: "模型目录" }]} />
      </div>

      {/* Phones: a compact ranked list — no sideways scrolling; the score and coverage stack right. */}
      <div className="border-t border-line-soft lg:hidden">
        <div className="flex items-center gap-3 px-4 pb-2 pt-3 text-[11.5px] text-ink-4">
          <span className="w-8 shrink-0">名次</span>
          <span className="min-w-0 flex-1">模型</span>
          <span className="w-20 shrink-0 text-right">
            {activeLabel}评分 <span aria-hidden>↓</span>
          </span>
        </div>
        <ul className="divide-y divide-line-soft pb-1">
          {rows.map((row) => {
            const name = prettyModelName(row.model);
            const vendor = prettyVendor(row.vendor);
            const sub = [vendor, releaseShort(row.releasedAt) ? `${releaseShort(row.releasedAt)}上线` : null].filter(Boolean).join(" · ");
            return (
              <li key={row.modelKey} className="flex items-center gap-3 px-4 py-3.5">
                <span className={`w-8 shrink-0 font-semibold tabular-nums ${RANK_TONE[row.position - 1] ?? "text-ink-3"}`}>{String(row.position).padStart(2, "0")}</span>
                <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-bg-sunk text-[14px] font-bold text-ink-3">
                  {name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span title={row.model} className="block truncate text-[15.5px] font-semibold text-ink">
                    {row.url ? (
                      <a href={row.url} target="_blank" rel="noreferrer noopener" className="hover:text-accent hover:underline">
                        {name}
                      </a>
                    ) : (
                      name
                    )}
                  </span>
                  <span className="block truncate text-[12px] text-ink-4">{sub || "目录未收录"}</span>
                </span>
                <span className="w-20 shrink-0 text-right">
                  <span className="block text-[22px] font-semibold leading-none tabular-nums text-accent">{formatScore(valueOf(row, sortKey))}</span>
                  <span className="mt-1 block text-[11.5px] text-ink-4">覆盖 {row.total > 0 ? `${Math.round((row.covered / row.total) * 100)}%` : "—"}</span>
                </span>
              </li>
            );
          })}
          {rows.length === 0 && (
            <li className="px-4 py-10 text-center text-[13px] text-ink-4">没有符合条件的模型，试试清掉筛选。</li>
          )}
        </ul>
      </div>

      {/* Desktop: the full table. */}
      <div className="hidden overflow-x-auto border-t border-line-soft lg:block">
        <table className="w-full min-w-[880px] text-sm">
          <thead className="bg-bg-muted text-xs text-ink-3">
            <tr>
              <th className="w-14 px-4 py-2.5 text-left font-normal">名次</th>
              <th className="px-3 py-2.5 text-left font-normal">模型</th>
              <th className="w-28 px-3 py-2.5 text-left font-normal">上线日期</th>
              <th className="w-28 px-3 py-2.5 text-left font-normal">评测证据</th>
              <th className="w-28 px-3 py-2.5 text-right font-normal">输入/百万</th>
              <th className="w-28 px-3 py-2.5 text-right font-normal">输出/百万</th>
              <th className="w-28 px-4 py-2.5 text-right font-normal">
                {activeLabel}评分 <span aria-hidden>↓</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.modelKey} className="border-t border-line-soft hover:bg-bg-muted/50">
                <td className={`px-4 py-3.5 font-semibold tabular-nums ${RANK_TONE[row.position - 1] ?? "text-ink-3"}`}>{String(row.position).padStart(2, "0")}</td>
                <td className="px-3 py-2.5">
                  <ModelCell row={row} />
                </td>
                <td className="px-3 py-2.5 text-ink-3">{formatDate(row.releasedAt)}</td>
                <td className="px-3 py-2.5 text-ink-3">
                  <span className="block tabular-nums">{row.total > 0 ? `${row.covered} 类` : "—"}</span>
                  {row.total > 0 && <span className="block text-[11.5px] text-ink-4">覆盖 {Math.round((row.covered / row.total) * 100)}%</span>}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-ink-2">{formatPrice(row.priceIn)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-ink-2">{formatPrice(row.priceOut)}</td>
                <td className="px-4 py-2.5 text-right">
                  <span className="text-[21px] font-semibold tabular-nums text-accent">{formatScore(valueOf(row, sortKey))}</span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-[13px] text-ink-4">
                  没有符合条件的模型，试试清掉筛选。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="border-t border-line-soft px-5 py-3 text-xs leading-relaxed text-ink-4">
        「{activeLabel}」是 {benchmark.sourceLabel}
        自己发布的读数{sortKey === "overall" ? "（其表格里的综合行）" : "（该类别下各任务的平均分）"}，本站不做任何跨基准换算。
        「评测证据」是该模型已测的类别数与覆盖率，覆盖不足一半的模型先不参与名次。价格来自模型目录，按每百万 Token 展示，筛选只改显示、不改名次。
      </p>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="筛选">
        <div className="space-y-5 px-1 pb-2">
          <input
            value={filters.query}
            onChange={(event) => onFilters({ query: event.target.value })}
            placeholder="搜索模型或厂商"
            aria-label="搜索模型或厂商"
            className="h-11 w-full rounded-full border border-line-strong bg-surface px-4 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-4 focus:border-accent"
          />
          <div>
            <ToggleChip on={filters.freeOnly} onToggle={() => onFilters({ freeOnly: !filters.freeOnly })}>
              只看免费
            </ToggleChip>
          </div>
          {vendorOptions.length > 0 && (
            <div>
              <p className="mb-2 text-[12px] text-ink-4">厂商</p>
              <div className="flex flex-wrap gap-2">
                {vendorOptions.map((vendor) => (
                  <ToggleChip key={vendor} on={filters.vendors.includes(vendor)} onToggle={() => toggleVendor(vendor)}>
                    {vendor}
                  </ToggleChip>
                ))}
              </div>
            </div>
          )}
          {activeCount > 0 && (
            <button type="button" onClick={() => onFilters(EMPTY_FILTERS)} className="text-[13px] font-medium text-accent hover:text-accent-ink">
              清除全部筛选
            </button>
          )}
        </div>
      </Sheet>
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
    <details className="rounded-lg border border-line px-4 py-3" open>
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
                      {prettyVendor(row.vendor) ?? row.name}
                    </a>
                  ) : (
                    prettyVendor(row.vendor) ?? row.name
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

export function LeaderboardContent({ payload, embedded = false }: { payload: LeaderboardPayload; embedded?: boolean }) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [view, setView] = useState<"ranking" | "catalogue">("ranking");
  const [sortKey, setSortKey] = useState("overall");
  const benchmark = payload.benchmark;
  const columns = benchmark?.columns ?? [];
  const updated = formatDate(payload.generatedAt);
  const totalScores = payload.sources.reduce((sum, source) => sum + source.scores, 0);
  const onFilters = (patch: Partial<Filters>) => setFilters((previous) => ({ ...previous, ...patch }));
  return (
    <div className="space-y-5">
      <header className="pb-4 pt-2 lg:rounded-card lg:border lg:bg-surface lg:px-6 lg:py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="mono text-[11px] font-semibold tracking-[0.22em] text-accent">AI FOMO LEADERBOARD</p>
            <h1 className="mt-1.5 text-[24px] font-semibold tracking-tight text-ink">模型榜</h1>
          </div>
          <div className={`${embedded ? "flex" : "hidden lg:flex"} items-center gap-2`}>
            <a href="#leaderboard-sources" className="rounded-full border border-line-strong px-3.5 py-2 text-[12.5px] font-medium text-ink-2 transition-colors hover:border-ink-4 hover:text-ink">
              评测来源 ↗
            </a>
            <a href="#leaderboard-method" className="rounded-full border border-line-strong px-3.5 py-2 text-[12.5px] font-medium text-ink-2 transition-colors hover:border-ink-4 hover:text-ink">
              怎么算的 ↗
            </a>
          </div>
        </div>
        {columns.length > 0 && (
          <PillTabs
            className="mt-5"
            size="sm"
            layoutId="leaderboard-abilities"
            label="能力维度"
            active={sortKey}
            onSelect={setSortKey}
            items={columns.map((column) => ({ key: column.key, label: labelOf(column), ...(column.key !== "overall" && ZH_LABEL[column.label] ? { title: column.label } : {}) }))}
          />
        )}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-2xl text-[13px] leading-relaxed text-ink-3">
            只用公开评测机构自己发布的成绩：分数来自数据源本身，本站不混算不同基准，也不代跑评测。
          </p>
          <span className="num shrink-0 text-[12px] text-ink-4">
            {totalScores > 0 ? `${totalScores} 项成绩 · ` : ""}
            {payload.sources.length} 个来源 · {updated} 更新
          </span>
        </div>
        <div className="mt-4 hidden flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-4 lg:flex">
          <span className="text-[12.5px] text-ink-4">{benchmark ? `${benchmark.sourceLabel} 数据${benchmark.snapshot ? ` · ${benchmark.snapshot} 版` : ""}` : "等待评测数据同步"}</span>
          <PillTabs size="xs" layoutId="leaderboard-view" label="查看方式" active={view} onSelect={(key) => setView(key as "ranking" | "catalogue")} items={[{ key: "ranking", label: "榜单" }, { key: "catalogue", label: "模型目录" }]} />
        </div>
      </header>

      {view === "ranking" && benchmark ? (
        <MainTable benchmark={benchmark} sortKey={sortKey} filters={filters} onFilters={onFilters} view={view} onView={setView} />
      ) : view === "ranking" ? (
        <p className="rounded-lg border border-line px-4 py-6 text-sm text-ink-3">
          还没有评测数据。在服务器上跑一次同步：
          <code className="ml-2 rounded bg-bg-muted px-1.5 py-0.5">node --env-file=.env modules/leaderboard/scripts/sync.ts</code>
        </p>
      ) : payload.catalogue.length > 0 ? (
        <Catalogue rows={payload.catalogue} source={payload.catalogueSource} />
      ) : (
        <p className="rounded-card border border-line px-4 py-6 text-sm text-ink-3">模型目录暂时没有数据。</p>
      )}

      {view === "ranking" && benchmark && benchmark.watchlist.length > 0 && (
        <section className="rounded-card border border-line bg-surface px-5 py-4">
          <h3 className="text-[14px] font-semibold text-ink">暂不排名</h3>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-4">这些模型已有综合分，但测过的能力类别还太少，一个坏成绩就可能带偏名次；分项补齐后自动进入榜单。</p>
          <ul className="mt-3 divide-y divide-line-soft">
            {benchmark.watchlist.map((row) => (
              <li key={row.modelKey} className="flex items-center gap-3 py-2.5">
                <span title={row.model} className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">
                  {prettyModelName(row.model)}
                </span>
                <span className="mono shrink-0 text-[11.5px] text-ink-4">
                  已测 {row.covered}/{row.total} 类能力
                </span>
                <span className="num shrink-0 text-right text-[13px] font-semibold tabular-nums text-ink-2">{formatScore(row.overall)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {view === "ranking" && payload.tables.map((table) => (
        <OtherTable key={`${table.sourceKey}:${table.metricKey}`} table={table} />
      ))}

      <section id="leaderboard-method" className="grid gap-3 lg:grid-cols-2">
        <div className="border-t border-line pt-4"><h3 className="text-[14px] font-semibold text-ink">怎么算的</h3><p className="mt-1.5 text-[13px] leading-relaxed text-ink-4">每个能力榜只展示该数据源自己发布的读数：综合是它表格里的综合行，各能力列是该类别下各任务的平均分。分数不是正确率，也不做跨基准换算；换模型前用自己的工作内容验证。</p></div>
        <div id="leaderboard-sources" className="border-t border-line pt-4"><h3 className="text-[14px] font-semibold text-ink">评测来源</h3><ul className="mt-1.5 space-y-1 text-[13px] leading-relaxed text-ink-4">{payload.sources.map((source: SourceView) => <li key={source.key}><a className="text-ink-2 hover:underline" href={source.url} target="_blank" rel="noreferrer noopener">{source.label}</a>{source.snapshot ? ` · ${source.snapshot}` : ""}{source.models ? ` · ${source.models} 个模型` : ""}{source.scores ? ` · ${source.scores} 项成绩` : ""}{source.licence ? ` · ${source.licence}` : ""}{source.error ? <span className="text-amber"> · 最近读取失败</span> : null}</li>)}</ul></div>
      </section>
    </div>
  );
}

export default function LeaderboardPage() {
  const payload = useLoaderData() as LeaderboardPayload;
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-4 lg:py-6">
      <PhoneBar
        title="模型榜"
        actions={
          <a href="#leaderboard-method" className="flex h-11 items-center pl-2 pr-2.5 text-[14px] font-medium text-accent">
            怎么算
          </a>
        }
      />
      <LeaderboardContent payload={payload} />
    </div>
  );
}
