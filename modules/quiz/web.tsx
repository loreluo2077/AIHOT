// What this module adds to the site's web pages: two entries in the desktop sidebar's 指数 section
// (the fomo module names it; modules naming the same section share it) and two rows on the 我的 page
// so the phone shell can reach them (the phone tab bar has room for one module tab, and the index
// takes it). Its pages themselves come from module.ts.
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

function IconGauge({ size = 18 }: { size?: number }): ReactNode {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21a9 9 0 1 1 9-9" />
      <path d="M12 12l5-3" />
      <path d="M17 21v-4M21 17h-4" />
    </svg>
  );
}

export default defineWebModule({
  name: "quiz",
  sidebar: {
    section: "指数",
    items: [
      { to: "/fomo-test", label: "FOMO 测试", icon: IconTarget },
      { to: "/anxiety-test", label: "焦虑测试", icon: IconGauge },
    ],
  },
  tools: [
    { to: "/fomo-test", label: "FOMO 测试", icon: <IconTarget size={18} /> },
    { to: "/anxiety-test", label: "焦虑测试", icon: <IconGauge size={18} /> },
  ],
});
