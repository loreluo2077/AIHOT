// The FOMO homepage, migrated from the eva-s-fomo-finder prototype: a full cyberpunk panel — the hero
// that rotates through four moments of AI anxiety, today's index, the explanation, a mood check, and a
// wall of voices. Everything but the index is static: the poll counts and the reader wall live only in
// this browser (localStorage), nothing is posted, and the index comes from this module's own API.
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { pageMeta } from "@aihot/web/lib/seo";
import type { Screen } from "@aihot/web/components/shell/screens";
import { IconBolt, IconClock, IconSparkles } from "@aihot/web/components/icons";
import { FOMO } from "../config.ts";
import type { FomoPayload } from "../types.ts";
import "./cyber.css";

/** The phone shell: this page is the site's root, and a back button to it reads 今日FOMO. */
export const handle: Screen = { tab: "fomo", name: "今日FOMO" };

export function meta() {
  // The share card is the site's own (site/site.ts CARDS.fomo): this page is what people forward.
  return pageMeta({
    title: "AI FOMO",
    description:
      "你明明没有落后，却每天都觉得自己正在落后。这里收集 AI 时代那些想跟上、又被新工具追着跑的瞬间。",
    path: "/",
    image: "/og/pages/fomo.png",
  });
}

/**
 * Today's index, the page's one live number. A failed read is a null rather than a thrown answer: the
 * page around it is static and must keep standing when the api is down. The loader reads the api by its
 * address; the browser's refresh reads it through the site's own /api proxy.
 */
async function fetchPayload(
  url: string,
  signal?: AbortSignal,
): Promise<FomoPayload | null> {
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json", "x-aihot-ssr": "1" },
      signal: signal ?? AbortSignal.timeout(15_000),
    });
    if (!response.ok) return null;
    return (await response.json()) as FomoPayload;
  } catch {
    return null;
  }
}

export async function loader(): Promise<Record<string, never>> {
  // The homepage no longer displays live index or mood blocks, so it has no API read of its own.
  return {};
}

/** The four moments that trigger AI FOMO in an ordinary day. */
const STIMULUS_CARDS = [
  {
    badge: "一睁眼，又更新了",
    titleTop: "又来了一个",
    subtitle: (
      <>
        昨天那个<span className='text-(--cyber-yellow)'>还没打开</span>
      </>
    ),
    desc: <>刚准备认真学一下，发现大家已经在讨论下一代了。</>,
  },
  {
    badge: "收藏夹：一切尽在掌握",
    titleTop: "收藏了 200 个教程",
    subtitle: <span className='cyber-text-gradient-hot'>看完了两个标题</span>,
    desc: <>先收藏，等有空再看。至于什么时候有空，暂时不清楚。</>,
  },
  {
    badge: "本来只是随便看看",
    titleTop: "刷了三小时 AI 新闻",
    subtitle: (
      <>
        正事<span className='text-(--cyber-cyan)'>一点没动</span>
      </>
    ),
    desc: <>新名词记了一堆。电脑一关，还是不知道今天该学哪个。</>,
  },
  {
    badge: "同事说很简单",
    titleTop: "“这个五分钟就能搞定”",
    subtitle: <span className='text-(--cyber-cyan)'>我点了点头</span>,
    desc: <>然后趁没人注意，搜了一遍这个东西到底是干什么的。</>,
  },
] as const;

const HERO_INTERVAL = 5000;

/** The prototype's count-up: a number that eases to its target as the page opens. */
function useCountUp(target: number, duration = 1800): number {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    const startTime = Date.now();
    const timer = window.setInterval(() => {
      const progress = Math.min((Date.now() - startTime) / duration, 1);
      setCurrent(Math.floor((1 - Math.pow(1 - progress, 3)) * target));
      if (progress >= 1) window.clearInterval(timer);
    }, 16);
    return () => window.clearInterval(timer);
  }, [target, duration]);
  return current;
}

