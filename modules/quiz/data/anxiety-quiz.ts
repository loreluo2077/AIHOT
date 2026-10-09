// AI 焦虑速测的题库与等级（迁自 eva-s-fomo-finder 的 anxiety-quiz）：5 道题、50 分制，出结果即给建议。
export interface AnxietyQuestion {
  id: number;
  question: string;
  options: { label: string; score: number }[];
}

export interface AnxietyLevel {
  grade: string;
  label: string;
  emoji: string;
  min: number;
  max: number;
  description: string;
  advice: string;
}

export const ANXIETY_LEVELS: AnxietyLevel[] = [
  {
    grade: "S",
    label: "焦虑爆表",
    emoji: "🔥",
    min: 41,
    max: 50,
    description: "你的 AI 焦虑已经拉满，每天都在担心被时代抛弃",
    advice: "深呼吸，关掉信息流，先做好手头的事。焦虑不会让你进步，行动才会。",
  },
  {
    grade: "A",
    label: "持续焦虑中",
    emoji: "😰",
    min: 31,
    max: 40,
    description: "你经常感到 AI 带来的压力，时不时就会 FOMO",
    advice: "选一个感兴趣的方向，深入学习，而不是广泛焦虑。专注比追热点更有效。",
  },
  {
    grade: "B",
    label: "有点焦虑",
    emoji: "😐",
    min: 21,
    max: 30,
    description: "你对 AI 有一定关注，偶尔会感到焦虑但还算淡定",
    advice: "保持当前节奏，适度关注即可。你的心态比大多数人健康。",
  },
  {
    grade: "C",
    label: "佛系围观",
    emoji: "😌",
    min: 11,
    max: 20,
    description: "你对 AI 变革保持平和心态，不太受外界影响",
    advice: "你的心态很好，但也别完全忽视变化，保持适度的好奇心。",
  },
  {
    grade: "D",
    label: "完全不焦虑",
    emoji: "😴",
    min: 0,
    max: 10,
    description: "AI？跟我有什么关系？你完全没有 AI 焦虑",
    advice: "虽然不焦虑是好事，但了解一下 AI 的基本动态可能对未来有帮助。",
  },
];

export const ANXIETY_QUESTIONS: AnxietyQuestion[] = [
  {
    id: 1,
    question: "刷到「XX 行业将被 AI 取代」的文章时，你的反应是？",
    options: [
      { label: "心跳加速，立马转发到工作群讨论", score: 10 },
      { label: "点进去看看，有点担心自己的饭碗", score: 7 },
      { label: "扫一眼标题就划走了", score: 4 },
      { label: "这种标题党我从不点", score: 1 },
    ],
  },
  {
    id: 2,
    question: "看到朋友圈有人晒用 AI 做的作品/成果时，你的感受是？",
    options: [
      { label: "焦虑到失眠，觉得自己要被淘汰了", score: 10 },
      { label: "赶紧去搜这个工具怎么用", score: 7 },
      { label: "点个赞，心里想有空也试试", score: 4 },
      { label: "无感，继续刷下一条", score: 1 },
    ],
  },
  {
    id: 3,
    question: "过去一周，你因为 AI 相关的事情感到焦虑的次数是？",
    options: [
      { label: "几乎每天都会焦虑", score: 10 },
      { label: "3–4 次，时不时就会想到", score: 7 },
      { label: "1–2 次，偶尔有感触", score: 4 },
      { label: "0 次，完全没想过", score: 1 },
    ],
  },
  {
    id: 4,
    question: "当同事/同行开始用 AI 工具提效时，你会？",
    options: [
      { label: "极度紧张，觉得不学就要被开除", score: 10 },
      { label: "有压力，赶紧也去学一下", score: 7 },
      { label: "觉得挺好的，有空再看看", score: 4 },
      { label: "无所谓，各做各的", score: 1 },
    ],
  },
  {
    id: 5,
    question: "你觉得 AI 会在多大程度上影响你的职业发展？",
    options: [
      { label: "已经在影响了，我随时可能被替代", score: 10 },
      { label: "未来几年会有很大影响", score: 7 },
      { label: "可能会有一些影响，但不确定", score: 4 },
      { label: "不会有什么影响", score: 1 },
    ],
  },
];

export function calcAnxietyScore(answers: Record<number, number>): number {
  return Object.values(answers).reduce((sum, score) => sum + score, 0);
}

export function getAnxietyLevel(score: number): AnxietyLevel {
  return ANXIETY_LEVELS.find((level) => score >= level.min && score <= level.max) ?? ANXIETY_LEVELS[ANXIETY_LEVELS.length - 1]!;
}
