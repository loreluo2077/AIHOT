// The index's own look: one fixed dark card, used on the home page's entry card and at the top of /fomo.
// Its colours do not follow the reader's theme — the site is paper-light and this card is the one dark
// object — so text is white on a deep slate-teal and the bar runs calm → panic in the dark theme's
// ok / amber / hot (readable on dark whatever the page's theme is).
import type { ReactNode } from "react";
import { FOMO } from "../config.ts";

export const FEELINGS = ["low", "medium", "high"] as const;
export type Feeling = (typeof FEELINGS)[number];

/** The card itself: deep ground, one soft teal glow in the corner, room for whatever a page puts in. */
export function IndexCard({ children }: { children: ReactNode }): ReactNode {
  return (
    <div
      className="relative isolate overflow-hidden rounded-sheet border border-line-strong text-white"
      style={{ background: "linear-gradient(140deg, #243b42 0%, #17262c 55%, #101a20 100%)" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-14 -top-24 size-60 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(30, 160, 170, 0.5) 0%, transparent 70%)" }}
      />
      <div className="relative flex flex-col gap-4">{children}</div>
    </div>
  );
}

/** The band's name as a colour that reads on the card's fixed dark ground. */
export function bandInk(key: string): string {
  if (key === "panic") return "#d86a52";
  if (key === "buzz") return "#d3b26a";
  return "#5fc79a";
}

/** The 0–100 bar: the fill is the index, its colour runs calm (green) through panic (red). */
export function GaugeBar({ index }: { index: number }): ReactNode {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/15">
      <div
        className="h-full rounded-full"
        style={{
          width: `${Math.min(100, Math.max(2, index))}%`,
          background: "linear-gradient(to right, var(--ok), var(--amber), var(--hot))",
        }}
      />
    </div>
  );
}

/** The three bands the index is read in, as the bar's own scale. */
export function BandScale(): ReactNode {
  return (
    <div className="grid grid-cols-3 gap-2 text-[11px]">
      {FOMO.bands.map((band, i) => {
        const low = i === 0 ? 0 : (FOMO.bands[i - 1]?.max ?? 0) + 1;
        return (
          <div key={band.key} className="flex flex-col">
            <span className="font-medium text-white/85">{band.label}</span>
            <span className="tabular-nums text-white/45">
              {low}–{band.max}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** The day's one vote, as three pills on the dark ground. */
export function VotePills({ voted, busy, onVote }: { voted: Feeling | null; busy: boolean; onVote: (feeling: Feeling) => void }): ReactNode {
  return (
    <div className="flex flex-wrap gap-2">
      {FEELINGS.map((feeling) => {
        const chosen = voted === feeling;
        return (
          <button
            key={feeling}
            type="button"
            disabled={busy}
            onClick={() => onVote(feeling)}
            className={`rounded-full border px-4 py-1.5 text-sm transition disabled:opacity-50 ${
              chosen ? "border-transparent bg-white text-[#17262c]" : "border-white/25 text-white/85 hover:border-white/60 hover:text-white"
            }`}
          >
            {FOMO.feelingLabels[feeling]}
          </button>
        );
      })}
    </div>
  );
}
