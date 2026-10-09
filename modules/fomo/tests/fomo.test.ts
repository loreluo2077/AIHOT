// The module's own tables and the index it serves, on a database of its own: a reader votes once a day,
// a word is counted per reader, and the day's number comes from what the site actually selected.
import { tag } from "../../../tests/setup.ts";
import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { beijingDate } from "@aihot/contracts/time";
import { closeDb, sql } from "@aihot/backend/db";
import { FOMO } from "../config.ts";
import { daysEndingAt, fomoPayload } from "../backend/read.ts";
import { addReaderWord, castVote, countReaderWords, readReaderWords, readVotes } from "../backend/store.ts";

const T = tag();
const SOURCE = `test-fomo-${T}`;
const DAY = beijingDate(new Date());

after(async () => {
  await closeDb();
});

before(async () => {
  await sql`INSERT INTO sources (id, name, kind, tier, participation_mode, site_fulltext, syndicate_fulltext, next_fetch_at)
            VALUES (${SOURCE}, 'Test fomo', 'rss', 'T1', 'editorial', false, false, '2100-01-01')
            ON CONFLICT (id) DO NOTHING`;
});

beforeEach(async () => {
  await sql`DELETE FROM fomo_votes`;
  await sql`DELETE FROM fomo_hotwords`;
  await sql`DELETE FROM publications WHERE source_id = ${SOURCE}`;
  await sql`DELETE FROM articles WHERE source_id = ${SOURCE}`;
});

let seq = 0;
/** A selected, released report the index counts, as if the site had just published it. */
async function publish(options: { tags?: string[]; category?: string | null; score?: number | null; firstParty?: boolean; storyId?: number | null } = {}): Promise<string> {
  seq += 1;
  const id = `fomo-${T}-${seq}`;
  const at = new Date();
  await sql`INSERT INTO articles (id, source_id, identity_key, url, title, discovered_at, timeline_at, body_status)
            VALUES (${id}, ${SOURCE}, ${id}, ${`https://example.org/${id}`}, ${`Fomo ${seq}`}, ${at}, ${at}, 'ok')`;
  await sql`INSERT INTO publications (article_id, title, source_id, channel, url, discovered_at, timeline_at, sort_at, visible_after, visibility, selected, category, tags, score, first_party, story_id)
            VALUES (${id}, ${`标题 ${seq}`}, ${SOURCE}, 'news', ${`https://example.org/${id}`}, ${at}, ${at}, ${at}, ${new Date(at.getTime() - 60_000)}, 'public', true,
                    ${options.category ?? null}, ${options.tags ?? []}::text[], ${options.score ?? null}, ${options.firstParty ?? false}, ${options.storyId ?? null})`;
  return id;
}

test("a reader votes once a day, and voting again replaces the vote", async () => {
  await castVote(DAY, "voter-a", "low");
  await castVote(DAY, "voter-a", "high");
  await castVote(DAY, "voter-b", "medium");
  const votes = await readVotes(daysEndingAt(DAY, 2)[0]!, DAY);
  assert.deepEqual(votes.get(DAY), { low: 0, medium: 1, high: 1 });
});

test("a word counts once per reader, and spelling does not split it", async () => {
  assert.equal(await addReaderWord(DAY, "Sora", "voter-a"), true);
  assert.equal(await addReaderWord(DAY, "Sora", "voter-a"), false, "the same reader adding it again is not a second row");
  assert.equal(await addReaderWord(DAY, "sora", "voter-b"), true, "another reader's spelling joins the word already listed");
  assert.deepEqual(await readReaderWords(DAY), [{ word: "Sora", count: 2 }]);
  assert.equal(await countReaderWords(DAY, "voter-a"), 1);
  assert.equal(await countReaderWords(DAY, "voter-b"), 1);
  assert.equal(await countReaderWords(DAY, "voter-c"), 0);
});

test("the day's number comes from what the site selected, and the hot list from its own tags", async () => {
  await publish({ tags: ["OpenAI", "GPT-5"], category: "模型发布", score: 80, firstParty: true, storyId: 1 });
  await publish({ tags: ["OpenAI"], category: "模型发布", score: 60, storyId: 1 });

  const payload = await fomoPayload();
  assert.equal(payload.day, DAY);
  assert.equal(payload.breakdown.factors[0]!.value, 2, "two selected reports");
  assert.equal(payload.breakdown.factors[1]!.value, 1, "both belong to one event");
  assert.equal(payload.breakdown.sources, 1);
  assert.equal(payload.breakdown.factors[3]!.value, 70, "the mean of the two scores");
  assert.deepEqual(payload.hotwords, [
    { word: "OpenAI", count: 2 },
    { word: "模型发布", count: 2 },
    { word: "GPT-5", count: 1 },
  ]);
  assert.equal(payload.votes.total, 0);
  assert.equal(payload.voteScore, null);
  assert.equal(payload.index, Math.round(payload.contentScore));
  assert.equal(payload.trend.length, FOMO.trendDays);
  assert.equal(payload.trend[payload.trend.length - 1]!.day, DAY);
  assert.equal(payload.trend[payload.trend.length - 1]!.index, payload.index);
});

test("readers voting moves the index without touching the content half", async () => {
  await publish({ score: 80 });
  const before = await fomoPayload();
  assert.equal(before.votes.total, 0);

  await castVote(DAY, "voter-a", "high");
  await castVote(DAY, "voter-b", "high");
  const after = await fomoPayload();
  assert.equal(after.votes.total, 2);
  assert.equal(after.voteScore, FOMO.feelings.high);
  assert.equal(after.contentScore, before.contentScore, "what the site selected did not change");
  assert.ok(after.index > before.index, "a day readers are anxious about reads higher");
});

test("a withdrawn report stops counting, the way every public exit stops showing it", async () => {
  const id = await publish({ tags: ["OpenAI"], score: 90, firstParty: true });
  assert.equal((await fomoPayload()).breakdown.factors[0]!.value, 1);

  await sql`UPDATE publications SET visibility = 'withdrawn' WHERE article_id = ${id}`;
  const payload = await fomoPayload();
  assert.equal(payload.breakdown.factors[0]!.value, 0);
  assert.deepEqual(payload.hotwords, []);
  assert.equal(payload.index, 0);
});
