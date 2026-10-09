// The shapes the module's API answers with, and the page reads. Kept apart from the code that queries the
// database so the browser bundle never pulls a database client in: the page imports these types only.
export interface RankedRow {
  rank: number;
  modelKey: string;
  model: string;
  value: number;
}

export interface BenchmarkTable {
  sourceKey: string;
  sourceLabel: string;
  sourceUrl: string;
  metricKey: string;
  label: string;
  group: string;
  /** The benchmark's own overall row, not the mean of its categories. */
  overall: boolean;
  rows: RankedRow[];
}

export interface SourceView {
  key: string;
  label: string;
  url: string;
  licence: string;
  /** What this run read, in words: the table's own version. */
  snapshot: string | null;
  fetchedAt: string | null;
  lastOkAt: string | null;
  error: string | null;
  models: number;
  scores: number;
}

export interface CatalogueRow {
  modelKey: string;
  name: string;
  vendor: string | null;
  releasedAt: string | null;
  contextLength: number | null;
  priceIn: number | null;
  priceOut: number | null;
  modality: string | null;
  url: string | null;
}

/** One column of the main table: the benchmark's overall score, or one of its categories. */
export interface BenchmarkColumn {
  key: string;
  label: string;
  group: string;
  overall: boolean;
}

/** One model's row: what the benchmark scored it, and what the catalogue says about it. */
export interface BenchmarkRow {
  rank: number;
  modelKey: string;
  model: string;
  overall: number | null;
  scores: Record<string, number>;
  /** The entry this row was matched to in the catalogue; null when nothing matched it. */
  catalogueName: string | null;
  releasedAt: string | null;
  priceIn: number | null;
  priceOut: number | null;
  modality: string | null;
  url: string | null;
}

export interface BenchmarkView {
  sourceKey: string;
  sourceLabel: string;
  sourceUrl: string;
  licence: string;
  snapshot: string | null;
  columns: BenchmarkColumn[];
  rows: BenchmarkRow[];
  /** How many rows a catalogue entry was found for. */
  matched: number;
}

export interface LeaderboardPayload {
  generatedAt: string;
  title: string;
  description: string;
  sources: SourceView[];
  /** The main ranked table: one row per model, categories beside it, catalogue fields joined on. */
  benchmark: BenchmarkView | null;
  /** Every other source's overall table, for a site that runs more than one benchmark. */
  tables: BenchmarkTable[];
  catalogue: CatalogueRow[];
  catalogueSource: { label: string; url: string } | null;
}
