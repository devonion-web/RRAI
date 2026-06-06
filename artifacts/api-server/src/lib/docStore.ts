import { randomUUID } from "crypto";
import type { ParsedRow } from "./xlsxParser";

export interface DocEntry {
  id: string;
  name: string;
  // Text documents (PDF, Word, pasted text)
  text?: string;
  charCount: number;
  // Structured documents (Excel/spreadsheets)
  structuredRows?: ParsedRow[];
  rowCount?: number;
  fileType: "text" | "excel";
  storedAt: number;
}

const STORE = new Map<string, DocEntry>();
const TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of STORE) {
    if (now - entry.storedAt > TTL_MS) STORE.delete(id);
  }
}, 30 * 60 * 1000);

export function storeTextDoc(name: string, text: string): DocEntry {
  const id = randomUUID();
  const entry: DocEntry = {
    id, name,
    text: text.trim(),
    charCount: text.trim().length,
    fileType: "text",
    storedAt: Date.now(),
  };
  STORE.set(id, entry);
  return entry;
}

export function storeExcelDoc(name: string, rows: ParsedRow[]): DocEntry {
  const id = randomUUID();
  const entry: DocEntry = {
    id, name,
    charCount: 0,
    structuredRows: rows,
    rowCount: rows.length,
    fileType: "excel",
    storedAt: Date.now(),
  };
  STORE.set(id, entry);
  return entry;
}

// Backward-compat alias
export const storeDoc = storeTextDoc;

export function getDoc(id: string): DocEntry | null {
  const entry = STORE.get(id);
  if (!entry) return null;
  if (Date.now() - entry.storedAt > TTL_MS) { STORE.delete(id); return null; }
  return entry;
}

export function getDocs(ids: string[]): DocEntry[] {
  return ids.flatMap((id) => { const e = getDoc(id); return e ? [e] : []; });
}

export function removeDoc(id: string): void {
  STORE.delete(id);
}

export function storeSize(): number {
  return STORE.size;
}
