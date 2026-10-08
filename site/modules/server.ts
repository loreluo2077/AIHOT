// The backend of the site's modules, installed by the api and the worker when they start (site/modules/index.ts).
import type { ServerModule } from "@aihot/backend/modules";
import aihotBridge from "@aihot/aihot-bridge/server";
import leaderboard from "@aihot/leaderboard/server";

export const SERVER_MODULES: readonly ServerModule[] = [aihotBridge, leaderboard];
