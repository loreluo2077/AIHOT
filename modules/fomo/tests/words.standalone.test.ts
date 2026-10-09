// The hot list's rules: what counts as a word, how it is compared, and how it is counted. Pure.
import assert from "node:assert/strict";
import { test } from "node:test";
import { FOMO } from "../config.ts";
import { normalizeWord, tallyWords, wordKey } from "../backend/words.ts";

const RULES = FOMO.hotword;

test("a word keeps the spelling it arrived in and is compared without case", () => {
  assert.equal(normalizeWord("OpenAI", RULES), "OpenAI");
  assert.equal(wordKey("OpenAI"), "openai");
  assert.equal(wordKey("  GPT-5  "), "gpt-5");
  assert.equal(normalizeWord("  GPT-5  ", RULES), "GPT-5");
});

test("a link, a handle, markup or a control character is not a word", () => {
  assert.equal(normalizeWord("https://example.org", RULES), null);
  assert.equal(normalizeWord("www.example.org", RULES), null);
  assert.equal(normalizeWord("@openai", RULES), null);
  assert.equal(normalizeWord("<b>bold</b>", RULES), null);
  assert.equal(normalizeWord("two\nlines", RULES), null);
});

test("a word has to be long enough, short enough, and mean something", () => {
  assert.equal(normalizeWord("a", RULES), null, "too short");
  assert.equal(normalizeWord("x".repeat(RULES.maxLength + 1), RULES), null, "too long");
  assert.equal(normalizeWord("..", RULES), null, "no letter or digit");
  assert.equal(normalizeWord("  ", RULES), null, "nothing at all");
  assert.equal(normalizeWord("x".repeat(RULES.maxLength), RULES), "x".repeat(RULES.maxLength));
});

test("a word too general to tell anything is refused, however it is spelled", () => {
  assert.equal(normalizeWord("AI", RULES), null);
  assert.equal(normalizeWord("模型", RULES), null);
  assert.equal(normalizeWord("世界模型", RULES), "世界模型", "a word that merely contains a blocked one is fine");
});

test("a word counts once per report, and the category counts as one of its words", () => {
  const counted = tallyWords(
    [
      { tags: ["OpenAI", "OpenAI", "GPT-5"], category: "模型发布" },
      { tags: ["OpenAI"], category: "模型发布" },
    ],
    RULES,
    10,
  );
  assert.deepEqual(counted, [
    { word: "OpenAI", count: 2 },
    { word: "模型发布", count: 2 },
    { word: "GPT-5", count: 1 },
  ]);
});

test("two spellings of one word are one entry, and the list is capped", () => {
  const counted = tallyWords([{ tags: ["OpenAI", "openai"], category: null }], RULES, 10);
  assert.deepEqual(counted, [{ word: "OpenAI", count: 1 }], "the first spelling is the one shown");
  assert.equal(tallyWords([{ tags: ["世界模型", "推理能力", "多模态"], category: null }], RULES, 2).length, 2);
});
