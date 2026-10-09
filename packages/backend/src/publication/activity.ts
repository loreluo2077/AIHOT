// The public read layer's daily activity: how much the site actually published on each Beijing day.
// An exit that wants a day's shape (the anxiety index in modules/fomo) reads it from here instead of
// touching `publications` itself.
import { sql } from "../db.ts";
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
