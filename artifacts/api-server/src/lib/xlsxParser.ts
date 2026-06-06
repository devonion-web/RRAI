import * as XLSX from "xlsx";

export interface ParsedRow {
  sheetName: string;
  rowIndex: number;
  id?: string;
  requirement: string;
  category?: string;
  subcategory?: string;
  priority?: string;
  response?: string;
}

// Keywords that indicate a column holds requirement/question text
const REQ_PATTERNS = [
  /requirement/i, /question/i, /description/i, /capability/i,
  /criteria/i, /criterion/i, /statement/i, /item/i, /need/i,
  /feature/i, /functional/i, /control/i, /objective/i,
];

const FIELD_MAP: Record<string, RegExp[]> = {
  id:          [/^(id|ref|no\.?|#|req\.?\s*(id|no|ref)|item\s*(no|id|ref))$/i],
  category:    [/categor/i, /section/i, /domain/i, /area/i, /module/i, /workstream/i, /phase/i, /group/i, /topic/i],
  subcategory: [/sub.?categor/i, /sub.?section/i, /sub.?area/i, /sub.?topic/i],
  priority:    [/priorit/i, /mandatory/i, /must.have/i, /importance/i, /weight/i, /critical/i, /tier/i, /level/i],
  response:    [/response/i, /answer/i, /comment/i, /note/i, /supplier/i, /vendor.res/i],
};

function matchesAny(header: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(header.trim()));
}

function findReqColumn(headers: string[]): number {
  // Prefer exact requirement/question keywords first
  for (const p of REQ_PATTERNS) {
    const idx = headers.findIndex((h) => p.test(h.trim()));
    if (idx !== -1) return idx;
  }
  // Fall back: longest non-empty header (likely the main text column)
  let best = -1;
  let bestLen = 0;
  headers.forEach((h, i) => {
    if (h.trim().length > bestLen) { bestLen = h.trim().length; best = i; }
  });
  return best;
}

function findFieldColumn(headers: string[], field: string): number {
  const patterns = FIELD_MAP[field] ?? [];
  return headers.findIndex((h) => matchesAny(h, patterns));
}

function isGarbageRow(val: string): boolean {
  if (!val || val.trim().length < 4) return true;
  // Skip rows that look like repeated headers or totals
  const lower = val.toLowerCase().trim();
  if (/^(total|subtotal|grand total|n\/a|na|tbd|none|null)$/.test(lower)) return true;
  return false;
}

export interface ExcelParseResult {
  rows: ParsedRow[];
  sheets: string[];
  columnsDetected: string[];
  totalRawRows: number;
  usefulRows: number;
}

export function parseExcelForRequirements(buffer: Buffer): ExcelParseResult {
  const wb = XLSX.read(buffer, { type: "buffer", sheetRows: 5000 }); // cap at 5000 rows per sheet
  const allRows: ParsedRow[] = [];
  const sheetsUsed: string[] = [];
  const columnsDetected = new Set<string>();
  let totalRawRows = 0;

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;

    const json = XLSX.utils.sheet_to_json<Record<string, string>>(ws, {
      defval: "",
      raw: false,
    });

    if (json.length < 2) continue; // skip near-empty sheets
    totalRawRows += json.length;

    const headers = Object.keys(json[0]);
    if (headers.length < 2) continue;

    const reqCol = findReqColumn(headers);
    if (reqCol === -1) continue;

    const reqHeader = headers[reqCol];
    const idCol = findFieldColumn(headers, "id");
    const catCol = findFieldColumn(headers, "category");
    const subCatCol = findFieldColumn(headers, "subcategory");
    const priCol = findFieldColumn(headers, "priority");
    const resCol = findFieldColumn(headers, "response");

    if (catCol !== -1) columnsDetected.add("category");
    if (priCol !== -1) columnsDetected.add("priority");
    if (resCol !== -1) columnsDetected.add("response");
    if (idCol !== -1) columnsDetected.add("id");
    columnsDetected.add("requirement");
    sheetsUsed.push(sheetName);

    json.forEach((row, rowIdx) => {
      const reqText = String(row[reqHeader] ?? "").trim();
      if (isGarbageRow(reqText)) return;

      const parsed: ParsedRow = {
        sheetName,
        rowIndex: rowIdx + 2, // 1-indexed + header row
        requirement: reqText,
      };

      if (idCol !== -1) {
        const v = String(row[headers[idCol]] ?? "").trim();
        if (v) parsed.id = v;
      }
      if (catCol !== -1) {
        const v = String(row[headers[catCol]] ?? "").trim();
        if (v) parsed.category = v;
      }
      if (subCatCol !== -1) {
        const v = String(row[headers[subCatCol]] ?? "").trim();
        if (v) parsed.subcategory = v;
      }
      if (priCol !== -1) {
        const v = String(row[headers[priCol]] ?? "").trim();
        if (v) parsed.priority = v;
      }
      if (resCol !== -1) {
        const v = String(row[headers[resCol]] ?? "").trim();
        if (v) parsed.response = v;
      }

      allRows.push(parsed);
    });
  }

  return {
    rows: allRows,
    sheets: sheetsUsed,
    columnsDetected: [...columnsDetected],
    totalRawRows,
    usefulRows: allRows.length,
  };
}

/** Split rows into batches of batchSize */
export function batchRows<T>(rows: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < rows.length; i += batchSize) {
    batches.push(rows.slice(i, i + batchSize));
  }
  return batches;
}

/** Split a long string into chunks of ~maxChars, breaking on newlines where possible */
export function chunkText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = start + maxChars;
    if (end < text.length) {
      // Try to break on a newline
      const nlIdx = text.lastIndexOf("\n", end);
      if (nlIdx > start + maxChars * 0.5) end = nlIdx + 1;
    }
    chunks.push(text.slice(start, end));
    start = end;
  }
  return chunks;
}
