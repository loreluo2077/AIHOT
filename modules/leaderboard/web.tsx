// What this module adds to the site's web pages: one entry in the desktop sidebar's 内容 section, and a row
// on the 我的 page so the phone shell can reach it (the phone bar has room for one module tab, and the
// index takes it). Its page comes from module.ts.
import type { ReactNode } from "react";
import { defineWebModule } from "@aihot/web/modules";

function IconChart({ size = 18 }: { size?: number }): ReactNode {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M4 20V10M10 20V4M16 20v-7" />
      <path d="M2 20h20" />
    </svg>
  );
}

export default defineWebModule({
  name: "leaderboard",
  sidebar: { section: "内容", items: [{ to: "/leaderboard", label: "模型榜", icon: IconChart }] },
  tools: [{ to: "/leaderboard", label: "模型榜", icon: <IconChart size={18} /> }],
});
