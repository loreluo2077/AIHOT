// What the site's modules add to the web pages (site/modules/index.ts).
import type { WebModule } from "@aihot/web/modules";
import leaderboard from "@aihot/leaderboard/web";

export const WEB_MODULES: readonly WebModule[] = [leaderboard];
