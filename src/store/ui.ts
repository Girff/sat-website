// Transient UI state shared across pages (not persisted anywhere).
import { create } from 'zustand';
import type { Tab } from '../lib/filters';
import { DEFAULT_CONFIG, MIX_PRESETS, type GenOptions, type SetConfig, type SetItem } from '../lib/sets';

export interface Builder {
  /** null until chosen: starts on the selection when there is one. */
  mode: 'selection' | 'generate' | null;
  /** Which sections of the selection to use (null: follow the bank's tab). */
  include: Tab | null;
  /** Generator options; a null section follows the bank's tab. */
  gen: Omit<GenOptions, 'section'> & { section: Tab | null };
  generated: string[];
  config: SetConfig;
}

export interface PrintJob {
  title: string;
  items: SetItem[];
  answers: boolean;
}

interface UiState {
  /** The question popup: which question, and the table order for Previous/Next. */
  popup: { id: string; order: string[] } | null;
  /** Last question-bank query string, so returning to the bank restores the view. */
  bankQuery: string;
  /** The question last shown in the popup, so the table can move focus to its row. */
  returnTo: string | null;
  builder: Builder;
  printJob: PrintJob | null;
  openPopup: (id: string, order: string[]) => void;
  closePopup: () => void;
  setBankQuery: (q: string) => void;
  setBuilder: (patch: Partial<Builder>) => void;
}

export const useUi = create<UiState>((set) => ({
  popup: null,
  bankQuery: '',
  returnTo: null,
  builder: {
    mode: null,
    include: null,
    gen: { section: null, count: 10, domains: [], skills: [], mix: MIX_PRESETS[1].mix, excludeAnswered: true },
    generated: [],
    config: DEFAULT_CONFIG,
  },
  printJob: null,
  openPopup: (id, order) => set({ popup: { id, order }, returnTo: null }),
  closePopup: () => set((s) => ({ popup: null, returnTo: s.popup?.id ?? null })),
  setBankQuery: (bankQuery) => set({ bankQuery }),
  setBuilder: (patch) => set((s) => ({ builder: { ...s.builder, ...patch } })),
}));

/** The section tab currently chosen in the question bank. */
export function bankTab(bankQuery: string): Tab {
  const t = new URLSearchParams(bankQuery).get('tab');
  return t === 'reading' || t === 'math' ? t : 'both';
}
