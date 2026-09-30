import { describe, expect, it } from 'vitest';
import { checkGridIn, gridInError, parseGridIn } from './gridin';
import type { Question } from './types';

describe('grid-in answers', () => {
  it('parses fractions, decimals and negatives', () => {
    expect(parseGridIn('3/4')).toEqual({ n: 3, d: 4 });
    expect(parseGridIn('.75')).toEqual({ n: 75, d: 100 });
    expect(parseGridIn('-2.5')).toEqual({ n: -25, d: 10 });
    expect(parseGridIn('−7')).toEqual({ n: -7, d: 1 });
    expect(parseGridIn('4/0')).toBeNull();
    expect(parseGridIn('abc')).toBeNull();
    expect(parseGridIn('.')).toBeNull();
  });

  it('accepts equivalent forms', () => {
    const correct = ['.75', '3/4'];
    for (const a of ['3/4', '.75', '0.75', '6/8', '0.750', ' 3/4 ']) expect(checkGridIn(a, correct)).toBe(true);
    for (const a of ['.7', '0.8', '4/3', '-3/4', '']) expect(checkGridIn(a, correct)).toBe(false);
  });

  it('accepts truncated or rounded decimals that fill the answer space', () => {
    const correct = ['2/3', '.6666', '.6667'];
    for (const a of ['2/3', '.6666', '.6667', '0.666', '0.667', '4/6']) expect(checkGridIn(a, correct)).toBe(true);
    for (const a of ['.66', '.67', '0.66', '.665']) expect(checkGridIn(a, correct)).toBe(false);
    expect(checkGridIn('-.3266', ['-.3266', '-.3267', '-49/150'])).toBe(true);
    expect(checkGridIn('-0.327', ['-.3266', '-.3267', '-49/150'])).toBe(true);
    expect(checkGridIn('94.67', ['284/3', '94.66', '94.67'])).toBe(true);
  });

  it('accepts any one of several different correct answers', () => {
    expect(checkGridIn('-5', ['14', '-5', '-4'])).toBe(true);
    expect(checkGridIn('5', ['14', '-5', '-4'])).toBe(false);
  });

  it('explains invalid input', () => {
    expect(gridInError('3/4')).toBeNull();
    expect(gridInError('3/')).toBeNull();
    expect(gridInError('-')).toBeNull();
    expect(gridInError('3 1/2')).toMatch(/Mixed numbers/);
    expect(gridInError('x+1')).toMatch(/only digits/);
    expect(gridInError('1-2')).toMatch(/minus sign/);
    expect(gridInError('12345678')).toMatch(/at most 7/);
    expect(gridInError('-12345')).toBeNull();
    expect(gridInError('1.5/2')).toMatch(/fraction/);
    expect(gridInError('3/0')).toMatch(/zero/);
  });

  it('accepts every listed answer of every grid-in question in the bank', () => {
    const chunks = import.meta.glob<Question[]>('/public/data/questions/*.json', { eager: true, import: 'default' });
    const questions = Object.entries(chunks).filter(([f]) => /\/[\w-]+\.json$/.test(f)).flatMap(([, qs]) => qs);
    const spr = questions.filter((q) => q.type === 'spr');
    expect(spr.length).toBeGreaterThan(400);
    for (const q of spr) {
      for (const form of q.correct) {
        expect(gridInError(form), `${q.id} ${form}`).toBeNull();
        expect(checkGridIn(form, q.correct), `${q.id} ${form}`).toBe(true);
      }
    }
  });
});
