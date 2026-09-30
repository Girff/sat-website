// Export/import of session results as a JSON file (the only way results outlive the tab).
// Imported files are untrusted: every field is checked and anything unknown is dropped.
import type { QStatus } from './filters';
import { LETTERS } from './letters';
import type { Outcome, TestResult } from './scoring';
import { DEFAULT_CONFIG, type SetConfig, type SetItem, type TimerMode } from './sets';
import type { Letter } from './types';

export const EXPORT_APP = 'sat-question-bank';
export const EXPORT_VERSION = 1;

export interface ExportFile {
  app: typeof EXPORT_APP;
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  status: Record<string, QStatus>;
  history: TestResult[];
}

export function makeExport(status: Record<string, QStatus>, history: TestResult[], now = new Date()): ExportFile {
  return { app: EXPORT_APP, version: EXPORT_VERSION, exportedAt: now.toISOString(), status, history };
}

export function exportFileName(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `sat-results-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.json`;
}

/** Save a file through the browser's download (nothing is stored by the site). */
export function downloadJson(data: unknown, fileName: string): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: fileName });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ------------------------------------------------------------------ validation
type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : undefined);
const OUTCOMES: Outcome[] = ['correct', 'incorrect', 'unanswered'];
const TIMERS: TimerMode[] = ['off', 'stopwatch', 'countdown', 'custom'];

function readStatus(v: unknown, known: Set<string>): Record<string, QStatus> {
  const out: Record<string, QStatus> = {};
  if (!isObj(v)) return out;
  for (const [id, s] of Object.entries(v)) {
    if (!known.has(id) || !isObj(s)) continue;
    const st: QStatus = {};
    if (s.result === 'correct' || s.result === 'incorrect') st.result = s.result;
    if (s.flagged === true) st.flagged = true;
    if (st.result || st.flagged) out[id] = st;
  }
  return out;
}

function readConfig(v: unknown): SetConfig {
  const c = isObj(v) ? v : {};
  return {
    name: str(c.name) ?? '',
    checkAnswer: c.checkAnswer === true,
    timer: TIMERS.includes(c.timer as TimerMode) ? (c.timer as TimerMode) : DEFAULT_CONFIG.timer,
    customMinutes: isNum(c.customMinutes) && c.customMinutes > 0 ? Math.min(c.customMinutes, 600) : DEFAULT_CONFIG.customMinutes,
    order: c.order === 'shuffled' ? 'shuffled' : 'selected',
    shuffleChoices: c.shuffleChoices === true,
    grouping: c.grouping === 'mixed' ? 'mixed' : 'grouped',
  };
}

function readItem(v: unknown, known: Set<string>): SetItem | null {
  if (!isObj(v) || typeof v.id !== 'string' || !known.has(v.id)) return null;
  const ch = v.choices;
  const valid = Array.isArray(ch) && ch.length === 4 && LETTERS.every((l) => ch.includes(l));
  return valid ? { id: v.id, choices: ch as Letter[] } : { id: v.id };
}

function readResult(v: unknown, known: Set<string>): TestResult | null {
  if (!isObj(v) || typeof v.key !== 'string' || !Array.isArray(v.items)) return null;
  const items = v.items.map((i) => readItem(i, known)).filter((i): i is SetItem => i !== null);
  if (!items.length || !isNum(v.startedAt) || !isNum(v.finishedAt)) return null;
  const ids = new Set(items.map((i) => i.id));
  const answers: Record<string, string> = {};
  const outcome: Record<string, Outcome> = {};
  const timeMs: Record<string, number> = {};
  const a = isObj(v.answers) ? v.answers : {};
  const o = isObj(v.outcome) ? v.outcome : {};
  const t = isObj(v.timeMs) ? v.timeMs : {};
  for (const id of ids) {
    const ans = str(a[id], 12);
    if (ans !== undefined) answers[id] = ans;
    outcome[id] = OUTCOMES.includes(o[id] as Outcome) ? (o[id] as Outcome) : 'unanswered';
    if (isNum(t[id]) && t[id] >= 0) timeMs[id] = t[id];
  }
  return {
    key: v.key.slice(0, 40),
    name: str(v.name) || 'Imported set',
    config: readConfig(v.config),
    items, answers, outcome, timeMs,
    marked: Array.isArray(v.marked) ? v.marked.filter((m): m is string => typeof m === 'string' && ids.has(m)) : [],
    startedAt: v.startedAt,
    finishedAt: Math.max(v.startedAt, v.finishedAt),
    autoSubmitted: v.autoSubmitted === true,
  };
}

export interface Imported {
  status: Record<string, QStatus>;
  history: TestResult[];
  skipped: number;
}

/** Parse and validate an exported results file. Throws an Error with a readable message. */
export function parseImport(text: string, known: Set<string>): Imported {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('This file isn’t valid JSON.');
  }
  if (!isObj(data) || data.app !== EXPORT_APP) throw new Error('This isn’t a results file exported from this site.');
  if (data.version !== EXPORT_VERSION) throw new Error(`Unsupported results file version (${String(data.version)}).`);
  const rawHistory = Array.isArray(data.history) ? data.history : [];
  const history = rawHistory.map((r) => readResult(r, known)).filter((r): r is TestResult => r !== null);
  return { status: readStatus(data.status, known), history, skipped: rawHistory.length - history.length };
}

/** Combine imported results with this session's: statuses from this session win,
 *  flags are kept from both, and sets already present (same key) are not duplicated. */
export function mergeImport(
  status: Record<string, QStatus>, history: TestResult[], imp: Imported,
): { status: Record<string, QStatus>; history: TestResult[]; added: number } {
  const merged: Record<string, QStatus> = { ...imp.status };
  for (const [id, s] of Object.entries(status)) {
    merged[id] = { ...merged[id], ...s, flagged: s.flagged || merged[id]?.flagged || undefined };
    if (!merged[id].flagged) delete merged[id].flagged;
  }
  const keys = new Set(history.map((h) => h.key));
  const fresh = imp.history.filter((h) => !keys.has(h.key));
  const all = [...history, ...fresh].sort((a, b) => a.finishedAt - b.finishedAt);
  return { status: merged, history: all, added: fresh.length };
}
