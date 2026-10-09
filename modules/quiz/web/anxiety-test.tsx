// The anxiety quick test: five questions, a 0–50 score, and one piece of advice. Like the survival
// quiz, everything happens in the browser and nothing is stored.
import { useState } from "react";
import { pageMeta } from "@aihot/web/lib/seo";
import type { Screen } from "@aihot/web/components/shell/screens";
import { ANXIETY_QUESTIONS, calcAnxietyScore, getAnxietyLevel, type AnxietyLevel } from "../data/anxiety-quiz.ts";

/** The phone shell: this page sits under the 指数 tab, and a back button to it reads 焦虑测试. */
export const handle: Screen = { tab: "fomo", name: "焦虑测试" };

export function meta() {
  return pageMeta({
    title: "AI 焦虑速测",
    description: "5 道题，30 秒出结果，测测你的 AI 焦虑值。题目只在本页计算，不上传任何内容。",
    path: "/anxiety-test",
  });
}

/** The grade as the page paints it, from 焦虑爆表 down to 完全不焦虑. */
function gradeTone(grade: string): string {
  if (grade === "S") return "text-hot";
  if (grade === "A") return "text-amber-ink";
  if (grade === "B") return "text-ink-2";
  if (grade === "C") return "text-ok-ink";
  return "text-ink-4";
}

function Quiz({ onComplete }: { onComplete: (answers: Record<number, number>) => void }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [chosen, setChosen] = useState<number | null>(null);
  const question = ANXIETY_QUESTIONS[index]!;

  const pick = (optionIndex: number) => {
    if (chosen !== null) return;
    setChosen(optionIndex);
    const next = { ...answers, [question.id]: question.options[optionIndex]!.score };
    setAnswers(next);
    window.setTimeout(() => {
      setChosen(null);
      if (index < ANXIETY_QUESTIONS.length - 1) setIndex(index + 1);
      else onComplete(next);
    }, 300);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-ink-4">
          <span className="tabular-nums">
            问题 {index + 1}/{ANXIETY_QUESTIONS.length}
          </span>
          <span>速测模式</span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-bg-sunk">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(index / ANXIETY_QUESTIONS.length) * 100}%` }} />
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

      <div className="flex justify-center gap-2">
        {ANXIETY_QUESTIONS.map((entry, dot) => (
          <span key={entry.id} className={`size-2 rounded-full transition ${dot < index ? "bg-accent" : dot === index ? "bg-accent/50" : "bg-line-strong"}`} />
        ))}
      </div>
    </div>
  );
}

function Result({ answers, onRetry }: { answers: Record<number, number>; onRetry: () => void }) {
  const score = calcAnxietyScore(answers);
  const level: AnxietyLevel = getAnxietyLevel(score);
  const message = `我的 AI 焦虑值：${score}/50 - ${level.label} ${level.emoji}。${level.description}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-2 rounded-card border border-line px-5 py-6 text-center">
        <div className="text-5xl">{level.emoji}</div>
        <div className={`text-5xl font-semibold leading-none tabular-nums ${gradeTone(level.grade)}`}>{score}</div>
        <div className="text-xs text-ink-4 tabular-nums">/ 50 焦虑值</div>
        <span className={`mt-1 rounded-full border border-line px-3 py-1 text-sm font-medium ${gradeTone(level.grade)}`}>
          {level.grade} 级 · {level.label}
        </span>
        <p className="text-sm text-ink-3">{level.description}</p>
      </div>

      <div className="flex flex-col gap-2 rounded-card border border-line px-5 py-5">
        <div className="flex justify-between text-[11px] text-ink-4">
          <span>完全不焦虑</span>
          <span>焦虑爆表</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-bg-sunk">
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.max(2, (score / 50) * 100)}%`, background: "linear-gradient(to right, var(--ok), var(--amber), var(--hot))" }}
          />
        </div>
      </div>

      <div className="rounded-card border border-line px-5 py-4">
        <p className="text-sm leading-relaxed text-ink-2">
          <span className="font-medium">一条建议：</span>
          {level.advice}
        </p>
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
        <a href="/fomo-test" className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-contrast">
          深度 AI 生存测试 →
        </a>
      </div>
    </div>
  );
}

export default function AnxietyTestPage() {
  const [answers, setAnswers] = useState<Record<number, number> | null>(null);
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6">
      <header className="flex flex-col gap-2 text-center">
        <h1 className="text-xl font-semibold">AI 焦虑速测</h1>
        <p className="text-sm text-ink-3">5 道题 · 30 秒出结果 · 测测你有多焦虑。结果只在本页计算，不上传任何内容。</p>
      </header>
      {answers === null ? <Quiz onComplete={setAnswers} /> : <Result answers={answers} onRetry={() => setAnswers(null)} />}
      <p className="text-center text-xs text-ink-4">焦虑值只描述这一刻的心情，它今天的答案和明天可以不一样。</p>
    </div>
  );
}
