export interface SchemaHint {
  table: string;
  columns: string[];
  note?: string;
}

function extractTablesFromParsed(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (typeof parsed === "object" && parsed !== null && "tables" in parsed) {
    const tables = (parsed as { tables?: unknown }).tables;
    return Array.isArray(tables) ? tables : [];
  }
  return [];
}

function mapTableItem(item: unknown): SchemaHint | null {
  if (typeof item !== "object" || item === null) {
    return null;
  }

  const record = item as {
    name?: string;
    table_name?: string;
    columns?: Array<{ name: string } | string>;
  };

  const tableName = record.name ?? record.table_name;
  if (!tableName) {
    return null;
  }

  const columns = (record.columns ?? []).map((column) =>
    typeof column === "string" ? column : column.name,
  );

  return { table: tableName, columns };
}

/** Parseia resposta MCP list_tables (array ou { tables: [] }). */
export function parseListTablesResult(result: unknown): SchemaHint[] {
  if (!result || typeof result !== "object") {
    return [];
  }

  const record = result as { content?: Array<{ type?: string; text?: string }> };
  const textBlock = record.content?.find((block) => block.type === "text")?.text;
  if (!textBlock) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(textBlock);
    return extractTablesFromParsed(parsed)
      .map(mapTableItem)
      .filter((item): item is SchemaHint => item !== null);
  } catch {
    return [];
  }
}

export function rankTablesByIntent(tables: SchemaHint[], intent: string, limit: number): SchemaHint[] {
  const keywords = intent
    .toLowerCase()
    .split(/\W+/)
    .filter((token) => token.length > 3);

  const ranked = [...tables].sort((left, right) => {
    const leftText = `${left.table} ${left.columns.join(" ")}`.toLowerCase();
    const rightText = `${right.table} ${right.columns.join(" ")}`.toLowerCase();
    const leftScore = keywords.filter((keyword) => leftText.includes(keyword)).length;
    const rightScore = keywords.filter((keyword) => rightText.includes(keyword)).length;
    return rightScore - leftScore;
  });

  if (keywords.length === 0) {
    return ranked.slice(0, limit);
  }

  const matched = ranked.filter((table) => {
    const haystack = `${table.table} ${table.columns.join(" ")}`.toLowerCase();
    return keywords.some((keyword) => haystack.includes(keyword));
  });

  return (matched.length > 0 ? matched : ranked).slice(0, limit);
}
