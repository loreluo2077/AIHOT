// Joining a benchmark's model ids to a catalogue's. The two name the same model differently
// (`claude-opus-5-5-max-effort` against `anthropic/claude-opus-5.5`), and a wrong join would put one
// model's price on another model's row, so the rule is deliberately narrow: the same name once
// punctuation, the vendor prefix and the benchmark's effort suffixes are removed — or an alias the
// operator wrote down. Two models that differ by a number never fold together.
import { modelKeyFor } from "./csv.ts";

/** Words a benchmark adds to a model to name a run setting, not a different model. */
const MODES = new Set(["max", "effort", "high", "xhigh", "medium", "low", "thinking", "auto", "reasoning", "preview", "exp", "experimental", "latest", "non", "instruct", "chat", "turbo"]);

/** Letters and digits only: "5.5" and "5-5" become the same run of characters. */
function folded(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** The name without its vendor prefix: `anthropic/claude-opus-5.5` → `claude-opus-5.5`. */
export function lastNameOf(value: string): string {
  const parts = value.split("/").filter(Boolean);
  return parts.at(-1) ?? value;
}

/** The id with run settings and punctuation removed: `claude-opus-5-5-max-effort` → `claudeopus55`. */
export function baseKeyOf(value: string): string {
  return folded(
    lastNameOf(value)
      .split(/[^a-zA-Z0-9.]+/)
      .filter((word) => word && !MODES.has(word.toLowerCase()))
      .join(""),
  );
}

export interface CatalogueEntry {
  key: string;
  /** The catalogue's own display name, e.g. "Anthropic: Claude Opus 5.5"; its part after the vendor is a name too. */
  name: string;
}

/** Every spelling of one catalogue model that is still that model: its key, its key without the vendor, its name. */
function variantsOf(entry: CatalogueEntry): string[] {
  const variants = new Set<string>([entry.key, lastNameOf(entry.key)]);
  const parts = entry.key.split("-").filter(Boolean);
  if (parts.length > 1) variants.add(parts.slice(1).join("-"));
  const colon = entry.name.indexOf(":");
  variants.add(colon >= 0 ? entry.name.slice(colon + 1).trim() : entry.name);
  return [...variants].filter(Boolean);
}

export interface MatchIndex {
  exact: Map<string, CatalogueEntry>;
  base: Map<string, CatalogueEntry>;
}

export function matchIndex(entries: readonly CatalogueEntry[]): MatchIndex {
  const exact = new Map<string, CatalogueEntry>();
  const base = new Map<string, CatalogueEntry>();
  const put = (map: Map<string, CatalogueEntry>, key: string, entry: CatalogueEntry) => {
    if (key && !map.has(key)) map.set(key, entry);
  };
  for (const entry of entries) {
    for (const variant of variantsOf(entry)) {
      put(exact, modelKeyFor(variant), entry);
      put(base, baseKeyOf(variant), entry);
    }
  }
  return { exact, base };
}

/**
 * The catalogue entry a benchmark id belongs to, or null. An alias wins over the rule; the rule only
 * ever matches on the folded name, so two models that differ by a number never meet.
 */
export function matchCatalogue(benchmarkId: string, index: MatchIndex, aliases: Record<string, string> = {}): CatalogueEntry | null {
  const alias = aliases[benchmarkId] ?? aliases[modelKeyFor(benchmarkId)] ?? aliases[lastNameOf(benchmarkId)];
  const look = (candidate: string): CatalogueEntry | null =>
    index.exact.get(modelKeyFor(candidate)) ?? index.exact.get(modelKeyFor(lastNameOf(candidate))) ?? index.base.get(baseKeyOf(candidate)) ?? null;
  if (alias) return look(alias);
  return look(benchmarkId);
}
