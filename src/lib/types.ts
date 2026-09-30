// Shapes of the files produced by scripts/extract.py (public/data/).

export type Section = 'reading' | 'math';
export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export type QType = 'mcq' | 'spr';
export type Letter = 'A' | 'B' | 'C' | 'D';

/** Text values use a small inline markup: $latex$, <b>, <i>, <u>, <sup>, <sub>,
 *  <br/>, <img src w h alt/>, and &lt; &gt; &amp; entities. Literal dollars are \$. */
export type Block =
  | { kind: 'text'; value: string; style?: 'bullet' | 'center' }
  | { kind: 'math'; latex: string }
  | { kind: 'table'; headers: string[]; rows: string[][]; merged?: [number, number, number, number][] }
  | { kind: 'image'; src: string; alt: string; width: number; height: number; inline?: boolean };

export type RichContent = Block[];

export interface Question {
  id: string;
  section: Section;
  domain: string;
  skill: string;
  difficulty: Difficulty;
  type: QType;
  passage?: RichContent;
  stem: RichContent;
  choices?: { label: Letter; content: RichContent }[];
  correct: string[];
  rationale: { overall: RichContent; perChoice?: Partial<Record<Letter, RichContent>> };
  figures: string[];
  sourcePdf: string;
  sourcePage: number;
  parseConfidence: 'high' | 'low';
  issues?: string[];
  originalImages?: string[];
}

/** One row of index.json: metadata only, enough to render the question table. */
export interface IndexEntry {
  id: string;
  section: Section;
  domain: string;
  skill: string;
  difficulty: Difficulty;
  type: QType;
  preview: string;
  chunk: string;
  low: boolean;
}

export type Taxonomy = Record<Section, {
  count: number;
  domains: Record<string, { count: number; skills: Record<string, number> }>;
}>;

export const SECTION_LABEL: Record<Section, string> = { reading: 'Reading & Writing', math: 'Math' };
export const TYPE_LABEL: Record<QType, string> = { mcq: 'Multiple choice', spr: 'Grid-in' };
export const DIFFICULTIES: Difficulty[] = ['Easy', 'Medium', 'Hard'];
