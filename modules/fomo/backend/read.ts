// What the page and the API show: today's index, the parts it is made of, and the day's words. Every
// number comes from either the public read layer (publication/activity.ts) or this module's own tables.
import { addDays, beijingDate, beijingMidnight } from "@aihot/contracts/time";
import { dailyActivity, dayTopReports, dayTopics, type DailyActivity } from "@aihot/backend/publication/activity";
import { FOMO } from "../config.ts";
import type { FomoInsightsPayload, FomoPayload } from "../types.ts";
import { bandFor, baselineOf, firstPartyRatio, round1, scoreDay, type ContentMetrics, type ScoreRules } from "./score.ts";
import { readReaderWords, readSignals, readStats, readVotes } from "./store.ts";
import { tallyWords } from "./words.ts";

const DAY_MS = 24 * 3600_000;
const EMPTY: ContentMetrics = { selected: 0, stories: 0, sources: 0, firstParty: 0, averageScore: null };

/** The Beijing days ending at `day`, oldest first. */
export function daysEndingAt(day: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => addDays(day, index - (count - 1)));
}

function rulesFor(reference: ReturnType<typeof baselineOf>): ScoreRules {
  return { factors: FOMO.factors, reference, feelings: FOMO.feelings, halves: FOMO.weights };
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
  const [activity, votes, topics, readerWords, signals, stats] = await Promise.all([
    dailyActivity(since, until, now),
    readVotes(history[0]!, day),
    dayTopics(day, now),
    readReaderWords(day),
    readSignals(FOMO.signal.listLimit),
    readStats(day),
  ]);

  const byDay = new Map(activity.map((entry) => [entry.day, entry]));
  // The baseline is the days before today: a busy day never raises its own bar.
  const reference = baselineOf(history.filter((entry) => entry !== day).map((entry) => metricsOf(byDay.get(entry))), FOMO.reference, FOMO.baselineMinimumDays);
  const rules = rulesFor(reference);
  const today = metricsOf(byDay.get(day));
  const todayVotes = votes.get(day) ?? { low: 0, medium: 0, high: 0 };
  const scored = scoreDay(today, todayVotes, rules);

  const band = bandFor(scored.index, FOMO.bands);
  return {
    day,
    title: FOMO.title,
    description: FOMO.description,
    index: scored.index,
    band: { key: band.key, label: band.label },
    contentScore: scored.content,
    voteScore: scored.vote,
    breakdown: {
      factors: (["selected", "stories", "firstParty", "score"] as const).map((key) => ({ ...scored.factors[key], label: FOMO.factorLabels[key] })),
      averageScore: today.averageScore,
      sources: today.sources,
      firstPartyRatio: round1(firstPartyRatio(today)),
    },
    votes: { total: todayVotes.low + todayVotes.medium + todayVotes.high, ...todayVotes },
    hotwords: tallyWords(topics, FOMO.hotword, FOMO.hotword.limit),
    readerWords,
    signals: signals.map((entry) => ({ id: entry.id, body: entry.body, author: entry.author, at: entry.at.toISOString(), agrees: entry.agrees })),
    stats,
    trend: daysEndingAt(day, FOMO.trendDays).map((entry) => {
      const metrics = metricsOf(byDay.get(entry));
      const dayVotes = votes.get(entry) ?? { low: 0, medium: 0, high: 0 };
      return { day: entry, index: scoreDay(metrics, dayVotes, rules).index };
    }),
    generatedAt: now.toISOString(),
  };
}

/**
 * The insights views' payload: the index over the long window, and the recent days with what the site
 * put out and the reports that led each of them. One read for both pages — the queries are the same
 * kind `fomoPayload` makes, over a longer stretch of days.
 */
export async function fomoInsightsPayload(now = new Date()): Promise<FomoInsightsPayload> {
  const day = beijingDate(now);
  const history = daysEndingAt(day, FOMO.trendsDays + 1);
  const since = beijingMidnight(history[0]!);
  const until = new Date(beijingMidnight(day).getTime() + DAY_MS);
  const [activity, votes] = await Promise.all([dailyActivity(since, until, now), readVotes(history[0]!, day)]);

  const byDay = new Map(activity.map((entry) => [entry.day, entry]));
  // The baseline is the days before today, the same rule the index page follows.
  const reference = baselineOf(history.filter((entry) => entry !== day).map((entry) => metricsOf(byDay.get(entry))), FOMO.reference, FOMO.baselineMinimumDays);
  const rules = rulesFor(reference);
  const indexOf = (entry: string) => {
    const metrics = metricsOf(byDay.get(entry));
    const dayVotes = votes.get(entry) ?? { low: 0, medium: 0, high: 0 };
    return scoreDay(metrics, dayVotes, rules).index;
  };

  const timelineDays = daysEndingAt(day, FOMO.timelineDays);
  const tops = await Promise.all(timelineDays.map((entry) => dayTopReports(entry, FOMO.timelineTop, now)));
  return {
    title: FOMO.title,
    trend: daysEndingAt(day, FOMO.trendsDays).map((entry) => ({ day: entry, index: indexOf(entry) })),
    days: timelineDays.map((entry, index) => {
      const metrics = metricsOf(byDay.get(entry));
      return {
        day: entry,
        index: indexOf(entry),
        selected: metrics.selected,
        stories: metrics.stories,
        sources: metrics.sources,
        firstPartyRatio: round1(firstPartyRatio(metrics)),
        averageScore: metrics.averageScore,
        top: tops[index]!,
      };
    }),
    generatedAt: now.toISOString(),
  };
}
