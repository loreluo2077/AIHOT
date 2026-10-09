// This module's own tables: the day's votes and the words readers added. Nothing here writes the
// engine's tables; what the index counts comes from the public read layer (publication/activity.ts).
import { sql } from "@aihot/backend/db";
import type { VoteCounts } from "./score.ts";

export type Feeling = "low" | "medium" | "high";

export function isFeeling(value: unknown): value is Feeling {
  return value === "low" || value === "medium" || value === "high";
}

/** One vote per reader per day: voting again replaces the earlier one. */
export async function castVote(day: string, voter: string, feeling: Feeling): Promise<void> {
  await sql`
    INSERT INTO fomo_votes (day, voter, feeling)
    VALUES (${day}, ${voter}, ${feeling})
    ON CONFLICT (day, voter) DO UPDATE SET feeling = EXCLUDED.feeling, updated_at = now()`;
}

/** Every day's votes in a range, by day. Days nobody voted on are absent. */
export async function readVotes(sinceDay: string, untilDay: string): Promise<Map<string, VoteCounts>> {
  const rows = await sql<{ day: string; low: number; medium: number; high: number }[]>`
    SELECT to_char(day, 'YYYY-MM-DD') AS day,
           count(*) FILTER (WHERE feeling = 'low')::int AS low,
           count(*) FILTER (WHERE feeling = 'medium')::int AS medium,
           count(*) FILTER (WHERE feeling = 'high')::int AS high
    FROM fomo_votes
    WHERE day >= ${sinceDay} AND day <= ${untilDay}
    GROUP BY day`;
  return new Map(rows.map((row) => [row.day, { low: row.low, medium: row.medium, high: row.high }]));
}

/**
 * False when this reader already added this word today. A word another reader already added keeps the
 * spelling the list first showed, so two cases of one word do not sit side by side.
 */
export async function addReaderWord(day: string, word: string, voter: string): Promise<boolean> {
  const [existing] = await sql<{ word: string }[]>`
    SELECT word FROM fomo_hotwords WHERE day = ${day} AND lower(word) = lower(${word}) LIMIT 1`;
  const rows = await sql<{ word: string }[]>`
    INSERT INTO fomo_hotwords (day, word, voter)
    VALUES (${day}, ${existing?.word ?? word}, ${voter})
    ON CONFLICT (day, word, voter) DO NOTHING
    RETURNING word`;
  return rows.length > 0;
}

/** How many words this reader has added today, for the daily cap. */
export async function countReaderWords(day: string, voter: string): Promise<number> {
  const [row] = await sql<{ count: number }[]>`
    SELECT count(*)::int AS count FROM fomo_hotwords WHERE day = ${day} AND voter = ${voter}`;
  return row?.count ?? 0;
}

/** What readers added that day, per word, most-added first. */
export async function readReaderWords(day: string): Promise<Array<{ word: string; count: number }>> {
  const rows = await sql<{ word: string; count: number }[]>`
    SELECT word, count(*)::int AS count
    FROM fomo_hotwords
    WHERE day = ${day}
    GROUP BY word
    ORDER BY count DESC, word ASC`;
  return rows.map((row) => ({ word: row.word, count: row.count }));
}

// ---------------------------------------------------------------------------
// Community signals: the one place readers write something of their own.
// ---------------------------------------------------------------------------

export type SignalMark = "agree" | "report";

export function isSignalMark(value: unknown): value is SignalMark {
  return value === "agree" || value === "report";
}

/** What one reader has used of today's allowance, and when they last posted at all. */
export async function signalAllowance(day: string, voter: string): Promise<{ today: number; lastAt: Date | null }> {
  const [row] = await sql<{ today: number; last_at: Date | null }[]>`
    SELECT count(*) FILTER (WHERE day = ${day})::int AS today, max(created_at) AS last_at
    FROM fomo_signals WHERE voter = ${voter}`;
  return { today: row?.today ?? 0, lastAt: row?.last_at ?? null };
}

export async function addSignal(input: { id: string; day: string; voter: string; body: string; author: string | null }): Promise<void> {
  await sql`
    INSERT INTO fomo_signals (id, day, voter, body, author)
    VALUES (${input.id}, ${input.day}, ${input.voter}, ${input.body}, ${input.author})`;
}

/** False when this reader already marked this signal that way: one reader counts once. */
export async function addSignalMark(signalId: string, voter: string, kind: SignalMark): Promise<boolean> {
  const rows = await sql<{ kind: string }[]>`
    INSERT INTO fomo_signal_marks (signal_id, voter, kind)
    VALUES (${signalId}, ${voter}, ${kind})
    ON CONFLICT (signal_id, voter, kind) DO NOTHING
    RETURNING kind`;
  return rows.length > 0;
}

export async function countSignalMarks(signalId: string, kind: SignalMark): Promise<number> {
  const [row] = await sql<{ count: number }[]>`
    SELECT count(*)::int AS count FROM fomo_signal_marks WHERE signal_id = ${signalId} AND kind = ${kind}`;
  return row?.count ?? 0;
}

