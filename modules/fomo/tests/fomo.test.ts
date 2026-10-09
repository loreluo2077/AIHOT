// The index the module serves, on a database of its own: the day's number comes from what the site
// actually selected, and what is withdrawn stops counting — the same rule every public exit follows.
import { tag } from "../../../tests/setup.ts";
import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { beijingDate } from "@aihot/contracts/time";
import { closeDb, sql } from "@aihot/backend/db";
import { fomoPayload } from "../backend/read.ts";

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
  await sql`DELETE FROM publications WHERE source_id = ${SOURCE}`;
  await sql`DELETE FROM articles WHERE source_id = ${SOURCE}`;
});

let seq = 0;
/** A selected, released report the index counts, as if the site had just published it. */
async function publish(options: { category?: string | null; score?: number | null; firstParty?: boolean; storyId?: number | null } = {}): Promise<string> {
  seq += 1;
  const id = `fomo-${T}-${seq}`;
  const at = new Date();
  await sql`INSERT INTO articles (id, source_id, identity_key, url, title, discovered_at, timeline_at, body_status)
            VALUES (${id}, ${SOURCE}, ${id}, ${`https://example.org/${id}`}, ${`Fomo ${seq}`}, ${at}, ${at}, 'ok')`;
  await sql`INSERT INTO publications (article_id, title, source_id, channel, url, discovered_at, timeline_at, sort_at, visible_after, visibility, selected, category, tags, score, first_party, story_id)
            VALUES (${id}, ${`标题 ${seq}`}, ${SOURCE}, 'news', ${`https://example.org/${id}`}, ${at}, ${at}, ${at}, ${new Date(at.getTime() - 60_000)}, 'public', true,
                    ${options.category ?? null}, ${[] as string[]}, ${options.score ?? null}, ${options.firstParty ?? false}, ${options.storyId ?? null})`;
  return id;
}

test("the day's number comes from what the site selected", async () => {
  await publish({ category: "模型发布", score: 80, firstParty: true, storyId: 1 });
  await publish({ category: "模型发布", score: 60, storyId: 1 });

  const payload = await fomoPayload();
  assert.equal(payload.day, DAY);
  assert.equal(payload.breakdown.factors[0]!.value, 2, "two selected reports");
  assert.equal(payload.breakdown.factors[1]!.value, 1, "both belong to one event");
  assert.equal(payload.breakdown.sources, 1);
  assert.equal(payload.breakdown.factors[3]!.value, 70, "the mean of the two scores");
  assert.equal(payload.index, Math.round(payload.contentScore), "the index is the content half, rounded");
  assert.equal(payload.band.label, "躁动", "two first-party reports land the day in the middle band");
});

test("a withdrawn report stops counting, the way every public exit stops showing it", async () => {
  const id = await publish({ score: 90, firstParty: true });
  assert.equal((await fomoPayload()).breakdown.factors[0]!.value, 1);

  await sql`UPDATE publications SET visibility = 'withdrawn' WHERE article_id = ${id}`;
  const payload = await fomoPayload();
  assert.equal(payload.breakdown.factors[0]!.value, 0);
  assert.equal(payload.index, 0);
});
