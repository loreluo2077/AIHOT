// The FOMO homepage, migrated from the eva-s-fomo-finder prototype: a full cyberpunk panel — the hero
// that rotates through four moments of AI anxiety, today's index, the explanation, a mood check, and a
// wall of voices. Everything but the index is static: the poll counts and the reader wall live only in
// this browser (localStorage), nothing is posted, and the index comes from this module's own API.
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, useLoaderData } from "react-router";
import { pageMeta } from "@aihot/web/lib/seo";
import { API_BASE_URL } from "@aihot/web/lib/api.server";
import type { Screen } from "@aihot/web/components/shell/screens";
import { FOMO } from "../config.ts";
import type { FomoPayload } from "../types.ts";
import "./cyber.css";

/** The phone shell: this page is the site's root, and a back button to it reads 今日FOMO. */
export const handle: Screen = { tab: "fomo", name: "今日FOMO" };

export function meta() {
  // The share card is the site's own (site/site.ts CARDS.fomo): this page is what people forward.
  return pageMeta({
    title: "AI FOMO",
    description: "别慌，大家都一样。今天的焦虑指数、轮播的四个瞬间、一份心情投票和一面留言墙——你的 AI 焦虑，这里有人陪。页面不收集任何数据。",
    path: "/",
    image: "/og/pages/fomo.png",
  });
}

/**
 * Today's index, the page's one live number. A failed read is a null rather than a thrown answer: the
 * page around it is static and must keep standing when the api is down. The loader reads the api by its
 * address; the browser's refresh reads it through the site's own /api proxy.
 */
