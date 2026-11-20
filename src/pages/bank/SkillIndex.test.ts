import { describe, expect, it } from 'vitest';
import { EMPTY_FILTERS } from '../../lib/filters';
import type { IndexEntry } from '../../lib/types';
import { chosenSkills } from './SkillIndex';

const e = (id: string, domain: string, skill: string): IndexEntry =>
  ({ id, section: 'math', domain, skill, difficulty: 'Easy', type: 'mcq', preview: '', chunk: 'c', low: false });
const rows = [e('a', 'Algebra', 'Linear functions'), e('b', 'Algebra', 'Linear equations'), e('c', 'Geometry', 'Circles')];

describe('skill index', () => {
  it('reads ticked skills, or every skill of a domain filter from an older link', () => {
    expect([...chosenSkills(rows, EMPTY_FILTERS)]).toEqual([]);
    expect([...chosenSkills(rows, { ...EMPTY_FILTERS, skills: ['Circles'] })]).toEqual(['Circles']);
    expect([...chosenSkills(rows, { ...EMPTY_FILTERS, domains: ['Algebra'] })].sort()).toEqual(['Linear equations', 'Linear functions']);
  });
});
