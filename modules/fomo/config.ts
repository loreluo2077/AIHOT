// This module's arrangement: how the daily anxiety index is put together, and what readers may add. It
// reads no environment variable of its own, so there is nothing to register in a template.
export interface FomoBand {
  key: string;
  label: string;
  /** Upper bound of the band, inclusive. */
  max: number;
}

/** The four counted parts of the content half, in the order the page lists them. */
export interface FomoFactorWeights {
  selected: number;
  stories: number;
  firstParty: number;
  score: number;
}

export const FOMO = {
  /** The page's title and description. */
  title: "焦虑指数",
  description:
    "今天 AI 圈到底有多热闹？这个指数由两半合成：一半是本站当天真正选出来的内容（条数、事件数、一手来源占比、平均分），一半是读者投的票。内容那一半是主体，投票只做修正——热闹是真的，焦虑才值得讨论。",
  /** The two halves of the index, and what each weighs. With no votes the index is the content half. */
  weights: { content: 0.6, votes: 0.4 },
  /** What each counted part weighs inside the content half; the four must add up to 1. */
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
  /** What a vote is worth: 还好 / 有点焦虑 / 很焦虑. */
  feelings: { low: 35, medium: 65, high: 90 } as Record<"low" | "medium" | "high", number>,
  /** What each vote is called on the page. */
  feelingLabels: { low: "还好", medium: "有点焦虑", high: "很焦虑" } as Record<"low" | "medium" | "high", string>,
  /** The three bands the index is read in, by upper bound. */
  bands: [
    { key: "chill", label: "冷静", max: 40 },
    { key: "buzz", label: "躁动", max: 70 },
    { key: "panic", label: "恐慌", max: 100 },
  ] as FomoBand[],
  /** How many days of the index's own history the page shows. */
  trendDays: 14,
  /** How many days the trends page charts, and the timeline walks back. */
  trendsDays: 30,
  timelineDays: 14,
  /** How many of a day's reports the timeline leads with. */
  timelineTop: 3,
  /** The hot list, built from the day's own tags. */
  hotword: {
    /** How many words the list shows. */
    limit: 24,
    /** A word's length in characters (a CJK character counts as one). */
    minLength: 2,
    maxLength: 20,
    /** How many words one reader may add per day. */
    perDay: 5,
    /** Too general to tell anything: refused as reader submissions. */
    blocked: ["ai", "人工智能", "大模型", "模型", "新闻", "热点", "科技", "技术"],
  },
  /**
   * 社区信号（读者发一段话，别人可以认同或举报）。这是唯一一块用户生成内容，所以限制都写得紧：
   * 长度、间隔、每天条数都在这里，举报到阈值就自动下架，等管理员在后台处理。
   */
  signal: {
    /** 一段话的长度限制（按字符数，CJK 一个字算一个）。 */
    minLength: 2,
    maxLength: 200,
    /** 同一个人两次发言之间至少隔多少秒。 */
    cooldownSeconds: 300,
    /** 同一个人每天最多发几条。 */
    perDay: 5,
    /** 几个人举报就自动下架（一人一票，所以这是"几个不同的人"）。 */
    reportsToHide: 2,
    /** 页面上一屏显示几条。 */
    listLimit: 30,
  },
  /** 分享与关注。 */
  share: {
    /**
     * 你的 X（Twitter）地址，例如 "https://x.com/your-handle"；填了页面下部才会出现「关注 X」按钮。
     * null 表示还没定，按钮不显示。
     */
    xProfile: null as string | null,
  },
  /** How long the API's answer may be cached; a vote is never cached. */
  cacheSeconds: 120,
};
