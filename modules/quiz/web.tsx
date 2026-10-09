// What this module adds to the site's web pages: one entry in the desktop sidebar's 指数 section (the
// fomo module names it; modules naming the same section share it) and one row on the 我的 page so the
// phone shell can reach it (the phone tab bar has room for one module tab, and the fomo homepage takes
// it). Its page itself comes from module.ts.
import type { ReactNode } from "react";
import { defineWebModule } from "@aihot/web/modules";

function IconTarget({ size = 18 }: { size?: number }): ReactNode {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </svg>
  );
}

export default defineWebModule({
  name: "quiz",
  sidebar: {
    section: "指数",
    items: [{ to: "/fomo-test", label: "FOMO 自测", icon: IconTarget }],
  },
  tools: [{ to: "/fomo-test", label: "FOMO 自测", icon: <IconTarget size={18} /> }],
});
