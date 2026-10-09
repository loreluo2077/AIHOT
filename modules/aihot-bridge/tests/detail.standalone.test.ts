// The item page's text block, on pages shaped like AIHOT's: the text sits in one `div.prose`, with the
// item's own headings, links and nested blocks inside it, and the page's chrome around it. No network
// and no database: what the parser takes and what it leaves is the whole subject.
import assert from "node:assert/strict";
import { test } from "node:test";
import { bodyFromDetailPage, classifyDetailPage, proseBlock } from "../backend/detail-page.ts";

/** A page like theirs: the site's own release marker in the head, plus navigation and a footer. */
function page(inner: string): string {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta name="aihot-release" content="20261008060016-ea6464dab4"></head><body>
<nav><a href="/">AIHOT</a><span>精选</span><a href="/items/x/original">原文</a></nav>
<section><span class="text-[12px]">正文 · AI 翻译</span><div class="prose">${inner}</div></section>
<p class="mt-8">来源：<a href="https://example.com/a">Example</a><span> · example.com</span></p>
<footer>京ICP备2026012723号-5</footer>
</body></html>`;
}

test("the text is taken out of the prose block, and the page's chrome is left behind", () => {
  const body = bodyFromDetailPage(page("<p>今天，Waymo 完成了一笔 50 亿美元的定期贷款。</p><p>第二段。</p>"), "https://aihot.news/items/x/original");
  assert.ok(body);
  assert.match(body.text, /Waymo 完成了一笔 50 亿美元的定期贷款/);
  assert.match(body.text, /第二段/);
  for (const chrome of ["精选", "京ICP备", "来源", "原文"]) assert.doesNotMatch(body.text, new RegExp(chrome));
});

test("the block ends at its own closing tag, not at the first one inside it", () => {
  const html = page('<div class="note"><p>里面的盒子</p></div><p>盒子外的段落</p>');
  assert.equal(proseBlock(html), '<div class="note"><p>里面的盒子</p></div><p>盒子外的段落</p>');
  const body = bodyFromDetailPage(html, "https://aihot.news/items/x");
  assert.match(body!.text, /里面的盒子/);
  assert.match(body!.text, /盒子外的段落/);
  assert.doesNotMatch(body!.text, /京ICP备/);
});

test("a page with no prose block, or an empty one, has no body", () => {
  assert.equal(bodyFromDetailPage("<html><body><p>只有页面外壳</p></body></html>", "https://aihot.news/items/x"), null);
  assert.equal(bodyFromDetailPage(page("   "), "https://aihot.news/items/x"), null);
  // Their page is truncated: the block never closes, so nothing here is known to be its text.
  assert.equal(bodyFromDetailPage('<html><body><div class="prose"><p>半页</p></body></html>', "https://aihot.news/items/x"), null);
});

test("what the stored body keeps: paragraphs, headings, links and emphasis, with entities decoded", () => {
  const body = bodyFromDetailPage(
    page('<h2>安全地全球扩张</h2><p>今年早些时候，我们完成了一笔 <a href="https://waymo.com/blog/x">160 亿美元的股权投资</a>，R&amp;D 继续。</p><script>alert(1)</script><sub><i>注：机构贷款方可能代表投资基金。</i></sub>'),
    "https://aihot.news/items/x/original",
  );
  assert.ok(body);
  assert.match(body.html, /<h2>安全地全球扩张<\/h2>/);
  assert.match(body.html, /<a href="https:\/\/waymo.com\/blog\/x">/);
  assert.match(body.html, /<em>|<i>/);
  assert.doesNotMatch(body.html, /<script|<nav|class=/);
  assert.match(body.text, /R&D 继续/);
  assert.match(body.text, /注：机构贷款方可能代表投资基金/);
});

test("their bot wall and a page of unknown shape are told apart from an item page", () => {
  // Served with a 200 where the page should have been: a cookie-setting script and no page markup.
  const wall = '<script>document.cookie="__tst_status="+1;setTimeout(function(){location.href=location.href.replace(/[?|&]tads/,"")},0x4b0)</script>';
  assert.equal(classifyDetailPage(wall), "challenge");
  assert.equal(classifyDetailPage('<html><body><i class="EO_Bot_Ssid"></i></body></html>'), "challenge");
  assert.equal(classifyDetailPage(page("<p>正文</p>")), "item");
  assert.equal(classifyDetailPage(page("   ")), "item", "an item page without text is still their page");
  assert.equal(classifyDetailPage("<html><body><h1>Something else entirely</h1></body></html>"), "other");
});
