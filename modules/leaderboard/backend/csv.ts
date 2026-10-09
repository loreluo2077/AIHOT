// A small RFC 4180 reader: benchmark tables are published as CSV, and the fields carry quotes, commas
// and embedded newlines. Written here rather than pulled in, so the module keeps no dependency of its
// own and the parsing rules are visible next to the shapes they feed.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let started = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"' && field === "") {
      quoted = true;
      started = true;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      started = true;
      continue;
    }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      if (started || field !== "" || row.length > 0) {
        row.push(field);
        rows.push(row);
      }
      row = [];
      field = "";
      started = false;
      continue;
    }
    field += char;
    started = true;
  }
  if (started || field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

/** A number a benchmark table holds, or null when the cell is empty or not a number. */
export function cellNumber(cell: string | undefined): number | null {
  if (cell === undefined) return null;
  const trimmed = cell.trim().replace(/[%$]/g, "").replace(/,/g, "");
  if (trimmed === "" || trimmed === "-" || trimmed.toLowerCase() === "n/a") return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/** A stable key for a model name: "Claude Opus 4.5 (thinking)" and "claude-opus-4-5" have to meet. */
export function modelKeyFor(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}
