// Pure mapping between AIHOT's JSON and this framework's own shapes. Everything here is a function of
// its arguments, so the shape rules are testable without a database or a network call.
import { createHash } from "node:crypto";
import { SITE } from "@aihot/site";
import { beijingMidnight } from "@aihot/contracts/time";
import { BRIDGE } from "../config.ts";
import type { AihotDailyReport, AihotItem, AihotPeriodReport, AihotReportEntry } from "./types.ts";

/** Bumped when the mapping changes in a way that should re-import what it already brought in. */
export const BRIDGE_VERSION = "aihot-bridge/1";

/** A report entry, as reports/edition.ts writes it. `itemId` is one of this site's article ids. */
export interface ReportEntry {
  itemId: string | null;
  factId: string | null;
  storyPublicId: string | null;
  title: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  sourceId: string;
  firstParty: boolean;
  role: string;
  score: number | null;
  publishedAt: string;
}

export interface DailyEntry extends ReportEntry {
  sources: number;
}

/** What the mapping needs to know about rows already imported. */
export interface BridgeLookup {
  /** The article this AIHOT item became, if it was imported. */
  articleId(aihotId: string): string | null;
  /** The mirror source row for an AIHOT source name. */
  sourceId(sourceName: string): string;
}

export function aihotIdFromUrl(url: string | null | undefined): string | null {
  const match = /\/items\/([a-zA-Z0-9_-]{1,80})\/?$/.exec(url ?? "");
  return match?.[1] ?? null;
}

/** The address of the original story: what this site links to, and what gives the article its identity. */
export function originalUrl(item: AihotItem): string | null {
  const url = item.links?.original?.trim();
  return url && /^https?:\/\//.test(url) ? url : null;
}

export function sourceNameOf(item: AihotItem | AihotReportEntry): string {
  return item.source?.name?.trim() || BRIDGE.attribution.name;
}

/**
 * One mirror source row per AIHOT source name. The id is derived from the name, so re-importing keeps
 * pointing at the same row, and the name itself is stored unchanged: readers see where a story came from.
 */
export function sourceIdFor(name: string): string {
  const readable = name.replace(/\s+/g, " ").trim().slice(0, 200) || BRIDGE.attribution.name;
  return `aihot-${createHash("sha256").update(readable).digest("hex").slice(0, 12)}`;
}

/** A source name that fits the source id derivation, used when writing the row. */
export function storedSourceName(name: string): string {
  return name.replace(/\s+/g, " ").trim().slice(0, 200) || BRIDGE.attribution.name;
}

export function categoryFor(category: string | null | undefined): string | null {
  if (!category) return null;
  return BRIDGE.categoryMap[category] ?? category;
}

/**
 * What is imported of an item. The hash decides whether a re-import has anything to do: AIHOT revises
 * titles, summaries and scores, and only a real change should rewrite the analysis and the publication.
 */
export function payloadHash(item: AihotItem): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        BRIDGE_VERSION,
        item.title,
        item.originalTitle ?? null,
        item.summary ?? null,
        item.reason ?? null,
        item.score ?? null,
        categoryFor(item.category),
        originalUrl(item),
        item.publishedAt ?? null,
      ]),
    )
    .digest("hex");
}

function publishedAt(item: AihotItem | AihotReportEntry): Date | null {
  const value = item.publishedAt ? new Date(item.publishedAt) : null;
  return value && Number.isFinite(value.getTime()) ? value : null;
}

export function itemPublishedAt(item: AihotItem): Date | null {
  return publishedAt(item);
}

function entryOf(entry: AihotReportEntry, look: BridgeLookup): ReportEntry {
  const aihotId = aihotIdFromUrl(entry.links?.aihot);
  const name = sourceNameOf(entry);
  return {
    itemId: aihotId ? look.articleId(aihotId) : null,
    factId: null,
    storyPublicId: null,
    title: entry.title,
    summary: entry.summary ?? "",
    sourceName: name,
    sourceUrl: entry.links?.original ?? "",
    sourceId: look.sourceId(name),
    firstParty: false,
    role: "report",
    score: null,
    publishedAt: entry.publishedAt ?? "",
  };
}

function dailyEntryOf(entry: AihotReportEntry, look: BridgeLookup): DailyEntry {
  return { ...entryOf(entry, look), sources: 1 };
}

function highlightsOf(sections: Array<{ items: Array<{ title: string }> }>, leadTitle: string, count: number): string[] {
  return sections
    .flatMap((section) => section.items.map((item) => item.title))
    .filter((title) => title && title !== leadTitle)
    .slice(0, count);
}

