// What a community signal is allowed to be, before it reaches the database. Pure, so the API and the
// tests agree on it: this is the only place a reader's own words enter the site.

export interface SignalRules {
  minLength: number;
  maxLength: number;
}

/** A signature is short by nature; anything longer is trimmed rather than refused. */
const AUTHOR_MAX = 24;

/** Control characters never belong in a post. A line break does, so it is kept. */
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

const lengthOf = (text: string) => [...text].length;

/**
 * A reader's words as they are stored and shown, or null when they are not a signal: empty, too short,
 * too long, or nothing but control characters. Line breaks and spacing are tidied, never removed, so a
 * post with paragraphs reads back the way it was written.
 */
export function normalizeSignalBody(raw: string, rules: SignalRules): string | null {
  const body = raw
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const length = lengthOf(body);
  if (length < rules.minLength || length > rules.maxLength) return null;
  return body;
}

/** The signature to show beside a signal; null when the reader left it out (the page then shows 匿名). */
export function normalizeAuthor(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const author = raw.replace(CONTROL, "").replace(/\s+/g, " ").trim();
  if (!author) return null;
  return lengthOf(author) > AUTHOR_MAX ? [...author].slice(0, AUTHOR_MAX).join("") : author;
}
