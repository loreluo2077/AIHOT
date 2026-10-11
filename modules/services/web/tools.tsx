// The services page: one card per entry in config.ts, each a plain outbound link. There is no loader —
// the list is configuration, not data, so the page needs no API and no database.
import { useState } from "react";
import { pageMeta } from "@aihot/web/lib/seo";
import type { Screen } from "@aihot/web/components/shell/screens";
import { buttonClass } from "@aihot/web/components/ui/Controls";
import { SERVICES } from "../config.ts";

/** The phone shell: reached from 我的, so that tab stays lit and a back button reads AI 服务. */
export const handle: Screen = { tab: "me", name: "AI 服务" };

export function meta() {
  // The share card is the site's own (site/site.ts CARDS.tools).
  return pageMeta({ title: SERVICES.title, description: SERVICES.description, path: "/tools", image: "/og/pages/tools.png" });
}

export function ServicesContent() {
  const [goal, setGoal] = useState<keyof typeof SERVICES.goals | "all">("all");
  const featured = SERVICES.entries.find((entry) => entry.featured);
  const visible = SERVICES.entries.filter((entry) => entry.kind !== "radar" && (goal === "all" || entry.goal === goal));
  const radar = SERVICES.entries.filter((entry) => entry.kind === "radar");
  const kindLabel = { editorial: "编辑推荐", sponsored: "合作推荐", owned: "自有产品", radar: "观察中" } as const;
  return (
    <>
      {SERVICES.entries.length === 0 ? (
        <p className="rounded-lg border border-line px-4 py-6 text-sm text-ink-3">
          还没有配置。往 <code className="rounded bg-bg-muted px-1.5 py-0.5">modules/services/config.ts</code> 的{" "}
          <code className="rounded bg-bg-muted px-1.5 py-0.5">entries</code> 里加一条，这里就会出现一张卡片。
        </p>
      ) : <>
        {featured && (
          <section className="overflow-hidden rounded-card border border-accent/25 bg-accent-softer p-5 lg:grid lg:grid-cols-[minmax(0,1fr)_180px] lg:gap-8 lg:p-7">
            <div>
              <span className="inline-flex rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-contrast">本周推荐</span>
              <div className="mt-4 flex flex-wrap items-center gap-2"><h2 className="text-[22px] font-semibold text-ink">{featured.name}</h2><span className="text-[12px] font-medium text-accent">{kindLabel[featured.kind]}</span></div>
              <p className="mt-2 text-[16px] leading-relaxed text-ink-2">{featured.oneLiner}</p>
              <p className="mt-4 max-w-xl text-[13px] leading-relaxed text-ink-3"><span className="font-semibold text-ink">为什么推荐：</span>{featured.recommendation}</p>
              <a href={featured.url} target="_blank" rel="noreferrer noopener" className={`${buttonClass("primary", "lg")} mt-5`}>去看看 <span aria-hidden>→</span></a>
            </div>
            <div className="mt-6 flex min-h-32 items-end rounded-tile border border-accent/20 bg-surface p-4 lg:mt-0"><span className="text-[11px] font-medium tracking-widest text-accent">EDITOR&apos;S PICK<br /><span className="text-ink-4">DEMO PLACEMENT</span></span></div>
          </section>
        )}

        <section>
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-[17px] font-semibold text-ink">按目标找工具</h2><p className="mt-1 text-[13px] text-ink-4">先解决眼前的问题，再决定要不要加入工具箱。</p></div></div>
          <div className="scrollbar-none -mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1">
            <button type="button" onClick={() => setGoal("all")} className={`${buttonClass(goal === "all" ? "primary" : "secondary")} shrink-0`}>全部</button>
            {Object.entries(SERVICES.goals).map(([key, label]) => <button key={key} type="button" onClick={() => setGoal(key as keyof typeof SERVICES.goals)} className={`${buttonClass(goal === key ? "primary" : "secondary")} shrink-0`}>{label}</button>)}
          </div>
        </section>

        <section className="grid gap-3 lg:grid-cols-2">
          {visible.map((entry) => (
            <article key={entry.url} className="card flex flex-col p-5">
              <div className="flex flex-wrap items-center gap-2"><h3 className="text-[17px] font-semibold text-ink">{entry.name}</h3><span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">{kindLabel[entry.kind]}</span>{entry.price && <span className="text-[12px] text-ink-4">{entry.price}</span>}</div>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{entry.oneLiner}</p>
              <p className="mt-4 border-t border-line-soft pt-3 text-[13px] leading-relaxed text-ink-3"><span className="font-semibold text-ink">为什么推荐：</span>{entry.recommendation}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">{entry.tags.map((tag) => <span key={tag} className="chip">{tag}</span>)}<a href={entry.url} target="_blank" rel="noreferrer noopener" className="ml-auto text-[13px] font-semibold text-accent hover:text-accent-ink">查看工具 →</a></div>
            </article>
          ))}
        </section>

        <section className="border-t border-line pt-5"><div className="flex items-baseline justify-between gap-3"><div><h2 className="text-[17px] font-semibold text-ink">工具雷达</h2><p className="mt-1 text-[13px] text-ink-4">最近值得留意，但我还在继续观察的工具。</p></div><span className="text-[12px] text-ink-4">持续更新</span></div><div className="mt-3 divide-y divide-line-soft rounded-card border border-line bg-surface">{radar.map((entry) => <a key={entry.url} href={entry.url} target="_blank" rel="noreferrer noopener" className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-bg-sunk"><span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold text-ink">{entry.name}</span><span className="mt-0.5 block truncate text-[12.5px] text-ink-4">{entry.oneLiner}</span></span><span className="text-[12px] font-medium text-accent">观察中</span></a>)}</div></section>
      </>}

      <p className="text-xs text-ink-4">{SERVICES.note}</p>
    </>
  );
}

export default function ServicesPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">{SERVICES.title}</h1>
        <p className="text-sm text-ink-3">{SERVICES.description}</p>
      </header>
      <ServicesContent />
    </div>
  );
}
