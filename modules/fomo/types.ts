// What the page and the API send: today's index, how it was reached, and the day's words.

export interface FomoBandView {
  key: string;
  label: string;
}

/** One counted part of the content half, as the page explains it. */
export interface FomoFactorView {
  key: string;
  label: string;
  /** What the day had. */
  value: number;
  /** What counts as a full mark. */
  reference: number;
  /** value ÷ reference, capped at 1. */
  ratio: number;
  weight: number;
  /** ratio × weight × 100: what this part contributes to the content half. */
  score: number;
}

export interface FomoBreakdownView {
  factors: FomoFactorView[];
  /** Included in the four above as `score`; kept here for the sentence that names the numbers. */
  averageScore: number | null;
  sources: number;
  firstPartyRatio: number;
}

export interface FomoVotesView {
  total: number;
  low: number;
  medium: number;
  high: number;
}

export interface FomoHotwordView {
  word: string;
  count: number;
}

export interface FomoTrendDayView {
  day: string;
  index: number;
}

/** One reader's signal, as the page shows it: the text, who signed it, and what other readers did with it. */
export interface FomoSignalView {
  id: string;
  body: string;
  /** The signature the reader gave; null when they left it out. */
  author: string | null;
  /** When it was posted, ISO. */
  at: string;
  agrees: number;
}

/** The day's own numbers, under the index. Today's votes are already on `votes.total`. */
export interface FomoStatsView {
  signalsToday: number;
  hotwordsToday: number;
  /** Every visible signal, not just today's. */
  signalsTotal: number;
}

/** What the admin page lists: the same signal plus what only the owner may see. */
export interface FomoAdminSignalView extends FomoSignalView {
  day: string;
  reports: number;
  hidden: boolean;
  hiddenReason: string | null;
  /** The voter's unreadable identifier, to spot one source flooding the list. */
  voter: string;
}

export interface FomoAdminSignals {
  rows: FomoAdminSignalView[];
  /** Hidden ones waiting for the owner: what the navigation badge counts. */
  waiting: number;
}

export interface FomoPayload {
  /** Asia/Shanghai day the index is for. */
  day: string;
  title: string;
  description: string;
  /** 0–100, rounded. */
  index: number;
  band: FomoBandView;
  contentScore: number;
  /** null when nobody has voted: the index is then the content half alone. */
  voteScore: number | null;
  breakdown: FomoBreakdownView;
  votes: FomoVotesView;
  /** Words the day's own reports carried. */
  hotwords: FomoHotwordView[];
  /** Words readers added today, most-added first. */
  readerWords: FomoHotwordView[];
  /** What readers are saying, newest first. */
  signals: FomoSignalView[];
  stats: FomoStatsView;
  /** The index of the last days, oldest first; today is last. */
  trend: FomoTrendDayView[];
  generatedAt: string;
}

/** One day in the insights views: the index it scored, and what the site put out that day. */
export interface FomoDayView {
  day: string;
  /** The day's index (0–100), computed with today's rules. */
  index: number;
  selected: number;
  stories: number;
  sources: number;
  firstPartyRatio: number;
  averageScore: number | null;
}

/** A day's best-scoring report, as the timeline leads with it. */
export interface FomoTopReport {
  /** The article's public id: the report page is /items/<id>. */
  id: string;
  title: string;
  score: number | null;
  source: string;
  firstParty: boolean;
}

/** What the timeline and the trends page read: one long trend, and the days with their leading reports. */
export interface FomoInsightsPayload {
  title: string;
  /** The index day by day, oldest first (`trendsDays` long, today last). */
  trend: FomoTrendDayView[];
  /** The recent days, oldest first (`timelineDays` long), each with its best reports. */
  days: Array<FomoDayView & { top: FomoTopReport[] }>;
  generatedAt: string;
}
