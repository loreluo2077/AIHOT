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
        {tab === "leaderboard" && (leaderboard ? <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-1"><LeaderboardContent payload={leaderboard} /></div> : <p className="card mx-4 px-4 py-6 text-sm text-ink-3">模型榜暂时不可用，请稍后再试。</p>)}
        {articleTab && <><ActiveFilters base="/curated" category={filters.category} channel={filters.channel ?? "all"} tag={filters.tag} /><Timeline initial={articles} filters={articles.filters} /></>}
      </div>
    </div>
  );
}
