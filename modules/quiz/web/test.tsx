// The merged self-test page: the AI survival index and the anxiety quick test behind one entry, in the
// fomo module's cyberpunk skin. Everything still happens in the browser — the questions are static
// data, the score is computed on this page, and nothing is stored or uploaded (see docs/architecture.md).
import { useState, type ReactNode } from "react";
import { pageMeta } from "@aihot/web/lib/seo";
import type { Screen } from "@aihot/web/components/shell/screens";
import "@aihot/fomo/web/cyber.css";
import { DIMENSION_LABELS, QUIZ_QUESTIONS, QUIZ_LEVELS, calcDimensionScores, calcTotalScore, getLevel, type QuizLevel } from "../data/fomo-quiz.ts";
import { ANXIETY_QUESTIONS, calcAnxietyScore, getAnxietyLevel, type AnxietyLevel } from "../data/anxiety-quiz.ts";

/** The phone shell: this page sits under the fomo tab, and a back button to it reads FOMO 自测. */
export const handle: Screen = { tab: "fomo", name: "FOMO 自测" };

export function meta() {
  return pageMeta({
    title: "FOMO 自测：生存指数与焦虑速测",
    description: "10 道题的 AI 生存指数和 5 道题的焦虑速测，合在一个入口。结果只在本页计算，不上传任何内容。",
    path: "/fomo-test",
  });
}

/** The two tests the page switches between; each keeps its own answers while the other is on screen. */
type Which = "survival" | "anxiety";
type Answers = Record<number, number> | null;

/** The smallest shape both question files share, so one Quiz runs both. */
interface Question {
  id: number;
  question: string;
  options: ReadonlyArray<{ label: string; score: number }>;
}

/** The grade as the page paints it, from 赛博觉醒者 down, in this skin's own colours. */
function gradeInk(grade: string): string {
  if (grade === "S") return "var(--cyber-cyan)";
  if (grade === "A") return "var(--cyber-yellow)";
  if (grade === "B") return "var(--cyber-ink)";
  if (grade === "C") return "var(--cyber-magenta)";
  return "var(--cyber-muted)";
}