/** Today's index, as the retired trends page drew it: the count-up, the band, the gauge, the day's own numbers. */
function TodaySection({ payload }: { payload: FomoPayload | null }): ReactNode {
  const shown = useCountUp(payload?.index ?? 0);
  const band = payload?.band;
  const bandInk =
    band?.key === "panic"
      ? "var(--cyber-magenta)"
      : band?.key === "buzz"
        ? "var(--cyber-yellow)"
        : "var(--cyber-cyan)";
  const factors = payload?.breakdown.factors ?? [];
  const stats = [
    { label: "精选", value: payload ? String(factors[0]?.value ?? 0) : "—" },
    { label: "事件", value: payload ? String(factors[1]?.value ?? 0) : "—" },
    {
      label: "一手占比",
      value: payload
        ? `${Math.round(payload.breakdown.firstPartyRatio * 100)}%`
        : "—",
    },
    {
      label: "平均分",
      value:
        payload?.breakdown.averageScore == null
          ? "—"
          : String(Math.round(payload.breakdown.averageScore)),
    },
  ];

  return (
    <section className='px-4 py-12'>
      <div className='cyber-panel cyber-hover-yellow mx-auto max-w-3xl p-6 md:p-8'>
        <div className='mb-3 flex items-center justify-between'>
          <div className='mono text-[10px] tracking-widest uppercase text-(--cyber-muted)'>
            INDEX // 今日指数
          </div>
          <div className='mono text-[10px] text-(--cyber-muted)/60'>
            {payload?.day ?? ""}（北京时间）
          </div>
        </div>
        {payload ? (
          <>
            <div className='flex flex-col items-center'>
              <div
                className='cyber-display text-7xl leading-none font-bold md:text-8xl'
                style={{ color: bandInk }}
              >
                {shown}
              </div>
              <div className='mt-2 text-xs text-(--cyber-muted)'>
                / 100 内容强度
              </div>
              <div
                className='mt-4 rounded-full border px-4 py-1.5 text-sm font-bold tracking-wider uppercase'
                style={{
                  borderColor: `color-mix(in srgb, ${bandInk} 40%, transparent)`,
                  color: bandInk,
                }}
              >
                {band?.label}
              </div>
            </div>

            {/* The gauge the number sits on, with the three bands as its scale. */}
            <div className='mt-6 w-full'>
              <div className='h-2 w-full overflow-hidden rounded-full bg-(--cyber-muted)/15'>
                <div
                  className='h-full rounded-full transition-all duration-1000'
                  style={{
                    width: `${Math.max(2, payload.index)}%`,
                    background:
                      "linear-gradient(to right, var(--cyber-cyan), var(--cyber-yellow), var(--cyber-magenta))",
                  }}
                />
              </div>
              <div className='mono mt-2 flex justify-between text-[10px] text-(--cyber-muted)'>
                {FOMO.bands.map((b) => (
                  <span key={b.key}>
                    {b.label} ≤{b.max}
                  </span>
                ))}
              </div>
            </div>

            {/* The day's own numbers, under the index. */}
            <div className='mt-6 grid grid-cols-2 gap-3 md:grid-cols-4'>
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className='flex flex-col gap-1 rounded-tile border border-(--cyber-line)/60 p-3 text-center'
                >
                  <span className='text-[10px] tracking-widest text-(--cyber-muted)'>
                    {stat.label}
                  </span>
                  <span className='cyber-display text-xl font-bold text-(--cyber-cyan) tabular-nums'>
                    {stat.value}
                  </span>
                </div>
              ))}
            </div>
            <p className='mt-4 text-center text-[10px] text-(--cyber-muted)/60'>
              指数只看今天真正选出的内容（精选、事件、一手、评分）。
            </p>
          </>
        ) : (
          <p className='py-8 text-center text-sm text-(--cyber-muted)'>
            指数暂时不可用，稍后再来看。
          </p>
        )}
      </div>
    </section>
  );
}

