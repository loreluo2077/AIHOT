// This module's addresses: one self-test page — the survival index and the anxiety quick test merged
// behind a single entry, in the fomo module's skin. There is no backend — the questions are static
// data, the score is computed in the browser, and nothing is stored (see docs/architecture.md).
import { defineModule } from "@aihot/contracts/modules";

export default defineModule({
  name: "quiz",
  pages: [{ path: "fomo-test", file: "web/test.tsx" }],
});