function Quiz<Q extends Question>({ questions, sideLabel, onComplete }: { questions: ReadonlyArray<Q>; sideLabel: (question: Q) => string; onComplete: (answers: Record<number, number>) => void }): ReactNode {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [chosen, setChosen] = useState<number | null>(null);
  const question = questions[index]!;

  const pick = (optionIndex: number) => {
    if (chosen !== null) return;
    setChosen(optionIndex);
    const next = { ...answers, [question.id]: question.options[optionIndex]!.score };
    setAnswers(next);
    window.setTimeout(() => {
      setChosen(null);
      if (index < questions.length - 1) setIndex(index + 1);
      else onComplete(next);
    }, 300);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-(--cyber-muted)">
          <span className="tabular-nums">
            问题 {index + 1}/{questions.length}
          </span>
          <span className="text-(--cyber-cyan)">{sideLabel(question)}</span>
        </div>
        <div className="h-1 w-full overflow-hidden bg-(--cyber-muted)/15">
          <div className="h-full bg-(--cyber-yellow) transition-all" style={{ width: `${(index / questions.length) * 100}%` }} />
        </div>
      </div>

      <div className="cyber-panel flex flex-col gap-4 p-5 md:px-6 md:py-6">
        <div className="flex items-start gap-3">
          <span className="shrink-0 font-bold text-(--cyber-yellow)">Q{index + 1}.</span>
          <h2 className="text-base leading-relaxed text-(--cyber-ink)">{question.question}</h2>
        </div>
        <div className="flex flex-col gap-2">
          {question.options.map((option, optionIndex) => (
            <button
              key={option.label}
              type="button"
              onClick={() => pick(optionIndex)}
              className={`flex items-center gap-3 border px-4 py-3 text-left text-sm transition ${
                chosen === optionIndex
                  ? "border-(--cyber-yellow) bg-(--cyber-yellow)/10 text-(--cyber-yellow)"
                  : "border-(--cyber-line) text-(--cyber-ink) hover:border-(--cyber-yellow)/60 hover:text-(--cyber-yellow)"
              } ${chosen !== null && chosen !== optionIndex ? "opacity-50" : ""}`}
            >
              <span className={`flex size-6 shrink-0 items-center justify-center border text-[11px] ${chosen === optionIndex ? "border-(--cyber-yellow)" : "border-(--cyber-line) text-(--cyber-muted)"}`}>
                {String.fromCharCode(65 + optionIndex)}
              </span>
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-center gap-2">
        {questions.map((entry, dot) => (
          <span key={entry.id} className={`size-2 rounded-full transition ${dot < index ? "bg-(--cyber-yellow)" : dot === index ? "bg-(--cyber-yellow)/50" : "bg-(--cyber-line)"}`} />
        ))}
      </div>
    </div>
  );
}

/** One dimension or one grade's bar, in this skin. */
function Bar({ label, value, max }: { label: string; value: number; max: number }): ReactNode {
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-xs text-(--cyber-muted)">{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden bg-(--cyber-muted)/15">
        <div className="h-full bg-(--cyber-cyan)/70" style={{ width: `${Math.max(2, (value / max) * 100)}%` }} />
      </div>
      <span className="w-10 shrink-0 text-right text-xs text-(--cyber-muted) tabular-nums">{value}</span>
    </div>
  );
}

function SurvivalResult({ answers, onRetry, onSwitch }: { answers: Record<number, number>; onRetry: () => void; onSwitch: () => void }): ReactNode {
  const score = calcTotalScore(answers);
  const level: QuizLevel = getLevel(score);
  const dimensions = calcDimensionScores(answers);
  const message = `我的 AI 生存指数：${score}/100 - ${level.grade}级 ${level.label}。${level.description}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="cyber-panel flex flex-col items-center gap-2 p-6 text-center md:py-8">
        <div className="cyber-display text-6xl leading-none font-bold tabular-nums" style={{ color: gradeInk(level.grade) }}>
          {score}
        </div>
        <div className="text-xs text-(--cyber-muted) tabular-nums">/ 100 生存指数</div>
        <span className="mt-1 border px-3 py-1 text-sm font-medium" style={{ borderColor: `color-mix(in srgb, ${gradeInk(level.grade)} 40%, transparent)`, color: gradeInk(level.grade) }}>
          {level.grade} 级 · {level.label}
        </span>
        <p className="text-sm text-(--cyber-muted)">{level.description}</p>
      </div>

      <div className="cyber-panel flex flex-col gap-3 p-5 md:px-6">
        <h2 className="cyber-display text-base font-bold text-(--cyber-ink)">五个维度</h2>
        {Object.entries(DIMENSION_LABELS).map(([key, label]) => (
          <Bar key={key} label={label} value={dimensions[key] ?? 0} max={100} />
        ))}
        <p className="text-xs text-(--cyber-muted)/60">分数只来自你在本页点的选项，不会上传；换一个答案，结论就跟着变。</p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => void navigator.clipboard.writeText(message).catch(() => undefined)}
          className="border border-(--cyber-line) px-4 py-1.5 text-sm text-(--cyber-ink) transition hover:border-(--cyber-yellow) hover:text-(--cyber-yellow)"
        >
          复制结果
        </button>
        <button type="button" onClick={onRetry} className="border border-(--cyber-line) px-4 py-1.5 text-sm text-(--cyber-ink) transition hover:border-(--cyber-yellow) hover:text-(--cyber-yellow)">
          重新测一遍
        </button>
        <button type="button" onClick={onSwitch} className="bg-(--cyber-yellow) px-4 py-1.5 text-sm font-medium text-(--cyber-bg)">
          测测你的焦虑值 →
        </button>
      </div>
    </div>
  );
}

function AnxietyResult({ answers, onRetry, onSwitch }: { answers: Record<number, number>; onRetry: () => void; onSwitch: () => void }): ReactNode {
  const score = calcAnxietyScore(answers);
  const level: AnxietyLevel = getAnxietyLevel(score);
  const message = `我的 AI 焦虑值：${score}/50 - ${level.label} ${level.emoji}。${level.description}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="cyber-panel flex flex-col items-center gap-2 p-6 text-center md:py-8">
        <div className="text-5xl">{level.emoji}</div>
        <div className="cyber-display text-6xl leading-none font-bold tabular-nums" style={{ color: gradeInk(level.grade) }}>
          {score}
        </div>
        <div className="text-xs text-(--cyber-muted) tabular-nums">/ 50 焦虑值</div>
        <span className="mt-1 border px-3 py-1 text-sm font-medium" style={{ borderColor: `color-mix(in srgb, ${gradeInk(level.grade)} 40%, transparent)`, color: gradeInk(level.grade) }}>
          {level.grade} 级 · {level.label}
        </span>
        <p className="text-sm text-(--cyber-muted)">{level.description}</p>
      </div>

      <div className="cyber-panel flex flex-col gap-2 p-5 md:px-6">
        <div className="flex justify-between text-[11px] text-(--cyber-muted)">
          <span>完全不焦虑</span>
          <span>焦虑爆表</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden bg-(--cyber-muted)/15">
          <div
            className="h-full"
            style={{ width: `${Math.max(2, (score / 50) * 100)}%`, background: "linear-gradient(to right, var(--cyber-cyan), var(--cyber-yellow), var(--cyber-magenta))" }}
          />
        </div>
      </div>

      <div className="cyber-panel p-5 md:px-6">
        <p className="text-sm leading-relaxed text-(--cyber-ink)">
          <span className="font-medium text-(--cyber-cyan)">一条建议：</span>
          {level.advice}
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => void navigator.clipboard.writeText(message).catch(() => undefined)}
          className="border border-(--cyber-line) px-4 py-1.5 text-sm text-(--cyber-ink) transition hover:border-(--cyber-magenta) hover:text-(--cyber-magenta)"
        >
          复制结果
        </button>
        <button type="button" onClick={onRetry} className="border border-(--cyber-line) px-4 py-1.5 text-sm text-(--cyber-ink) transition hover:border-(--cyber-magenta) hover:text-(--cyber-magenta)">
          重新测一遍
        </button>
        <button type="button" onClick={onSwitch} className="bg-(--cyber-magenta) px-4 py-1.5 text-sm font-medium text-(--cyber-bg)">
          深度 AI 生存测试 →
        </button>
      </div>
    </div>
  );
}

