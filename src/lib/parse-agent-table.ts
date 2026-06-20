/**
 * Parse a markdown table from agent output_content into an array of row objects.
 * Header row becomes the keys (lowercased, spaces→underscores).
 */
export function parseAgentTable(content: string): Record<string, string>[] {
  if (!content) return [];
  const lines = content.split("\n");
  const tableLines: string[] = [];
  let inTable = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("|")) {
      inTable = true;
      tableLines.push(trimmed);
    } else if (inTable && trimmed === "") {
      break;
    }
  }

  if (tableLines.length < 2) return [];

  const parseRow = (line: string) =>
    line
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());

  const headers = parseRow(tableLines[0]).map((h) =>
    h.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")
  );

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < tableLines.length; i++) {
    const line = tableLines[i];
    // Skip separator rows
    if (/^\|[-| :]+\|$/.test(line)) continue;
    const cells = parseRow(line);
    if (cells.every((c) => !c)) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = cells[idx] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

/** Parse ALL markdown tables in content, returning an array of table arrays */
export function parseAllTables(content: string): Record<string, string>[][] {
  if (!content) return [];
  const lines = content.split("\n");
  const tables: Record<string, string>[][] = [];
  let current: string[] = [];

  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith("|")) {
      current.push(t);
    } else {
      if (current.length >= 2) {
        const parsed = parseAgentTable(current.join("\n"));
        if (parsed.length) tables.push(parsed);
      }
      current = [];
    }
  }
  if (current.length >= 2) {
    const parsed = parseAgentTable(current.join("\n"));
    if (parsed.length) tables.push(parsed);
  }
  return tables;
}

/** Extract a specific number from agent output text */
export function extractNumber(content: string, patterns: RegExp[]): number | null {
  for (const p of patterns) {
    const m = content.match(p);
    if (m?.[1]) return parseFloat(m[1]);
  }
  return null;
}
