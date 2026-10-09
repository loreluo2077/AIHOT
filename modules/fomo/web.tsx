// What this module adds to the site's web pages: a dark index card on the home page (the site's daily
// object, one glance deep), one entry in the desktop sidebar under its own 指数 heading, the one extra
// tab the phone bar has room for (it supports four or five columns), and a row on the admin's 内容
// group. Its pages themselves come from module.ts.
import type { ReactNode } from "react";
import { defineWebModule } from "@aihot/web/modules";
import HomeCard from "./web/home-card.tsx";

function IconPulse({ size = 18 }: { size?: number }): ReactNode {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12h4l2.5-6 4 12 2.5-6h7" />
    </svg>
  );
}

function IconCalendar({ size = 18 }: { size?: number }): ReactNode {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  );
}

function IconTrend({ size = 18 }: { size?: number }): ReactNode {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />
    </svg>
  );
}

export default defineWebModule({
  name: "fomo",
  home: { card: HomeCard },
  // Its own section rather than the tail of 内容, so the desktop sidebar names it outright; module
  // sections sit between the engine's 内容 and 更多. The tests and the AI services live in their own
  // modules and join this section (the quiz module) or the engine's 内容 (services).
  sidebar: {
    section: "指数",
    items: [
      { to: "/fomo", label: "焦虑指数", icon: IconPulse },
      { to: "/timeline", label: "大事记", icon: IconCalendar },
      { to: "/trends", label: "趋势", icon: IconTrend },
    ],
  },
  // The index is what people come back to daily, so it gets the phone bar's fifth column rather than
  // sitting two taps deep. 我的 stays last (site/modules only inserts tabs before it).
  tabs: [{ key: "fomo", to: "/fomo", label: "指数", icon: IconPulse }],
  admin: {
    // The badge counts signals readers reported down and the owner has not looked at yet.
    content: [{ to: "/admin/fomo-signals", label: "社区信号", count: "fomoSignals", tone: "accent" }],
  },
});
