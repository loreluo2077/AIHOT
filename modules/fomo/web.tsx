// What this module adds to the site's web pages: one entry in the desktop sidebar under its own 指数
// heading (which sits above the engine's 内容 — see components/shell/nav.ts), and the tab that is the
// site's root. Its pages themselves come from module.ts and routes.ts.
import type { ReactNode } from "react";
import { defineWebModule } from "@aihot/web/modules";

function IconPulse({ size = 18 }: { size?: number }): ReactNode {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12h4l2.5-6 4 12 2.5-6h7" />
    </svg>
  );
}

export default defineWebModule({
  name: "fomo",
  // Its own section, above the engine's 内容; the self-test lives in its own module and joins this
  // section (the quiz module).
  sidebar: {
    section: "指数",
    items: [{ to: "/", label: "今日FOMO", icon: IconPulse, end: true }],
  },
  // The module's tab is the site's root, so the tab bar leads with it (components/shell/nav.ts).
  tabs: [{ key: "fomo", to: "/", label: "今日FOMO", icon: IconPulse }],
});
