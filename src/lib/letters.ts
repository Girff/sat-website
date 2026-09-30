// Answer-choice shuffling. A set item stores the order in which the original
// choices are shown; explanations that mention letters ("Choice B is incorrect…")
// are rewritten so they refer to the letters the student actually saw.
import type { Letter, RichContent } from './types';

export const LETTERS: Letter[] = ['A', 'B', 'C', 'D'];

/** order[i] = the original letter shown at position i (display letter LETTERS[i]). */
export type ChoiceOrder = Letter[];

export function shuffled<T>(items: T[], rng: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** original letter → displayed letter */
export function displayMap(order: ChoiceOrder | undefined): Record<Letter, Letter> {
  const m = { A: 'A', B: 'B', C: 'C', D: 'D' } as Record<Letter, Letter>;
  order?.forEach((orig, i) => { m[orig] = LETTERS[i]; });
  return m;
}

export const toDisplay = (order: ChoiceOrder | undefined, orig: Letter): Letter => displayMap(order)[orig];
export const toOriginal = (order: ChoiceOrder | undefined, shown: Letter): Letter => order?.[LETTERS.indexOf(shown)] ?? shown;

const LIST = /\b([Cc]hoices?)(\s+)([A-D](?:(?:,\s*|,?\s+and\s+|,?\s+or\s+)[A-D](?![\w']))*)(?![\w'])/g;

/** Rewrite "Choice A" / "Choices A, C, and D" references in a markup string. */
export function remapText(s: string, map: Record<Letter, Letter>): string {
  return s.replace(LIST, (_m, word: string, sp: string, list: string) => {
    const letters = (list.match(/[A-D]/g) as Letter[]).map((l) => map[l]);
    if (letters.length === 1) return `${word}${sp}${letters[0]}`;
    letters.sort();
    const joiner = /\bor\b/.test(list) ? 'or' : 'and';
    const body = letters.length === 2
      ? `${letters[0]} ${joiner} ${letters[1]}`
      : `${letters.slice(0, -1).join(', ')}, ${joiner} ${letters[letters.length - 1]}`;
    return `${word}${sp}${body}`;
  });
}

export function remapBlocks(blocks: RichContent, map: Record<Letter, Letter>): RichContent {
  if (Object.entries(map).every(([k, v]) => k === v)) return blocks;
  return blocks.map((b) => {
    if (b.kind === 'text') return { ...b, value: remapText(b.value, map) };
    if (b.kind === 'table') {
      return { ...b, headers: b.headers.map((h) => remapText(h, map)), rows: b.rows.map((r) => r.map((c) => remapText(c, map))) };
    }
    return b;
  });
}
