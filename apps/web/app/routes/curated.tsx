import { useState } from "react";
import { Link, useLoaderData, useSearchParams } from "react-router";
import type { TimelineResponse } from "@aihot/contracts/site";
import type { LeaderboardPayload } from "@aihot/leaderboard/types";
import { LeaderboardContent } from "@aihot/leaderboard/web/leaderboard";
import { ServicesContent } from "@aihot/services/web/tools";
import { Wordmark } from "@aihot/site/brand/Logo.tsx";
import { apiGet, cachedPage, loadOr404 } from "../lib/api.server";
import { filterParams, listPath, pageMeta, readFilters } from "../lib/seo";
import type { CategoryKey, ChannelKey } from "@aihot/contracts/taxonomy";
import { PillTabs } from "../components/ui/Tabs";
import { buttonClass } from "../components/ui/Controls";
import { PhoneBar } from "../components/shell/PhoneBar";
import type { Screen } from "../components/shell/screens";
import { ActiveFilters, ArticleFilterButton, CategoryTabs, SearchButton, SearchField } from "../features/feed/Filters";
import { Timeline } from "../features/feed/Timeline";

export const handle: Screen = { tab: "curated", name: "精选" };

type CuratedTab = "tools" | "leaderboard" | "articles";

export function meta() {
  return pageMeta({ title: "精选", path: "/curated", noindex: true });
}

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const filters = readFilters(url.searchParams);
  const [articles, leaderboard] = await Promise.all([
    loadOr404<TimelineResponse>(listPath("/api/site/timeline", filterParams(filters)), { signal: request.signal }),
    apiGet<LeaderboardPayload>("/api/leaderboard", { signal: request.signal }).catch(() => null),
  ]);
  return cachedPage(60, { articles, filters, leaderboard });
}

const TABS: Array<{ key: CuratedTab; label: string }> = [
  { key: "tools", label: "工具" },
  { key: "leaderboard", label: "模型榜" },
  { key: "articles", label: "文章" },
];

const MOCK_MODELS = [
  { rank: 1, name: "Orion 3.5", score: "91.8", note: "推理、代码与长文本任务表现稳定" },
  { rank: 2, name: "Lumen Pro", score: "89.4", note: "适合日常写作、多轮对话和知识整理" },
  { rank: 3, name: "Atlas Code", score: "87.9", note: "代码生成、重构与命令行任务更突出" },
] as const;

const MOCK_ARTICLES = [
  { source: "编辑笔记", time: "今天", goal: "reduce", featured: true, title: "新模型更新很快，但真正值得换的往往只有一两个理由", summary: "性能提升不等于所有人都需要立刻迁移。先看它能不能解决你正在做的那件事。", reason: "这篇写给每次更新一来，就觉得自己必须重新学一遍的人。", tags: ["减少焦虑", "模型选择"] },
  { source: "工作流", time: "今天", goal: "work", featured: false, title: "别再收藏工具清单了，先给一个重复任务找自动化入口", summary: "把“我该学什么”换成“这周哪件重复工作最值得省掉”。", reason: "看完可以立刻做，不需要先研究十个新工具。", tags: ["工作流", "自动化"] },
  { source: "产品观察", time: "昨天", goal: "build", featured: false, title: "做产品之前，先用 AI 把用户会问的问题写出来", summary: "一页清楚的问题清单，比一份很长的功能列表更接近真正的开始。", reason: "适合有想法、但还不想被技术栈吓退的时候。", tags: ["做产品", "快速验证"] },
  { source: "FOMO 笔记", time: "昨天", goal: "reduce", featured: false, title: "当你想同时学三种工具时，先把其中两个关掉", summary: "工具越多不代表开始得越快。能持续使用的一个，胜过收藏夹里的十个。", reason: "给正在被选择太多困住的人。", tags: ["减少焦虑", "习惯"] },
  { source: "研究方法", time: "2 天前", goal: "learn", featured: false, title: "把 AI 当成研究搭子之前，先学会追问它的来源", summary: "答案顺不顺不等于可靠。保留出处，才能让下一步判断有据可查。", reason: "适合需要把 AI 用进真实工作，而不是只图省事的人。", tags: ["研究", "学习"] },
] as const;

