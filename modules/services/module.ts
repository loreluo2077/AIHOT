// This module's addresses: one page, no API of its own (it only links out). Its navigation entry is in
// web.tsx (see docs/architecture.md).
import { defineModule } from "@aihot/contracts/modules";

export default defineModule({
  name: "services",
  pages: [{ path: "tools", file: "web/tools.tsx" }],
});