export async function signalExists(signalId: string): Promise<boolean> {
  const [row] = await sql<{ one: number }[]>`SELECT 1 AS one FROM fomo_signals WHERE id = ${signalId}`;
  return row !== undefined;
}

/** Takes a signal down. The reason is what the admin page shows: who did it, and why. */
export async function hideSignal(signalId: string, reason: string): Promise<boolean> {
  const rows = await sql<{ id: string }[]>`
    UPDATE fomo_signals SET hidden = true, hidden_reason = ${reason} WHERE id = ${signalId} AND NOT hidden
    RETURNING id`;
  return rows.length > 0;
}

/** What the page shows: visible signals, newest first, each with the agreements it gathered. */
export async function readSignals(limit: number): Promise<Array<{ id: string; body: string; author: string | null; at: Date; agrees: number }>> {
  return await sql<{ id: string; body: string; author: string | null; at: Date; agrees: number }[]>`
    SELECT s.id, s.body, s.author, s.created_at AS at,
           count(m.*) FILTER (WHERE m.kind = 'agree')::int AS agrees
    FROM fomo_signals s
    LEFT JOIN fomo_signal_marks m ON m.signal_id = s.id
    WHERE NOT s.hidden
    GROUP BY s.id
    ORDER BY s.created_at DESC
    LIMIT ${limit}`;
}

/** The numbers under the index: today's activity, and how much is on the page in all. */
export async function readStats(day: string): Promise<{ signalsToday: number; signalsTotal: number; hotwordsToday: number }> {
  const [row] = await sql<{ signals_today: number; signals_total: number; hotwords_today: number }[]>`
    SELECT (SELECT count(*)::int FROM fomo_signals WHERE day = ${day} AND NOT hidden) AS signals_today,
           (SELECT count(*)::int FROM fomo_signals WHERE NOT hidden) AS signals_total,
           (SELECT count(*)::int FROM fomo_hotwords WHERE day = ${day}) AS hotwords_today`;
  return {
    signalsToday: row?.signals_today ?? 0,
    signalsTotal: row?.signals_total ?? 0,
    hotwordsToday: row?.hotwords_today ?? 0,
  };
}

// ---------------------------------------------------------------------------
// What only the owner sees (the module's admin page).
// ---------------------------------------------------------------------------

/** Every signal for the admin page, newest first, with the reports that took it down. */
export async function readSignalsForAdmin(limit: number): Promise<Array<{ id: string; day: string; body: string; author: string | null; voter: string; at: Date; hidden: boolean; hiddenReason: string | null; agrees: number; reports: number }>> {
  const rows = await sql<{ id: string; day: string; body: string; author: string | null; voter: string; at: Date; hidden: boolean; hidden_reason: string | null; agrees: number; reports: number }[]>`
    SELECT s.id, to_char(s.day, 'YYYY-MM-DD') AS day, s.body, s.author, s.voter, s.created_at AS at, s.hidden, s.hidden_reason,
           count(m.*) FILTER (WHERE m.kind = 'agree')::int AS agrees,
           count(m.*) FILTER (WHERE m.kind = 'report')::int AS reports
    FROM fomo_signals s
    LEFT JOIN fomo_signal_marks m ON m.signal_id = s.id
    GROUP BY s.id
    ORDER BY s.created_at DESC
    LIMIT ${limit}`;
  return rows.map((row) => ({
    id: row.id,
    day: row.day,
    body: row.body,
    author: row.author,
    voter: row.voter,
    at: row.at,
    hidden: row.hidden,
    hiddenReason: row.hidden_reason,
    agrees: row.agrees,
    reports: row.reports,
  }));
}

/** How many signals are down and waiting to be looked at: what the admin navigation's badge counts. */
export async function countSignalsWaiting(): Promise<number> {
  const [row] = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM fomo_signals WHERE hidden`;
  return row?.count ?? 0;
}

/** Puts a signal back on the page, or takes it down by hand. Either way the reports it gathered are cleared. */
export async function setSignalHidden(signalId: string, hidden: boolean): Promise<boolean> {
  const rows = await sql<{ id: string }[]>`
    UPDATE fomo_signals
    SET hidden = ${hidden}, hidden_reason = ${hidden ? "管理员下架" : null}
    WHERE id = ${signalId}
    RETURNING id`;
  if (rows.length === 0) return false;
  if (!hidden) await sql`DELETE FROM fomo_signal_marks WHERE signal_id = ${signalId} AND kind = 'report'`;
  return true;
}

/** Removes a signal for good; the database drops its marks with it. */
export async function removeSignal(signalId: string): Promise<boolean> {
  const rows = await sql<{ id: string }[]>`DELETE FROM fomo_signals WHERE id = ${signalId} RETURNING id`;
  return rows.length > 0;
}
