// In-memory session state. Nothing here is written to localStorage, cookies or
// IndexedDB: closing the tab clears it (results can be exported as a file later).
import { create } from 'zustand';
import type { QStatus } from '../lib/filters';
import type { TestResult } from '../lib/scoring';

type Theme = 'light' | 'dark';

interface SessionState {
  status: Record<string, QStatus>;
  selected: Set<string>;
  theme: Theme;
  textScale: number;
  /** Completed problem sets, oldest first. */
  history: TestResult[];
  /** True when results changed since the last export (warns before closing the tab). */
  dirty: boolean;
  toggleSelected: (id: string) => void;
  setSelected: (ids: string[], on: boolean) => void;
  clearSelection: () => void;
  toggleFlag: (id: string) => void;
  recordResult: (id: string, correct: boolean) => void;
  setTheme: (t: Theme) => void;
  setTextScale: (s: number) => void;
  addResult: (r: TestResult) => void;
  replaceResults: (status: Record<string, QStatus>, history: TestResult[]) => void;
  markExported: () => void;
}

export const TEXT_SCALES = [0.9, 1, 1.125, 1.25, 1.4];

const systemTheme = (): Theme =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

export const useSession = create<SessionState>((set) => ({
  status: {},
  selected: new Set(),
  theme: systemTheme(),
  textScale: 1,
  history: [],
  dirty: false,
  toggleSelected: (id) => set((s) => {
    const next = new Set(s.selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return { selected: next };
  }),
  setSelected: (ids, on) => set((s) => {
    const next = new Set(s.selected);
    for (const id of ids) {
      if (on) next.add(id);
      else next.delete(id);
    }
    return { selected: next };
  }),
  clearSelection: () => set({ selected: new Set() }),
  toggleFlag: (id) => set((s) => ({ dirty: true, status: { ...s.status, [id]: { ...s.status[id], flagged: !s.status[id]?.flagged } } })),
  recordResult: (id, correct) => set((s) => ({
    dirty: true,
    status: { ...s.status, [id]: { ...s.status[id], result: correct ? 'correct' : 'incorrect' } },
  })),
  // Answered questions take the test's result; questions marked for review become flagged.
  addResult: (r) => set((s) => {
    const status = { ...s.status };
    for (const { id } of r.items) {
      const o = r.outcome[id];
      if (o === 'correct' || o === 'incorrect') status[id] = { ...status[id], result: o };
    }
    for (const id of r.marked) status[id] = { ...status[id], flagged: true };
    return { status, history: [...s.history, r], dirty: true };
  }),
  replaceResults: (status, history) => set({ status, history }),
  markExported: () => set({ dirty: false }),
  setTheme: (theme) => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    set({ theme });
  },
  setTextScale: (textScale) => {
    document.documentElement.style.setProperty('--text-scale', String(textScale));
    set({ textScale });
  },
}));
