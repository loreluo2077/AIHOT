// Importing an event somebody else already grouped. A mirror, a migration or an internal curation tool
// brings events that were decided elsewhere; this writes them as `replay` events, the same way
// publication takes an already-public editorial decision (PublishOptions.releasedAt) and reports take an
// imported issue (reports.origin = 'imported'). Nothing here decides anything: it records the grouping,
// its evidence and the text that came with it, and leaves the engine's own grouping alone — an event
// this site grouped itself (origin 'model') or an editor touched ('manual') is never rewritten.
//
// The tables this writes (stories, facts, fact_articles, story_signals, story_digests) carry rules and
// are written only from events/ (tests/architecture.test.ts), which is why this lives here rather than
// in the module that calls it.
import { sql, type Db, type Tx } from "../db.ts";
import { publishArticle } from "../publication/publish.ts";
import { digestInputsHash, digestReports } from "../publication/story-evidence.ts";
import { recordSignal } from "./group.ts";

export interface ImportedEventMember {
  articleId: string;
  /** The report the event is shown under; the first primary member wins. */
  role: "primary" | "report";
  /** When this report joined the event: its publication time. */
  observedAt: Date;
}

export interface ImportedEvent {
  /** The event's own id, kept so its address stays stable across imports. */
  publicId: string;
  title: string;
  firstReportAt: Date;
  latestAt: Date;
  /** The newest development, as one line. */
  latest?: string | null;
  /** The event's summary as the importer has it; it is shown while its evidence still backs it. */
  digest?: string | null;
  digestUpdatedAt?: Date | null;
  members: ImportedEventMember[];
}

export interface ImportedEventResult {
  /** `owned`: this site grouped the event itself or an editor changed it, and this import left it alone. */
  status: "created" | "updated" | "owned" | "empty";
  storyId: number | null;
  /** How many members the import attached (an article the site does not hold is skipped). */
  attached: number;
}

/**
 * Writes one imported event. Members must already exist as articles; their publications are rebuilt so
 * the event page and the hot list see them as evidence. The digest is stored with the same evidence
 * fingerprint the read layer recomputes (publication/story-text.ts), so it is shown only while the
 * reports behind it are still public.
 */
export async function importEvent(input: ImportedEvent, db: Db = sql): Promise<ImportedEventResult> {
  const members = input.members.filter((member, index, all) => all.findIndex((other) => other.articleId === member.articleId) === index);
  if (members.length === 0) return { status: "empty", storyId: null, attached: 0 };

  // The pool opens the transaction; a caller that already holds one writes inside it.
  const outcome = "begin" in db
    ? await (db as typeof sql).begin((tx) => writeEvent(tx, input, members))
    : await writeEvent(db as Tx, input, members);
  if (outcome.id === null) return { status: "owned", storyId: null, attached: 0 };

  // The evidence readers see comes from the publications, so they are rebuilt before the digest is
  // fingerprinted: the fingerprint has to describe exactly the rows the read layer will read back.
  for (const member of members) await publishArticle(member.articleId);
  if (input.digest) await writeDigest(outcome.id, input, db);

  return { status: outcome.created ? "created" : "updated", storyId: outcome.id, attached: outcome.attached };
}

