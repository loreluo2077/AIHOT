// What this module adds to the site's web pages: one entry in the desktop sidebar's 内容 section, and a row
// on the 我的 page so the phone shell can reach it (the phone bar has room for one module tab, and the
// index takes it). Its page comes from module.ts and is built entirely from config.ts.
import type { ReactNode } from "react";
import { defineWebModule } from "@aihot/web/modules";

function IconPlug({ size = 18 }: { size?: number }): ReactNode {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 3v6M15 3v6M7 9h10v3a5 5 0 0 1-5 5 5 5 0 0 1-5-5V9ZM12 17v4" />
    </svg>
  );
}

export default defineWebModule({
  name: "services",
  sidebar: { section: "内容", items: [{ to: "/tools", label: "AI 服务", icon: IconPlug }] },
  tools: [{ to: "/tools", label: "AI 服务", icon: <IconPlug size={18} /> }],
});
