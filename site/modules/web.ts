// What the site's modules add to the web pages (site/modules/index.ts).
import type { WebModule } from "@aihot/web/modules";
import fomo from "@aihot/fomo/web";
import leaderboard from "@aihot/leaderboard/web";
import quiz from "@aihot/quiz/web";
import services from "@aihot/services/web";

export const WEB_MODULES: readonly WebModule[] = [fomo, quiz, leaderboard, services];
