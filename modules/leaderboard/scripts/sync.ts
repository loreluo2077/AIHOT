// Reads every configured source now (development / operations helper).
//   node --env-file=.env modules/leaderboard/scripts/sync.ts
import { closeDb } from "@aihot/backend/db";
import { syncLeaderboard } from "../backend/sync.ts";

const run = await syncLeaderboard();
console.log(JSON.stringify(run, null, 2));
await closeDb();
