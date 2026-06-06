import { randomUUID } from "crypto";

export interface DocEntry {
  id: string;
  name: string;
  text: string;
  charCount: number;
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

export function storeDoc(name: string, text: string): DocEntry {
  const id = randomUUID();
  const entry: DocEntry = { id, name, text, charCount: text.length, storedAt: Date.now() };
  STORE.set(id, entry);
  return entry;
}

export function getDoc(id: string): DocEntry | null {
  const entry = STORE.get(id);
  if (!entry) return null;
  if (Date.now() - entry.storedAt > TTL_MS) { STORE.delete(id); return null; }
  return entry;
}

export function getDocs(ids: string[]): DocEntry[] {
  return ids.flatMap((id) => {
    const e = getDoc(id);
    return e ? [e] : [];
  });
}

export function removeDoc(id: string): void {
  STORE.delete(id);
}

export function storeSize(): number {
  return STORE.size;
}
