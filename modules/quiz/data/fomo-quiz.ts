// AI 生存指数测试的题库与等级（迁自 eva-s-fomo-finder 的 fomo-quiz）：10 道题、5 个维度，
// 每题 1–10 分，总分 100。等级只描述"你与 AI 的距离"，不评价任何人。
export interface QuizQuestion {
  id: number;
  dimension: "cognition" | "tools" | "anxiety" | "learning" | "trend";
  dimensionLabel: string;
  question: string;
  options: { label: string; score: number }[];
}

export interface QuizLevel {
  grade: string;
  label: string;
  min: number;
  max: number;
  description: string;
}

export const QUIZ_LEVELS: QuizLevel[] = [
  { grade: "S", label: "赛博觉醒者", min: 90, max: 100, description: "你已经完全拥抱 AI 时代，走在最前沿" },
  { grade: "A", label: "数字原住民", min: 75, max: 89, description: "你对 AI 的理解和使用超越大多数人" },
  { grade: "B", label: "观望迟疑者", min: 60, max: 74, description: "你已有所了解，但行动力还需提升" },
  { grade: "C", label: "模拟信号人", min: 40, max: 59, description: "AI 对你来说还很遥远，需要尽快跟上" },
  { grade: "D", label: "肉体保守派", min: 0, max: 39, description: "你正在被 AI 时代甩在身后" },
];

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    dimension: "cognition",
    dimensionLabel: "AI 认知",
    question: "你对当前 AI 技术发展（如 GPT、Midjourney 等）了解多少？",
    options: [
      { label: "我能解释底层原理并追踪最新论文", score: 10 },
      { label: "了解主流产品和应用场景", score: 7 },
      { label: "听说过一些，但不太了解细节", score: 4 },
      { label: "几乎不了解", score: 1 },
    ],
  },
  {
    id: 2,
    dimension: "cognition",
    dimensionLabel: "AI 认知",
    question: "你认为 AI 在未来 5 年内对你所在行业的影响是？",
    options: [
      { label: "将彻底重塑行业格局，我已在准备", score: 10 },
      { label: "会有显著影响，需要适应", score: 7 },
      { label: "可能有一些影响，但不确定", score: 4 },
      { label: "不会有什么影响", score: 1 },
    ],
  },
  {
    id: 3,
    dimension: "tools",
    dimensionLabel: "工具使用",
    question: "你在日常工作中使用 AI 工具的频率是？",
    options: [
      { label: "每天都用，已经离不开了", score: 10 },
      { label: "每周使用几次", score: 7 },
      { label: "偶尔试一试", score: 4 },
      { label: "从未使用过", score: 1 },
    ],
  },
  {
    id: 4,
    dimension: "tools",
    dimensionLabel: "工具使用",
    question: "你同时使用过多少种 AI 工具/平台？",
    options: [
      { label: "5 种以上，且能熟练切换", score: 10 },
      { label: "3–4 种，各有用途", score: 7 },
      { label: "1–2 种，浅尝辄止", score: 4 },
      { label: "0 种", score: 1 },
    ],
  },
  {
    id: 5,
    dimension: "anxiety",
    dimensionLabel: "行业焦虑",
    question: "看到「AI 将取代 XX 职业」的新闻时，你的第一反应是？",
    options: [
      { label: "立即研究自己如何利用 AI 增强竞争力", score: 10 },
      { label: "有些焦虑，想了解更多", score: 7 },
      { label: "看看就好，不太当回事", score: 4 },
      { label: "完全不关心", score: 1 },
    ],
  },
  {
    id: 6,
    dimension: "anxiety",
    dimensionLabel: "行业焦虑",
    question: "同行已经在用 AI 而自己还没用时，你的感受是？",
    options: [
      { label: "强烈的紧迫感，我必须赶上", score: 10 },
      { label: "有点焦虑，应该学一下", score: 7 },
      { label: "无所谓，我有自己的节奏", score: 4 },
      { label: "他们用他们的，跟我无关", score: 1 },
    ],
  },
  {
    id: 7,
    dimension: "learning",
    dimensionLabel: "学习投入",
    question: "过去一个月，你花了多少时间学习 AI 相关知识？",
    options: [
      { label: "10 小时以上", score: 10 },
      { label: "3–10 小时", score: 7 },
      { label: "不到 3 小时", score: 4 },
      { label: "完全没有", score: 1 },
    ],
  },
  {
    id: 8,
    dimension: "learning",
    dimensionLabel: "学习投入",
    question: "你是否为 AI 学习付费过（课程、工具订阅等）？",
    options: [
      { label: "订阅了多个付费工具和课程", score: 10 },
      { label: "付费订阅了 1–2 个", score: 7 },
      { label: "只用免费的", score: 4 },
      { label: "没有，也不打算", score: 1 },
    ],
  },
  {
    id: 9,
    dimension: "trend",
    dimensionLabel: "趋势敏感度",
    question: "一个新的 AI 工具/模型发布时，你通常多久会去尝试？",
    options: [
      { label: "当天就上手", score: 10 },
      { label: "一周内会试试", score: 7 },
      { label: "等口碑出来再看", score: 4 },
      { label: "不会主动去尝试", score: 1 },
    ],
  },
  {
    id: 10,
    dimension: "trend",
    dimensionLabel: "趋势敏感度",
    question: "你关注 AI 资讯的渠道有多少个？",
    options: [
      { label: "5 个以上（推特/公众号/播客/论坛/社群等）", score: 10 },
      { label: "3–4 个渠道", score: 7 },
      { label: "1–2 个，偶尔刷到", score: 4 },
      { label: "没有专门关注", score: 1 },
    ],
  },
];

export const DIMENSION_LABELS: Record<QuizQuestion["dimension"], string> = {
  cognition: "AI 认知",
  tools: "工具使用",
  anxiety: "行业焦虑",
  learning: "学习投入",
  trend: "趋势敏感度",
};

export function getLevel(score: number): QuizLevel {
  return QUIZ_LEVELS.find((level) => score >= level.min && score <= level.max) ?? QUIZ_LEVELS[QUIZ_LEVELS.length - 1]!;
}

/** Each dimension's answers normalized to 0–100 (a dimension is two questions, 20 points at most). */
export function calcDimensionScores(answers: Record<number, number>): Record<string, number> {
  const dims: Record<string, { total: number; count: number }> = {};
  QUIZ_QUESTIONS.forEach((question) => {
    if (answers[question.id] !== undefined) {
      if (!dims[question.dimension]) dims[question.dimension] = { total: 0, count: 0 };
      dims[question.dimension]!.total += answers[question.id]!;
      dims[question.dimension]!.count += 1;
    }
  });
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(dims)) {
    result[key] = Math.round((value.total / (value.count * 10)) * 100);
  }
  return result;
}

/** The total: 10 questions at 10 points each. */
export function calcTotalScore(answers: Record<number, number>): number {
  return Object.values(answers).reduce((sum, score) => sum + score, 0);
}
