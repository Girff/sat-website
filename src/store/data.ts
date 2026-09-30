// Loaded bank data: the index (always) and the full-text search map (on demand).
import { create } from 'zustand';
import { loadIndex, loadSearchText } from '../lib/data';
import type { IndexEntry } from '../lib/types';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface DataState {
  entries: IndexEntry[];
  byId: Map<string, IndexEntry>;
  status: LoadStatus;
  error: string | null;
  fullText: Map<string, string> | null;
  fullTextStatus: LoadStatus;
  load: () => Promise<void>;
  loadFullText: () => Promise<void>;
}

export const useData = create<DataState>((set, get) => ({
  entries: [],
  byId: new Map(),
  status: 'idle',
  error: null,
  fullText: null,
  fullTextStatus: 'idle',
  async load() {
    if (get().status === 'loading' || get().status === 'ready') return;
    set({ status: 'loading', error: null });
    try {
      const entries = await loadIndex();
      set({ entries, byId: new Map(entries.map((e) => [e.id, e])), status: 'ready' });
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : String(e) });
    }
  },
  async loadFullText() {
    if (get().fullTextStatus === 'loading' || get().fullTextStatus === 'ready') return;
    set({ fullTextStatus: 'loading' });
    try {
      const text = await loadSearchText();
      set({ fullText: new Map(Object.entries(text)), fullTextStatus: 'ready' });
    } catch {
      set({ fullTextStatus: 'error' });
    }
  },
}));
