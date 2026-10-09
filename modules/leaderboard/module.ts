// This module's addresses: one page, and the API path behind it. Its backend is in server.ts, its
// navigation entry in web.tsx (see docs/architecture.md).
import { defineModule } from "@aihot/contracts/modules";

export default defineModule({
  name: "leaderboard",
  pages: [{ path: "leaderboard", file: "web/leaderboard.tsx" }],
  apiPaths: [/^\/api\/leaderboard$/],
});
