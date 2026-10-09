// The hot list: which words the day's own reports carried, and what a reader may add to it. Pure, so
// the page and the tests agree on what a word is.

export interface WordSource {
  tags: string[];
  category: string | null;
}

export interface WordCount {
  word: string;
  count: number;
}

export interface WordRules {
  minLength: number;
  maxLength: number;
  blocked: readonly string[];
}

const HAS_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;
/** A word with markup, a control character, a link or a handle in it is not a word readers pick. */
const NOT_A_WORD = /[<>\u0000-\u001f\u007f]|https?:\/\/|www\.|@/i;

/** What a word is compared by: two spellings of one word are one entry, whatever case they arrived in. */
export function wordKey(word: string): string {
  return word.trim().replace(/\s+/g, " ").toLowerCase();
}

/** A word in the form it is stored and shown, or null when the list should not carry it. */
export function normalizeWord(raw: string, rules: WordRules): string | null {
  // A line break or a control character is checked before anything is collapsed: it means this was not
  // typed as one word. A word with room around it is still fine.
  const trimmed = raw.trim();
  if (NOT_A_WORD.test(trimmed)) return null;
  const word = trimmed.replace(/\s+/g, " ");
  const key = wordKey(word);
  if (!word) return null;
  const length = [...key].length;
  if (length < rules.minLength || length > rules.maxLength) return null;
  if (!HAS_LETTER_OR_DIGIT.test(key)) return null;
  if (rules.blocked.includes(key)) return null;
  return word;
}

function byCountThenWord(a: WordCount, b: WordCount): number {
  return b.count - a.count || (a.word < b.word ? -1 : a.word > b.word ? 1 : 0);
}

/** How many of the day's reports carried each word; a report's category counts as one of its words. */
export function tallyWords(sources: readonly WordSource[], rules: WordRules, limit: number): WordCount[] {
  const counts = new Map<string, WordCount>();
  for (const source of sources) {
    const seenToday = new Set<string>();
    for (const raw of [...source.tags, source.category ?? ""]) {
      const word = normalizeWord(raw, rules);
      if (!word) continue;
      const key = wordKey(word);
      if (seenToday.has(key)) continue;
      seenToday.add(key);
      const found = counts.get(key);
      if (found) found.count += 1;
      else counts.set(key, { word, count: 1 });
    }
  }
  return [...counts.values()].sort(byCountThenWord).slice(0, limit);
}
