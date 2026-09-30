import { describe, expect, it } from 'vitest';
import { displayMap, remapBlocks, remapText, shuffled, toOriginal } from './letters';
import { grade, summarize, type TestResult } from './scoring';
import { DEFAULT_CONFIG, allocate, autoName, buildItems, generateSet, generatorPool, practiceSet, timeLimit } from './sets';
import { mergeImport, parseImport } from './transfer';
import type { IndexEntry, Letter } from './types';

const E = (id: string, section: 'reading' | 'math', difficulty: 'Easy' | 'Medium' | 'Hard', skill = 'S1'): IndexEntry => ({
  id, section, difficulty, skill, domain: section === 'math' ? 'Algebra' : 'Craft', type: 'mcq', preview: '', chunk: 'c', low: false,
});
function rng(seed = 1) {
  return () => {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    return seed / 2 ** 31;
  };
}

describe('choice shuffling', () => {
  it('maps letters both ways', () => {
    const order: Letter[] = ['C', 'A', 'D', 'B'];
    expect(displayMap(order)).toEqual({ C: 'A', A: 'B', D: 'C', B: 'D' });
    expect(toOriginal(order, 'A')).toBe('C');
  });

  it('rewrites letter references in explanations', () => {
    const map = displayMap(['C', 'A', 'D', 'B']);
    expect(remapText('Choice C is the best answer. Choice A is incorrect.', map)).toBe('Choice A is the best answer. Choice B is incorrect.');
    expect(remapText('Choices A, B, and D are incorrect', map)).toBe('Choices B, C, and D are incorrect');
    expect(remapText('choices A and B are wrong; Choice Ada', map)).toBe('choices B and D are wrong; Choice Ada');
    expect(remapBlocks([{ kind: 'text', value: 'Choice D' }, { kind: 'math', latex: 'D' }], map))
      .toEqual([{ kind: 'text', value: 'Choice C' }, { kind: 'math', latex: 'D' }]);
  });

  it('shuffles without losing items', () => {
    expect(shuffled([1, 2, 3, 4, 5], rng()).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('problem sets', () => {
  const entries = [E('r1', 'reading', 'Easy'), E('m1', 'math', 'Hard'), E('r2', 'reading', 'Hard'), E('m2', 'math', 'Hard', 'S2')];

  it('names sets and paces countdowns', () => {
    expect(autoName([entries[1], entries[3]])).toBe('Math – Hard – 2 Qs');
    expect(autoName(entries)).toBe('R&W + Math – Mixed – 4 Qs');
    expect(autoName([entries[0], entries[2]])).toBe('S1 – Mixed – 2 Qs');
    expect(timeLimit({ ...DEFAULT_CONFIG, timer: 'countdown' }, entries)).toBe(71 * 2 + 95 * 2);
    expect(timeLimit({ ...DEFAULT_CONFIG, timer: 'custom', customMinutes: 12 }, entries)).toBe(720);
    expect(timeLimit({ ...DEFAULT_CONFIG, timer: 'stopwatch' }, entries)).toBeNull();
  });

  it('groups Reading & Writing before Math unless mixed', () => {
    expect(buildItems(entries, DEFAULT_CONFIG).map((i) => i.id)).toEqual(['r1', 'r2', 'm1', 'm2']);
    expect(buildItems(entries, { ...DEFAULT_CONFIG, grouping: 'mixed' }).map((i) => i.id)).toEqual(['r1', 'm1', 'r2', 'm2']);
    const shuffledChoices = buildItems(entries, { ...DEFAULT_CONFIG, shuffleChoices: true }, rng());
    expect(shuffledChoices.every((i) => i.choices?.length === 4)).toBe(true);
  });

  it('allocates a difficulty mix exactly', () => {
    expect(allocate(10, { Easy: 30, Medium: 40, Hard: 30 })).toEqual({ Easy: 3, Medium: 4, Hard: 3 });
    expect(allocate(7, { Easy: 30, Medium: 40, Hard: 30 })).toEqual({ Easy: 2, Medium: 3, Hard: 2 });
  });

  it('generates from the pool, filling short difficulties from others', () => {
    const pool = generatorPool(entries, { section: 'math', domains: [], skills: [], excludeAnswered: true }, new Set(['m2']));
    expect(pool.map((e) => e.id)).toEqual(['m1']);
    const set = generateSet(entries, 3, { Easy: 100, Medium: 0, Hard: 0 }, rng());
    expect(set).toHaveLength(3);
    expect(set.some((e) => e.id === 'r1')).toBe(true);
    expect(new Set(set.map((e) => e.id)).size).toBe(3);
  });

  it('builds practice sets across skills, skipping seen questions', () => {
    const set = practiceSet(entries, ['S1', 'S2'], new Set(['r1']), 10, rng());
    expect(set.map((e) => e.id).sort()).toEqual(['m1', 'm2', 'r2']);
    expect(practiceSet(entries, ['S1', 'S2'], new Set(), 2, rng()).map((e) => e.skill).sort()).toEqual(['S1', 'S2']);
  });
});

describe('results', () => {
  const byId = new Map([E('a', 'math', 'Easy'), E('b', 'math', 'Hard'), E('c', 'reading', 'Hard')].map((e) => [e.id, e]));
  const result: TestResult = {
    key: 'k1', name: 'Set', config: DEFAULT_CONFIG, items: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    answers: { a: 'B', b: '3/4' }, outcome: { a: 'correct', b: 'incorrect', c: 'unanswered' },
    marked: ['b'], timeMs: { a: 30_000, b: 200_000, c: 5_000 }, startedAt: 0, finishedAt: 240_000, autoSubmitted: false,
  };

  it('grades answers', () => {
    expect(grade({ type: 'mcq', correct: ['B'] }, 'B')).toBe('correct');
    expect(grade({ type: 'mcq', correct: ['B'] }, 'C')).toBe('incorrect');
    expect(grade({ type: 'spr', correct: ['.5', '1/2'] }, '2/4')).toBe('correct');
    expect(grade({ type: 'spr', correct: ['1/2'] }, '  ')).toBe('unanswered');
  });

  it('summarizes by category and flags slow questions', () => {
    const s = summarize(result, byId);
    expect([s.correct, s.total, s.pct, s.answered]).toEqual([1, 3, 33, 2]);
    expect(s.byDifficulty.get('Hard')).toEqual({ correct: 0, total: 2 });
    expect(s.slow).toEqual(['b']);
    expect(s.avgMs).toBe(80_000);
  });

  it('round-trips an export and rejects bad files', () => {
    const known = new Set(['a', 'b', 'c']);
    const file = JSON.stringify({ app: 'sat-question-bank', version: 1, exportedAt: '', status: { a: { result: 'correct' }, zz: { result: 'correct' } }, history: [result, { key: 1 }] });
    const imp = parseImport(file, known);
    expect(imp.status).toEqual({ a: { result: 'correct' } });
    expect(imp.history).toHaveLength(1);
    expect(imp.history[0].outcome).toEqual(result.outcome);
    expect(imp.skipped).toBe(1);
    expect(() => parseImport('nope', known)).toThrow(/JSON/);
    expect(() => parseImport('{"app":"other"}', known)).toThrow(/results file/);

    const merged = mergeImport({ a: { result: 'incorrect', flagged: true } }, [result], imp);
    expect(merged.status.a).toEqual({ result: 'incorrect', flagged: true });
    expect(merged.added).toBe(0);
  });
});
