// The AIHOT public API as this module reads it (openapi-v1.json, schemaVersion 1), narrowed to the
// fields the bridge uses. Clients must ignore unknown fields, so everything beyond the required ones
// stays optional here.

export interface AihotAttribution {
  name: string;
  url: string;
}

export interface AihotSourceName {
  name: string;
}

export interface AihotLinks {
  aihot?: string | null;
  original?: string | null;
}

export interface AihotItem {
  id: string;
  title: string;
  originalTitle?: string | null;
  summary?: string | null;
  source?: AihotSourceName | null;
  links: AihotLinks;
  publishedAt?: string | null;
  discoveredAt?: string | null;
  category?: string | null;
  score?: number | null;
  selected?: boolean;
  reason?: string | null;
  attribution?: AihotAttribution | null;
}

export interface AihotItemsPage {
  schemaVersion: number;
  items: AihotItem[];
  page: { count: number; hasMore: boolean; nextCursor?: string | null };
}

export interface AihotSnapshot {
  schemaVersion: number;
  asOf: string;
  cursor: string;
  count: number;
  hasMore: boolean;
  nextPage?: string | null;
  items: AihotItem[];
}

export type AihotChange =
  | { op: "upsert"; changedAt: string; item: AihotItem }
  | { op: "remove"; changedAt: string; id: string };

export interface AihotChanges {
  schemaVersion: number;
  cursor: string;
  count: number;
  hasMore: boolean;
  changes: AihotChange[];
}

export interface AihotReportEntry {
  title: string;
  summary?: string | null;
  source?: AihotSourceName | null;
  links: AihotLinks;
  publishedAt?: string | null;
  category?: string | null;
  attribution?: AihotAttribution | null;
}

export interface AihotReportSection {
  label: string;
  summary?: string | null;
  items: AihotReportEntry[];
}

export interface AihotDailyReport {
  date: string;
  generatedAt: string;
  windowStart?: string | null;
  windowEnd?: string | null;
  lead?: { title: string; leadParagraph: string } | null;
  sections?: AihotReportSection[];
  flashes?: AihotReportEntry[];
  links?: AihotLinks;
  attribution?: AihotAttribution | null;
}

export interface AihotPeriodReport {
  week?: string;
  month?: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  windowStart?: string | null;
  windowEnd?: string | null;
  headline?: string | null;
  overview?: string | null;
  sections?: AihotReportSection[];
  links?: AihotLinks;
  attribution?: AihotAttribution | null;
}

export interface AihotDailyIndex {
  schemaVersion: number;
  count: number;
  items: Array<{ date: string; generatedAt: string; leadTitle?: string | null; leadParagraph?: string | null }>;
}

export interface AihotPeriodIndex {
  schemaVersion: number;
  count: number;
  items: Array<{ week?: string; month?: string; periodStart: string; periodEnd: string; generatedAt: string; headline?: string | null }>;
}

export interface AihotHotTopic {
  rank: number;
  /** The report the hot list shows the event under. */
  id: string;
  title: string;
  source?: AihotSourceName | null;
  links: AihotLinks & { story?: string | null };
  sourceCount?: number;
  signalCount?: number;
  participantCount?: number;
  sourceNames?: string[];
  latestAt?: string | null;
}

export interface AihotHotTopics {
  schemaVersion: number;
  count: number;
  items: AihotHotTopic[];
}

export interface AihotStoryReport {
  id: string;
  title: string;
  summary?: string | null;
  source?: AihotSourceName | null;
  publishedAt?: string | null;
  links: AihotLinks;
}

export interface AihotStoryDetail {
  publicId: string;
  title: string;
  firstReportAt?: string | null;
  latestAt?: string | null;
  latest?: string | null;
  digest?: string | null;
  digestUpdatedAt?: string | null;
  reportCount?: number;
  sourceCount?: number;
  links?: AihotLinks;
  reports?: AihotStoryReport[];
  related?: Array<{ publicId: string; title: string; relation: string }>;
}
