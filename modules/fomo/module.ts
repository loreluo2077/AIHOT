// This module's addresses: one public page, one admin page, and the API paths behind them. Its backend is
// in server.ts, its navigation entries in web.tsx (see docs/architecture.md).
import { defineModule } from "@aihot/contracts/modules";

export default defineModule({
  name: "fomo",
  pages: [
    { path: "fomo", file: "web/fomo.tsx" },
    { path: "timeline", file: "web/timeline.tsx" },
    { path: "trends", file: "web/trends.tsx" },
  ],
  adminPages: [{ path: "admin/fomo-signals", file: "web/admin-signals.tsx" }],
  apiPaths: [/^\/api\/fomo\//],
});
