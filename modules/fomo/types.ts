// What the page and the API send: today's index and how it was reached.

export interface FomoBandView {
  key: string;
  label: string;
}

/** One counted part of the index, as the pages explain it. */
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
  /** ratio × weight × 100: what this part contributes to the index. */
  score: number;
}

export interface FomoBreakdownView {
  factors: FomoFactorView[];
  /** Included in the four above as `score`; kept here for the sentence that names the numbers. */
  averageScore: number | null;
  sources: number;
  firstPartyRatio: number;
}

export interface FomoPayload {
  /** Asia/Shanghai day the index is for. */
  day: string;
  /** 0–100, rounded. */
  index: number;
  band: FomoBandView;
  contentScore: number;
  breakdown: FomoBreakdownView;
  generatedAt: string;
}
