// One more feed: the text behind an item. AIHOT renders it twice on the item page — the source's own
// language at /items/<id>/original, their Chinese translation at /items/<id> — and the JSON API carries
// neither. This lane fetches both and stores each where this site keeps that kind of text: the source
// rendering as the article's body, the translation as its `translations` row (origin 'replay', the same
// word the imported judgement uses). No model is called and nothing becomes public: the mirrored
// sources keep site_fulltext off, so every exit still reads summary + original link.
import { sql, type Db } from "@aihot/backend/db";
import { contentHash, reviseMaterial } from "@aihot/backend/content/materials";
import { publishArticleTx } from "@aihot/backend/publication/publish";
import { BRIDGE } from "../config.ts";
import { AihotHttpError, type AihotClient } from "./client.ts";
import { bodyFromDetailPage, classifyDetailPage, type DetailBody } from "./detail-page.ts";
import { emptySummary, type SyncSummary } from "./summary.ts";
import { saveRun } from "./state.ts";

/** What one page gave us: its text, a definite "no text", or nothing this run can act on. */
type PageRead =
  | { kind: "text"; body: DetailBody }
  /** Their item page, and it has no text block to give. */
  | { kind: "empty" }
  /** No such page: 404 is their own answer. */
  | { kind: "missing" }
  /** Their bot wall, a 403, a 5xx or a timeout: not an answer about the item. */
  | { kind: "refused" }
  /** A 200 that is not one of their pages: the shape this parser knows changed. */
  | { kind: "other" };

function pageUrl(aihotId: string, tab: "" | "/original"): string {
  return `${BRIDGE.baseUrl()}/items/${aihotId}${tab}`;
}

async function readPage(client: AihotClient, aihotId: string, tab: "" | "/original"): Promise<PageRead> {
  let html = "";
  try {
    html = (await client.text(`/items/${aihotId}${tab}`)).html ?? "";
  } catch (error) {
    if (!(error instanceof AihotHttpError)) throw error;
    return error.status === 404 ? { kind: "missing" } : { kind: "refused" };
  }
  const kind = classifyDetailPage(html);
  if (kind === "challenge") return { kind: "refused" };
  if (kind === "other") return { kind: "other" };
  const body = bodyFromDetailPage(html, pageUrl(aihotId, tab));
  return body ? { kind: "text", body } : { kind: "empty" };
}

/** Both renderings answered without a text block: AIHOT holds no text for this item. */
async function markEmpty(articleId: string): Promise<void> {
  await sql`UPDATE articles SET body_status = 'unconfirmed', updated_at = now()
    WHERE id = ${articleId} AND body_status = 'none'`;
}

/**
 * The body is new content, so it is a new revision — and a revision sends the article back to this
 * site's paid analysers, which this module never spends. The judgement the item arrived with is moved
 * onto the new revision in the same transaction, and the article is settled again as analysed.
 */
