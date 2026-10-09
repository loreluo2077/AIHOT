// This module's arrangement: the services the page introduces and links to. Fill `entries` in and the
// page is done — there is no database and no API behind it, and nothing here is sold on this site.
export interface ServiceEntry {
  /** What it is called on the card. */
  name: string;
  /** One sentence: what it is for, in the reader's words. */
  summary: string;
  /** Where the card goes. */
  url: string;
  /** A short label beside the name, e.g. 自有服务 / 推荐 / 邀请制. */
  badge?: string;
  /** One line about price, when there is one worth naming; leave it out rather than guess. */
  price?: string;
}

export const SERVICES = {
  title: "AI 服务",
  description: "我们自己在用、也愿意推荐给读者的 AI 服务。点进去是各自的站点，不在这里下单。",
  /** Shown under the list: who provides these, and what this site's part in it is. */
  note: "下面这些服务由各自的运营者提供和销售，本站不是提供方，也不参与交易；价格、可用性与数据处理以对方页面为准。我们只在自己确实用过、觉得值的时候才放上来。",
  /**
   * The cards, in the order they are shown. Empty for now: add your own, for example
   *
   *   { name: "示例中转", summary: "一个 OpenAI 兼容的接口地址，按量计费。", url: "https://example.com", badge: "自有服务", price: "约 $1 / 百万 token 起" },
   */
  entries: [] as ServiceEntry[],
};
