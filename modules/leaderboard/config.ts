// This module's arrangement: which first-party sources it reads, and the file its own operator can point
// at for a benchmark this module does not ship with. It reads no environment variable of its own, so
// there is nothing to register in a template.
import { SITE } from "@aihot/site";

export interface JsonSource {
  key: string;
  label: string;
  /** An https address or a path on this machine. */
  url: string;
  licence?: string;
}

export const LEADERBOARD = {
  /** The order the benchmark's ability columns appear in; groups it does not name come after, by name. */
  domainOrder: ["Reasoning", "Coding", "Agentic Coding", "Mathematics", "Data Analysis", "Language", "IF"],
  /** The page's title and description. */
  title: "模型榜",
  description: `第三方评测机构公开的模型成绩，与供应商公布的上下文长度、价格放在一起看。数据来自公开数据集与公开接口，页面注明来源与版本；本站不重算、不代跑评测。`,
  /** How many models the main table ranks (the benchmark's own top), and how many the directory lists. */
  rowsPerMetric: 30,
  catalogueRows: 60,
  /**
   * Which source drives the main table. null: the first one that publishes an overall score.
   * The others keep their own category tables on the page.
   */
  primarySource: null as string | null,
  /**
   * Exceptions to the name rule that joins a benchmark's model ids to a catalogue's
   * (backend/match.ts): `{ "smaug-flash": "some-vendor/smaug-2-flash" }`. Write one down whenever a
   * model's release date or price is missing, or worse, has landed on the wrong row.
   */
  modelAliases: {} as Record<string, string>,
  /** A metric needs this many models behind it to be shown at all. */
  minModelsPerMetric: 5,
  /** First-party benchmark tables: a published CSV of scores. */
  livebench: {
    enabled: true,
    /** Where the tables live. The newest table is discovered from the same directory. */
    tableUrlTemplate: "https://raw.githubusercontent.com/LiveBench/new-livebench/main/public/{file}",
    directoryUrl: "https://api.github.com/repos/LiveBench/new-livebench/contents/public",
    /** Used when the directory listing is unavailable. */
    fallbackTable: "table_2026_06_25.csv",
    label: "LiveBench",
    pageUrl: "https://livebench.ai/",
    licence: "表格与题目由 LiveBench 公开；引用请注明 LiveBench",
    /** The mean of a table's own columns, which is the benchmark's own global average. */
    overall: { key: "overall", label: "综合" },
  },
  /** A model catalogue with prices and release dates, from a documented public API. */
  openrouter: {
    enabled: true,
    url: "https://openrouter.ai/api/v1/models",
    label: "OpenRouter",
    pageUrl: "https://openrouter.ai/models",
    licence: "模型目录与价格来自 OpenRouter 的公开接口；价格以其页面为准",
  },
  /** A benchmark of your own: point at a JSON file, local or remote (schema in README.md). */
  json: null as JsonSource | null,
  userAgent: (): string => `${SITE.crawlerName} (leaderboard)`,
  /** The longest a source may take before the run gives up on it. */
  timeoutMs: 30_000,
};