async function writeEvent(tx: Tx, input: ImportedEvent, members: readonly ImportedEventMember[]): Promise<{ id: number | null; created: boolean; attached: number }> {
  const [existing] = await tx<{ id: number; origin: string; merged_into: number | null; title: string; latest: string | null }[]>`
    SELECT id, origin, merged_into, title, latest FROM stories WHERE public_id = ${input.publicId} FOR UPDATE`;
  if (existing && (existing.origin !== "replay" || existing.merged_into !== null)) return { id: null, created: false, attached: 0 };

  let id: number;
  if (existing) {
    // The version is the digest's identity: it moves only when the imported text does, so a re-import
    // that brings the same words rewrites the same summary row instead of piling up new ones.
    const changed = existing.title !== input.title || (existing.latest ?? null) !== (input.latest ?? null);
    await tx`
      UPDATE stories SET title = ${input.title}, latest = ${input.latest ?? null},
        first_report_at = LEAST(coalesce(first_report_at, ${input.firstReportAt}), ${input.firstReportAt}),
        latest_at = GREATEST(coalesce(latest_at, ${input.latestAt}), ${input.latestAt}),
        version = version + ${changed ? 1 : 0}, updated_at = now()
      WHERE id = ${existing.id}`;
    id = existing.id;
  } else {
    const [row] = await tx<{ id: number }[]>`
      INSERT INTO stories (public_id, title, first_report_at, latest_at, latest, origin)
      VALUES (${input.publicId}, ${input.title}, ${input.firstReportAt}, ${input.latestAt}, ${input.latest ?? null}, 'replay')
      RETURNING id`;
    id = row!.id;
  }

  // One fact per imported event: the occurrence its reports report. The id is derived from the event's,
  // so re-importing keeps pointing at the same fact.
  const [fact] = await tx<{ id: number }[]>`
    INSERT INTO facts (public_id, story_id, title, occurred_at, created_at)
    VALUES (${`${input.publicId}:1`}, ${id}, ${input.title}, ${input.firstReportAt}, ${input.firstReportAt})
    ON CONFLICT (public_id) DO UPDATE SET story_id = EXCLUDED.story_id, title = EXCLUDED.title, updated_at = now()
    RETURNING id`;

  let attached = 0;
  for (const member of members) {
    const [source] = await tx<{ id: string; signal_group_id: string | null; participation_mode: string }[]>`
      SELECT s.id, s.signal_group_id, s.participation_mode FROM articles a JOIN sources s ON s.id = a.source_id
      WHERE a.id = ${member.articleId}`;
    if (!source) continue;
    const written = await tx`
      INSERT INTO fact_articles (fact_id, article_id, role, created_at)
      VALUES (${fact!.id}, ${member.articleId}, ${member.role}, ${member.observedAt})
      ON CONFLICT (fact_id, article_id) DO NOTHING`;
    if (written.count === 0) {
      await tx`UPDATE fact_articles SET role = ${member.role} WHERE fact_id = ${fact!.id} AND article_id = ${member.articleId} AND role <> 'mention'`;
    }
    // Signals are what the hot list counts: one participant per source, at the report's own time.
    await recordSignal(tx, id, member.articleId, { id: source.id, signal_group_id: source.signal_group_id }, source.participation_mode === "editorial" ? "editorial" : "signal", member.observedAt);
    attached++;
  }
  return { id, created: !existing, attached };
}

async function writeDigest(storyId: number, input: ImportedEvent, db: Db): Promise<void> {
  const reports = await digestReports(db, [storyId]);
  if (reports.length === 0) return;
  const articleIds = reports.map((report) => report.id);
  const inputsHash = digestInputsHash(reports);
  if ("begin" in db) await (db as typeof sql).begin((tx) => writeDigestRow(tx, storyId, input, articleIds, inputsHash));
  else await writeDigestRow(db as Tx, storyId, input, articleIds, inputsHash);
}

async function writeDigestRow(tx: Tx, storyId: number, input: ImportedEvent, articleIds: string[], inputsHash: string): Promise<void> {
  const [story] = await tx<{ version: number }[]>`SELECT version FROM stories WHERE id = ${storyId} FOR UPDATE`;
  if (!story) return;
  await tx`
    INSERT INTO story_digests (story_id, version, digest, latest, receipt_id, article_ids, inputs_hash)
    VALUES (${storyId}, ${story.version}, ${input.digest ?? null}, ${input.latest ?? null}, NULL, ${articleIds}, ${inputsHash})
    ON CONFLICT (story_id, version) DO UPDATE SET digest = EXCLUDED.digest, latest = EXCLUDED.latest,
      article_ids = EXCLUDED.article_ids, inputs_hash = EXCLUDED.inputs_hash`;
  await tx`
    UPDATE stories SET digest = ${input.digest ?? null}, digest_updated_at = ${input.digestUpdatedAt ?? new Date()}, updated_at = now()
    WHERE id = ${storyId}`;
}
