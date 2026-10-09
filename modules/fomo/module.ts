// This module's addresses: its homepage sits at the site's root (see apps/web/app/routes.ts) and the
// API paths behind it. Its backend is in server.ts, its navigation entries in web.tsx (see
// docs/architecture.md).
import { defineModule } from "@aihot/contracts/modules";

export default defineModule({
  name: "fomo",
  // The pages this site has retired: their addresses keep answering, pointing at where their readers
  // should go instead of a dead end.
  redirects: [
    { match: "exact", path: "/fomo", status: 301, location: "/", keepQuery: true },
    { match: "exact", path: "/timeline", status: 301, location: "/", keepQuery: true },
    { match: "exact", path: "/trends", status: 301, location: "/", keepQuery: true },
  ],
  apiPaths: [/^\/api\/fomo\//],
});
