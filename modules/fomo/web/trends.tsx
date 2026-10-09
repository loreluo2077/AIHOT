// The trends page: the index over the long window, what the site put out each recent day, and which
// topics are carrying the heat. The index and the day shapes come from this module's insights API; the
// topics come from the engine's own public topics API.
import { pageMeta } from "@aihot/web/lib/seo";
import { API_BASE_URL } from "@aihot/web/lib/api.server";
import { useLoaderData } from "react-router";
import type { Screen } from "@aihot/web/components/shell/screens";
import type { TopicSummary, TopicsResponse } from "@aihot/contracts/site";
import { FOMO } from "../config.ts";
import type { FomoInsightsPayload } from "../types.ts";

/** The phone shell: this page sits under the 指数 tab, and a back button to it reads 趋势. */
export const handle: Screen = { tab: "fomo", name: "趋势" };

async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, {
    headers: { accept: "application/json", "x-aihot-ssr": "1" },
    signal: signal ?? AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Response("趋势暂时不可用", { status: response.status === 404 ? 404 : 503 });
  return (await response.json()) as T;
}

export async function loader({ request }: { request: Request }): Promise<{ insights: FomoInsightsPayload; topics: TopicSummary[] }> {
  const [insights, topics] = await Promise.all([
    fetchJson<FomoInsightsPayload>(`${API_BASE_URL}/api/fomo/insights`, request.signal),
    fetchJson<TopicsResponse>(`${API_BASE_URL}/api/site/topics`, request.signal),
  ]);
  // The heat list: topics with recent content, the busiest first.
  const recent = topics.topics.filter((topic) => topic.recent > 0).sort((a, b) => b.recent - a.recent || b.total - a.total);
  return { insights, topics: recent.slice(0, 12) };
}

export function meta() {
  // The share card is the site's own (site/site.ts CARDS.trends).
  return pageMeta({ title: "趋势", description: `焦虑指数近 ${FOMO.trendsDays} 天的走势、最近产出的节奏，以及现在最有热度的主题。`, path: "/trends", image: "/og/pages/trends.png" });
}

export default function TrendsPage() {
  const { insights, topics } = useLoaderData() as Awaited<ReturnType<typeof loader>>;
  const trend = insights.trend;
  const peak = Math.max(1, ...trend.map((point) => point.index));
  const recentDays = [...insights.days].slice(-7).reverse();
  const dayMax = Math.max(1, ...recentDays.map((day) => day.selected));

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">趋势</h1>
        <p className="text-sm text-ink-3">指数走得有多快、内容跟得有多紧、话题热在哪里，这一页放在一起看。</p>
      </header>

      <section className="flex flex-col gap-3 rounded-card border border-line px-5 py-4">
        <h2 className="text-base font-semibold">焦虑指数 · 最近 {FOMO.trendsDays} 天</h2>
        <div className="flex h-28 items-end gap-1">
          {trend.map((point, index) => (
            <div
              key={point.day}
              title={`${point.day} · ${point.index}`}
              className={`flex-1 rounded-t-sm ${index === trend.length - 1 ? "bg-accent" : "bg-accent/30"}`}
              style={{ height: `${Math.max(3, (point.index / peak) * 100)}%` }}
            />
          ))}
        </div>
        <div className="flex justify-between text-xs text-ink-4">
          <span>{trend[0]?.day}</span>
          <span className="tabular-nums">最高 {peak} · 今天 {trend[trend.length - 1]?.index}</span>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-card border border-line px-5 py-4">
        <h2 className="text-base font-semibold">最近 7 天的产出</h2>
        <div className="flex flex-col gap-2">
          {recentDays.map((day) => (
            <div key={day.day} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-xs tabular-nums text-ink-3">{day.day}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-bg-sunk">
                <div className="h-full rounded-full bg-accent/60" style={{ width: `${Math.max(2, (day.selected / dayMax) * 100)}%` }} />
              </div>
              <span className="w-44 shrink-0 text-right text-xs text-ink-4 tabular-nums">
                {day.selected} 条 · {day.stories} 事件 · {day.sources} 源
              </span>
            </div>
          ))}
          {recentDays.every((day) => day.selected === 0) ? <p className="text-sm text-ink-3">最近还没有选出内容。</p> : null}
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-card border border-line px-5 py-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">主题热度</h2>
          <p className="text-xs text-ink-4">最近 30 天选出报道最多的主题；点进去是主题页。</p>
        </div>
        {topics.length === 0 ? (
          <p className="text-sm text-ink-3">还没有可显示的主题。</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {topics.map((topic, index) => (
              <li key={topic.slug} className="flex items-center gap-3 rounded-tile bg-bg-sunk px-4 py-2.5">
                <span className="mono w-6 shrink-0 text-[11px] tabular-nums text-ink-4">#{index + 1}</span>
                <a href={`/topics/${topic.slug}`} className="min-w-0 flex-1 truncate text-sm font-medium underline-offset-2 hover:underline">
                  {topic.name}
                </a>
                <span className="shrink-0 text-xs text-ink-4 tabular-nums">30 天 {topic.recent} · 累计 {topic.total}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
