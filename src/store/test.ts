// The problem set being taken right now (one at a time, in memory only).
import { create } from 'zustand';
import { loadQuestion, prefetchChunks } from '../lib/data';
import { navigate } from '../lib/router';
import { grade, type Outcome, type TestResult } from '../lib/scoring';
import { buildItems, newKey, timeLimit, type SetConfig, type SetItem } from '../lib/sets';
import type { IndexEntry, Letter } from '../lib/types';
import { useData } from './data';
import { useSession } from './session';

/** Character ranges highlighted in a passage. */
export type Ranges = [number, number][];

export interface ActiveTest {
  key: string;
  name: string;
  config: SetConfig;
  items: SetItem[];
  startedAt: number;
  /** Countdown end time (ms since epoch), or null without a countdown. */
  deadline: number | null;
  current: number;
  /** When the current question was shown, or null while the test page is closed. */
  enteredAt: number | null;
  answers: Record<string, string>;
  eliminated: Record<string, Letter[]>;
  marked: Record<string, boolean>;
  timeMs: Record<string, number>;
  highlights: Record<string, Ranges>;
}

interface TestState {
  test: ActiveTest | null;
  submitting: boolean;
  goTo: (i: number) => void;
  answer: (id: string, value: string | undefined) => void;
  toggleEliminated: (id: string, letter: Letter) => void;
  toggleMarked: (id: string) => void;
  setHighlights: (id: string, ranges: Ranges) => void;
  /** Pause/resume per-question timing while the test page is closed. */
  suspend: () => void;
  resume: () => void;
  abandon: () => void;
}

/** Add the time spent on the current question since it was shown. */
function accrue(t: ActiveTest, now: number): Record<string, number> {
  if (t.enteredAt === null) return t.timeMs;
  const id = t.items[t.current]?.id;
  if (!id) return t.timeMs;
  return { ...t.timeMs, [id]: (t.timeMs[id] ?? 0) + Math.max(0, now - t.enteredAt) };
}

function prefetchAround(t: ActiveTest, i: number) {
  const byId = useData.getState().byId;
  const chunks = t.items.slice(i, i + 3).map((it) => byId.get(it.id)?.chunk).filter((c): c is string => !!c);
  prefetchChunks(chunks);
}

export const useTest = create<TestState>((set, get) => ({
  test: null,
  submitting: false,
  goTo: (i) => {
    const t = get().test;
    if (!t || i < 0 || i >= t.items.length || i === t.current) return;
    const now = Date.now();
    set({ test: { ...t, timeMs: accrue(t, now), current: i, enteredAt: t.enteredAt === null ? null : now } });
    prefetchAround(t, i);
  },
  answer: (id, value) => set((s) => {
    if (!s.test) return s;
    const answers = { ...s.test.answers };
    if (value === undefined || value === '') delete answers[id];
    else answers[id] = value;
    // choosing a crossed-out answer un-crosses it, as in Bluebook
    const el = s.test.eliminated[id];
    const eliminated = el && value && el.includes(value as Letter)
      ? { ...s.test.eliminated, [id]: el.filter((l) => l !== value) } : s.test.eliminated;
    return { test: { ...s.test, answers, eliminated } };
  }),
  toggleEliminated: (id, letter) => set((s) => {
    if (!s.test) return s;
    const cur = s.test.eliminated[id] ?? [];
    const on = !cur.includes(letter);
    const answers = { ...s.test.answers };
    if (on && answers[id] === letter) delete answers[id];
    return {
      test: {
        ...s.test, answers,
        eliminated: { ...s.test.eliminated, [id]: on ? [...cur, letter] : cur.filter((l) => l !== letter) },
      },
    };
  }),
  toggleMarked: (id) => set((s) => (s.test ? { test: { ...s.test, marked: { ...s.test.marked, [id]: !s.test.marked[id] } } } : s)),
  setHighlights: (id, ranges) => set((s) => (s.test ? { test: { ...s.test, highlights: { ...s.test.highlights, [id]: ranges } } } : s)),
  suspend: () => set((s) => (s.test && s.test.enteredAt !== null
    ? { test: { ...s.test, timeMs: accrue(s.test, Date.now()), enteredAt: null } } : s)),
  resume: () => set((s) => (s.test && s.test.enteredAt === null ? { test: { ...s.test, enteredAt: Date.now() } } : s)),
  abandon: () => set({ test: null, submitting: false }),
}));

/** Build a set from index entries and open the test page. */
export function startTest(entries: IndexEntry[], config: SetConfig): void {
  if (!entries.length) return;
  const items = buildItems(entries, config);
  const now = Date.now();
  const limit = timeLimit(config, entries);
  const test: ActiveTest = {
    key: newKey(), name: config.name.trim() || 'Problem set', config, items,
    startedAt: now, deadline: limit === null ? null : now + limit * 1000,
    current: 0, enteredAt: null, answers: {}, eliminated: {}, marked: {}, timeMs: {}, highlights: {},
  };
  useTest.setState({ test, submitting: false });
  prefetchAround(test, 0);
  navigate('/test');
}

/** Grade the active test, add it to the session history and open its results. */
export async function submitTest(autoSubmitted = false): Promise<void> {
  const { test, submitting } = useTest.getState();
  if (!test || submitting) return;
  useTest.setState({ submitting: true });
  const finishedAt = Date.now();
  const byId = useData.getState().byId;
  try {
    const questions = await Promise.all(test.items.map(({ id }) => loadQuestion(byId.get(id) ?? { id, chunk: '' })));
    const outcome: Record<string, Outcome> = {};
    questions.forEach((q) => { outcome[q.id] = grade(q, test.answers[q.id]); });
    const result: TestResult = {
      key: test.key, name: test.name, config: test.config, items: test.items,
      answers: test.answers, outcome,
      marked: test.items.map((i) => i.id).filter((id) => test.marked[id]),
      timeMs: accrue(test, finishedAt), startedAt: test.startedAt, finishedAt, autoSubmitted,
    };
    useSession.getState().addResult(result);
    navigate(`/results/${result.key}`);          // before clearing, so the results render directly
    useTest.setState({ test: null, submitting: false });
  } catch (e) {
    useTest.setState({ submitting: false });
    throw e;
  }
}
