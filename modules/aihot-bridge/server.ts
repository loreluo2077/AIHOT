// This module's backend: three scheduled feeds and the alerts that say when one goes quiet. Enabled by
// AIHOT_BRIDGE_ENABLED; when it is off the schedules are removed when the worker starts, like the
// engine's own valves. Because the schedules live here, a site without the module in
// site/modules/server.ts runs the engine unchanged.
import { defineServerModule } from "@aihot/backend/modules";
import { BRIDGE } from "./config.ts";
import { httpClient } from "./backend/client.ts";
import { syncDetails } from "./backend/detail.ts";
import { syncEvents } from "./backend/events.ts";
import { syncChanges, syncItems, syncReports } from "./backend/sync.ts";
import { bridgeStatus, staleFindings } from "./backend/status.ts";

export default defineServerModule({
  name: "aihot-bridge",
  schedules: [
    // New items: their window is the last 7 days, and we stop at the first item we already have.
    { name: "aihot-bridge.items", cron: "*/30 * * * *", run: () => syncItems(httpClient()), when: () => BRIDGE.enabled() },
    // Their selection ledger: a withdrawal there has to reach the exits here quickly.
    { name: "aihot-bridge.changes", cron: "*/10 * * * *", run: () => syncChanges(httpClient()), when: () => BRIDGE.enabled() },
    // The hot list and the events behind it: their grouping, this site's heat.
    { name: "aihot-bridge.hot", cron: "7,37 * * * *", run: () => syncEvents(httpClient()), when: () => BRIDGE.enabled() },
    // Issues, after AIHOT's own 08:00 daily and 10:00/10:30 weekly and monthly.
    { name: "aihot-bridge.reports", cron: "20 9,10,11 * * *", missed: "once", run: () => syncReports(httpClient()), when: () => BRIDGE.enabled() },
    // The text behind the items: the source's own rendering and AIHOT's translation, both off the API.
    { name: "aihot-bridge.detail", cron: "11,41 * * * *", missed: "once", run: () => syncDetails(httpClient()), when: () => BRIDGE.enabled() },
  ],
  admin: { runs: () => bridgeStatus() },
  alerts: (now) => staleFindings(now),
});
