// What the page and the API show: today's index and the parts it is made of. Every number comes from
// the public read layer (publication/activity.ts) — this module's own tables are gone, the reader wall
// and the poll live in the browser.
import { addDays, beijingDate, beijingMidnight } from "@aihot/contracts/time";
import { dailyActivity, type DailyActivity } from "@aihot/backend/publication/activity";
import { FOMO } from "../config.ts";
import type { FomoPayload } from "../types.ts";
import { bandFor, baselineOf, firstPartyRatio, round1, scoreDay, type ContentMetrics, type ScoreRules } from "./score.ts";

const DAY_MS = 24 * 3600_000;
const EMPTY: ContentMetrics = { selected: 0, stories: 0, sources: 0, firstParty: 0, averageScore: null };

/** The Beijing days ending at `day`, oldest first. */
export function daysEndingAt(day: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => addDays(day, index - (count - 1)));
}

function rulesFor(reference: ReturnType<typeof baselineOf>): ScoreRules {
  return { factors: FOMO.factors, reference };
}

function metricsOf(day: DailyActivity | undefined): ContentMetrics {
  return day ? { selected: day.selected, stories: day.stories, sources: day.sources, firstParty: day.firstParty, averageScore: day.averageScore } : EMPTY;
}

/** Today's index, as the page and the API read it. */
export async function fomoPayload(now = new Date()): Promise<FomoPayload> {
  const day = beijingDate(now);
  const history = daysEndingAt(day, FOMO.baselineDays + 1);
  const since = beijingMidnight(history[0]!);
  const until = new Date(beijingMidnight(day).getTime() + DAY_MS);
  const activity = await dailyActivity(since, until, now);

  const byDay = new Map(activity.map((entry) => [entry.day, entry]));
  // The baseline is the days before today: a busy day never raises its own bar.
  const reference = baselineOf(history.filter((entry) => entry !== day).map((entry) => metricsOf(byDay.get(entry))), FOMO.reference, FOMO.baselineMinimumDays);
  const scored = scoreDay(metricsOf(byDay.get(day)), rulesFor(reference));

  const band = bandFor(scored.index, FOMO.bands);
  const today = metricsOf(byDay.get(day));
  return {
    day,
    index: scored.index,
    band: { key: band.key, label: band.label },
    contentScore: scored.content,
    breakdown: {
      factors: (["selected", "stories", "firstParty", "score"] as const).map((key) => ({ ...scored.factors[key], label: FOMO.factorLabels[key] })),
      averageScore: today.averageScore,
      sources: today.sources,
      firstPartyRatio: round1(firstPartyRatio(today)),
    },
    generatedAt: now.toISOString(),
  };
}

