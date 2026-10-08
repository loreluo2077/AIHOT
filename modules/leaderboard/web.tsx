// What this module adds to the site's web pages: one entry in the desktop sidebar's 内容 section. Its page
// itself comes from module.ts, and it draws it with nothing but its own code and the payload its API sends.
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
});