async function fetchPayload(url: string, signal?: AbortSignal): Promise<FomoPayload | null> {
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

export async function loader({ request }: { request: Request }): Promise<{ payload: FomoPayload | null }> {
  return { payload: await fetchPayload(`${API_BASE_URL}/api/fomo/today`, request.signal) };
}

/** The four moments the hero rotates through, verbatim from the prototype. */
const STIMULUS_CARDS = [
  {
    badge: "📡 SIGNAL: 又来新工具了",
    titleTop: "AI FOMO",
    subtitle: <>别慌，<span className="text-(--cyber-yellow)">大家都一样</span></>,
    desc: (
      <>
        又发布了一个AI工具，我上一个还没学会呢。
        <br className="hidden md:block" />
        放心，<span className="font-bold text-(--cyber-yellow)">99%</span> 的人跟你一样。
      </>
    ),
  },
  {
    badge: "😅 STATUS: 正在假装跟上时代",
    titleTop: "收藏了",
    subtitle: <span className="cyber-text-gradient-hot">200个教程</span>,
    desc: (
      <>
        看了0个。点赞=学会，收藏=掌握，转发=精通。
        <br className="hidden md:block" />
        我们都是这样的，对吧？
      </>
    ),
  },
  {
    badge: "🫠 MOOD: 焦虑但不行动",
    titleTop: "刷了3小时",
    subtitle: <>AI资讯，感觉自己<span className="text-(--cyber-cyan)">更焦虑了</span></>,
    desc: (
      <>
        明明是想学习，结果越看越慌。
        <br className="hidden md:block" />
        这不是你的问题，是这个时代的通病。
      </>
    ),
  },
  {
    badge: "🤝 TRUTH: 我们都被推着走",
    titleTop: "每个人",
    subtitle: <>都在<span className="text-(--cyber-cyan)">假装淡定</span></>,
    desc: (
      <>
        朋友圈晒AI作品的人，私下也在焦虑下一个工具。
        <br className="hidden md:block" />
        这个时代，没有人真正「跟上了」。
      </>
    ),
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
  const bandInk = band?.key === "panic" ? "var(--cyber-magenta)" : band?.key === "buzz" ? "var(--cyber-yellow)" : "var(--cyber-cyan)";
  const factors = payload?.breakdown.factors ?? [];
  const stats = [
    { label: "精选", value: payload ? String(factors[0]?.value ?? 0) : "—" },
    { label: "事件", value: payload ? String(factors[1]?.value ?? 0) : "—" },
    { label: "一手占比", value: payload ? `${Math.round(payload.breakdown.firstPartyRatio * 100)}%` : "—" },
    { label: "平均分", value: payload?.breakdown.averageScore == null ? "—" : String(Math.round(payload.breakdown.averageScore)) },
  ];

  return (
    <section className="px-4 py-12">
      <div className="cyber-panel cyber-hover-yellow mx-auto max-w-xl p-6 md:p-8">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[10px] tracking-widest uppercase text-(--cyber-muted)">INDEX // 今日指数</div>
          <div className="text-[10px] text-(--cyber-muted)/60">{payload?.day ?? ""}（北京时间）</div>
        </div>
        {payload ? (
          <>
            <div className="flex flex-col items-center">
              <div className="cyber-display text-7xl leading-none font-bold md:text-8xl" style={{ color: bandInk }}>
                {shown}
              </div>
              <div className="mt-2 text-xs text-(--cyber-muted)">/ 100 内容强度</div>
              <div className="mt-4 border px-4 py-1.5 text-sm font-bold tracking-wider uppercase" style={{ borderColor: `color-mix(in srgb, ${bandInk} 40%, transparent)`, color: bandInk }}>
                {band?.label}
              </div>
            </div>

            {/* The gauge the number sits on, with the three bands as its scale. */}
            <div className="mt-6 w-full">
              <div className="h-2 w-full overflow-hidden bg-(--cyber-muted)/15">
                <div
                  className="h-full transition-all duration-1000"
                  style={{ width: `${Math.max(2, payload.index)}%`, background: "linear-gradient(to right, var(--cyber-cyan), var(--cyber-yellow), var(--cyber-magenta))" }}
                />
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-(--cyber-muted)">
                {FOMO.bands.map((b) => (
                  <span key={b.key}>
                    {b.label} ≤{b.max}
                  </span>
                ))}
              </div>
            </div>

            {/* The day's own numbers, under the index. */}
            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="flex flex-col gap-1 border border-(--cyber-line)/60 p-3 text-center">
                  <span className="text-[10px] tracking-widest text-(--cyber-muted)">{stat.label}</span>
                  <span className="cyber-display text-xl font-bold text-(--cyber-cyan) tabular-nums">{stat.value}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-center text-[10px] text-(--cyber-muted)/60">指数只看今天真正选出的内容（精选、事件、一手、评分）。</p>
          </>
        ) : (
          <p className="py-8 text-center text-sm text-(--cyber-muted)">指数暂时不可用，稍后再来看。</p>
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
    const rotation = window.setInterval(() => goTo((current + 1) % STIMULUS_CARDS.length), HERO_INTERVAL);
    return () => {
      window.clearTimeout(warning);
      window.clearInterval(glitches);
      window.clearInterval(rotation);
    };
  }, [current, goTo]);

  const card = STIMULUS_CARDS[current]!;

  const scrollToVoices = () => {
    document.getElementById("everyone-saying")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative flex min-h-[calc(100dvh-120px)] items-center justify-center overflow-hidden">
      {/* The grid the content floats over. */}
      <div className="cyber-grid-bg absolute inset-0 opacity-60" aria-hidden />
      {/* The diagonal hairlines in the corners. */}
      <div className="pointer-events-none absolute right-0 top-0 size-[300px] opacity-20" aria-hidden>
        <div className="absolute right-10 top-10 h-px w-full origin-right rotate-[-35deg] bg-gradient-to-l from-(--cyber-yellow)/60 to-transparent" />
        <div className="absolute right-10 top-20 h-px w-[200px] origin-right rotate-[-35deg] bg-gradient-to-l from-(--cyber-cyan)/40 to-transparent" />
      </div>
      <div className="pointer-events-none absolute bottom-0 left-0 size-[200px] opacity-15" aria-hidden>
        <div className="absolute bottom-20 left-10 h-px w-full origin-left rotate-[-35deg] bg-gradient-to-r from-(--cyber-magenta)/50 to-transparent" />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl px-4 text-center">
        {/* The warning badge the card wears. */}
        <div
          className={`cyber-corner-tl mb-8 inline-flex items-center gap-2 border border-(--cyber-yellow)/60 bg-(--cyber-yellow)/10 px-4 py-1.5 text-xs tracking-widest uppercase text-(--cyber-yellow) transition-all duration-500 ${
            showWarning ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"
          } ${transitioning ? "translate-y-2 opacity-0" : ""}`}
        >
          <span className="cyber-animate-warning-flash size-2 bg-(--cyber-yellow)" />
          <span>{card.badge}</span>
        </div>

        {/* The headline, swapped card by card. */}
        <div className={`transition-all duration-300 ${transitioning ? "translate-y-4 scale-95 opacity-0" : "translate-y-0 scale-100 opacity-100"}`}>
          <h1 className={`cyber-display mb-6 text-5xl leading-none font-bold tracking-tight transition-all md:text-7xl ${glitchText ? "cyber-animate-glitch" : ""}`}>
            <span className="cyber-text-gradient cyber-animate-neon-flicker block">{card.titleTop}</span>
            <span className="mt-4 block text-2xl font-semibold tracking-wider text-(--cyber-ink) md:text-4xl">{card.subtitle}</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-sm leading-relaxed text-(--cyber-muted) md:text-base">{card.desc}</p>
        </div>

        {/* The card indicators. */}
        <div className="mb-8 flex items-center justify-center gap-2">
          {STIMULUS_CARDS.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`第 ${i + 1} 张`}
              onClick={() => goTo(i)}
              className={`h-1 rounded-full transition-all duration-300 ${i === current ? "w-8 bg-(--cyber-yellow)" : "w-3 bg-(--cyber-muted)/30 hover:bg-(--cyber-muted)/50"}`}
            />
          ))}
        </div>

        {/* The two doors: the voices wall below, and the merged self-test. */}
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <button
            type="button"
            onClick={scrollToVoices}
            className="cyber-corner-tr cyber-scan-hover cyber-animate-pulse-glow group relative overflow-hidden bg-(--cyber-yellow) px-8 py-3 text-base font-bold tracking-[0.15em] uppercase text-(--cyber-bg) transition-all hover:scale-105 hover:shadow-[0_0_30px_color-mix(in_srgb,var(--cyber-yellow)_50%,transparent),0_0_60px_color-mix(in_srgb,var(--cyber-yellow)_20%,transparent)]"
          >
            <span className="relative z-10">看看大家怎么说 //</span>
            <div className="animate-none absolute inset-0 bg-gradient-to-r from-(--cyber-yellow) via-(--cyber-magenta) to-(--cyber-yellow) bg-[length:200%_100%] opacity-0 transition-opacity group-hover:opacity-100 cyber-animate-border-flow" />
          </button>
          <Link
            to="/fomo-test"
            className="cyber-glitch-hover border border-(--cyber-cyan)/50 px-8 py-3 text-base font-bold tracking-[0.15em] uppercase text-(--cyber-cyan) transition-all hover:scale-105 hover:border-(--cyber-cyan)/80 hover:bg-(--cyber-cyan)/10 hover:shadow-[0_0_20px_color-mix(in_srgb,var(--cyber-cyan)_40%,transparent),0_0_40px_color-mix(in_srgb,var(--cyber-cyan)_15%,transparent)]"
          >
            FOMO 自测 &gt;&gt;
          </Link>
        </div>

        {/* The decorative line under the calls to action. */}
        <div className="mt-16 flex items-center justify-center gap-3" aria-hidden>
          <div className="h-px w-20 bg-gradient-to-r from-transparent to-(--cyber-yellow)/40" />
          <div className="size-1.5 bg-(--cyber-yellow)/60" />
          <div className="h-px w-8 bg-(--cyber-yellow)/40" />
          <div className="size-1.5 bg-(--cyber-cyan)/60" />
          <div className="h-px w-20 bg-gradient-to-l from-transparent to-(--cyber-cyan)/40" />
        </div>
      </div>
    </section>
  );
}