export default function SelfTestPage(): ReactNode {
  const [which, setWhich] = useState<Which>("survival");
  // Each test keeps its own answers, so switching does not lose a half-finished run.
  const [survivalAnswers, setSurvivalAnswers] = useState<Answers>(null);
  const [anxietyAnswers, setAnxietyAnswers] = useState<Answers>(null);

  const switcher = [
    { key: "survival" as Which, label: "生存指数", sub: `${QUIZ_QUESTIONS.length} 题 · 约 2 分钟`, color: "var(--cyber-yellow)" },
    { key: "anxiety" as Which, label: "焦虑速测", sub: `${ANXIETY_QUESTIONS.length} 题 · 30 秒`, color: "var(--cyber-magenta)" },
  ];

  return (
    <div className="cyber cyber-noise mx-auto mb-6 flex w-full max-w-2xl flex-col gap-6 px-4 py-6 md:my-4">
      <header className="flex flex-col gap-2 text-center">
        <div className="text-[10px] tracking-widest uppercase text-(--cyber-muted)">SELF-TEST // FOMO 自测</div>
        <h1 className="cyber-display text-2xl font-bold">
          <span className="cyber-text-gradient">测一测</span>
          <span className="text-(--cyber-ink)"> 你和 AI 时代的距离</span>
        </h1>
        <p className="text-sm leading-relaxed text-(--cyber-muted)">两份测试合在一个入口：先测生存指数，再测焦虑值，或只测其中一个。结果只在本页计算，不上传任何内容。</p>
      </header>

      {/* The switcher: the two tests, one accent each. */}
      <div className="grid grid-cols-2 gap-3">
        {switcher.map((entry) => {
          const active = which === entry.key;
          return (
            <button
              key={entry.key}
              type="button"
              onClick={() => setWhich(entry.key)}
              className={`cyber-panel cyber-hover-yellow flex flex-col gap-0.5 p-4 text-left transition-all ${active ? "" : "opacity-60 hover:opacity-100"}`}
              style={active ? { borderColor: `color-mix(in srgb, ${entry.color} 60%, transparent)`, boxShadow: `0 0 15px color-mix(in srgb, ${entry.color} 25%, transparent)` } : undefined}
            >
              <span className="cyber-display text-sm font-bold" style={{ color: active ? entry.color : "var(--cyber-ink)" }}>
                {entry.label}
              </span>
              <span className="text-[11px] text-(--cyber-muted)">{entry.sub}</span>
            </button>
          );
        })}
      </div>

      {which === "survival" ? (
        survivalAnswers === null ? (
          <Quiz key="survival" questions={QUIZ_QUESTIONS} sideLabel={(question) => question.dimensionLabel} onComplete={setSurvivalAnswers} />
        ) : (
          <SurvivalResult answers={survivalAnswers} onRetry={() => setSurvivalAnswers(null)} onSwitch={() => setWhich("anxiety")} />
        )
      ) : anxietyAnswers === null ? (
        <Quiz key="anxiety" questions={ANXIETY_QUESTIONS} sideLabel={() => "速测模式"} onComplete={setAnxietyAnswers} />
      ) : (
        <AnxietyResult answers={anxietyAnswers} onRetry={() => setAnxietyAnswers(null)} onSwitch={() => setWhich("survival")} />
      )}

      <p className="text-center text-xs text-(--cyber-muted)/60">
        等级只是把同样的题分成 {QUIZ_LEVELS.length} 档（{QUIZ_LEVELS.map((level) => level.grade).join(" / ")}），图个参照；焦虑值只描述这一刻的心情，不构成任何建议。
      </p>
    </div>
  );
}
