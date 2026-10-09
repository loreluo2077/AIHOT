// This module's arrangement: how the daily anxiety index is put together. The index is purely the
// content side now — the reader-facing wall and the mood poll live in the browser and touch nothing —
// so what is left is arithmetic over what the site selected. It reads no environment variable of its
// own, so there is nothing to register in a template.
export interface FomoBand {
  key: string;
  label: string;
  /** Upper bound of the band, inclusive. */
  max: number;
}

/** The four counted parts of the index, in the order the pages list them. */
export interface FomoFactorWeights {
  selected: number;
  stories: number;
  firstParty: number;
  score: number;
}

export const FOMO = {
  /** What each counted part weighs inside the index; the four must add up to 1. */
  factors: { selected: 0.4, stories: 0.25, firstParty: 0.2, score: 0.15 } satisfies FomoFactorWeights,
  factorLabels: {
    selected: "精选条数",
    stories: "独立事件",
    firstParty: "一手来源占比",
    score: "平均评分",
  } satisfies Record<keyof FomoFactorWeights, string>,
  /**
   * What counts as a full mark for the three counted parts: reaching the reference scores 1. A busier
   * trailing window raises them (see baselineDays), so the index compares a day with this site's own
   * normal, not with a fixed number forever.
   */
  reference: { selected: 8, stories: 5, firstPartyRatio: 0.2 },
  /** How many days back the baseline looks, and how many of them it needs before it raises the reference. */
  baselineDays: 30,
  baselineMinimumDays: 7,
  /** The three bands the index is read in, by upper bound. */
  bands: [
    { key: "chill", label: "冷静", max: 40 },
    { key: "buzz", label: "躁动", max: 70 },
    { key: "panic", label: "恐慌", max: 100 },
  ] as FomoBand[],
  /** How long the API's answer may be cached. */
  cacheSeconds: 120,
};
