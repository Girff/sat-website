// Problem sets: options, default names, SAT pacing, ordering and the random generator.
import type { Tab } from './filters';
import { LETTERS, shuffled, type ChoiceOrder } from './letters';
import { DIFFICULTIES, SECTION_LABEL, type Difficulty, type IndexEntry, type Section } from './types';

/** Official digital SAT pacing, in seconds per question. */
export const PACE: Record<Section, number> = { reading: 71, math: 95 };
/** A question is "slow" when it took this many times the SAT pace. */
export const SLOW_FACTOR = 1.5;

export type TimerMode = 'off' | 'stopwatch' | 'countdown' | 'custom';

export interface SetConfig {
  name: string;
  checkAnswer: boolean;
  timer: TimerMode;
  customMinutes: number;
  order: 'selected' | 'shuffled';
  shuffleChoices: boolean;
  /** For sets with both sections: Reading & Writing first, then Math, or mixed. */
  grouping: 'grouped' | 'mixed';
}

export const DEFAULT_CONFIG: SetConfig = {
  name: '', checkAnswer: false, timer: 'countdown', customMinutes: 30,
  order: 'selected', shuffleChoices: false, grouping: 'grouped',
};

export interface SetItem {
  id: string;
  /** Shuffled answer-choice order (original letters in display order), if shuffled. */
  choices?: ChoiceOrder;
}

const one = <T,>(xs: T[]): T | undefined => (xs.length && xs.every((x) => x === xs[0]) ? xs[0] : undefined);

/** e.g. "Math – Hard – 20 Qs", "Reading & Writing – Mixed – 12 Qs". */
export function autoName(entries: IndexEntry[]): string {
  if (!entries.length) return 'Problem set';
  const section = one(entries.map((e) => e.section));
  const skill = one(entries.map((e) => e.skill));
  const diff = one(entries.map((e) => e.difficulty));
  const first = skill ?? (section ? SECTION_LABEL[section] : 'R&W + Math');
  return `${first} – ${diff ?? 'Mixed'} – ${entries.length} Q${entries.length === 1 ? '' : 's'}`;
}

export function pacedSeconds(entries: Pick<IndexEntry, 'section'>[]): number {
  return entries.reduce((t, e) => t + PACE[e.section], 0);
}

/** Countdown length in seconds, or null when the set is not on a countdown. */
export function timeLimit(config: SetConfig, entries: Pick<IndexEntry, 'section'>[]): number | null {
  if (config.timer === 'countdown') return pacedSeconds(entries);
  if (config.timer === 'custom') return Math.max(1, Math.round(config.customMinutes * 60));
  return null;
}

export const hasBothSections = (entries: Pick<IndexEntry, 'section'>[]) =>
  entries.some((e) => e.section === 'reading') && entries.some((e) => e.section === 'math');

/** Order the questions and (optionally) shuffle each question's answer choices. */
export function buildItems(entries: IndexEntry[], config: SetConfig, rng: () => number = Math.random): SetItem[] {
  let list = config.order === 'shuffled' ? shuffled(entries, rng) : [...entries];
  if (config.grouping === 'grouped' && hasBothSections(list)) {
    list = [...list.filter((e) => e.section === 'reading'), ...list.filter((e) => e.section === 'math')];
  }
  return list.map((e) => (config.shuffleChoices && e.type === 'mcq' ? { id: e.id, choices: shuffled(LETTERS, rng) } : { id: e.id }));
}

// ------------------------------------------------------------------ generator
export type Mix = Record<Difficulty, number>;
export const MIX_PRESETS: { label: string; mix: Mix | null }[] = [
  { label: 'Any', mix: null },
  { label: 'Balanced', mix: { Easy: 30, Medium: 40, Hard: 30 } },
  { label: 'Warm-up', mix: { Easy: 60, Medium: 30, Hard: 10 } },
  { label: 'Challenge', mix: { Easy: 10, Medium: 30, Hard: 60 } },
];

export interface GenOptions {
  section: Tab;
  count: number;
  domains: string[];
  skills: string[];
  /** Percentages per difficulty (summing to 100), or null for no preference. */
  mix: Mix | null;
  excludeAnswered: boolean;
}

export function generatorPool(entries: IndexEntry[], o: Omit<GenOptions, 'count' | 'mix'>, answered: Set<string>): IndexEntry[] {
  return entries.filter((e) =>
    (o.section === 'both' || e.section === o.section)
    && (!o.domains.length || o.domains.includes(e.domain))
    && (!o.skills.length || o.skills.includes(e.skill))
    && !(o.excludeAnswered && answered.has(e.id)));
}

/** Split `count` by percentages, rounding so the parts add up exactly (largest remainder). */
export function allocate(count: number, mix: Mix): Record<Difficulty, number> {
  const total = DIFFICULTIES.reduce((t, d) => t + Math.max(0, mix[d]), 0) || 1;
  const raw = DIFFICULTIES.map((d) => (count * Math.max(0, mix[d])) / total);
  const out = raw.map(Math.floor);
  let left = count - out.reduce((a, b) => a + b, 0);
  const byRemainder = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of byRemainder) {
    if (left <= 0) break;
    out[i]++;
    left--;
  }
  return { Easy: out[0], Medium: out[1], Hard: out[2] };
}

/** Pick questions at random from the pool, following the difficulty mix where the pool allows.
 *  When a difficulty runs short, the remaining places are filled from the other difficulties. */
export function generateSet(pool: IndexEntry[], count: number, mix: Mix | null, rng: () => number = Math.random): IndexEntry[] {
  const n = Math.min(count, pool.length);
  if (!mix) return shuffled(pool, rng).slice(0, n);
  const want = allocate(n, mix);
  const picked: IndexEntry[] = [];
  const rest: IndexEntry[] = [];
  for (const d of DIFFICULTIES) {
    const bucket = shuffled(pool.filter((e) => e.difficulty === d), rng);
    picked.push(...bucket.slice(0, want[d]));
    rest.push(...bucket.slice(want[d]));
  }
  picked.push(...shuffled(rest, rng).slice(0, n - picked.length));
  return shuffled(picked, rng);
}

/** Unique enough for in-session keys (no storage, so no collisions across sessions matter). */
export const newKey = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Pick up to `count` questions from the given skills, spread evenly across them,
 *  skipping `exclude` (e.g. questions already seen). */
export function practiceSet(entries: IndexEntry[], skills: string[], exclude: Set<string>, count: number, rng: () => number = Math.random): IndexEntry[] {
  const bySkill = skills.map((s) => shuffled(entries.filter((e) => e.skill === s && !exclude.has(e.id)), rng));
  const out: IndexEntry[] = [];
  for (let round = 0; out.length < count && bySkill.some((b) => b.length > round); round++) {
    for (const b of bySkill) if (b[round] && out.length < count) out.push(b[round]);
  }
  return shuffled(out, rng);
}
