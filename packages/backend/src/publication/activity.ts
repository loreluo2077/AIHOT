// The public read layer's daily activity: how much the site actually published on each Beijing day, and
// what those reports were tagged as. An exit that wants a day's shape (the anxiety index in
// modules/fomo) reads it from here instead of touching `publications` itself.
import { beijingMidnight } from "@aihot/contracts/time";
import { sql } from "../db.ts";
import { displayTags, publicSourceName } from "./rules.ts";
import { selectedCondition } from "./scope.ts";

export interface DailyActivity {
  /** Asia/Shanghai day, YYYY-MM-DD. */
  day: string;
  /** Selected reports. */
  selected: number;
  /** The events they belong to: a report with no event of its own is one. */
  stories: number;
  /** Sources that reported them. */
  sources: number;
  /** How many of them came from a first-party source. */
  firstParty: number;
  /** Their mean score (0–100); null when the day has none. */
  averageScore: number | null;
}

/** A report's tags and category, as the day's hot list counts them. */
export interface DayTopics {
  tags: string[];
  category: string | null;
}

/**
 * What the site selected between `since` and `until`, one row per Beijing day that has any. Days with
 * nothing selected are absent: the caller knows which days it asked for.
 */
export async function dailyActivity(since: Date, until: Date, now = new Date()): Promise<DailyActivity[]> {
  const rows = await sql<{
    day: string;
    selected: number;
    stories: number;
    sources: number;
    first_party: number;
    average_score: string | null;
  }[]>`
    SELECT to_char((p.timeline_at AT TIME ZONE 'Asia/Shanghai')::date, 'YYYY-MM-DD') AS day,
           count(*)::int AS selected,
           (count(DISTINCT p.story_id) + count(*) FILTER (WHERE p.story_id IS NULL))::int AS stories,
           count(DISTINCT p.source_id)::int AS sources,
           count(*) FILTER (WHERE p.first_party)::int AS first_party,
           avg(p.score) AS average_score
    FROM publications p
    WHERE ${selectedCondition(now)} AND p.timeline_at >= ${since} AND p.timeline_at < ${until}
    GROUP BY 1
    ORDER BY 1`;
  return rows.map((row) => ({
    day: row.day,
    selected: row.selected,
    stories: row.stories,
    sources: row.sources,
    firstParty: row.first_party,
    averageScore: row.average_score === null ? null : Number(row.average_score),
  }));
}

/** What that day's selected reports carried: the words a hot list counts, and their categories. */
export async function dayTopics(day: string, now = new Date()): Promise<DayTopics[]> {
  const since = beijingMidnight(day);
  const until = new Date(since.getTime() + 24 * 3600_000);
  const rows = await sql<{ tags: string[] | null; category: string | null }[]>`
    SELECT p.tags, p.category
    FROM publications p
    WHERE ${selectedCondition(now)} AND p.timeline_at >= ${since} AND p.timeline_at < ${until}`;
  return rows.map((row) => ({ tags: displayTags(row.tags ?? []), category: row.category }));
}

/** A day's selected report, as a "what happened that day" list shows it. */
export interface DayReport {
  /** The article's public id: the report page is /items/<id>. */
  id: string;
  title: string;
  /** The model's 0–100 selection score; null where the report carries none. */
  score: number | null;
  /** The source's public name (account handles reduced to the display name). */
  source: string;
  firstParty: boolean;
}

/** That day's selected reports, best-scoring first. Days with nothing selected give an empty list. */
export async function dayTopReports(day: string, limit: number, now = new Date()): Promise<DayReport[]> {
  const since = beijingMidnight(day);
  const until = new Date(since.getTime() + 24 * 3600_000);
  const rows = await sql<{ article_id: string; title: string; score: number | null; source_name: string; first_party: boolean }[]>`
    SELECT p.article_id, p.title, p.score, s.name AS source_name, p.first_party
    FROM publications p JOIN sources s ON s.id = p.source_id
    WHERE ${selectedCondition(now)} AND p.timeline_at >= ${since} AND p.timeline_at < ${until}
    ORDER BY p.score DESC NULLS LAST, p.timeline_at DESC
    LIMIT ${limit}`;
  return rows.map((row) => ({
    id: row.article_id,
    title: row.title,
    score: row.score === null ? null : Number(row.score),
    source: publicSourceName(row.source_name),
    firstParty: row.first_party,
  }));
}
