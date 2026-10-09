// What a reader's own words are allowed to be. Pure: no database, no clock.
import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeAuthor, normalizeSignalBody } from "../backend/signal.ts";

const RULES = { minLength: 2, maxLength: 20 };

test("a signal is tidied, not rewritten", () => {
  assert.equal(normalizeSignalBody("  三家客户都在问同一个 Agent 产品  ", RULES), "三家客户都在问同一个 Agent 产品");
  assert.equal(normalizeSignalBody("第一行\r\n第二行", RULES), "第一行\n第二行", "a Windows line break becomes one line break");
  assert.equal(normalizeSignalBody("分行\n\n\n\n太多了", RULES), "分行\n\n太多了", "at most one blank line");
  assert.equal(normalizeSignalBody("多个     空格", RULES), "多个 空格");
});

test("control characters never survive", () => {
  assert.equal(normalizeSignalBody("看不见\u0007的\u0000字符", RULES), "看不见的字符");
});

test("too short, too long or nothing at all is not a signal", () => {
  assert.equal(normalizeSignalBody("", RULES), null);
  assert.equal(normalizeSignalBody("  \n  ", RULES), null);
  assert.equal(normalizeSignalBody("一", RULES), null);
  assert.equal(normalizeSignalBody("字".repeat(21), RULES), null);
  assert.equal(normalizeSignalBody("字".repeat(20), RULES), "字".repeat(20), "the limit itself is fine");
});

test("a signature is optional, single-line and short", () => {
  assert.equal(normalizeAuthor(undefined), null);
  assert.equal(normalizeAuthor(null), null);
  assert.equal(normalizeAuthor("   "), null);
  assert.equal(normalizeAuthor(42), null, "a number is not a signature");
  assert.equal(normalizeAuthor("  老张  "), "老张");
  assert.equal(normalizeAuthor("老\n张"), "老 张", "a line break becomes one space, so it stays one line");
  assert.equal(normalizeAuthor("名".repeat(30)), "名".repeat(24), "a long one is trimmed, not refused");
});