function MockLeaderboard() {
  return (
    <section className="card overflow-hidden">
      <header className="border-b border-line-soft px-5 py-4">
        <p className="text-[15px] font-semibold text-ink">本周模型表现</p>
        <p className="mt-1 text-[13px] text-ink-4">演示数据，接入真实评测后会自动替换。</p>
      </header>
      <ol className="divide-y divide-line-soft">
        {MOCK_MODELS.map((model) => (
          <li key={model.name} className="flex items-center gap-4 px-5 py-4">
            <span className="num w-6 text-[18px] font-semibold text-accent">{model.rank}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-ink">{model.name}</span>
              <span className="mt-0.5 block text-[13px] text-ink-4">{model.note}</span>
            </span>
            <span className="num text-[16px] font-semibold text-ink">{model.score}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function MockArticles() {
  const [goal, setGoal] = useState<"all" | "reduce" | "work" | "build" | "learn">("all");
  const featured = MOCK_ARTICLES.find((article) => article.featured)!;
  const visible = MOCK_ARTICLES.filter((article) => !article.featured && (goal === "all" || article.goal === goal));
  const radar = [
    { label: "新一轮 Agent 工作流实践", note: "正在观察是否真的比现有流程省时间。" },
    { label: "多模型协作的成本与稳定性", note: "值得关注，但还不急着跟进。" },
  ];
  const goals = [
    { key: "all", label: "全部" },
    { key: "reduce", label: "少点焦虑" },
    { key: "work", label: "提高效率" },
    { key: "build", label: "做产品" },
    { key: "learn", label: "学习研究" },
  ] as const;
  return (
    <div className="space-y-7">
      <section className="overflow-hidden rounded-card border border-accent/25 bg-accent-softer p-5 lg:grid lg:grid-cols-[minmax(0,1fr)_180px] lg:gap-8 lg:p-7">
        <div>
          <span className="inline-flex rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-contrast">本周必读</span>
          <div className="mt-4 flex items-center gap-2 text-[12px] text-ink-4"><span>{featured.source}</span><span>·</span><time>{featured.time}</time></div>
          <h2 className="mt-2 max-w-2xl text-[22px] font-semibold leading-relaxed text-ink">{featured.title}</h2>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-2">{featured.summary}</p>
          <p className="mt-4 max-w-xl text-[13px] leading-relaxed text-ink-3"><span className="font-semibold text-ink">为什么值得读：</span>{featured.reason}</p>
          <button type="button" className={`${buttonClass("primary", "lg")} mt-5`}>先读这篇 <span aria-hidden>→</span></button>
        </div>
        <div className="mt-6 flex min-h-32 items-end rounded-tile border border-accent/20 bg-surface p-4 lg:mt-0"><span className="text-[11px] font-medium tracking-widest text-accent">EDITOR&apos;S READ<br /><span className="text-ink-4">DEMO PLACEMENT</span></span></div>
      </section>

      <section>
        <div><h2 className="text-[17px] font-semibold text-ink">按你现在需要的读</h2><p className="mt-1 text-[13px] text-ink-4">不用把所有 AI 新闻都看完，先挑和你有关的。</p></div>
        <div className="scrollbar-none -mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1">
          {goals.map((item) => <button key={item.key} type="button" onClick={() => setGoal(item.key)} className={`${buttonClass(goal === item.key ? "primary" : "secondary")} shrink-0`}>{item.label}</button>)}
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        {visible.map((article) => (
          <article key={article.title} className="card flex flex-col p-5">
            <div className="flex items-center gap-2 text-[12px] text-ink-4"><span>{article.source}</span><span>·</span><time>{article.time}</time></div>
            <h3 className="mt-2 text-[17px] font-semibold leading-relaxed text-ink">{article.title}</h3>
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink-3">{article.summary}</p>
            <p className="mt-4 border-t border-line-soft pt-3 text-[13px] leading-relaxed text-ink-3"><span className="font-semibold text-ink">为什么值得读：</span>{article.reason}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2">{article.tags.map((tag) => <span key={tag} className="chip">{tag}</span>)}<button type="button" className="ml-auto text-[13px] font-semibold text-accent hover:text-accent-ink">阅读文章 →</button></div>
          </article>
        ))}
      </section>

      <section className="border-t border-line pt-5"><div className="flex items-baseline justify-between gap-3"><div><h2 className="text-[17px] font-semibold text-ink">继续关注</h2><p className="mt-1 text-[13px] text-ink-4">还在观察、值得之后回来看的变化。</p></div><span className="text-[12px] text-ink-4">编辑更新</span></div><div className="mt-3 divide-y divide-line-soft rounded-card border border-line bg-surface">{radar.map((item) => <div key={item.label} className="flex items-center gap-3 px-4 py-3"><span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold text-ink">{item.label}</span><span className="mt-0.5 block truncate text-[12.5px] text-ink-4">{item.note}</span></span><span className="text-[12px] font-medium text-accent">关注中</span></div>)}</div></section>
    </div>
  );
}

function CuratedHeader({ category, channel, articles }: { category: CategoryKey | null; channel: ChannelKey; articles: boolean }) {
  return (
    <PhoneBar
      leading={<Link to="/" aria-label="AI FOMO 首页" className="flex h-11 items-center pl-2.5 pr-2 text-ink"><Wordmark size={17} /></Link>}
      actions={<>{articles && <ArticleFilterButton base="/curated" category={category} channel={channel} />}<SearchButton /></>}
    />
  );
}

export default function CuratedPage() {
  const { articles, filters, leaderboard } = useLoaderData<typeof loader>();
  const [params] = useSearchParams();
  const requested = params.get("section");
  const [tab, setTab] = useState<CuratedTab>(requested === "articles" || requested === "leaderboard" ? requested : "tools");
  const articleTab = tab === "articles";

  return (
    <div className="mx-auto max-w-[var(--page-max-reading)] pb-10 pt-3 lg:pt-1">
      <CuratedHeader category={filters.category} channel={filters.channel ?? "all"} articles={articleTab} />
      <PillTabs fill layoutId="curated-sections" label="精选内容" active={tab} onSelect={(key) => setTab(key as CuratedTab)} items={TABS} />
      <div className="mt-5">
        {tab === "tools" && <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-1"><ServicesContent /></div>}
        {tab === "leaderboard" && <div className="mx-auto w-full max-w-6xl px-4 py-1">{leaderboard?.benchmark || leaderboard?.tables.length || leaderboard?.catalogue.length ? <LeaderboardContent payload={leaderboard} embedded /> : <MockLeaderboard />}</div>}
        {articleTab && <>{articles.cards.length > 0 ? <><ActiveFilters base="/curated" category={filters.category} channel={filters.channel ?? "all"} tag={filters.tag} /><Timeline initial={articles} filters={articles.filters} /></> : <div className="mx-auto max-w-3xl px-4"><MockArticles /></div>}</>}
      </div>
    </div>
  );
}
