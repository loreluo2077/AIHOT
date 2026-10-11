// This module's arrangement: the services the page introduces and links to. Fill `entries` in and the
// page is done — there is no database and no API behind it, and nothing here is sold on this site.
export interface ServiceEntry {
  name: string;
  url: string;
  goal: "writing" | "research" | "automation" | "building";
  oneLiner: string;
  recommendation: string;
  tags: string[];
  kind: "editorial" | "sponsored" | "owned" | "radar";
  featured?: boolean;
  price?: string;
}

export const SERVICES = {
  title: "工具",
  description: "先从能解决眼前问题的工具开始，不必把每一个都装一遍。",
  /** Shown under the list: who provides these, and what this site's part in it is. */
  note: "下面这些服务由各自的运营者提供和销售，本站不是提供方，也不参与交易；价格、可用性与数据处理以对方页面为准。我们只在自己确实用过、觉得值的时候才放上来。",
  goals: {
    writing: "写内容",
    research: "做研究",
    automation: "提高效率",
    building: "做产品",
  } as const,
  /** Replace these presentation entries with the tools you actually recommend. */
  entries: [
    { name: "Focus Draft", url: "https://example.com/writing", goal: "writing", oneLiner: "从一个模糊念头开始，写出能继续修改的第一稿。", recommendation: "适合需要先把脑子里的东西落下来，再慢慢整理的人。", tags: ["编辑常用", "新手友好"], kind: "editorial", featured: true, price: "免费试用" },
    { name: "Deep Search", url: "https://example.com/research", goal: "research", oneLiner: "把检索、阅读和来源整理放进同一条研究路径。", recommendation: "不只给答案，也保留你之后需要回看和核验的出处。", tags: ["研究", "带来源"], kind: "editorial", price: "按量使用" },
    { name: "Flow Loop", url: "https://example.com/automation", goal: "automation", oneLiner: "把重复的信息收集、分类和提醒交给自动化流程。", recommendation: "先拿一件每周都在重复做的事试试，最容易感受到差别。", tags: ["自动化", "省时间"], kind: "owned", price: "有免费额度" },
    { name: "Build Kit", url: "https://example.com/building", goal: "building", oneLiner: "把想法、页面和功能拆成今天就能开始的一步。", recommendation: "适合想做点东西，但不想先把所有技术栈学完的人。", tags: ["做产品", "快速验证"], kind: "editorial", price: "免费可用" },
    { name: "Notebook AI", url: "https://example.com/notebook", goal: "research", oneLiner: "给一堆资料建立可对话、可追溯的个人知识库。", recommendation: "还在观察它是否适合长期使用，目前适合资料密集型项目。", tags: ["知识库", "观察中"], kind: "radar" },
    { name: "Slide Maker", url: "https://example.com/slides", goal: "writing", oneLiner: "从结构到版面，快速把一份想法做成可展示的内容。", recommendation: "适合临时需要把一页文字变成能讲清楚的演示稿。", tags: ["演示", "观察中"], kind: "radar" },
  ] satisfies ServiceEntry[],
};
