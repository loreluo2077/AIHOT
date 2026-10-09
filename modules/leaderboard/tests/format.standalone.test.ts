// The parts of this module that are pure: the CSV reader benchmark tables need, the keys models are
// matched by, and the display name readers see.
import assert from "node:assert/strict";
import { test } from "node:test";
import { cellNumber, modelKeyFor, parseCsv } from "../backend/csv.ts";
import { baseKeyOf, matchCatalogue, matchIndex } from "../backend/match.ts";
import { prettyModelName } from "../format.ts";

test("a table cell survives quotes, commas and CRLF", () => {
  const rows = parseCsv('model,task\r\n"a, b",12.5\r\n"say ""hi""",7\r\n');
  assert.deepEqual(rows, [
    ["model", "task"],
    ["a, b", "12.5"],
    ['say "hi"', "7"],
  ]);
});

test("a row with nothing in it is not a row", () => {
  assert.deepEqual(parseCsv("a,b\n\n,\n1,2\n"), [["a", "b"], ["1", "2"]]);
  assert.deepEqual(parseCsv(""), []);
  assert.deepEqual(parseCsv("a,b\n  ,  \n"), [["a", "b"]]);
});

test("a number is read where the table has one, and nothing where it does not", () => {
  assert.equal(cellNumber("83.78"), 83.78);
  assert.equal(cellNumber(" 12% "), 12);
  assert.equal(cellNumber("1,234"), 1234);
  assert.equal(cellNumber(""), null);
  assert.equal(cellNumber("-"), null);
  assert.equal(cellNumber("n/a"), null);
  assert.equal(cellNumber(undefined), null);
});

test("model keys meet across the spellings of one model", () => {
  assert.equal(modelKeyFor("Claude Opus 4.5 (thinking)"), modelKeyFor("claude-opus-4.5"));
  assert.equal(modelKeyFor("GPT-6.1 Sol Max"), "gpt-6-1-sol-max");
  assert.equal(modelKeyFor("  -- weird --  "), "weird");
  assert.equal(modelKeyFor("x".repeat(300)).length, 120);
});

test("a benchmark id reads as a model name", () => {
  assert.equal(prettyModelName("claude-opus-4-5-max-effort"), "Claude Opus 4 5 Max Effort");
  assert.equal(prettyModelName("gpt-6.1-sol-max"), "GPT 6.1 Sol Max");
  assert.equal(prettyModelName("glm-5.3-flash"), "GLM 5.3 Flash");
  assert.equal(prettyModelName("qwen3.8-flash"), "Qwen3.8 Flash");
});

test("a benchmark id meets the catalogue's spelling of the same model, and never a neighbour", () => {
  const index = matchIndex([
    { key: "anthropic/claude-opus-5.5", name: "Anthropic: Claude Opus 5.5" },
    { key: "openai/gpt-6.1-sol", name: "OpenAI: GPT-6.1 Sol" },
    { key: "openai/gpt-6-sol", name: "OpenAI: GPT-6 Sol" },
  ]);
  assert.equal(baseKeyOf("claude-opus-5-5-max-effort"), "claudeopus55");
  assert.equal(matchCatalogue("claude-opus-5-5-max-effort", index)?.name, "Anthropic: Claude Opus 5.5");
  assert.equal(matchCatalogue("gpt-6.1-sol-max", index)?.name, "OpenAI: GPT-6.1 Sol");
  assert.equal(matchCatalogue("gpt-6-sol-max", index)?.name, "OpenAI: GPT-6 Sol");
  assert.equal(matchCatalogue("smaug-flash", index), null);
});

test("a written-down alias wins over the name rule", () => {
  const index = matchIndex([{ key: "acme/velvet-2", name: "Acme: Velvet 2" }]);
  assert.equal(matchCatalogue("velvet", index), null);
  assert.equal(matchCatalogue("velvet", index, { velvet: "acme/velvet-2" })?.name, "Acme: Velvet 2");
});

test("the catalogue key a source stores (vendor in the key) still meets the benchmark's id", () => {
  // Read.ts indexes exactly this shape: OpenRouter's `anthropic/claude-opus-5.5` becomes this key.
  const index = matchIndex([{ key: "anthropic-claude-opus-5-5", name: "Anthropic: Claude Opus 5.5" }]);
  assert.equal(matchCatalogue("claude-opus-5-5-max-effort", index)?.name, "Anthropic: Claude Opus 5.5");
  assert.equal(matchCatalogue("claude-opus-5-max-effort", index), null, "an earlier version is not the same model");
});
