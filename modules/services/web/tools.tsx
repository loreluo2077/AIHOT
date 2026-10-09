// The services page: one card per entry in config.ts, each a plain outbound link. There is no loader —
// the list is configuration, not data, so the page needs no API and no database.
import { pageMeta } from "@aihot/web/lib/seo";
import type { Screen } from "@aihot/web/components/shell/screens";
import { SERVICES } from "../config.ts";

/** The phone shell: reached from 我的, so that tab stays lit and a back button reads AI 服务. */
export const handle: Screen = { tab: "me", name: "AI 服务" };

export function meta() {
  // The share card is the site's own (site/site.ts CARDS.tools).
  return pageMeta({ title: SERVICES.title, description: SERVICES.description, path: "/tools", image: "/og/pages/tools.png" });
}

export default function ServicesPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">{SERVICES.title}</h1>
        <p className="text-sm text-ink-3">{SERVICES.description}</p>
      </header>

      {SERVICES.entries.length === 0 ? (
        <p className="rounded-lg border border-line px-4 py-6 text-sm text-ink-3">
          还没有配置。往 <code className="rounded bg-bg-muted px-1.5 py-0.5">modules/services/config.ts</code> 的{" "}
          <code className="rounded bg-bg-muted px-1.5 py-0.5">entries</code> 里加一条，这里就会出现一张卡片。
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {SERVICES.entries.map((entry) => (
            <li key={entry.url}>
              <a
                href={entry.url}
                target="_blank"
                rel="noreferrer noopener"
                className="flex flex-col gap-2 rounded-lg border border-line px-4 py-4 transition hover:border-accent"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{entry.name}</span>
                  {entry.badge ? <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent-ink">{entry.badge}</span> : null}
                  {entry.price ? <span className="text-xs text-ink-4">{entry.price}</span> : null}
                </span>
                <span className="text-sm text-ink-3">{entry.summary}</span>
              </a>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-ink-4">{SERVICES.note}</p>
    </div>
  );
}
