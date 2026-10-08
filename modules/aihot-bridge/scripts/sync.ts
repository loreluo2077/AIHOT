// Runs a sync now (development / operations helper). The switch is respected: without
// AIHOT_BRIDGE_ENABLED=true nothing leaves the site unless --force is given.
//   node --env-file=.env modules/aihot-bridge/scripts/sync.ts [items|changes|events|reports|detail|all] [--force]
import { closeDb } from "@aihot/backend/db";
import { stopBoss } from "@aihot/backend/jobs/queue";
import { BRIDGE } from "../config.ts";
import { httpClient } from "../backend/client.ts";
import { syncDetails } from "../backend/detail.ts";
import { syncEvents } from "../backend/events.ts";
import { syncAll, syncChanges, syncItems, syncReports } from "../backend/sync.ts";
import { bridgeStatus } from "../backend/status.ts";
import type { SyncSummary } from "../backend/sync.ts";

const args = process.argv.slice(2);
const force = args.includes("--force");
const what = args.find((arg) => !arg.startsWith("-")) ?? "all";

if (!BRIDGE.enabled() && !force) {
  console.error("AIHOT_BRIDGE_ENABLED is not true; refusing to call AIHOT. Pass --force to sync anyway.");
  process.exit(1);
}

const client = httpClient();
let summaries: SyncSummary[];
switch (what) {
  case "items":
    summaries = [await syncItems(client)];
    break;
  case "changes":
    summaries = [await syncChanges(client)];
    break;
  case "events":
    summaries = [await syncEvents(client)];
    break;
  case "reports":
    summaries = [await syncReports(client)];
    break;
  case "detail":
    summaries = [await syncDetails(client)];
    break;
  case "all":
    summaries = await syncAll(client);
    break;
  default:
    console.error(`unknown feed: ${what} (expected items, changes, events, reports, detail or all)`);
    process.exit(1);
}

console.log(JSON.stringify({ summaries, status: await bridgeStatus() }, null, 2));
// Publishing starts the job queue lazily and enqueueing keeps the process alive on its own; the pool
// closing is not enough to let the script end.
await stopBoss();
await closeDb();
