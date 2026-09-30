// Grading and result summaries for completed problem sets.
import { checkGridIn } from './gridin';
import { PACE, SLOW_FACTOR, type SetConfig, type SetItem } from './sets';
import type { Difficulty, IndexEntry, Question, Section } from './types';

export type Outcome = 'correct' | 'incorrect' | 'unanswered';

export interface TestResult {
  key: string;
  name: string;
  config: SetConfig;
  items: SetItem[];
  /** Original choice letter (MCQ) or the typed answer (grid-in), by question ID. */
  answers: Record<string, string>;
  outcome: Record<string, Outcome>;
  /** Questions marked for review during the test. */
  marked: string[];
  timeMs: Record<string, number>;
  startedAt: number;
  finishedAt: number;
  autoSubmitted: boolean;
}

export function grade(q: Pick<Question, 'type' | 'correct'>, answer: string | undefined): Outcome {
  if (answer === undefined || answer.trim() === '') return 'unanswered';
  if (q.type === 'mcq') return q.correct.includes(answer) ? 'correct' : 'incorrect';
  return checkGridIn(answer, q.correct) ? 'correct' : 'incorrect';
}

export const isSlow = (ms: number | undefined, section: Section) => (ms ?? 0) > PACE[section] * 1000 * SLOW_FACTOR;

export interface Tally {
  correct: number;
  total: number;
}

export interface Summary extends Tally {
  pct: number;
  totalMs: number;
  avgMs: number;
  slow: string[];
  answered: number;
  bySection: Map<Section, Tally>;
  byDomain: Map<string, Tally>;
  bySkill: Map<string, Tally>;
  byDifficulty: Map<Difficulty, Tally>;
}

export const percent = (t: Tally) => (t.total ? Math.round((100 * t.correct) / t.total) : 0);

function add<K>(m: Map<K, Tally>, k: K, ok: boolean) {
  const t = m.get(k) ?? { correct: 0, total: 0 };
  t.total++;
  if (ok) t.correct++;
  m.set(k, t);
}

export function summarize(r: TestResult, byId: Map<string, IndexEntry>): Summary {
  const s: Summary = {
    correct: 0, total: 0, pct: 0, totalMs: Math.max(0, r.finishedAt - r.startedAt), avgMs: 0, slow: [], answered: 0,
    bySection: new Map(), byDomain: new Map(), bySkill: new Map(), byDifficulty: new Map(),
  };
  for (const { id } of r.items) {
    const e = byId.get(id);
    if (!e) continue;
    const ok = r.outcome[id] === 'correct';
    s.total++;
    if (ok) s.correct++;
    if (r.outcome[id] !== 'unanswered') s.answered++;
    add(s.bySection, e.section, ok);
    add(s.byDomain, e.domain, ok);
    add(s.bySkill, e.skill, ok);
    add(s.byDifficulty, e.difficulty, ok);
    if (isSlow(r.timeMs[id], e.section)) s.slow.push(id);
  }
  s.pct = percent(s);
  s.avgMs = s.total ? s.totalMs / s.total : 0;
  return s;
}

/** 75 000 → "1:15"; 3 723 000 → "1:02:03". */
export function formatClock(ms: number): string {
  const t = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = String(t % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** 75 000 → "1 min 15 s"; 9 000 → "9 s". */
export function formatDuration(ms: number): string {
  const t = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = t % 60;
  if (h) return `${h} h ${m} min`;
  if (m) return sec ? `${m} min ${sec} s` : `${m} min`;
  return `${sec} s`;
}
