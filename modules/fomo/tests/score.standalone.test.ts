// The index's arithmetic, the bands it is read in, and the baseline it compares a day with. Pure: no
// database, no clock, no site.
import assert from "node:assert/strict";
import { test } from "node:test";
import { FOMO } from "../config.ts";
import { bandFor, baselineOf, firstPartyRatio, p90, scoreDay, type ContentMetrics, type ScoreRules } from "../backend/score.ts";

const RULES: ScoreRules = { factors: FOMO.factors, reference: FOMO.reference };
/** A day with only the numbers the test names. */
const day = (over: Partial<ContentMetrics> = {}): ContentMetrics => ({ selected: 0, stories: 0, sources: 0, firstParty: 0, averageScore: null, ...over });

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

test("the four parts are a whole", () => {
  const parts = FOMO.factors.selected + FOMO.factors.stories + FOMO.factors.firstParty + FOMO.factors.score;
  assert.ok(near(parts, 1), "the four parts add up to 1");
});

test("a day with nothing selected is zero, and a day at the reference on every part is full", () => {
  assert.equal(scoreDay(day(), RULES).content, 0);
  // The reference is 8 selected, 5 events, 20% first-party; 2 of 10 reports first-party is 20%.
  const full = scoreDay(day({ selected: 10, stories: 5, firstParty: 2, averageScore: 100 }), RULES);
  assert.equal(full.content, 100);
  assert.equal(full.index, 100);
});

test("a part past its reference does not push the others over", () => {
  // 100 reports is far past the reference, but only that part is full.
  const many = scoreDay(day({ selected: 100, averageScore: 50 }), RULES);
  assert.equal(many.factors.selected.ratio, 1);
  assert.ok(near(many.content, FOMO.factors.selected * 100 + FOMO.factors.score * 50));
});

test("the first-party part is a share of the day, not a count", () => {
  assert.equal(firstPartyRatio(day()), 0);
  assert.equal(firstPartyRatio(day({ selected: 4, firstParty: 2 })), 0.5);
});

test("the index is the content half, rounded", () => {
  const scored = scoreDay(day({ selected: 4, stories: 2, averageScore: 70 }), RULES);
  assert.equal(scored.index, Math.round(scored.content));
});

test("the index is read in three bands", () => {
  const label = (index: number) => bandFor(index, FOMO.bands).label;
  assert.equal(label(0), "冷静");
  assert.equal(label(40), "冷静");
  assert.equal(label(41), "躁动");
  assert.equal(label(70), "躁动");
  assert.equal(label(71), "恐慌");
  assert.equal(label(100), "恐慌");
});

test("the baseline is the configured reference until the window is long enough, then the window's own 90th percentile", () => {
  const quiet = [day({ selected: 1 }), day({ selected: 2 })];
  assert.deepEqual(baselineOf(quiet, FOMO.reference, 7), FOMO.reference, "too few days to move the reference");

  const busy = Array.from({ length: 10 }, () => day({ selected: 20, stories: 9, firstParty: 10 }));
  const raised = baselineOf(busy, FOMO.reference, 7);
  assert.equal(raised.selected, 20, "a busier site is measured against its own normal");
  assert.equal(raised.stories, 9);
  assert.equal(raised.firstPartyRatio, 0.5, "half of each day's reports first-party");
  assert.ok(raised.selected > FOMO.reference.selected);
});

test("the 90th percentile is taken by nearest rank", () => {
  assert.equal(p90([]), 0);
  assert.equal(p90([7]), 7);
  assert.equal(p90([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), 9);
});
