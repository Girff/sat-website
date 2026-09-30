// Data loading. Only index.json is fetched on first load; question chunks and
// the full-text search file are fetched lazily and cached in memory.
import type { IndexEntry, Question, Taxonomy } from './types';

export const DATA_BASE = `${import.meta.env.BASE_URL}data/`;
export const dataUrl = (path: string) => DATA_BASE + path;

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(dataUrl(path));
  if (!res.ok) throw new Error(`Could not load ${path} (${res.status})`);
  return res.json() as Promise<T>;
}

let indexPromise: Promise<IndexEntry[]> | null = null;
export function loadIndex(): Promise<IndexEntry[]> {
  indexPromise ??= getJson<IndexEntry[]>('index.json');
  return indexPromise;
}

let taxonomyPromise: Promise<Taxonomy> | null = null;
export function loadTaxonomy(): Promise<Taxonomy> {
  taxonomyPromise ??= getJson<Taxonomy>('taxonomy.json');
  return taxonomyPromise;
}

const chunkCache = new Map<string, Promise<Map<string, Question>>>();
export function loadChunk(chunk: string): Promise<Map<string, Question>> {
  let p = chunkCache.get(chunk);
  if (!p) {
    p = getJson<Question[]>(`questions/${chunk}.json`).then((qs) => new Map(qs.map((q) => [q.id, q])));
    p.catch(() => chunkCache.delete(chunk));   // allow a retry after a failed fetch
    chunkCache.set(chunk, p);
  }
  return p;
}

/** Fetch one question (its whole chunk is fetched and cached). */
export async function loadQuestion(entry: Pick<IndexEntry, 'id' | 'chunk'>): Promise<Question> {
  const q = (await loadChunk(entry.chunk)).get(entry.id);
  if (!q) throw new Error(`Question ${entry.id} is missing from ${entry.chunk}`);
  return q;
}

/** Warm the cache for chunks we are likely to need soon (e.g. the next test question). */
export function prefetchChunks(chunks: Iterable<string>): void {
  for (const c of new Set(chunks)) void loadChunk(c).catch(() => undefined);
}

let searchPromise: Promise<Record<string, string>> | null = null;
/** Lower-cased plain text of each question's passage, stem and choices. */
export function loadSearchText(): Promise<Record<string, string>> {
  searchPromise ??= getJson<Record<string, string>>('search.json');
  searchPromise.catch(() => { searchPromise = null; });
  return searchPromise;
}
