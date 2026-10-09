// The timeline: what the site actually selected, day by day — the index each day scored, how much came
// out, and the reports that led it. It reads this module's own insights API over HTTP (the web never
// touches the database) and every row links to the report's own page.
import { pageMeta } from "@aihot/web/lib/seo";
import { API_BASE_URL } from "@aihot/web/lib/api.server";
import { useLoaderData } from "react-router";
import type { Screen } from "@aihot/web/components/shell/screens";
import { FOMO } from "../config.ts";
import type { FomoInsightsPayload } from "../types.ts";

/** The phone shell: this page sits under the 指数 tab, and a back button to it reads 大事记. */
export const handle: Screen = { tab: "fomo", name: "大事记" };

async function fetchPayload(signal?: AbortSignal): Promise<FomoInsightsPayload> {
  const response = await fetch(`${API_BASE_URL}/api/fomo/insights`, {
    headers: { accept: "application/json", "x-aihot-ssr": "1" },
    signal: signal ?? AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Response("大事记暂时不可用", { status: response.status === 404 ? 404 : 503 });
  return (await response.json()) as FomoInsightsPayload;
}

export async function loader({ request }: { request: Request }): Promise<FomoInsightsPayload> {
  return fetchPayload(request.signal);
}

export function meta() {
  // The share card is the site's own (site/site.ts CARDS.timeline).
  return pageMeta({ title: "大事记", description: `最近 ${FOMO.timelineDays} 天，${FOMO.title}每天记下了什么：指数、选出条数与当天最重要的报道。`, path: "/timeline", image: "/og/pages/timeline.png" });
}

/** The day's index, painted by the band it lands in. */
function indexTone(index: number): string {
  if (index > FOMO.bands[1]!.max) return "text-rank-1";
  if (index > FOMO.bands[0]!.max) return "text-rank-2";
  return "text-ok-ink";
}

export default function TimelinePage() {
  const payload = useLoaderData() as FomoInsightsPayload;
  const days = [...payload.days].reverse();
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">大事记</h1>
        <p className="text-sm text-ink-3">
          最近 {FOMO.timelineDays} 天，这个站每天真正选出了什么。指数是当天焦虑指数的取值，条目是当天评分最高的报道；撤选或下架的，第二天就不再出现。
        </p>
      </header>

      {days.every((day) => day.selected === 0) ? (
        <p className="rounded-card border border-line px-4 py-6 text-sm text-ink-3">最近还没有选出内容。内容上线后，这里每天都会长出一行。</p>
      ) : (
        <ol className="flex flex-col gap-4">
          {days.map((day) => (
            <li key={day.day} className="rounded-card border border-line px-5 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <div className="flex items-baseline gap-3">
                  <h2 className="text-base font-semibold tabular-nums">{day.day}</h2>
                  <span className={`text-2xl font-semibold leading-none tabular-nums ${indexTone(day.index)}`}>{day.index}</span>
                </div>
                <p className="text-xs text-ink-4 tabular-nums">
                  {day.selected} 条报道 · {day.stories} 个事件 · {day.sources} 个来源 · 一手 {Math.round(day.firstPartyRatio * 100)}%
                </p>
              </div>
              {day.top.length > 0 ? (
                <ul className="mt-3 flex flex-col gap-2 border-t border-line-soft pt-3">
                  {day.top.map((report, rank) => (
                    <li key={report.id} className="flex items-baseline gap-2.5">
                      <span className="mono shrink-0 text-[11px] tabular-nums text-ink-4">#{rank + 1}</span>
                      <a href={`/items/${report.id}`} className="min-w-0 flex-1 text-sm leading-snug underline-offset-2 hover:underline">
                        {report.title}
                      </a>
                      {report.score !== null ? <span className="shrink-0 text-xs tabular-nums text-ink-4">{Math.round(report.score)} 分</span> : null}
                      <span className="hidden shrink-0 text-xs text-ink-4 sm:inline">{report.source}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 border-t border-line-soft pt-3 text-sm text-ink-3">当天没有选出报道。</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
