// The quizzes' scoring, without a database: totals, level boundaries, and the dimension normalization.
// The questions are static data; if someone edits them, these are the shapes that must hold.
import assert from "node:assert/strict";
import { test } from "node:test";
import { ANXIETY_QUESTIONS, calcAnxietyScore, getAnxietyLevel, ANXIETY_LEVELS } from "../data/anxiety-quiz.ts";
import { QUIZ_QUESTIONS, calcDimensionScores, calcTotalScore, getLevel, DIMENSION_LABELS, QUIZ_LEVELS } from "../data/fomo-quiz.ts";

test("the survival quiz's questions cover five dimensions with four options each", () => {
  assert.equal(QUIZ_QUESTIONS.length, 10);
  for (const question of QUIZ_QUESTIONS) {
    assert.equal(question.options.length, 4);
    assert.ok(question.dimension in DIMENSION_LABELS);
    assert.deepEqual(question.options.map((option) => option.score).sort((a, b) => a - b), [1, 4, 7, 10]);
  }
  // Every dimension carries exactly two questions, so its 0–100 normalization is exact.
  for (const key of Object.keys(DIMENSION_LABELS)) {
    assert.equal(QUIZ_QUESTIONS.filter((question) => question.dimension === key).length, 2);
  }
});

test("the survival score is the sum of the answers, and every score lands in one level", () => {
  const all = Object.fromEntries(QUIZ_QUESTIONS.map((question) => [question.id, 10]));
  const none = Object.fromEntries(QUIZ_QUESTIONS.map((question) => [question.id, 1]));
  assert.equal(calcTotalScore(all), 100);
  assert.equal(calcTotalScore(none), 10);
  assert.equal(getLevel(100).grade, "S");
  assert.equal(getLevel(10).grade, "D");
  for (let score = 0; score <= 100; score += 1) {
    const level = getLevel(score);
    assert.ok(score >= level.min && score <= level.max, `score ${score} fell outside ${level.grade}`);
  }
  // The levels tile 0–100 without gaps (the list is ordered S first, D last).
  assert.equal(QUIZ_LEVELS[0]!.max, 100);
  assert.equal(QUIZ_LEVELS[QUIZ_LEVELS.length - 1]!.min, 0);
  for (let i = 0; i < QUIZ_LEVELS.length - 1; i += 1) {
    assert.equal(QUIZ_LEVELS[i + 1]!.max, QUIZ_LEVELS[i]!.min - 1, `gap between ${QUIZ_LEVELS[i]!.grade} and ${QUIZ_LEVELS[i + 1]!.grade}`);
  }
});

test("each dimension normalizes to 0–100 whatever its questions scored", () => {
  const answers = Object.fromEntries(QUIZ_QUESTIONS.map((question) => [question.id, question.options[0]!.score]));
  const dimensions = calcDimensionScores(answers);
  assert.deepEqual(Object.keys(dimensions).sort(), Object.keys(DIMENSION_LABELS).sort());
  for (const value of Object.values(dimensions)) {
    assert.ok(value >= 0 && value <= 100);
  }
  // One dimension answered with its lowest option reads 10, its highest reads 100.
  const low = calcDimensionScores({ 1: 1, 2: 1 });
  const high = calcDimensionScores({ 1: 10, 2: 10 });
  assert.equal(low.cognition, 10);
  assert.equal(high.cognition, 100);
});

test("the anxiety quiz's score is 0–50 and every score lands in one level with advice", () => {
  assert.equal(ANXIETY_QUESTIONS.length, 5);
  assert.equal(calcAnxietyScore(Object.fromEntries(ANXIETY_QUESTIONS.map((question) => [question.id, 10]))), 50);
  assert.equal(getAnxietyLevel(50).grade, "S");
  assert.equal(getAnxietyLevel(0).grade, "D");
  for (let score = 0; score <= 50; score += 1) {
    const level = getAnxietyLevel(score);
    assert.ok(score >= level.min && score <= level.max, `score ${score} fell outside ${level.grade}`);
    assert.ok(level.advice.length > 0);
  }
  // The levels tile 0–50 without gaps (the list is ordered S first, D last).
  assert.equal(ANXIETY_LEVELS[0]!.max, 50);
  assert.equal(ANXIETY_LEVELS[ANXIETY_LEVELS.length - 1]!.min, 0);
  for (let i = 0; i < ANXIETY_LEVELS.length - 1; i += 1) {
    assert.equal(ANXIETY_LEVELS[i + 1]!.max, ANXIETY_LEVELS[i]!.min - 1, `gap between ${ANXIETY_LEVELS[i]!.grade} and ${ANXIETY_LEVELS[i + 1]!.grade}`);
  }
});