function HeroSection(): ReactNode {
  const [current, setCurrent] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [glitchText, setGlitchText] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  const goTo = useCallback((index: number) => {
    setTransitioning(true);
    window.setTimeout(() => {
      setCurrent(index);
      setTransitioning(false);
    }, 300);
  }, []);

  useEffect(() => {
    const warning = window.setTimeout(() => setShowWarning(true), 500);
    const glitches = window.setInterval(() => {
      setGlitchText(true);
      window.setTimeout(() => setGlitchText(false), 150);
    }, 4000);
    const rotation = window.setInterval(
      () => goTo((current + 1) % STIMULUS_CARDS.length),
      HERO_INTERVAL,
    );
    return () => {
      window.clearTimeout(warning);
      window.clearInterval(glitches);
      window.clearInterval(rotation);
    };
  }, [current, goTo]);

  const card = STIMULUS_CARDS[current]!;

  const scrollToVoices = () => {
    document
      .getElementById("everyone-saying")
      ?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className='fomo-hero relative flex items-center justify-center overflow-hidden py-16 sm:py-20 xl:grid xl:min-h-[min(620px,calc(100dvh-120px))] xl:grid-cols-[1.15fr_0.85fr] xl:gap-10 xl:py-0'>
      <div className='cyber-grid-bg absolute inset-0 opacity-60' aria-hidden />
      <Link
        to='/'
        aria-label='AI FOMO 首页'
        className='absolute left-5 top-5 z-20 inline-flex items-center gap-2 text-[15px] font-black tracking-[-0.03em] text-(--cyber-ink) transition-opacity hover:opacity-80 md:left-7 md:top-7'
      >
        <span aria-hidden className='size-2 rounded-full bg-(--cyber-yellow)' />
        <span>AI FOMO</span>
      </Link>
      <div
        className='pointer-events-none absolute right-0 top-0 size-[300px] opacity-20'
        aria-hidden
      >
        <div className='absolute right-10 top-10 h-px w-full origin-right rotate-[-35deg] bg-gradient-to-l from-(--cyber-yellow)/60 to-transparent' />
        <div className='absolute right-10 top-20 h-px w-[200px] origin-right rotate-[-35deg] bg-gradient-to-l from-(--cyber-cyan)/40 to-transparent' />
      </div>
      <div
        className='pointer-events-none absolute bottom-0 left-0 size-[200px] opacity-15'
        aria-hidden
      >
        <div className='absolute bottom-20 left-10 h-px w-full origin-left rotate-[-35deg] bg-gradient-to-r from-(--cyber-magenta)/50 to-transparent' />
      </div>

      <div className='relative z-10 mx-auto max-w-5xl px-4 text-center'>
        {/* The warning badge the card wears. */}
        <div
          className={`mono mb-8 inline-flex items-center gap-2 rounded-full border border-(--cyber-yellow)/60 bg-(--cyber-yellow)/10 px-4 py-1.5 text-xs tracking-widest uppercase text-(--cyber-yellow) transition-all duration-500 ${
            showWarning
              ? "translate-y-0 opacity-100"
              : "-translate-y-4 opacity-0"
          } ${transitioning ? "translate-y-2 opacity-0" : ""}`}
        >
          <span className='cyber-animate-warning-flash size-2 bg-(--cyber-yellow)' />
          <span>{card.badge}</span>
        </div>

        {/* The headline, swapped card by card. */}
        <div
          className={`transition-all duration-300 ${transitioning ? "translate-y-4 scale-95 opacity-0" : "translate-y-0 scale-100 opacity-100"}`}
        >
          <h1
            className={`cyber-display mb-6 text-5xl leading-[1.08] font-bold tracking-tight transition-all md:text-7xl ${glitchText ? "cyber-animate-glitch" : ""}`}
          >
            <span className='cyber-text-gradient cyber-animate-neon-flicker block'>
              {card.titleTop}
            </span>
            <span className='mt-4 block text-2xl font-semibold tracking-wider text-(--cyber-ink) md:text-4xl'>
              {card.subtitle}
            </span>
          </h1>
          <p className='mx-auto mb-10 max-w-2xl text-sm leading-relaxed text-(--cyber-muted) md:text-base'>
            {card.desc}
          </p>
        </div>

        {/* The card indicators. */}
        <div className='mb-8 flex items-center justify-center gap-2'>
          {STIMULUS_CARDS.map((_, i) => (
            <button
              key={i}
              type='button'
              aria-label={`第 ${i + 1} 张`}
              onClick={() => goTo(i)}
              className={`h-1 rounded-full transition-all duration-300 ${i === current ? "w-8 bg-(--cyber-yellow)" : "w-3 bg-(--cyber-muted)/30 hover:bg-(--cyber-muted)/50"}`}
            />
          ))}
        </div>

        {/* The two doors: the voices wall below, and the merged self-test. */}
        <div className='flex flex-wrap items-center justify-center gap-4'>
          <button
            type='button'
            onClick={scrollToVoices}
            className='cyber-scan-hover rounded-full bg-accent px-8 py-3 text-base font-bold tracking-[0.15em] uppercase text-accent-contrast transition-all hover:scale-105 hover:bg-accent-ink'
          >
            看看大家怎么说 //
          </button>
          <Link
            to='/fomo-test'
            className='cyber-glitch-hover rounded-full border border-line-strong px-8 py-3 text-base font-bold tracking-[0.15em] uppercase text-accent transition-all hover:scale-105 hover:border-accent hover:bg-accent-soft'
          >
            测试 &gt;&gt;
          </Link>
        </div>

        <div
          className='mt-10 flex items-center justify-center gap-3 xl:mt-16'
          aria-hidden
        >
          <div className='h-px w-20 bg-gradient-to-r from-transparent to-(--cyber-yellow)/40' />
          <div className='size-1.5 bg-(--cyber-yellow)/60' />
          <div className='h-px w-8 bg-(--cyber-yellow)/40' />
          <div className='size-1.5 bg-(--cyber-cyan)/60' />
          <div className='h-px w-20 bg-gradient-to-l from-transparent to-(--cyber-cyan)/40' />
        </div>
      </div>

      {/* Wide screens seat the definition beside the carousel (FomoExplainer below); phones keep the
          original full-height hero with the definition underneath it. */}
      <aside className='relative z-10 hidden px-4 xl:block'>
        <FomoExplainer />
      </aside>
    </section>
  );
}

