// The item page's text block. AIHOT renders one item's text in a single `<div class="prose">`, and the
// two pages that carry it have the same shape: /items/<id>/original (the source's own language) and
// /items/<id> (their Chinese translation). Neither is in the JSON API. Kept pure, so the parsing is
// tested without a network.
import { sanitizeBody } from "@aihot/backend/content/sanitize";
import { stripTags } from "@aihot/backend/lib/text";

export interface DetailBody {
  html: string;
  text: string;
}

/** Tags with no closing tag, so the depth scan below must not wait for one. */
const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);

/** The opening tag of the block the text is rendered in. */
const PROSE_OPEN = /<div\b[^>]*\bclass\s*=\s*"[^"]*\bprose\b[^"]*"[^>]*>/i;

/**
 * The inner HTML of the first `<div class="prose">`. The block's own elements are matched on a stack,
 * so where it ends is its matching close tag and not the first `</div>` — nor the page's own `</body>`,
 * which closes nothing this block opened. A block that never closes has no text this parser can trust.
 */
export function proseBlock(html: string): string | null {
  const open = PROSE_OPEN.exec(html);
  if (!open) return null;
  const from = open.index + open[0].length;
  const tag = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/?)>/g;
  tag.lastIndex = from;
  const stack: string[] = [];
  for (let match = tag.exec(html); match; match = tag.exec(html)) {
    const name = match[2]!.toLowerCase();
    if (VOID_TAGS.has(name) || match[3] === "/") continue;
    if (match[1] !== "/") {
      stack.push(name);
      continue;
    }
    const top = stack[stack.length - 1];
    if (top === name) stack.pop();
    else if (stack.length === 0) {
      if (name === "div") return html.slice(from, match.index);
      // The page's own chrome (</body>, </html>, a stray </p>): not part of this block.
    }
  }
  return null;
}

/** One item's text as AIHOT renders it, in this site's stored body shape. Null when the page has none. */
export function bodyFromDetailPage(html: string, url: string): DetailBody | null {
  const block = proseBlock(html);
  if (!block) return null;
  const clean = sanitizeBody(block, url);
  const text = stripTags(clean);
  return text ? { html: clean, text } : null;
}

/**
 * What a fetched page turned out to be. Their bot wall is served **with a 200**, in place of the page:
 * a kilobyte of script that sets a cookie and reloads, carrying none of the page's own markup. We never
 * solve it — their rules forbid getting past a security measure, and this module has no browser — so it
 * is only ever recognised, and the item waits for a run where the wall is not in the way.
 */
export type DetailPageKind = "item" | "challenge" | "other";

const CHALLENGE_MARKER = /__tst_status|EO_Bot_Ssid/;

/** Every page of theirs carries this, including an item page that has no text block to give. */
const SITE_MARKER = /<meta\s+name="aihot-release"/i;

export function classifyDetailPage(html: string): DetailPageKind {
  if (CHALLENGE_MARKER.test(html)) return "challenge";
  return SITE_MARKER.test(html) ? "item" : "other";
}
