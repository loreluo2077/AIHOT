// The home page's entry to the index: the day's number, the gauge it sits on, and the day's one vote —
// the whole feature one glance and one tap deep. It reads this module's own API from the browser (the
// home route's loader is the engine's and stays untouched); until the answer is in it holds the card's
// shape, and if the api is down it says so instead of hiding.
import { useEffect, useState } from "react";
import { BandScale, FEELINGS, GaugeBar, IndexCard, VotePills, bandInk, type Feeling } from "./card.tsx";
import type { FomoPayload } from "../types.ts";

async function fetchPayload(signal?: AbortSignal): Promise<FomoPayload> {
  const response = await fetch("/api/fomo/today", {
    headers: { accept: "application/json" },
    signal: signal ?? AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(String(response.status));
  return (await response.json()) as FomoPayload;
}

export default function FomoHomeCard() {
  const [payload, setPayload] = useState<FomoPayload | null>(null);
  const [voted, setVoted] = useState<Feeling | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchPayload(controller.signal)
      .then((data) => {
        setPayload(data);
        // What this browser already chose today, so the pills come back marked (same key as /fomo).
        try {
          const stored = window.localStorage.getItem(`aifomo-vote:${data.day}`);
          if (stored && (FEELINGS as readonly string[]).includes(stored)) setVoted(stored as Feeling);
        } catch {
          // A browser with storage turned off simply does not remember the choice.
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, []);

  // The same POST the /fomo page makes; the answer is the whole day, so it replaces the card's numbers.
  const vote = (feeling: Feeling) => {
    setBusy(true);
    fetch("/api/fomo/vote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ feeling }) })
      .then(async (response) => {
        if (!response.ok) return;
        const next = (await response.json()) as FomoPayload;
        setPayload(next);
        setVoted(feeling);
        try {
          window.localStorage.setItem(`aifomo-vote:${next.day}`, feeling);
        } catch {
          // Nothing to remember it with.
        }
      })
      .catch(() => undefined)
      .finally(() => setBusy(false));
  };

  return (
    <div className="mb-5">
      <IndexCard>
        {payload ? (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/55">AI FOMO Index</p>
              <p className="text-xs tabular-nums text-white/45">{payload.day}（北京时间）</p>
            </div>
            <div className="flex items-end gap-3">
              <span className="text-5xl font-semibold leading-none tabular-nums" style={{ color: bandInk(payload.band.key) }}>
                {payload.index}
              </span>
              <span className="pb-1 text-sm text-white/80">{payload.band.label}</span>
              <span className="pb-1 text-xs text-white/45">
                {payload.voteScore === null
                  ? "还没有人投票，今天先按内容本身算。"
                  : `读者 ${payload.votes.total} 票：还好 ${payload.votes.low} · 有点焦虑 ${payload.votes.medium} · 很焦虑 ${payload.votes.high}`}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <GaugeBar index={payload.index} />
              <BandScale />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3.5">
              <VotePills voted={voted} busy={busy} onVote={vote} />
              <a href="/fomo" className="text-sm text-white/85 underline-offset-4 hover:underline">
                完整指数 →
              </a>
            </div>
          </>
        ) : failed ? (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/55">AI FOMO Index</p>
            <p className="text-sm text-white/70">指数暂时不可用，稍后再来看。</p>
            <a href="/fomo" className="w-fit text-sm text-white/85 underline-offset-4 hover:underline">
              打开完整指数 →
            </a>
          </>
        ) : (
          <>
            <div className="h-3 w-28 animate-pulse rounded-full bg-white/10" />
            <div className="h-10 w-32 animate-pulse rounded-card bg-white/10" />
            <div className="h-2.5 w-full animate-pulse rounded-full bg-white/10" />
            <div className="h-8 w-56 animate-pulse rounded-full bg-white/10" />
          </>
        )}
      </IndexCard>
    </div>
  );
}
