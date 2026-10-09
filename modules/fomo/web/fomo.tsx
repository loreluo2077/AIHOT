// The anxiety index page: today's number, the two halves it is made of, what readers are saying, and the
// ways to pass it on. It reads this module's own API over HTTP (the web never touches the database) and
// every number keeps the reason it has it.
import { useEffect, useState } from "react";
import { SITE } from "@aihot/site";
import { pageMeta } from "@aihot/web/lib/seo";
import { API_BASE_URL } from "@aihot/web/lib/api.server";
import { useLoaderData } from "react-router";
import type { Screen } from "@aihot/web/components/shell/screens";
import { FOMO } from "../config.ts";
import { BandScale, FEELINGS, GaugeBar, IndexCard, VotePills, bandInk, type Feeling } from "./card.tsx";
import type { FomoPayload, FomoVotesView } from "../types.ts";

/** The phone shell: this page sits under its own tab, and a back button to it reads 指数. */
export const handle: Screen = { tab: "fomo", name: "指数" };

/**
 * One fetch for both sides: the loader reads the api by its address, the browser's refresh reads it
 * through the site's own /api proxy — the browser never names the api host (it has no `process`).
 */
async function fetchPayload(url: string, signal?: AbortSignal): Promise<FomoPayload> {
  const response = await fetch(url, {
    headers: { accept: "application/json", "x-aihot-ssr": "1" },
    signal: signal ?? AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Response("焦虑指数暂时不可用", { status: response.status === 404 ? 404 : 503 });
  return (await response.json()) as FomoPayload;
}

export async function loader({ request }: { request: Request }): Promise<FomoPayload> {
  return fetchPayload(`${API_BASE_URL}/api/fomo/today`, request.signal);
}

export function meta() {
  // The share card is the site's own (site/site.ts CARDS.fomo): the index is the thing people forward.
  return pageMeta({ title: FOMO.title, description: FOMO.description, path: "/fomo", image: "/og/pages/fomo.png" });
}

/** "3 分钟前" for a signal posted today, a date for one older than that. */
function since(at: string): string {
  const minutes = Math.round((Date.now() - new Date(at).getTime()) / 60_000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return new Date(at).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

function Trend({ points }: { points: FomoPayload["trend"] }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-24 items-end gap-1">
        {points.map((point, index) => (
          <div
            key={point.day}
            title={`${point.day} · ${point.index}`}
            className={`flex-1 rounded-t-sm ${index === points.length - 1 ? "bg-accent" : "bg-accent/30"}`}
            style={{ height: `${Math.max(3, point.index)}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs text-ink-4">
        <span>{points[0]?.day}</span>
        <span>今天 {points[points.length - 1]?.index}</span>
      </div>
    </div>
  );
}

function Stats({ payload }: { payload: FomoPayload }) {
  const items = [
    { label: "今日投票", value: payload.votes.total },
    { label: "今日信号", value: payload.stats.signalsToday },
    { label: "今日热词", value: payload.stats.hotwordsToday },
    { label: "累计信号", value: payload.stats.signalsTotal },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-baseline gap-1.5 rounded-full border border-line px-3.5 py-1.5">
          <span className="text-sm font-semibold tabular-nums">{item.value}</span>
          <span className="text-xs text-ink-3">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function Breakdown({ payload }: { payload: FomoPayload }) {
  const { factors, averageScore, sources, firstPartyRatio } = payload.breakdown;
  return (
    <div className="flex flex-col gap-3">
      <table className="w-full text-sm">
        <thead className="text-xs text-ink-3">
          <tr>
            <th className="py-1 text-left font-normal">内容的一半</th>
            <th className="py-1 text-right font-normal">今天</th>
            <th className="py-1 text-right font-normal">满分线</th>
            <th className="py-1 text-right font-normal">权重</th>
            <th className="py-1 text-right font-normal">得分</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {factors.map((factor) => (
            <tr key={factor.key} className="border-t border-line-soft">
              <td className="py-1.5">{factor.label}</td>
              <td className="py-1.5 text-right">{factor.key === "firstParty" ? `${Math.round(factor.value * 100)}%` : Math.round(factor.value * 10) / 10}</td>
              <td className="py-1.5 text-right text-ink-4">{factor.key === "firstParty" ? `${Math.round(factor.reference * 100)}%` : Math.round(factor.reference * 10) / 10}</td>
              <td className="py-1.5 text-right text-ink-4">{Math.round(factor.weight * 100)}%</td>
              <td className="py-1.5 text-right font-medium">{factor.score}</td>
            </tr>
          ))}
          <tr className="border-t border-line">
            <td className="py-1.5 font-medium" colSpan={4}>
              内容强度
            </td>
            <td className="py-1.5 text-right font-semibold">{payload.contentScore}</td>
          </tr>
        </tbody>
      </table>
      <p className="text-xs text-ink-4">
        「满分线」= 这一项拿到多少算满分；它是本站最近 30 天的 90 分位与固定下限里更高的那个，所以指数比的是本站自己的平常水平，不是一个写死的数字。
        今天选了 {Math.round(payload.breakdown.factors[0]?.value ?? 0)} 条、来自 {sources} 个来源、一手占 {Math.round(firstPartyRatio * 100)}%
        {averageScore === null ? null : `、平均评分 ${Math.round(averageScore * 10) / 10}`}。
      </p>
    </div>
  );
}

function Hotwords({ payload, onAdd, busy, message }: { payload: FomoPayload; onAdd: (word: string) => void; busy: boolean; message: string | null }) {
  const [word, setWord] = useState("");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">今天的热词</h2>
        <p className="text-xs text-ink-4">今天被选出来的报道自己带的标签，出现得越多排得越前。</p>
      </div>
      {payload.hotwords.length === 0 ? (
        <p className="text-sm text-ink-3">今天还没有精选内容。</p>
      ) : (
        <ol className="grid gap-2 sm:grid-cols-2">
          {payload.hotwords.map((entry, index) => (
            <li key={entry.word} className="flex items-center justify-between gap-3 rounded-tile bg-bg-sunk px-4 py-2.5">
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="mono text-[11px] tabular-nums text-ink-4">#{index + 1}</span>
                <span className="truncate text-sm font-medium">{entry.word}</span>
              </span>
              <span className="shrink-0 rounded-full bg-surface px-2.5 py-0.5 text-xs tabular-nums text-ink-3">{entry.count}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** The words readers added themselves, and the one-a-few-a-day form that adds to them. */
function ReaderWords({ payload, onAdd, busy, message }: { payload: FomoPayload; onAdd: (word: string) => void; busy: boolean; message: string | null }) {
  const [word, setWord] = useState("");
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">读者补充</h3>
      <p className="text-xs text-ink-4">没被收录的词，你补一个。一人一天 {FOMO.hotword.perDay} 个，同一个词只算一次。</p>
      {payload.readerWords.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {payload.readerWords.map((entry) => (
            <li key={entry.word} className="rounded-full bg-accent-soft px-3 py-1 text-sm text-accent-ink">
              {entry.word}
              <span className="ml-1.5 text-xs tabular-nums">{entry.count}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          onAdd(word);
          setWord("");
        }}
      >
        <input
          value={word}
          onChange={(event) => setWord(event.target.value)}
          maxLength={FOMO.hotword.maxLength}
          placeholder="例如：世界模型"
          className="min-w-0 flex-1 rounded-control border border-line bg-transparent px-3 py-1.5 text-sm outline-none focus:border-accent"
        />
        <button type="submit" disabled={busy || word.trim().length < FOMO.hotword.minLength} className="rounded-control border border-line px-3 py-1.5 text-sm text-ink-2 disabled:opacity-50">
          补充
        </button>
      </form>
      {message ? <p className="text-xs text-ink-3">{message}</p> : null}
    </div>
  );
}

/**
 * The community signals: what readers are seeing, in their own words. This is the only user-generated
 * content on the site, so every control here is deliberately small — a length limit, one post per
 * cooldown, a daily cap, and a report button that takes a signal down once enough readers use it.
 */
function Signals({
  payload,
  busy,
  agreed,
  reported,
  onPost,
  onAgree,
  onReport,
}: {
  payload: FomoPayload;
  busy: boolean;
  agreed: ReadonlySet<string>;
  reported: ReadonlySet<string>;
  onPost: (body: string, author: string) => void;
  onAgree: (id: string) => void;
  onReport: (id: string) => void;
}) {
  const [body, setBody] = useState("");
  const [author, setAuthor] = useState("");
  const tooShort = body.trim().length < FOMO.signal.minLength;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">大家在说什么</h2>
        <p className="text-xs text-ink-4">
          你看到、听到、担心的事，写一句。一人 {Math.round(FOMO.signal.cooldownSeconds / 60)} 分钟一条，一天 {FOMO.signal.perDay} 条；
          {FOMO.signal.reportsToHide} 个人举报就会自动下架。请只写愿意公开的内容。
        </p>
      </div>

      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (tooShort) return;
          onPost(body, author);
          setBody("");
          setAuthor("");
        }}
      >
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={FOMO.signal.maxLength}
          rows={3}
          placeholder="例如：三家客户这周都在问同一个 Agent 产品，我们要不要也做一个？"
          className="w-full resize-y rounded-control border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={author}
            onChange={(event) => setAuthor(event.target.value)}
            maxLength={24}
            placeholder="署名（可不填）"
            className="w-40 rounded-control border border-line bg-transparent px-3 py-1.5 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={busy || tooShort}
            className="rounded-control bg-accent px-4 py-1.5 text-sm font-medium text-accent-contrast disabled:opacity-50"
          >
            发布
          </button>
          <span className="text-xs text-ink-4 tabular-nums">
            {[...body].length}/{FOMO.signal.maxLength}
          </span>
        </div>
      </form>

      {payload.signals.length === 0 ? (
        <p className="text-sm text-ink-3">还没有人发言。第一条留给你。</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {payload.signals.map((signal) => (
            <li key={signal.id} className="flex flex-col gap-2 rounded-tile border border-line-soft px-4 py-3">
              <p className="whitespace-pre-wrap text-sm text-ink-2">{signal.body}</p>
              <div className="flex flex-wrap items-center gap-3 text-xs text-ink-4">
                <span>{signal.author ?? "匿名"}</span>
                <span>{since(signal.at)}</span>
                <button
                  type="button"
                  disabled={busy || agreed.has(signal.id)}
                  onClick={() => onAgree(signal.id)}
                  className="rounded-full border border-line px-2.5 py-0.5 text-xs text-ink-2 transition hover:border-accent hover:text-accent-ink disabled:opacity-60"
                >
                  {agreed.has(signal.id) ? "已认同" : "认同"}
                  <span className="ml-1.5 tabular-nums">{signal.agrees}</span>
                </button>
                <button
                  type="button"
                  disabled={busy || reported.has(signal.id)}
                  onClick={() => onReport(signal.id)}
                  className="text-xs text-ink-4 transition hover:text-rank-1 disabled:opacity-60"
                  title="举报后这条会被隐藏，等站长处理"
                >
                  {reported.has(signal.id) ? "已举报" : "举报"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Passing the day on: the share card is generated by the api, the rest is the browser's own share sheet. */
function Share({ payload, message, onCopy }: { payload: FomoPayload; message: string | null; onCopy: (what: "index" | "link") => void }) {
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function"), []);
  const text = `${SITE.name} 焦虑指数 ${payload.index} · ${payload.band.label}（${payload.day}）`;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">分享今天</h2>
        <p className="text-xs text-ink-4">把今天的指数发出去，别人点开就能看到同一页。</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.href)}`, "_blank", "noopener")}
          className="rounded-full border border-line px-4 py-1.5 text-sm text-ink-2 transition hover:border-accent hover:text-accent-ink"
        >
          分享到 X
        </button>
        <button type="button" onClick={() => onCopy("index")} className="rounded-full border border-line px-4 py-1.5 text-sm text-ink-2 transition hover:border-accent hover:text-accent-ink">
          复制指数
        </button>
        <button type="button" onClick={() => onCopy("link")} className="rounded-full border border-line px-4 py-1.5 text-sm text-ink-2 transition hover:border-accent hover:text-accent-ink">
          复制链接
        </button>
        <button
          type="button"
          onClick={() => {
            // Built here rather than in the markup: the address is the browser's, which the server cannot know.
            window.location.href = `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(`${text}\n${window.location.href}`)}`;
          }}
          className="rounded-full border border-line px-4 py-1.5 text-sm text-ink-2 transition hover:border-accent hover:text-accent-ink"
        >
          邮件分享
        </button>
        <a
          href="/og/pages/fomo.png"
          download={`ai-fomo-${payload.day}.png`}
          className="rounded-full border border-line px-4 py-1.5 text-sm text-ink-2 transition hover:border-accent hover:text-accent-ink"
        >
          保存分享图
        </a>
        {canShare ? (
          <button
            type="button"
            onClick={() => void navigator.share({ title: `${SITE.name} · ${FOMO.title}`, text, url: window.location.href }).catch(() => undefined)}
            className="rounded-full border border-line px-4 py-1.5 text-sm text-ink-2 transition hover:border-accent hover:text-accent-ink"
          >
            更多…
          </button>
        ) : null}
      </div>
      {message ? <p className="text-xs text-ink-3">{message}</p> : null}
    </div>
  );
}

export default function FomoPage() {
  const loaded = useLoaderData() as FomoPayload;
  const [payload, setPayload] = useState(loaded);
  const [voted, setVoted] = useState<Feeling | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [agreed, setAgreed] = useState<ReadonlySet<string>>(new Set());
  const [reported, setReported] = useState<ReadonlySet<string>>(new Set());

  // The vote is the reader's own browser's business: the API's answer is the same for everyone, so what
  // this browser already chose is kept here.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(`aifomo-vote:${loaded.day}`);
      if (stored && (FEELINGS as readonly string[]).includes(stored)) setVoted(stored as Feeling);
    } catch {
      // A browser with storage turned off simply does not remember the choice.
    }
  }, [loaded.day]);

  // The page's numbers do not change while it sits open. The browser reads the api through the site's own proxy.
  useEffect(() => {
    const timer = window.setInterval(() => void fetchPayload("/api/fomo/today").then(setPayload).catch(() => undefined), FOMO.cacheSeconds * 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function send(path: string, body: object, options: { ok?: () => void; limited?: string } = {}): Promise<boolean> {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) {
        setMessage(response.status === 429 ? (options.limited ?? "今天先到这里，明天再来。") : "没有提交成功，稍后再试。");
        return false;
      }
      setPayload((await response.json()) as FomoPayload);
      options.ok?.();
      return true;
    } catch {
      setMessage("网络不太好，稍后再试。");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const vote = (feeling: Feeling) =>
    send("/api/fomo/vote", { feeling }, {
      ok: () => {
        setVoted(feeling);
        try {
          window.localStorage.setItem(`aifomo-vote:${payload.day}`, feeling);
        } catch {
          // Nothing to remember it with.
        }
      },
    });

  const addWord = (word: string) => {
    if (word.trim().length < FOMO.hotword.minLength) return;
    void send("/api/fomo/hotword", { word }, { ok: () => setMessage("加上了。"), limited: "今天补充的词够多了，明天再来。" });
  };

  const postSignal = (body: string, author: string) =>
    void send("/api/fomo/signal", { body, author }, { ok: () => setMessage("发布了。"), limited: `发得太快或今天的额度用完了（一人 ${Math.round(FOMO.signal.cooldownSeconds / 60)} 分钟一条、一天 ${FOMO.signal.perDay} 条）。` });

  const agree = (id: string) => void send("/api/fomo/agree", { id }, { ok: () => setAgreed((before) => new Set(before).add(id)) });

  const report = (id: string) =>
    void send("/api/fomo/report", { id }, {
      ok: () => {
        setReported((before) => new Set(before).add(id));
        setMessage("收到，我们会看一下。");
      },
    });

  const copy = (what: "index" | "link") => {
    const text = what === "index"
      ? `${SITE.name} 焦虑指数 ${payload.index} · ${payload.band.label}（${payload.day}）｜内容强度 ${payload.contentScore}${payload.voteScore === null ? "" : ` ＋ 读者情绪 ${payload.voteScore}`}`
      : window.location.href;
    void navigator.clipboard
      .writeText(text)
      .then(() => setShareMessage(what === "index" ? "指数已复制。" : "链接已复制。"))
      .catch(() => setShareMessage("这个浏览器不让复制，请手动选中。"));
  };

  const votes: FomoVotesView = payload.votes;
  const halves = `内容强度 ${payload.contentScore} × ${Math.round(FOMO.weights.content * 100)}%${
    payload.voteScore === null ? "" : ` + 读者情绪 ${payload.voteScore} × ${Math.round(FOMO.weights.votes * 100)}%`
  }`;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6">
      {/* The day's object: the number, the gauge it sits on, the one vote. Dark so it reads as the site's instrument. */}
      <IndexCard>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/55">AI FOMO Index</p>
          <p className="text-xs tabular-nums text-white/45">{payload.day}（北京时间）</p>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div className="flex items-end gap-3">
            <span className="text-6xl font-semibold leading-none tabular-nums" style={{ color: bandInk(payload.band.key) }}>
              {payload.index}
            </span>
            <span className="pb-1.5 text-base text-white/80">{payload.band.label}</span>
          </div>
          <p className="max-w-72 pb-1 text-xs leading-relaxed text-white/50">
            <span className="block">{halves}</span>
            <span className="block">
              {payload.voteScore === null
                ? "还没有人投票，今天先按内容本身算。"
                : `读者 ${votes.total} 票：还好 ${votes.low} · 有点焦虑 ${votes.medium} · 很焦虑 ${votes.high}`}
            </span>
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <GaugeBar index={payload.index} />
          <BandScale />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3.5">
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium text-white/90">你今天是什么感觉？</p>
            <p className="text-xs text-white/45">一人一天一票，可以改。</p>
          </div>
          <VotePills voted={voted} busy={busy} onVote={(feeling) => void vote(feeling)} />
        </div>
        {message ? <p className="text-xs text-white/60">{message}</p> : null}
      </IndexCard>

      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold">{payload.title}</h1>
        <p className="text-sm leading-relaxed text-ink-3">{payload.description}</p>
      </header>

      <Stats payload={payload} />

      <section className="flex flex-col gap-4 rounded-card border border-line px-5 py-5">
        <Hotwords payload={payload} onAdd={addWord} busy={busy} message={null} />
        <div className="border-t border-line-soft pt-4">
          <ReaderWords payload={payload} onAdd={addWord} busy={busy} message={null} />
        </div>
      </section>

      <section className="rounded-card border border-line px-5 py-5">
        <Signals payload={payload} busy={busy} agreed={agreed} reported={reported} onPost={postSignal} onAgree={agree} onReport={report} />
      </section>

      <section className="flex flex-col gap-3 rounded-card border border-line px-5 py-5">
        <h2 className="text-base font-semibold">最近 {FOMO.trendDays} 天</h2>
        <Trend points={payload.trend} />
      </section>

      <section className="flex flex-col gap-3 rounded-card border border-line px-5 py-5">
        <h2 className="text-base font-semibold">指数的构成</h2>
        <Breakdown payload={payload} />
      </section>

      <section className="rounded-card border border-line px-5 py-5">
        <Share payload={payload} message={shareMessage} onCopy={copy} />
      </section>

      <section className="flex flex-col gap-4 rounded-card border border-line px-5 py-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">什么是 AI FOMO？</h2>
          <p className="text-sm text-ink-3">
            FOMO = Fear Of Missing Out，错过恐惧症——那种「全世界都在用 AI 了，就我还不会」的感觉。别担心，你不是一个人。
          </p>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {[
            "同事说「我用 AI 五分钟就搞定了」，你笑着点头，心里在想这是啥",
            "朋友圈都在聊新模型，你默默点了个赞，假装自己也懂",
            "又收藏了一份「AI 入门指南」，收藏夹已经可以出书了",
            "每天刷三小时 AI 资讯，学到的知识：0，焦虑感：+100",
          ].map((text) => (
            <li key={text} className="rounded-tile bg-bg-sunk px-4 py-3 text-sm leading-relaxed text-ink-2">
              {text}
            </li>
          ))}
        </ul>
        <p className="rounded-tile border border-line-soft px-4 py-3 text-sm leading-relaxed text-ink-3">
          深呼吸。这个时代，我们都在被变化推着走。来这里不是为了更焦虑，而是发现——原来大家都一样啊。
        </p>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-ink-4">
          指数只描述"今天大家聊得有多热"，不代表对任何公司、产品或事件的评价，也不构成建议。
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {FOMO.share.xProfile ? (
            <a
              href={FOMO.share.xProfile}
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-contrast"
            >
              关注 X
            </a>
          ) : null}
          <a href="/about" className="text-xs text-ink-3 underline hover:text-ink-2">
            关于
          </a>
          <a href="/terms" className="text-xs text-ink-3 underline hover:text-ink-2">
            使用规则
          </a>
        </div>
      </section>
    </div>
  );
}