async function storeBody(articleId: string, body: DetailBody, translation: DetailBody | null): Promise<"updated" | "skipped"> {
  return sql.begin(async (tx) => {
    const [row] = await tx<{ title: string; excerpt: string | null }[]>`
      SELECT title, excerpt FROM articles WHERE id = ${articleId} AND body_status = 'none' FOR UPDATE`;
    if (!row) return "skipped";
    await reviseMaterial(tx, articleId, {
      set: sql`body_html = ${body.html}, body_text = ${body.text}, body_status = 'ok'`,
      hash: contentHash({ title: row.title, bodyText: body.text, excerpt: row.excerpt }),
      title: row.title,
      bodyText: body.text,
    });
    const [revision] = await tx<{ revision: number }[]>`SELECT revision FROM articles WHERE id = ${articleId}`;
    if (translation) {
      await tx`
        INSERT INTO translations (article_id, lang, revision, title, body_html, body_text, complete, origin)
        VALUES (${articleId}, 'zh', ${revision!.revision}, ${row.title}, ${translation.html}, ${translation.text}, true, 'replay')
        ON CONFLICT (article_id, lang) DO UPDATE SET
          revision = EXCLUDED.revision, title = EXCLUDED.title, body_html = EXCLUDED.body_html,
          body_text = EXCLUDED.body_text, complete = EXCLUDED.complete, origin = EXCLUDED.origin, created_at = now()`;
    }
    await tx`
      INSERT INTO analyses (article_id, input_revision, origin, model, prompt_version, receipt_ids, relevance, category, tags, subjects, title_zh, summary_zh, reason_zh, score, selected, output)
      SELECT a.article_id, ${revision!.revision}, a.origin, a.model, a.prompt_version, a.receipt_ids, a.relevance, a.category, a.tags, a.subjects,
             a.title_zh, a.summary_zh, a.reason_zh, a.score, a.selected, a.output
      FROM analyses a WHERE a.article_id = ${articleId} ORDER BY a.input_revision DESC, a.id DESC LIMIT 1`;
    await tx`
      UPDATE articles SET processing_state = 'analyzed', processing_error = NULL, processing_retry_at = NULL,
        processing_queued_at = NULL, grouping_status = 'complete', grouping_error = NULL,
        grouped_at = coalesce(grouped_at, now()), selection_adds_value = true, updated_at = now()
      WHERE id = ${articleId}`;
    await publishArticleTx(tx, articleId);
    return "updated";
  });
}

/**
 * The bodies of the items this module imported: newest first, and only those whose text it has not
 * stored yet. An item is a candidate while its body_status is 'none' — the value an import leaves.
 */
/**
 * The bodies of the items this module imported: newest first, and only those whose text it has not
 * stored yet. An item is a candidate while its body_status is 'none' — the value an import leaves.
 */
export async function syncDetails(client: AihotClient, db: Db = sql): Promise<SyncSummary> {
  const summary = emptySummary("detail");
  const candidates = await db<Array<{ aihot_id: string; article_id: string }>>`
    SELECT bi.aihot_id, bi.article_id FROM aihot_bridge_items bi
    JOIN articles a ON a.id = bi.article_id
    WHERE bi.owned AND a.body_status = 'none'
    ORDER BY a.discovered_at DESC LIMIT ${BRIDGE.detail.maxPerRun}`;
  // Items whose pages were all actually read: a body stored, or a definite "this item has no text".
  let read = 0;
  let unreadInARow = 0;
  for (const candidate of candidates) {
    summary.fetched++;
    try {
      const source = await readPage(client, candidate.aihot_id, "/original");
      const chinese = await readPage(client, candidate.aihot_id, "");
      const body = source.kind === "text" ? source.body : chinese.kind === "text" ? chinese.body : null;
      if (!body) {
        // A page we never got decides nothing: the item stays a candidate for the next run.
        const unread = [source, chinese].some((page) => page.kind === "refused" || page.kind === "other");
        summary.skipped++;
        if (unread) {
          unreadInARow++;
          // Their bot wall closes harder the more it is pushed, so a run that is getting nowhere
          // stops asking instead of spending its whole budget against it.
          if (unreadInARow >= 5 && summary.updated === 0) break;
          continue;
        }
        read++;
        unreadInARow = 0;
        await markEmpty(candidate.article_id);
        continue;
      }
      // Their two tabs are the same text in two languages; an item whose source is Chinese has one copy.
      const translation = source.kind === "text" && chinese.kind === "text" && chinese.body.text !== source.body.text ? chinese.body : null;
      const outcome = await storeBody(candidate.article_id, body, translation);
      read++;
      unreadInARow = 0;
      if (outcome === "skipped") summary.unchanged++;
      else summary.updated++;
    } catch (error) {
      summary.failed++;
      summary.detail = { error: (error as Error).message, item: candidate.aihot_id };
    }
  }
  // A run that read nothing at all is not a success to record quietly: either their bot wall is in the
  // way for now, or the markup this parser knows is gone. Either way the operator should hear it rather
  // than watch a lane that never fills.
  if (summary.fetched > 0 && read === 0 && summary.failed === 0) {
    summary.failed++;
    summary.detail = { error: "not one page could be read this run: their bot wall is in the way, or their markup changed" };
  }
  await saveRun(summary, db);
  return summary;
}
