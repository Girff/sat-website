// Student-produced response (grid-in) answers, checked the way the SAT scores them:
// any listed answer is accepted in an equivalent form (3/4 = .75 = 0.75 = 6/8), and a
// non-terminating value may be entered as a decimal that fills the answer space,
// either truncated or rounded (2/3 → .6666, .6667, 0.666, 0.667).

/** Exact value n/d (d > 0). Grid-in values are small, so plain numbers are exact. */
export interface Rational {
  n: number;
  d: number;
}

/** The answer space: 5 characters for positive answers, 6 with a leading minus sign. */
export const decimalSpace = (s: string) => (normalize(s).startsWith('-') ? 6 : 5);
/** Longest answer the input box accepts (the official answer lists include 7-character
 *  fractions such as 451/100 and -49/150). */
export const MAX_INPUT = 7;

export function normalize(s: string): string {
  return s.trim().replace(/[−–]/g, '-');
}

const DECIMAL = /^(-?)(\d*)\.?(\d*)$/;
const FRACTION = /^(-?)(\d+)\/(\d+)$/;

export function parseGridIn(raw: string): Rational | null {
  const s = normalize(raw);
  const f = FRACTION.exec(s);
  if (f) {
    const d = Number(f[3]);
    if (d === 0) return null;
    return { n: (f[1] ? -1 : 1) * Number(f[2]), d };
  }
  const m = DECIMAL.exec(s);
  if (!m || (!m[2] && !m[3])) return null;
  const d = 10 ** m[3].length;
  return { n: (m[1] ? -1 : 1) * Number((m[2] || '0') + m[3]), d };
}

const isDecimal = (s: string) => !normalize(s).includes('/');
const decimals = (s: string) => normalize(s).split('.')[1]?.length ?? 0;
const equal = (a: Rational, b: Rational) => a.n * b.d === b.n * a.d;

/** Does a decimal fill the whole answer space (so it may be a cut-off value)? */
const fillsSpace = (s: string) => normalize(s).length === decimalSpace(s);

/** Is `input` the value of `exact` truncated or rounded to the input's decimal places? */
function approximates(input: string, v: Rational, exact: Rational): boolean {
  const scale = 10 ** decimals(input);
  const sign = Math.sign(exact.n) || 1;
  const mag = Math.abs(exact.n) * scale;
  const trunc = Math.floor(mag / exact.d);
  const round = Math.floor((2 * mag + exact.d) / (2 * exact.d));
  return [trunc, round].some((k) => equal(v, { n: sign * k, d: scale }));
}

/** Is the entered answer one of the accepted answers? */
export function checkGridIn(input: string, correct: string[]): boolean {
  const v = parseGridIn(input);
  if (!v) return false;
  for (const form of correct) {
    const c = parseGridIn(form);
    if (!c) {
      if (normalize(form) === normalize(input)) return true;
      continue;
    }
    if (equal(v, c)) return true;
    if (!isDecimal(form) && isDecimal(input) && fillsSpace(input) && decimals(input) > 0 && approximates(input, v, c)) return true;
  }
  return false;
}

/** A message explaining why an answer can't be entered this way, or null if it's fine. */
export function gridInError(raw: string): string | null {
  const s = normalize(raw);
  if (!s) return null;
  if (/\d\s+\d+\/\d/.test(s)) return 'Mixed numbers aren’t allowed. Enter 3 1/2 as 7/2 or 3.5.';
  if (/[^\d./-]/.test(s)) return 'Use only digits, a decimal point, a fraction bar (/), and a leading minus sign.';
  if (s.lastIndexOf('-') > 0) return 'A minus sign can only come first.';
  if ((s.match(/\//g) ?? []).length > 1 || (s.match(/\./g) ?? []).length > 1) return 'That isn’t a number.';
  if (s.includes('/') && s.includes('.')) return 'A fraction can’t contain a decimal point.';
  if (s.length > MAX_INPUT) return `Answers can have at most ${MAX_INPUT} characters.`;
  if (s.endsWith('/') || s === '-' || s === '.' || s === '-.') return null;   // still typing
  if (s.includes('/') && !parseGridIn(s)) return 'The denominator can’t be zero.';
  if (!parseGridIn(s)) return 'That isn’t a number.';
  return null;
}

/** LaTeX for the answer preview under the input box. */
export function gridInPreview(raw: string): string {
  const s = normalize(raw);
  const f = FRACTION.exec(s);
  return f ? `${f[1]}\\dfrac{${f[2]}}{${f[3]}}` : s;
}
