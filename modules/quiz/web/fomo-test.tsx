// The AI survival quiz: ten questions, one at a time, five dimensions, a 0–100 score and a level.
// Everything happens in the browser — the questions are static data and nothing is stored — so this
// page has no loader and the module has no backend.
import { useState } from "react";
import { pageMeta } from "@aihot/web/lib/seo";
import type { Screen } from "@aihot/web/components/shell/screens";
import { DIMENSION_LABELS, QUIZ_QUESTIONS, QUIZ_LEVELS, calcDimensionScores, calcTotalScore, getLevel, type QuizLevel } from "../data/fomo-quiz.ts";

/** The phone shell: this page sits under the 指数 tab, and a back button to it reads FOMO 测试. */
export const handle: Screen = { tab: "fomo", name: "FOMO 测试" };

export function meta() {
  return pageMeta({
    title: "AI 生存指数测试",
    description: "10 道题，约 2 分钟，测一测你和 AI 时代的距离：认知、工具、焦虑、学习与趋势五个维度。题目只在本页计算，不上传任何内容。",
    path: "/fomo-test",
  });
}

/** The grade as the page paints it, from 赛博觉醒者 down. */
function gradeTone(grade: string): string {
  if (grade === "S") return "text-accent-ink";
  if (grade === "A") return "text-ok-ink";
  if (grade === "B") return "text-ink-2";
  if (grade === "C") return "text-amber-ink";
  return "text-hot";
}

/** One question at a time: the number just answered advances the bar, the next one is already waiting. */
function Quiz({ onComplete }: { onComplete: (answers: Record<number, number>) => void }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [chosen, setChosen] = useState<number | null>(null);
  const question = QUIZ_QUESTIONS[index]!;

  const pick = (optionIndex: number) => {
    if (chosen !== null) return;
    setChosen(optionIndex);
    const next = { ...answers, [question.id]: question.options[optionIndex]!.score };
    setAnswers(next);
    window.setTimeout(() => {
      setChosen(null);
      if (index < QUIZ_QUESTIONS.length - 1) setIndex(index + 1);
      else onComplete(next);
    }, 300);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-ink-4">
          <span className="tabular-nums">
            问题 {index + 1}/{QUIZ_QUESTIONS.length}
          </span>
          <span className="text-accent-ink">{question.dimensionLabel}</span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-bg-sunk">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(index / QUIZ_QUESTIONS.length) * 100}%` }} />
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-card border border-line px-5 py-5">
        <div className="flex items-start gap-3">
          <span className="mono shrink-0 text-accent-ink">Q{index + 1}.</span>
          <h2 className="text-base leading-relaxed">{question.question}</h2>
        </div>
        <div className="flex flex-col gap-2">
          {question.options.map((option, optionIndex) => (
            <button
              key={option.label}
              type="button"
              onClick={() => pick(optionIndex)}
              className={`flex items-center gap-3 rounded-tile border px-4 py-3 text-left text-sm transition ${
                chosen === optionIndex ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-2 hover:border-accent hover:text-accent-ink"
              } ${chosen !== null && chosen !== optionIndex ? "opacity-50" : ""}`}
            >
              <span className={`mono flex size-6 shrink-0 items-center justify-center rounded-mark border text-[11px] ${chosen === optionIndex ? "border-accent text-accent-ink" : "border-line text-ink-4"}`}>
                {String.fromCharCode(65 + optionIndex)}
              </span>
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {Object.entries(DIMENSION_LABELS).map(([key, label]) => {
          const done = QUIZ_QUESTIONS.filter((entry) => entry.dimension === key).every((entry) => answers[entry.id] !== undefined);
          const active = question.dimension === key;
          return (
            <span
              key={key}
              className={`rounded-full border px-2.5 py-0.5 text-[11px] ${
                active ? "border-accent text-accent-ink" : done ? "border-line-strong text-ink-3" : "border-line text-ink-4"
              }`}
            >
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** The score, its level, and the five dimensions it came from. */
function Result({ answers, onRetry }: { answers: Record<number, number>; onRetry: () => void }) {
  const score = calcTotalScore(answers);
  const level: QuizLevel = getLevel(score);
  const dimensions = calcDimensionScores(answers);
  const message = `我的 AI 生存指数：${score}/100 - ${level.grade}级 ${level.label}。${level.description}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-2 rounded-card border border-line px-5 py-6 text-center">
        <div className={`text-6xl font-semibold leading-none tabular-nums ${gradeTone(level.grade)}`}>{score}</div>
        <div className="text-xs text-ink-4 tabular-nums">/ 100 生存指数</div>
        <span className={`mt-1 rounded-full border border-line px-3 py-1 text-sm font-medium ${gradeTone(level.grade)}`}>
          {level.grade} 级 · {level.label}
        </span>
        <p className="text-sm text-ink-3">{level.description}</p>
      </div>

      <div className="flex flex-col gap-3 rounded-card border border-line px-5 py-5">
        <h2 className="text-base font-semibold">五个维度</h2>
        {Object.entries(DIMENSION_LABELS).map(([key, label]) => (
          <div key={key} className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-xs text-ink-3">{label}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-bg-sunk">
              <div className="h-full rounded-full bg-accent/70" style={{ width: `${Math.max(2, dimensions[key] ?? 0)}%` }} />
            </div>
            <span className="w-10 shrink-0 text-right text-xs tabular-nums text-ink-4">{dimensions[key] ?? 0}</span>
          </div>
        ))}
        <p className="text-xs text-ink-4">分数只来自你在本页点的选项，不会上传；换一个答案，结论就跟着变。</p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => void navigator.clipboard.writeText(message).catch(() => undefined)}
          className="rounded-full border border-line px-4 py-1.5 text-sm text-ink-2 transition hover:border-accent hover:text-accent-ink"
        >
          复制结果
        </button>
        <button type="button" onClick={onRetry} className="rounded-full border border-line px-4 py-1.5 text-sm text-ink-2 transition hover:border-accent hover:text-accent-ink">
          重新测一遍
        </button>
        <a href="/anxiety-test" className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-contrast">
          测测你的焦虑值 →
        </a>
      </div>
    </div>
  );
}

export default function FomoTestPage() {
  const [answers, setAnswers] = useState<Record<number, number> | null>(null);
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6">
      <header className="flex flex-col gap-2 text-center">
        <h1 className="text-xl font-semibold">AI 生存指数测试</h1>
        <p className="text-sm text-ink-3">10 道题 · 约 2 分钟 · 测一测你和 AI 时代的距离。结果只在本页计算，不上传任何内容。</p>
      </header>
      {answers === null ? <Quiz onComplete={setAnswers} /> : <Result answers={answers} onRetry={() => setAnswers(null)} />}
      <p className="text-center text-xs text-ink-4">
        等级只是把同样的 10 道题分成 {QUIZ_LEVELS.length} 档（{QUIZ_LEVELS.map((level) => level.grade).join(" / ")}），图个参照，不构成任何建议。
      </p>
    </div>
  );
}