/** The hairline between sections, tinted by whichever colour leads the next one. */
function SectionDivider({ variant = "yellow" }: { variant?: "yellow" | "cyan" | "magenta" }): ReactNode {
  const line = {
    yellow: "from-transparent via-(--cyber-yellow)/30 to-transparent",
    cyan: "from-transparent via-(--cyber-cyan)/25 to-transparent",
    magenta: "from-transparent via-(--cyber-magenta)/25 to-transparent",
  }[variant];
  const dot = { yellow: "bg-(--cyber-yellow)/50", cyan: "bg-(--cyber-cyan)/50", magenta: "bg-(--cyber-magenta)/50" }[variant];
  return (
    <div className="relative flex items-center justify-center py-4" aria-hidden>
      <div className={`h-px w-full max-w-4xl bg-gradient-to-r ${line}`} />
      <div className="absolute flex items-center gap-4">
        <div className={`size-1 ${dot}`} />
        <div className="h-px w-6 bg-(--cyber-line)" />
        <div className={`size-1.5 ${dot}`} />
        <div className="h-px w-6 bg-(--cyber-line)" />
        <div className={`size-1 ${dot}`} />
      </div>
    </div>
  );
}

/** The explanation: what AI FOMO is, the moments everyone knows, and the reassurance. */
function WhatIsFOMO(): ReactNode {
  const scenarios = [
    { emoji: "😅", text: "同事说「我用AI五分钟就搞定了」，你笑着点头，心里在想这是啥" },
    { emoji: "📱", text: "朋友圈都在聊Sora、Midjourney，你默默点了个赞，假装自己也懂" },
    { emoji: "🫠", text: "又收藏了一个「AI入门指南」，收藏夹已经可以出书了" },
    { emoji: "📰", text: "每天刷三小时AI资讯，学到的知识：0，焦虑感：+100" },
  ] as const;

  return (
    <section className="px-4 py-16 md:py-24">
      <div className="mx-auto max-w-3xl">
        <div className="mb-10 text-center">
          <div className="mb-3 text-[10px] tracking-widest uppercase text-(--cyber-muted)">EXPLAIN // 这不是你的错</div>
          <h2 className="cyber-display text-2xl font-bold md:text-4xl">
            <span className="text-(--cyber-ink)">什么是 </span>
            <span className="cyber-text-gradient">AI FOMO</span>
            <span className="text-(--cyber-ink)"> ？</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-(--cyber-muted) md:text-base">
            FOMO = <span className="font-bold text-(--cyber-cyan)">Fear Of Missing Out</span>（错过恐惧症）。
            <br />
            就是那种「全世界都在用AI了就我还不会」的感觉。
            <br />
            别担心，<span className="font-bold text-(--cyber-yellow)">你不是一个人</span>。
          </p>
        </div>

        <div className="mb-8 text-sm">
          <div className="mb-4 text-[10px] tracking-widest uppercase text-(--cyber-muted)">你是否有过这些瞬间？</div>
          <div className="grid gap-3">
            {scenarios.map((s, i) => (
              <div key={i} className="cyber-panel cyber-hover-yellow flex items-start gap-3 p-4 text-(--cyber-ink)">
                <span className="shrink-0 text-xl">{s.emoji}</span>
                <span className="leading-relaxed">{s.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center">
          <div className="inline-block border border-(--cyber-cyan)/30 bg-(--cyber-cyan)/5 px-5 py-3">
            <p className="text-sm leading-relaxed text-(--cyber-ink)">
              <span className="font-bold text-(--cyber-cyan)">深呼吸。</span>
              这个时代，我们都在被变化推着走。
              <br className="hidden md:block" />
              来这里不是为了更焦虑，而是发现——<span className="font-bold text-(--cyber-yellow)">原来大家都一样啊。</span>
            </p>
          </div>
        </div>
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
  const [votes, setVotes] = useState<Record<string, number>>({ none: 127, little: 342, yes: 518, very: 289 });

  const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);
  const handleVote = (value: string) => {
    if (selected) return;
    setSelected(value);
    setVotes((prev) => ({ ...prev, [value]: prev[value]! + 1 }));
  };

  return (
    <section className="px-4 py-12">
      <div className="cyber-panel mx-auto max-w-xl p-6 md:p-8">
        <div className="mb-3 text-[10px] tracking-widest uppercase text-(--cyber-muted)">QUICK.SCAN // 今日心情</div>
        <h3 className="cyber-display mb-5 text-lg font-bold md:text-xl">
          <span className="text-(--cyber-ink)">今天被 </span>
          <span className="cyber-text-gradient">AI新闻</span>
          <span className="text-(--cyber-ink)"> 刺激到了吗？</span>
        </h3>

        <div className="grid grid-cols-2 gap-3">
          {options.map((opt) => {
            const count = votes[opt.value]!;
            const pct = Math.round((count / (totalVotes + (selected ? 1 : 0))) * 100);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleVote(opt.value)}
                disabled={selected !== null}
                className={`relative overflow-hidden border p-4 text-left transition-all duration-300 ${
                  selected === opt.value
                    ? "border-(--cyber-yellow) bg-(--cyber-yellow)/10"
                    : selected
                      ? "border-(--cyber-line)/50 opacity-70"
                      : "cursor-pointer border-(--cyber-line) hover:border-(--cyber-yellow)/50 hover:bg-(--cyber-yellow)/5"
                }`}
              >
                {selected !== null && (
                  <div className="absolute inset-y-0 left-0 bg-(--cyber-yellow)/10 transition-all duration-700 ease-out" style={{ width: `${pct}%` }} />
                )}
                <div className="relative z-10">
                  <div className="mb-1 text-2xl">{opt.emoji}</div>
                  <div className="text-sm text-(--cyber-ink)">{opt.label}</div>
                  {selected !== null && (
                    <div className="cyber-animate-fade-in mt-1 text-xs text-(--cyber-yellow) tabular-nums">
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
          <div className="cyber-animate-fade-in mt-4 text-center text-xs text-(--cyber-muted)">
            共 {totalVotes + 1} 人参与了今日检测（票数只在这台浏览器里玩，别当真）
          </div>
        )}
      </div>
    </section>
  );
}

// The reader wall is a browser's own: what a reader posts is kept in localStorage, never uploaded, and
// nobody else can see it — the same privacy the prototype's wall had.
const VOICES_KEY = "aifomo-voices";
const MOOD_OPTIONS = ["😅", "🫠", "😂", "🥲", "😮‍💨", "🤡", "💀", "🔄", "😭", "🤯"] as const;

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
  { text: "又有新AI工具了，我连上一个的注册流程都没走完", mood: "😅", time: "3m" },
  { text: "老板说要拥抱AI，然后发了个全英文教程链接。谢谢老板。", mood: "🫠", time: "12m" },
  { text: "我妈问我ChatGPT能不能帮她炒股。我说能。其实我也不知道。", mood: "😂", time: "28m" },
  { text: "收藏了一个「7天精通AI」的课程。今天是第47天。", mood: "🥲", time: "1h" },
  { text: "看到00后用AI做了个App月入过万，我默默关掉了手机", mood: "😮‍💨", time: "2h" },
  { text: "在公司AI分享会上点头如捣蒜，其实一个字没听懂", mood: "🤡", time: "3h" },
] as const;

/** The static feed the cards below the wall read: the prototype's own fifteen, timestamps from page load. */
const FEED_TYPES = {
  自嘲吐槽: { border: "border-l-(--cyber-yellow)/60", icon: "😅", label: "MOOD" },
  真实故事: { border: "border-l-(--cyber-cyan)/60", icon: "📡", label: "REAL" },
  扎心数据: { border: "border-l-(--cyber-magenta)/60", icon: "📊", label: "DATA" },
} as const;
type FeedType = keyof typeof FEED_TYPES;

interface FeedItem {
  id: string;
  type: FeedType;
  content: string;
  subtext?: string;
  stat?: string;
  source?: string;
  at: number;
}

const HOUR = 3600_000;
const FEED_ITEMS: FeedItem[] = [
  { id: "ff1", type: "自嘲吐槽", content: "又有一个AI工具火了。我连上一个还没注册完。", subtext: "——来自一个收藏夹里躺着47个AI教程的人", at: Date.now() - HOUR * 1 },
  { id: "ff2", type: "真实故事", content: "同事用ChatGPT写完周报去喝咖啡了，我还在逐字逐句改。后来我也偷偷注册了一个。", subtext: "嘴上说不用，身体很诚实。", source: "即刻", at: Date.now() - HOUR * 2 },
  { id: "ff3", type: "扎心数据", content: "调查显示，73%的人表示「我知道该学AI」，但只有12%真的开始了。", stat: "73%", subtext: "你是73%还是12%？（大概率是73%，没关系我也是）", at: Date.now() - HOUR * 3 },
  { id: "ff4", type: "自嘲吐槽", content: "我的AI学习路线：看到新工具→焦虑→收藏→忘记→看到下一个新工具→更焦虑。完美闭环。", at: Date.now() - HOUR * 4 },
  { id: "ff5", type: "真实故事", content: "35岁，转行学AI第一天：打开教程，发现需要先学Python。关掉教程，打开外卖App。", subtext: "第二天又打开了。这次多看了5分钟。进步了。", source: "知乎", at: Date.now() - HOUR * 5 },
  { id: "ff6", type: "扎心数据", content: "过去一周，全球新上线了52个AI工具。你安装了几个？", stat: "52", subtext: "正确答案：0个，但收藏了3个介绍它们的文章", at: Date.now() - HOUR * 6 },
  { id: "ff7", type: "自嘲吐槽", content: "「你试过Cursor吗？」「Cursor是什么？」「……算了，你试过Claude吗？」「Claude又是谁？」", subtext: "每一次对话都在提醒我落后了多少", at: Date.now() - HOUR * 7 },
  { id: "ff8", type: "真实故事", content: "老板在群里发了一个「AI提效指南」，全组已读未回。因为大家都在偷偷百度这些工具是干嘛的。", subtext: "表面从容，内心：这都是啥？", source: "微信群", at: Date.now() - HOUR * 8 },
  { id: "ff9", type: "扎心数据", content: "你关注的AI博主今年已经推荐了347个「必学工具」。一天一个都学不完。", stat: "347", subtext: "所以别焦虑了，本来就不可能全学会", at: Date.now() - HOUR * 9 },
  { id: "ff10", type: "自嘲吐槽", content: "我对AI的了解：知道ChatGPT，用过一次，问了它「你是谁」，然后就没有然后了。", at: Date.now() - HOUR * 10 },
  { id: "ff11", type: "真实故事", content: "面试被问「你会用AI工具吗」，我说「当然」。回家立刻下载了三个，至今只打开过一个。", subtext: "面试造火箭，工作拧螺丝，学AI也一样。", source: "脉脉", at: Date.now() - HOUR * 11 },
  { id: "ff12", type: "扎心数据", content: "平均每个人手机里有2.3个AI App，月均使用次数：1.7次。", stat: "1.7", subtext: "下载了=用过了，我没有在说你", at: Date.now() - HOUR * 12 },
  { id: "ff13", type: "自嘲吐槽", content: "朋友圈有人晒AI画的图，我也想学。打开Midjourney教程，第一步：准备一个Discord账号。关闭。", at: Date.now() - HOUR * 14 },
  { id: "ff14", type: "真实故事", content: "爸妈问我AI会不会让我失业。我说不会。但我晚上偷偷搜了「AI会取代哪些岗位」。", subtext: "嘴硬心软，成年人的常态。", source: "小红书", at: Date.now() - HOUR * 16 },
  { id: "ff15", type: "自嘲吐槽", content: "这个时代最大的技能不是会用AI，是会假装自己会用AI。", subtext: "——当代打工人生存指南", at: Date.now() - HOUR * 18 },
];

/** The wall's own form: one sentence, one mood, kept in this browser only. */
function SubmitVoiceForm({ onSubmitted }: { onSubmitted: () => void }): ReactNode {
  const [content, setContent] = useState("");
  const [mood, setMood] = useState<string>("😅");
  const [message, setMessage] = useState<string | null>(null);

  const submit = () => {
    const trimmed = content.trim();
    if (!trimmed || trimmed.length > 200) return;
    try {
      writeVoices([{ content: trimmed, mood, created_at: new Date().toISOString() }, ...readVoices()]);
      setMessage("已发布（只存在这台浏览器里）");
      setContent("");
      setMood("😅");
      onSubmitted();
    } catch {
      setMessage("保存失败：这个浏览器不让写本地存储。");
    }
  };

  return (
    <div className="cyber-panel mb-6 flex flex-col gap-3 p-4">
      <div className="text-[10px] tracking-widest uppercase text-(--cyber-muted)">SUBMIT // SHARE YOUR STORY</div>
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        maxLength={200}
        rows={2}
        placeholder="你的 AI 焦虑时刻（最多 200 字，只保存在本机）"
        className="w-full resize-none border border-(--cyber-line)/50 bg-(--cyber-bg)/30 px-3 py-2 text-sm text-(--cyber-ink) outline-none transition-colors placeholder:text-(--cyber-muted)/50 focus:border-(--cyber-yellow)/50"
      />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[10px] text-(--cyber-muted)">mood:</span>
        {MOOD_OPTIONS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMood(m)}
            aria-label={`心情 ${m}`}
            className={`rounded p-0.5 text-lg transition-all ${mood === m ? "scale-125 ring-1 ring-(--cyber-yellow)/50" : "opacity-50 hover:opacity-80"}`}
          >
            {m}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-end gap-3">
        <span className="text-[10px] text-(--cyber-muted) tabular-nums">{[...content].length}/200</span>
        <button
          type="button"
          onClick={submit}
          disabled={!content.trim()}
          className="border border-(--cyber-yellow)/40 bg-(--cyber-yellow)/10 px-5 py-2 text-xs tracking-wider uppercase text-(--cyber-yellow) transition-all hover:bg-(--cyber-yellow)/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          SUBMIT
        </button>
      </div>
      {message ? <p className="text-xs text-(--cyber-muted)">{message}</p> : null}
    </div>
  );
}

function VoiceCard({ voice }: { voice: { text: string; mood: string; time: string } }): ReactNode {
  return (
    <div className="cyber-panel cyber-hover-yellow flex items-start gap-3 p-4">
      <span className="shrink-0 text-xl">{voice.mood}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-relaxed text-(--cyber-ink)">"{voice.text}"</p>
        <div className="mt-1 text-[10px] text-(--cyber-muted)/60">anon · {voice.time}</div>
      </div>
    </div>
  );
}

function FeedCard({ item }: { item: FeedItem }): ReactNode {
  const style = FEED_TYPES[item.type];
  return (
    <div className={`group border-l-2 ${style.border} cyber-panel cyber-hover-yellow py-3.5 pl-4 pr-4`}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">{style.icon}</span>
          <span className="text-[9px] tracking-widest uppercase text-(--cyber-muted)">{style.label}</span>
          {item.source ? <span className="text-[9px] text-(--cyber-muted)/50">// {item.source}</span> : null}
        </div>
        <span className="text-[9px] text-(--cyber-muted)/40">{timeAgo(new Date(item.at).toISOString())}</span>
      </div>
      <p className="text-sm leading-relaxed text-(--cyber-ink) transition-colors group-hover:text-(--cyber-yellow) md:text-base">
        {item.type === "扎心数据" && item.stat ? <span className="cyber-display cyber-text-gradient mr-2 text-2xl font-bold md:text-3xl">{item.stat}</span> : null}
        {item.content}
      </p>
      {item.subtext ? <p className="mt-1.5 text-xs italic text-(--cyber-muted)">{item.subtext}</p> : null}
    </div>
  );
}

function FomoFeed(): ReactNode {
  const [count, setCount] = useState(6);
  const [userVoices, setUserVoices] = useState<Array<{ text: string; mood: string; time: string }>>([]);

  useEffect(() => {
    setUserVoices(readVoices().map((v) => ({ text: v.content, mood: v.mood, time: timeAgo(v.created_at) })));
  }, []);

  const items = FEED_ITEMS.slice(0, count);
  const hasMore = count < FEED_ITEMS.length;
  const allVoices = [...userVoices, ...DEFAULT_VOICES];

  return (
    <section id="everyone-saying" className="px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <div className="mb-2 text-[10px] tracking-widest uppercase text-(--cyber-muted)">VOICES // 大家都在说什么</div>
          <h2 className="cyber-display text-2xl font-bold md:text-3xl">
            <span className="cyber-text-gradient">别憋着，说出来</span>
          </h2>
        </div>

        <SubmitVoiceForm onSubmitted={() => setUserVoices(readVoices().map((v) => ({ text: v.content, mood: v.mood, time: timeAgo(v.created_at) })))} />

        <div className="mb-8 grid gap-3">
          {allVoices.map((v, i) => (
            <VoiceCard key={i} voice={v} />
          ))}
        </div>

        <div className="mb-6 flex items-center gap-3" aria-hidden>
          <div className="h-px flex-1 bg-(--cyber-line)" />
          <span className="text-[10px] tracking-widest text-(--cyber-muted)">FOMO_FEED</span>
          <div className="h-px flex-1 bg-(--cyber-line)" />
        </div>

        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <FeedCard key={item.id} item={item} />
          ))}
        </div>

        {hasMore ? (
          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => setCount((c) => c + 5)}
              className="cyber-animate-pulse-glow border border-(--cyber-yellow)/40 px-8 py-2.5 text-xs tracking-wider uppercase text-(--cyber-yellow) transition-all hover:bg-(--cyber-yellow)/10"
            >
              MORE
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default function FomoPage(): ReactNode {
  const loaded = useLoaderData() as { payload: FomoPayload | null };
  const [payload, setPayload] = useState(loaded.payload);
  // The number is read again once the browser is in, so a cached server answer does not sit on the
  // page all day; a browser that cannot reach the api keeps the number the server had.
  useEffect(() => {
    void fetchPayload("/api/fomo/today").then((fresh) => {
      if (fresh) setPayload(fresh);
    });
  }, []);

  return (
    <div className="cyber cyber-noise cyber-animate-flicker mb-6">
      <HeroSection />
      <SectionDivider variant="yellow" />
      <TodaySection payload={payload} />
      <SectionDivider variant="cyan" />
      <WhatIsFOMO />
      <SectionDivider variant="cyan" />
      <FomoPoll />
      <SectionDivider variant="cyan" />
      <FomoFeed />
      <SectionDivider variant="magenta" />

      {/* The prototype's sign-off. */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-4xl text-center">
          <div className="text-[10px] tracking-[0.3em] text-(--cyber-muted)/40">NIGHT CITY // AI FOMO SYSTEM v2077 // {new Date().getFullYear()}</div>
          <div className="mt-4 flex items-center justify-center gap-4 text-xs text-(--cyber-muted)">
            <Link to="/featured" className="underline-offset-4 hover:text-(--cyber-yellow) hover:underline">
              精选
            </Link>
            <span className="text-(--cyber-muted)/40">·</span>
            <Link to="/fomo-test" className="underline-offset-4 hover:text-(--cyber-yellow) hover:underline">
              FOMO 自测
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