/** The daily issue as reports/compose.ts writes it. */
export function dailyContent(report: AihotDailyReport, look: BridgeLookup): Record<string, unknown> {
  const sections = (report.sections ?? []).map((section) => ({
    label: section.label,
    items: section.items.map((item) => dailyEntryOf(item, look)),
  }));
  const flashes = (report.flashes ?? []).map((item) => dailyEntryOf(item, look));
  const leadTitle = report.lead?.title ?? sections[0]?.items[0]?.title ?? "";
  const leadEntry = sections.flatMap((section) => section.items).find((entry) => entry.title === leadTitle) ?? null;
  const start = report.windowStart ? new Date(report.windowStart) : beijingMidnight(report.date);
  const end = report.windowEnd ? new Date(report.windowEnd) : beijingMidnight(report.date);
  const totalEvents = sections.reduce((sum, section) => sum + section.items.length, 0) + flashes.length;
  return {
    date: report.date,
    lead: { title: leadTitle, leadParagraph: report.lead?.leadParagraph ?? leadEntry?.summary ?? "" },
    leadItemId: leadEntry?.itemId ?? null,
    highlights: highlightsOf(sections, leadTitle, 3),
    sections,
    flashes,
    metrics: { totalEvents, sourcesCount: new Set(sections.flatMap((s) => s.items).map((i) => i.sourceId)).size, firstPartyEvents: 0 },
    windowStart: start.toISOString(),
    windowEnd: end.toISOString(),
    generator: { version: BRIDGE_VERSION, model: null, written: true, source: BRIDGE.attribution.name },
    // The read layer ignores fields it does not know; these keep whose work this is, so a deployment
    // that has to credit the source (AIHOT's rules require it when redistribution is authorised) can.
    bridge: { version: BRIDGE_VERSION, aihotUrl: report.links?.aihot ?? null, attribution: report.attribution ?? BRIDGE.attribution },
  };
}

/** A weekly or monthly issue as reports/compose.ts writes it: themes, not daily sections. */
export function periodContent(
  kind: "weekly" | "monthly",
  report: AihotPeriodReport,
  look: BridgeLookup,
  reportsCovered: number,
): Record<string, unknown> {
  const sections = report.sections ?? [];
  const themes = sections.map((section) => ({
    heading: section.label,
    summary: section.summary ?? null,
    storyRefs: section.items.map((item) => entryOf(item, look)),
  }));
  const entries = themes.flatMap((theme) => theme.storyRefs);
  const headline = report.headline ?? entries[0]?.title ?? "";
  const lead = entries.find((entry) => entry.title === headline) ?? entries[0] ?? null;
  const label = kind === "weekly" ? (report.week ?? report.periodEnd) : (report.month ?? report.periodEnd);
  const start = report.windowStart ? new Date(report.windowStart) : beijingMidnight(report.periodStart);
  const end = report.windowEnd ? new Date(report.windowEnd) : beijingMidnight(report.periodEnd);
  const storyOrder = entries.map((entry) => entry.itemId).filter((id): id is string => !!id);
  return {
    kind,
    title: `${SITE.name} ${kind === "weekly" ? "周报" : "月报"} · ${label}`,
    ...(kind === "weekly" ? { isoLabel: label } : { monthLabel: label }),
    periodStart: report.periodStart,
    periodEnd: report.periodEnd,
    headline,
    leadItemId: lead?.itemId ?? null,
    highlights: highlightsOf(sections, headline, 3),
    overview: report.overview ?? null,
    themes,
    storyOrder,
    metrics: { totalStories: storyOrder.length, selectedCount: entries.length, reportsCovered },
    generator: { version: BRIDGE_VERSION, model: null, written: true, source: BRIDGE.attribution.name },
    windowStart: start.toISOString(),
    windowEnd: end.toISOString(),
    bridge: { version: BRIDGE_VERSION, aihotUrl: report.links?.aihot ?? null, attribution: report.attribution ?? BRIDGE.attribution },
  };
}

/**
 * JSON with object keys in a fixed order. Postgres jsonb does not keep the key order a document was
 * written with, so comparing an imported issue with the stored one has to compare content, not text.
 */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** AIHOT's own issue timestamp: what "this issue changed" is measured against. */
export function reportGeneratedAt(report: AihotDailyReport | AihotPeriodReport): Date {
  const value = new Date(report.generatedAt);
  return Number.isFinite(value.getTime()) ? value : new Date();
}

/** The issue key this site routes by: daily `YYYY-MM-DD`, weekly `YYYY-Www`, monthly `YYYY-MM`. */
export function reportKey(kind: "daily" | "weekly" | "monthly", report: AihotDailyReport | AihotPeriodReport): string | null {
  if (kind === "daily") return "date" in report && report.date ? report.date : null;
  if (kind === "weekly") return "week" in report && report.week ? report.week : null;
  return "month" in report && report.month ? report.month : null;
}

