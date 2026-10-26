import { describe, expect, it } from 'vitest';
import {
  EMPTY_FILTERS, activeFilterCount, applyFilters, facetCounts, filtersFromParams, makeHay, normalizeFilters,
  sortFromParams, toParams, type Filters,
} from './filters';
import type { IndexEntry } from './types';

const e = (id: string, section: 'math' | 'reading', domain: string, skill: string, difficulty: 'Easy' | 'Medium' | 'Hard', type: 'mcq' | 'spr' = 'mcq', preview = '', desmos?: IndexEntry['desmos']): IndexEntry =>
  ({ id, section, domain, skill, difficulty, type, preview, chunk: 'c', low: false, desmos });

const rows: IndexEntry[] = [
  e('m1', 'math', 'Algebra', 'Linear functions', 'Easy', 'mcq', 'A line passes through', 'points'),
  e('m2', 'math', 'Algebra', 'Linear functions', 'Hard', 'spr', 'What is the slope', 'table'),
  e('m3', 'math', 'Geometry and Trigonometry', 'Circles', 'Medium', 'mcq', 'A circle has radius'),
  e('r1', 'reading', 'Craft and Structure', 'Words in Context', 'Easy', 'mcq', 'The poet describes'),
  e('r2', 'reading', 'Information and Ideas', 'Inferences', 'Hard', 'mcq', 'Researchers found'),
];
const none = () => undefined;
const hay = makeHay(null);
const f = (over: Partial<Filters>): Filters => ({ ...EMPTY_FILTERS, ...over });

describe('filters', () => {
  it('round-trips through the URL, including names with commas', () => {
    const src = f({ tab: 'math', domains: ['Problem-Solving and Data Analysis'], skills: ['Ratios, rates, proportional relationships, and units'], difficulties: ['Hard'], types: ['spr'], statuses: ['incorrect'], desmos: true, q: 'slope' });
    const sort = [{ id: 'difficulty', desc: true }, { id: 'id', desc: false }];
    const p = new URLSearchParams(toParams(src, sort).toString());
    expect(filtersFromParams(p)).toEqual(src);
    expect(sortFromParams(p)).toEqual(sort);
  });

  it('ignores unknown values in the URL', () => {
    const p = new URLSearchParams('tab=science&diff=Impossible&type=essay&status=maybe&desmos=yes');
    expect(filtersFromParams(p)).toEqual(EMPTY_FILTERS);
  });

  it('filters by tab, facets and search terms', () => {
    expect(applyFilters(rows, f({ tab: 'math' }), none, hay).map((r) => r.id)).toEqual(['m1', 'm2', 'm3']);
    expect(applyFilters(rows, f({ difficulties: ['Hard'] }), none, hay).map((r) => r.id)).toEqual(['m2', 'r2']);
    expect(applyFilters(rows, f({ q: 'CIRCLE radius' }), none, hay).map((r) => r.id)).toEqual(['m3']);
    expect(applyFilters(rows, f({ q: 'r2' }), none, hay).map((r) => r.id)).toEqual(['r2']);
  });

  it('filters by session status', () => {
    const st = (id: string) => (id === 'm1' ? { result: 'incorrect' as const } : id === 'r1' ? { flagged: true } : undefined);
    expect(applyFilters(rows, f({ statuses: ['incorrect'] }), st, hay).map((r) => r.id)).toEqual(['m1']);
    expect(applyFilters(rows, f({ statuses: ['flagged'] }), st, hay).map((r) => r.id)).toEqual(['r1']);
    expect(applyFilters(rows, f({ statuses: ['unseen'] }), st, hay)).toHaveLength(4);
  });

  it('counts each facet with the other filters applied', () => {
    const facets = facetCounts(rows, f({ tab: 'math', difficulties: ['Easy'] }), none, hay);
    expect(facets.tabs).toEqual({ math: 1, reading: 1, both: 2 });
    expect(facets.difficulties.get('Hard')).toBe(1);   // m2 would match if Hard were chosen
    expect(facets.domains.get('Algebra')).toBe(1);
    expect(facets.domains.get('Geometry and Trigonometry')).toBeUndefined();
  });

  it('keeps only Desmos regression questions, and counts them', () => {
    expect(applyFilters(rows, f({ desmos: true }), none, hay).map((r) => r.id)).toEqual(['m1', 'm2']);
    expect(applyFilters(rows, f({ desmos: true, difficulties: ['Hard'] }), none, hay).map((r) => r.id)).toEqual(['m2']);
    expect(facetCounts(rows, f({ difficulties: ['Easy'] }), none, hay).desmos).toBe(1);
    const facets = facetCounts(rows, f({ desmos: true }), none, hay);
    expect(facets.desmos).toBe(2);
    expect(facets.tabs).toEqual({ math: 2, reading: 0, both: 2 });
    expect(facets.domains.get('Geometry and Trigonometry')).toBeUndefined();
    expect(activeFilterCount(f({ desmos: true }))).toBe(1);
    expect(toParams(f({ desmos: true }), []).toString()).toBe('desmos=1');
  });

  it('drops domain and skill choices that do not exist in the tab', () => {
    const out = normalizeFilters(rows, f({ tab: 'reading', domains: ['Algebra', 'Craft and Structure'], skills: ['Circles', 'Words in Context'] }));
    expect(out.domains).toEqual(['Craft and Structure']);
    expect(out.skills).toEqual(['Words in Context']);
  });
});
