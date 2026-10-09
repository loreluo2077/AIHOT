// This module's backend: today's index. There is no schedule — the index is computed from the engine's
// own tables when it is read, so nothing has to be kept in step — and no write route: the reader wall
// and the mood poll live in the browser.
import { defineServerModule } from "@aihot/backend/modules";
import { FOMO } from "./config.ts";
import { fomoPayload } from "./backend/read.ts";

export default defineServerModule({
  name: "fomo",
  http: (app) => {
    app.get("/api/fomo/today", async (_request, reply) => {
      const payload = await fomoPayload();
      return reply
        .header("cache-control", `public, max-age=${FOMO.cacheSeconds}, stale-while-revalidate=600`)
        .header("content-type", "application/json; charset=utf-8")
        .send(payload);
    });
  },
});