/** The hairline between sections, tinted by whichever colour leads the next one. */
function SectionDivider({
  variant = "yellow",
}: {
  variant?: "yellow" | "cyan" | "magenta";
}): ReactNode {
  const line = {
    yellow: "from-transparent via-(--cyber-yellow)/30 to-transparent",
    cyan: "from-transparent via-(--cyber-cyan)/25 to-transparent",
    magenta: "from-transparent via-(--cyber-magenta)/25 to-transparent",
  }[variant];
  const dot = {
    yellow: "bg-(--cyber-yellow)/50",
    cyan: "bg-(--cyber-cyan)/50",
    magenta: "bg-(--cyber-magenta)/50",
  }[variant];
  return (
    <div className='relative flex items-center justify-center py-4' aria-hidden>
      <div className={`h-px w-full max-w-4xl bg-gradient-to-r ${line}`} />
      <div className='absolute flex items-center gap-4'>
        <div className={`size-1 ${dot}`} />
        <div className='h-px w-6 bg-(--cyber-line)' />
        <div className={`size-1.5 ${dot}`} />
        <div className='h-px w-6 bg-(--cyber-line)' />
        <div className={`size-1 ${dot}`} />
      </div>
    </div>
  );
}

/** The definition card: on wide screens it sits inside the hero beside the carousel; on phones it
 *  stays at the top of the explanation below. Same card, two seats, never both at once. */
function FomoExplainer(): ReactNode {
  return (
    <div className='fomo-explainer text-center'>
      <div className='mono mb-3 text-[10px] tracking-widest uppercase text-(--cyber-muted)'>
        EXPLAIN // 你也这样吗
      </div>
      <h2 className='cyber-display text-2xl font-bold md:text-4xl'>
        <span className='text-(--cyber-ink)'>什么是 </span>
        <span className='cyber-text-gradient'>AI FOMO</span>
        <span className='text-(--cyber-ink)'> ？</span>
      </h2>
      <p className='mx-auto mt-4 max-w-xl text-sm leading-relaxed text-(--cyber-muted) md:text-base'>
        大概就是：本来今天过得好好的，看了十分钟 AI 新闻，突然觉得自己什么都不会。
        <br />
        看到新工具想试，看到别人做出东西又着急。收藏越来越多，真正用起来的还是那几个。
        <br />
        不是你真的落后了。只是每天都有人提醒你：还有新的东西没学。
      </p>
    </div>
  );
}

/** The explanation: what AI FOMO is, the moments everyone knows, and the reassurance. */
function WhatIsFOMO(): ReactNode {
  const anxieties = [
    {
      icon: IconBolt,
      title: "能力焦虑",
      text: "别人都开始分享心得了，我还在找注册入口。",
    },
    {
      icon: IconSparkles,
      title: "价值焦虑",
      text: "AI 又会了一项。很好，我又少了一项可以自我介绍的技能。",
    },
    {
      icon: IconClock,
      title: "机会焦虑",
      text: "也不知道是什么机会，反正看起来再不行动就要错过了。",
    },
  ] as const;

  return (
    <section className='px-4 py-16 md:py-24'>
      <div className='mx-auto max-w-5xl lg:grid lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-12'>
        <div>
        {/* Phones keep the definition here at the top of the explanation; wide screens seat it
            inside the hero instead (see FomoExplainer). */}
        <div className='mb-10 xl:hidden'>
          <FomoExplainer />
        </div>

        <div className='mb-10'>
          <div className='mb-4 text-[10px] tracking-widest uppercase text-(--cyber-muted)'>
            三种底层焦虑 // 你到底在怕什么？
          </div>
          <div className='grid gap-3 md:grid-cols-3'>
            {anxieties.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className='cyber-panel cyber-hover-yellow p-5'
              >
                <div className='mb-3 text-(--cyber-yellow)'>
                  <Icon size={20} />
                </div>
                <h3 className='mb-2 text-base font-bold text-(--cyber-ink)'>
                  {title}
                </h3>
                <p className='text-sm leading-relaxed text-(--cyber-muted)'>
                  {text}
                </p>
              </div>
            ))}
          </div>
          <p className='mx-auto mt-4 max-w-2xl text-center text-sm leading-relaxed text-(--cyber-muted)'>
            于是先收藏、先安装、先报名。事情有没有开始不重要，至少刚才那几分钟没那么慌了。
          </p>
        </div>

        <div className='mb-8 text-sm'>
          <div className='mb-4 text-[10px] tracking-widest uppercase text-(--cyber-muted)'>
            症状清单 // 你中了几条？
          </div>
          <div className='grid gap-3'>
            {[
              "早上还没起床，先看到别人用 AI 做完了一个产品。",
              "手里的工具明明够用，还是顺手把新的也注册了。",
              "收藏夹里全是「周末看」，但每个周末都有新的要收藏。",
              "本来准备干活，结果先研究了两个小时该用什么工具干活。",
              "同时开了三个教程，最后只学会了怎么切标签页。",
              "看到「这几个岗位要消失了」，明知道标题很夸张，还是点了进去。",
            ].map((symptom) => (
              <div
                key={symptom}
                className='cyber-panel cyber-hover-yellow flex items-start gap-3 p-4 text-(--cyber-ink)'
              >
                <span className='mt-0.5 shrink-0 text-(--cyber-yellow)'>□</span>
                <span className='leading-relaxed'>{symptom}</span>
              </div>
            ))}
          </div>
        </div>
        <div className='text-center'>
          <div className='inline-block rounded-tile border border-(--cyber-cyan)/30 bg-(--cyber-cyan)/5 px-5 py-3'>
            <p className='text-sm leading-relaxed text-(--cyber-ink)'>
              来这里不是劝你再学十个工具。
              <br className='hidden md:block' />
              只是想提醒一句：
              <span className='font-bold text-(--cyber-yellow)'>
                今天真正用得上的，学一个就够了
              </span>
            </p>
          </div>
        </div>
        </div>

        <aside className='mt-10 hidden lg:block lg:mt-0'>
          <div className='sticky top-6 space-y-4'>
            <div className='border-t border-line pt-3.5'>
              <div className='mono text-[10px] tracking-widest text-(--cyber-muted)'>下一步</div>
              <h2 className='mt-2 text-[16px] font-semibold text-(--cyber-ink)'>不用追完所有更新</h2>
              <p className='mt-2 text-[13px] leading-relaxed text-(--cyber-muted)'>先弄清楚是什么在让你焦虑，再决定今天真正值得花时间的事。</p>
            </div>
            <Link to='/fomo-test' className='block rounded-control bg-accent px-4 py-3 text-center text-[13px] font-semibold text-accent-contrast transition-colors hover:bg-accent-ink'>做一次测试</Link>
            <Link to='/curated' className='block rounded-control border border-line-strong px-4 py-3 text-center text-[13px] font-semibold text-accent transition-colors hover:border-accent hover:bg-accent-soft'>从精选开始看</Link>
          </div>
        </aside>
      </div>
    </section>
  );
}

