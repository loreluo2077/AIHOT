// The arithmetic of the anxiety index. Pure: it takes the day's numbers and the readers' votes and
// returns numbers, so the page, the API and the tests all read one rule.

export interface ContentMetrics {
  selected: number;
  stories: number;
  sources: number;
  firstParty: number;
  averageScore: number | null;
}

export interface VoteCounts {
  low: number;
  medium: number;
  high: number;
}

/** What one vote is worth. The same shape as VoteCounts, and a different thing. */
export interface FeelingScores {
  low: number;
  medium: number;
  high: number;
}

/** What counts as a full mark for the three counted parts. */
export interface ScoreReference {
  selected: number;
  stories: number;
  firstPartyRatio: number;
}

export interface FactorWeights {
  selected: number;
  stories: number;
  firstParty: number;
  score: number;
}

export interface BandRule {
  key: string;
  label: string;
  max: number;
}

export interface ScoreRules {
  factors: FactorWeights;
  reference: ScoreReference;
  feelings: FeelingScores;
  /** What the content half and the vote half weigh in the index. */
  halves: { content: number; votes: number };
}

export interface ScoredFactor {
  key: string;
  value: number;
  reference: number;
  ratio: number;
  weight: number;
  score: number;
}

export interface ScoredDay {
  /** The content half, 0–100. */
  content: number;
  /** What readers said, 0–100; null when nobody voted. */
  vote: number | null;
  /** 0–100, whole. */
  index: number;
  factors: Record<keyof FactorWeights, ScoredFactor>;
}

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);
const ratioOf = (value: number, reference: number) => (reference > 0 ? clamp01(value / reference) : 0);
export const round1 = (value: number) => Math.round(value * 10) / 10;

/** The share of the day's selected reports that came from a first-party source. */
export function firstPartyRatio(metrics: ContentMetrics): number {
  return metrics.selected > 0 ? metrics.firstParty / metrics.selected : 0;
}

/** What readers said, 0–100; null when nobody voted. */
export function readerScore(votes: VoteCounts, feelings: FeelingScores): number | null {
  const total = votes.low + votes.medium + votes.high;
  if (total <= 0) return null;
  return (votes.low * feelings.low + votes.medium * feelings.medium + votes.high * feelings.high) / total;
}

function factor(key: keyof FactorWeights, value: number, reference: number, weight: number): ScoredFactor {
  const ratio = ratioOf(value, reference);
  return { key, value, reference, ratio: round1(ratio), weight, score: round1(ratio * weight * 100) };
}

/**
 * The day's index. The content half is what the site actually selected; the vote half only corrects it,
 * and a day nobody voted on reads as its content alone rather than as a zero.
 */
export function scoreDay(metrics: ContentMetrics, votes: VoteCounts, rules: ScoreRules): ScoredDay {
  const selected = factor("selected", metrics.selected, rules.reference.selected, rules.factors.selected);
  const stories = factor("stories", metrics.stories, rules.reference.stories, rules.factors.stories);
  const firstParty = factor("firstParty", firstPartyRatio(metrics), rules.reference.firstPartyRatio, rules.factors.firstParty);
  const score = factor("score", metrics.averageScore ?? 0, 100, rules.factors.score);
  const content = round1(selected.score + stories.score + firstParty.score + score.score);
  const vote = readerScore(votes, rules.feelings);
  const index = vote === null ? content : content * rules.halves.content + vote * rules.halves.votes;
  return { content, vote: vote === null ? null : round1(vote), index: Math.round(index), factors: { selected, stories, firstParty, score } };
}

/** The band a finished index is read in. */
export function bandFor(index: number, bands: readonly BandRule[]): BandRule {
  for (const band of bands) if (index <= band.max) return band;
  return bands[bands.length - 1]!;
}

/** The 90th percentile of a small sample, by nearest rank. */
export function p90(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.9) - 1)]!;
}

/**
 * What counts as a full mark on this site: the configured reference, raised to the trailing window's
 * 90th percentile once enough days are behind it. The window is the days *before* the one being scored,
 * so a busy day never raises its own bar.
 */
export function baselineOf(history: readonly ContentMetrics[], reference: ScoreReference, minimumDays: number): ScoreReference {
  if (history.length < minimumDays) return { ...reference };
  return {
    selected: Math.max(reference.selected, p90(history.map((day) => day.selected))),
    stories: Math.max(reference.stories, p90(history.map((day) => day.stories))),
    firstPartyRatio: Math.max(reference.firstPartyRatio, p90(history.map(firstPartyRatio))),
  };
}
