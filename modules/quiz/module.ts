// This module's addresses: two self-contained quiz pages. There is no backend — the questions are
// static data, the score is computed in the browser, and nothing is stored (see docs/architecture.md).
import { defineModule } from "@aihot/contracts/modules";

export default defineModule({
  name: "quiz",
  pages: [
    { path: "fomo-test", file: "web/fomo-test.tsx" },
    { path: "anxiety-test", file: "web/anxiety-test.tsx" },
  ],
});