/** The mood check: four answers, counted only in this browser, exactly like the prototype. */
function FomoPoll(): ReactNode {
  const options = [
    { label: "岁月静好 😌", value: "none", emoji: "😌" },
    { label: "就亿点点 😅", value: "little", emoji: "😅" },
    { label: "收藏了但没学 😰", value: "yes", emoji: "😰" },
    { label: "已经开始秃了 🤯", value: "very", emoji: "🤯" },
  ] as const;
  const [selected, setSelected] = useState<string | null>(null);
  const [votes, setVotes] = useState<Record<string, number>>({
    none: 127,
    little: 342,
    yes: 518,
    very: 289,
  });

  const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);
  const handleVote = (value: string) => {
    if (selected) return;
    setSelected(value);
    setVotes((prev) => ({ ...prev, [value]: prev[value]! + 1 }));
  };

  return (
    <section className='px-4 py-12'>
      <div className='cyber-panel mx-auto max-w-3xl p-6 md:p-8'>
        <div className='mono mb-3 text-[10px] tracking-widest uppercase text-(--cyber-muted)'>
          QUICK.SCAN // 今日心情
        </div>
        <h3 className='cyber-display mb-5 text-lg font-bold md:text-xl'>
          <span className='text-(--cyber-ink)'>今天被 </span>
          <span className='cyber-text-gradient'>AI新闻</span>
          <span className='text-(--cyber-ink)'> 刺激到了吗？</span>
        </h3>

        <div className='grid grid-cols-2 gap-3'>
          {options.map((opt) => {
            const count = votes[opt.value]!;
            const pct = Math.round(
              (count / (totalVotes + (selected ? 1 : 0))) * 100,
            );
            return (
              <button
                key={opt.value}
                type='button'
                onClick={() => handleVote(opt.value)}
                disabled={selected !== null}
                className={`relative overflow-hidden rounded-tile border p-4 text-left transition-all duration-300 ${
                  selected === opt.value
                    ? "border-(--cyber-yellow) bg-(--cyber-yellow)/10"
                    : selected
                      ? "border-(--cyber-line)/50 opacity-70"
                      : "cursor-pointer border-(--cyber-line) hover:border-(--cyber-yellow)/50 hover:bg-(--cyber-yellow)/5"
                }`}
              >
                {selected !== null && (
                  <div
                    className='absolute inset-y-0 left-0 bg-(--cyber-yellow)/10 transition-all duration-700 ease-out'
                    style={{ width: `${pct}%` }}
                  />
                )}
                <div className='relative z-10'>
                  <div className='mb-1 text-2xl'>{opt.emoji}</div>
                  <div className='text-sm text-(--cyber-ink)'>{opt.label}</div>
                  {selected !== null && (
                    <div className='mono cyber-animate-fade-in mt-1 text-xs text-(--cyber-yellow) tabular-nums'>
                      {pct}%（{count}
                      {selected === opt.value ? "+1" : ""}）
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {selected !== null && (
          <div className='cyber-animate-fade-in mt-4 text-center text-xs text-(--cyber-muted)'>
            共 {totalVotes + 1}{" "}
            人参与了今日检测（票数只在这台浏览器里玩，别当真）
          </div>
        )}
      </div>
    </section>
  );
}

// The reader wall is a browser's own: what a reader posts is kept in localStorage, never uploaded, and
// nobody else can see it — the same privacy the prototype's wall had.
const VOICES_KEY = "aifomo-voices";
const MOOD_OPTIONS = [
  "😅",
  "🫠",
  "😂",
  "🥲",
  "😮‍💨",
  "🤡",
  "💀",
  "🔄",
  "😭",
  "🤯",
] as const;

interface StoredVoice {
  content: string;
  mood: string;
  created_at: string;
}

function readVoices(): StoredVoice[] {
  try {
    const raw = window.localStorage.getItem(VOICES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as StoredVoice[]) : [];
  } catch {
    return [];
  }
}

function writeVoices(voices: StoredVoice[]) {
  window.localStorage.setItem(VOICES_KEY, JSON.stringify(voices.slice(0, 50)));
}

/** 「12m」 for a voice posted minutes ago; the defaults below never age because they are fixed strings. */
function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

const DEFAULT_VOICES = [
  {
    text: "又出了个新工具。我点进去看了一眼，发现上一个账号都还没注册完。",
    mood: "😅",
    time: "3m",
  },
  {
    text: "老板在群里发了篇全英文教程，说大家有空学习一下。群里目前非常安静。",
    mood: "🫠",
    time: "12m",
  },
  {
    text: "我妈问 ChatGPT 能不能帮她炒股。我说不能全信。其实这话也是我刚搜到的。",
    mood: "😂",
    time: "28m",
  },
  {
    text: "收藏了一个「7 天学会 AI」的课程。今天是第 47 天，第一课还没看完。",
    mood: "🥲",
    time: "1h",
  },
  {
    text: "同事用 AI 十分钟写完周报。我花了半小时研究他到底用了哪个提示词。",
    mood: "😮‍💨",
    time: "2h",
  },
  {
    text: "公司开 AI 分享会，我全程点头。散会以后第一件事，是搜刚才那些词怎么念。",
    mood: "🤡",
    time: "3h",
  },
] as const;

/** The static feed the cards below the wall read: the prototype's own fifteen, timestamps from page load. */
const FEED_TYPES = {
  自嘲吐槽: {
    border: "border-l-(--cyber-yellow)/60",
    icon: "😅",
    label: "自嘲一下",
  },
  真实故事: { border: "border-l-(--cyber-cyan)/60", icon: "📡", label: "真实经历" },
} as const;
type FeedType = keyof typeof FEED_TYPES;

interface FeedItem {
  id: string;
  type: FeedType;
  content: string;
  source?: string;
  at: number;
}

const HOUR = 3600_000;
const FEED_ITEMS: FeedItem[] = [
  ...DEFAULT_VOICES.map((voice, index) => ({
    id: `voice-${index + 1}`,
    type: "自嘲吐槽" as const,
    content: voice.text,
    at: Date.now() - HOUR * (index + 1),
  })),
  {
    id: "fomo-symptom-1",
    type: "自嘲吐槽",
    content:
      "早上还没起床，先看到别人用 AI 做完了一个产品。今天的落后感来得很准时。",
    at: Date.now() - HOUR * 7,
  },
  {
    id: "fomo-symptom-2",
    type: "自嘲吐槽",
    content:
      "手里的工具明明够用，还是顺手把新的也注册了。就当是留条后路。",
    at: Date.now() - HOUR * 8,
  },
  {
    id: "fomo-symptom-3",
    type: "自嘲吐槽",
    content:
      "收藏夹里全是「周末看」，但每个周末都有新的要收藏。周末本身一直没到。",
    at: Date.now() - HOUR * 9,
  },
  {
    id: "fomo-symptom-4",
    type: "自嘲吐槽",
    content:
      "本来准备干活，结果先研究了两个小时该用什么工具干活。后来活没干成。",
    at: Date.now() - HOUR * 10,
  },
  {
    id: "fomo-symptom-5",
    type: "自嘲吐槽",
    content:
      "同时开了三个教程，最后只学会了怎么切标签页。也算熟练了一项技能。",
    at: Date.now() - HOUR * 11,
  },
  {
    id: "fomo-symptom-6",
    type: "自嘲吐槽",
    content: "看到「这几个岗位要消失了」，明知道标题很夸张，还是点了进去。",
    at: Date.now() - HOUR * 12,
  },
  {
    id: "ff2",
    type: "真实故事",
    content:
      "同事用ChatGPT写完周报去喝咖啡了，我还在逐字逐句改。后来我也偷偷注册了一个。",
    source: "即刻",
    at: Date.now() - HOUR * 2,
  },
  {
    id: "ff3",
    type: "自嘲吐槽",
    content: "装了五个 AI App。真正会主动打开的，还是最开始那个聊天框。",
    at: Date.now() - HOUR * 3,
  },
  {
    id: "ff4",
    type: "自嘲吐槽",
    content:
      "我的AI学习路线：看到新工具→焦虑→收藏→忘记→看到下一个新工具→更焦虑。完美闭环。",
    at: Date.now() - HOUR * 4,
  },
  {
    id: "ff5",
    type: "真实故事",
    content:
      "35岁，转行学AI第一天：打开教程，发现需要先学Python。关掉教程，打开抖音 App。",
    source: "知乎",
    at: Date.now() - HOUR * 5,
  },
  {
    id: "ff6",
    type: "自嘲吐槽",
    content: "关注的博主每天都在推荐「必学工具」。我目前最熟练的操作是点收藏。",
    at: Date.now() - HOUR * 6,
  },
  {
    id: "ff7",
    type: "自嘲吐槽",
    content:
      "「你试过Codex吗？」「Cursor是什么？」「……算了，你试过Claude吗？」「Claude又是谁？」",
    at: Date.now() - HOUR * 7,
  },
  {
    id: "ff8",
    type: "真实故事",
    content:
      "老板在群里发了一个「AI提效指南」，全组已读未回。因为大家都在偷偷百度这些工具是干嘛的。",
    source: "微信群",
    at: Date.now() - HOUR * 8,
  },
  {
    id: "ff9",
    type: "自嘲吐槽",
    content:
      "每次看到「人人都该学 AI」，我都会认真焦虑一下，然后继续处理今天的工作。",
    at: Date.now() - HOUR * 9,
  },

  {
    id: "ff12",
    type: "自嘲吐槽",
    content: "最费时间的不是学工具，是研究到底应该学哪个工具。",
    at: Date.now() - HOUR * 12,
  },

  {
    id: "ff14",
    type: "真实故事",
    content:
      "爸妈问我AI会不会让我失业。我说不会。但我晚上偷偷搜了「AI会取代哪些岗位」。",
    source: "小红书",
    at: Date.now() - HOUR * 16,
  },
  {
    id: "ff15",
    type: "自嘲吐槽",
    content: "这个时代最大的技能不是会用AI，是会假装自己会用AI。",
    at: Date.now() - HOUR * 18,
  },
];

/** The wall's own form: one sentence, one mood, kept in this browser only. */
function SubmitVoiceForm({
  onSubmitted,
}: {
  onSubmitted: () => void;
}): ReactNode {
  const [content, setContent] = useState("");
  const [mood, setMood] = useState<string>("😅");
  const [message, setMessage] = useState<string | null>(null);

  const submit = () => {
    const trimmed = content.trim();
    if (!trimmed || trimmed.length > 200) return;
    try {
      writeVoices([
        { content: trimmed, mood, created_at: new Date().toISOString() },
        ...readVoices(),
      ]);
      setMessage("记下来了，只存在你的浏览器里");
      setContent("");
      setMood("😅");
      onSubmitted();
    } catch {
      setMessage("保存失败：这个浏览器不让写本地存储。");
    }
  };

  return (
    <div className='cyber-panel mb-6 flex flex-col gap-3 p-4'>
      <div className='mono mb-3 text-[10px] tracking-widest uppercase text-(--cyber-muted)'>
        说说你今天又被什么刺激到了
      </div>
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        maxLength={200}
        rows={2}
        placeholder='比如：刚学会一个，群里又开始聊下一个了……'
        className='w-full resize-none rounded-control border border-(--cyber-line)/50 bg-(--cyber-bg)/30 px-3 py-2 text-sm text-(--cyber-ink) outline-none transition-colors placeholder:text-(--cyber-muted)/50 focus:border-(--cyber-yellow)/50'
      />
      <div className='flex flex-wrap items-center gap-1.5'>
        <span className='mono mr-1 text-[10px] text-(--cyber-muted)'>
          此刻心情
        </span>
        {MOOD_OPTIONS.map((m) => (
          <button
            key={m}
            type='button'
            onClick={() => setMood(m)}
            aria-label={`心情 ${m}`}
            className={`rounded p-0.5 text-lg transition-all ${mood === m ? "scale-125 ring-1 ring-(--cyber-yellow)/50" : "opacity-50 hover:opacity-80"}`}
          >
            {m}
          </button>
        ))}
      </div>
      <div className='flex items-center justify-end gap-3'>
        <span className='mono text-[10px] text-(--cyber-muted) tabular-nums'>
          {[...content].length}/200
        </span>
        <button
          type='button'
          onClick={submit}
          disabled={!content.trim()}
          className='rounded-control border border-(--cyber-yellow)/40 bg-(--cyber-yellow)/10 px-5 py-2 text-xs tracking-wider uppercase text-(--cyber-yellow) transition-all hover:bg-(--cyber-yellow)/20 disabled:cursor-not-allowed disabled:opacity-40'
        >
          留在这里
        </button>
      </div>
      {message ? (
        <p className='text-xs text-(--cyber-muted)'>{message}</p>
      ) : null}
      <p className='text-[10px] leading-relaxed text-(--cyber-muted)/60'>
        只有你自己看得到。刷新不会丢，换设备就没有了。
      </p>
    </div>
  );
}

function FeedCard({ item }: { item: FeedItem }): ReactNode {
  const style = FEED_TYPES[item.type];
  return (
    <div
      className={`group border-l-2 ${style.border} cyber-panel cyber-hover-yellow py-3.5 pl-4 pr-4`}
    >
      <div className='mb-2 flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <span className='text-sm'>{style.icon}</span>
          <span className='mono text-[9px] tracking-widest uppercase text-(--cyber-muted)'>
            {style.label}
          </span>
          {item.source ? (
            <span className='mono text-[9px] text-(--cyber-muted)/50'>
              // {item.source}
            </span>
          ) : null}
        </div>
        <span className='mono text-[9px] text-(--cyber-muted)/40'>
          {timeAgo(new Date(item.at).toISOString())}
        </span>
      </div>
      <p className='text-sm leading-relaxed text-(--cyber-ink) transition-colors group-hover:text-(--cyber-yellow) md:text-base'>
        {item.content}
      </p>
    </div>
  );
}

function FomoFeed(): ReactNode {
  const [count, setCount] = useState(6);
  const [userVoices, setUserVoices] = useState<StoredVoice[]>([]);

  useEffect(() => {
    setUserVoices(readVoices());
  }, []);

  const userItems: FeedItem[] = userVoices.map((voice) => ({
    id: `submitted-${voice.created_at}`,
    type: "自嘲吐槽",
    content: voice.content,
    at: new Date(voice.created_at).getTime(),
  }));
  const feedItems = [...userItems, ...FEED_ITEMS];
  const items = feedItems.slice(0, count);
  const hasMore = count < feedItems.length;

  return (
    <section id='everyone-saying' className='px-4 py-12'>
      <div className='mx-auto max-w-3xl'>
        <div className='mb-8 text-center'>
          <div className='mono mb-2 text-[10px] tracking-widest uppercase text-(--cyber-muted)'>
            大家都在说什么
          </div>
          <h2 className='cyber-display text-2xl font-bold md:text-3xl'>
            <span className='cyber-text-gradient'>别憋着，说出来</span>
          </h2>
        </div>

        <SubmitVoiceForm onSubmitted={() => setUserVoices(readVoices())} />

        <div className='mb-6 flex items-center gap-3' aria-hidden>
          <div className='h-px flex-1 bg-(--cyber-line)' />
          <span className='mono text-[10px] tracking-widest text-(--cyber-muted)'>
            更多留言
          </span>
          <div className='h-px flex-1 bg-(--cyber-line)' />
        </div>

        <div className='flex flex-col gap-3'>
          {items.map((item) => (
            <FeedCard key={item.id} item={item} />
          ))}
        </div>

        {hasMore ? (
          <div className='mt-8 text-center'>
            <button
              type='button'
              onClick={() => setCount((c) => c + 5)}
              className='cyber-animate-pulse-glow rounded-full border border-(--cyber-yellow)/40 px-8 py-2.5 text-xs tracking-wider uppercase text-(--cyber-yellow) transition-all hover:bg-(--cyber-yellow)/10'
            >
              再看几条
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default function FomoPage(): ReactNode {
  return (
    <div className='cyber mx-auto mb-14 w-full max-w-[var(--page-max-reading)] lg:mt-3'>
      <HeroSection />
      <WhatIsFOMO />
      <SectionDivider variant='cyan' />
      <FomoFeed />
      <SectionDivider variant='magenta' />

      {/* The prototype's sign-off. */}
      <section className='px-4 py-16'>
        <div className='mx-auto max-w-4xl text-center'>
          <div className='mono text-[10px] tracking-[0.3em] text-(--cyber-muted)/40'>
            别全追。挑一个真的用起来。
          </div>
          <div className='mt-4 flex items-center justify-center gap-4 text-xs text-(--cyber-muted)'>
            <Link
              to='/featured'
              className='underline-offset-4 hover:text-(--cyber-yellow) hover:underline'
            >
              精选
            </Link>
            <span className='text-(--cyber-muted)/40'>·</span>
            <Link
              to='/fomo-test'
              className='underline-offset-4 hover:text-(--cyber-yellow) hover:underline'
            >
              测试
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
