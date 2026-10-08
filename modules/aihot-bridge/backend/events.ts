// The hot list and the events behind it. AIHOT decides which occurrences are one event; this site
// decides the heat, by its own rule (48 hours, one participant per source, 24-hour half life), so the
// ranking readers see is recomputed from the reports that actually reached this site.
//
// Events land in the engine's own tables through events/import.ts — the socket the engine exposes for an
// externally decided grouping — and every member report is published first, so the event page and the
// hot list read them exactly like reports this site grouped itself.
import { sql, type Db } from "@aihot/backend/db";
import { importEvent } from "@aihot/backend/events/import";
import { BRIDGE } from "../config.ts";
import { importItem } from "./import.ts";
import { aihotIdFromUrl } from "./mapping.ts";
import { readItem } from "./state.ts";
import { countOutcome, emptySummary, type SyncSummary } from "./summary.ts";
import { saveRun } from "./state.ts";
import type { AihotClient } from "./client.ts";
import type { AihotHotTopics, AihotItem, AihotStoryDetail, AihotStoryReport } from "./types.ts";

/** Their event addresses carry a uuid, which is what this site's stories.public_id holds too. */
const STORY_ID = /\/story\/([0-9a-fA-F-]{36})/;

export function storyIdFromUrl(url: string | null | undefined): string | null {
  return STORY_ID.exec(url ?? "")?.[1] ?? null;
}

function moment(value: string | null | undefined, fallback: Date): Date {
  const when = value ? new Date(value) : null;
  return when && Number.isFinite(when.getTime()) ? when : fallback;
}

/**
 * The article a report of an event is. Reports the site does not hold yet are imported as ordinary pool
 * items (never selected): an event's timeline is its evidence, and a reader following an event should see
 * the reports that make it up.
 */
async function articleForReport(report: AihotStoryReport, db: Db): Promise<string | null> {
  const aihotId = aihotIdFromUrl(report.links?.aihot);
  if (!aihotId) return null;
  const known = await readItem(aihotId, db);
  if (known) return known.article_id;
  const original = report.links?.original?.trim();
  if (!BRIDGE.hotTopics.importMissingReports || !original || !/^https?:\/\//.test(original)) return null;
  const pseudo: AihotItem = {
    id: aihotId,
    title: report.title,
    summary: report.summary ?? null,
    source: report.source ?? null,
    links: { aihot: report.links?.aihot ?? null, original },
    publishedAt: report.publishedAt ?? null,
    category: null,
    score: null,
    selected: false,
  };
  const outcome = await importItem(pseudo, db);
  return outcome.articleId ?? null;
}

/** One pass over the top of their hot list: the events, their member reports and their summaries. */
export async function syncEvents(client: AihotClient, db: Db = sql): Promise<SyncSummary> {
  const summary = emptySummary("events");
  let owned = 0;
  const answer = await client.get<AihotHotTopics>("/api/v1/hot-topics");
  const topics = (answer.data?.items ?? []).slice(0, BRIDGE.hotTopics.top);
  for (const topic of topics) {
    summary.fetched++;
    const publicId = storyIdFromUrl(topic.links?.story);
    if (!publicId) {
      summary.skipped++;
      continue;
    }
    try {
      const detail = await client.get<{ story: AihotStoryDetail }>(`/api/v1/stories/${publicId}`);
      const story = detail.data?.story;
      if (!story) {
        summary.skipped++;
        continue;
      }
      const fallback = moment(story.latestAt ?? topic.latestAt, new Date());
      const reports = [...(story.reports ?? [])]
        .sort((a, b) => moment(b.publishedAt, fallback).getTime() - moment(a.publishedAt, fallback).getTime())
        .slice(0, BRIDGE.hotTopics.maxReportsPerEvent);
      const members: Array<{ articleId: string; role: "primary" | "report"; observedAt: Date }> = [];
      for (const report of reports) {
        const articleId = await articleForReport(report, db);
        if (!articleId) continue;
        members.push({
          articleId,
          role: aihotIdFromUrl(report.links?.aihot) === topic.id ? "primary" : "report",
          observedAt: moment(report.publishedAt, fallback),
        });
      }
      if (members.length === 0) {
        summary.skipped++;
        continue;
      }
      const result = await importEvent(
        {
          publicId,
          title: story.title || topic.title,
          firstReportAt: moment(story.firstReportAt ?? topic.latestAt, fallback),
          latestAt: fallback,
          latest: story.latest ?? null,
          digest: story.digest ?? null,
          digestUpdatedAt: story.digestUpdatedAt ? moment(story.digestUpdatedAt, fallback) : null,
          members,
        },
        db,
      );
      if (result.status === "owned") owned++;
      countOutcome(result, summary);
    } catch (error) {
      summary.failed++;
      summary.detail = { error: (error as Error).message, story: publicId };
    }
  }
  if (owned > 0) summary.detail = { ...(summary.detail as object | undefined), owned };
  await saveRun(summary, db);
  return summary;
}
