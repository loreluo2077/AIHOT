// Display helpers. The benchmark publishes model ids such as `claude-fable-5-1-max-effort`; readers get a
// readable form, and the raw id stays in the cell's title so nothing is lost by showing it prettily.
const ACRONYMS = new Set(["ai", "gpt", "glm", "llm", "vl", "if", "moe", "api", "dpo", "sft", "qwen", "oss", "cpu", "gpu", "ui", "nlp", "rag", "cot"]);

export function prettyModelName(raw: string): string {
  return raw
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase();
      if (ACRONYMS.has(lower)) return lower.toUpperCase();
      if (/^\d+(\.\d+)*$/.test(word)) return word;
      if (/^[a-z]{1,3}\d/.test(lower)) return lower.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}
