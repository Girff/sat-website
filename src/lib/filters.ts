// Question-table filtering, facet counts and the URL encoding of both.
// Pure functions: the URL is the single source of truth for filters and sort.
import type { Difficulty, IndexEntry, QType, Section } from './types';

export type Tab = Section | 'both';
export type StatusKey = 'correct' | 'incorrect' | 'flagged' | 'unseen';
export const STATUS_KEYS: StatusKey[] = ['unseen', 'correct', 'incorrect', 'flagged'];
export const STATUS_LABEL: Record<StatusKey, string> = {
  unseen: 'Unseen', correct: 'Correct', incorrect: 'Incorrect', flagged: 'Flagged',
};

export interface QStatus {
  result?: 'correct' | 'incorrect';
  flagged?: boolean;
}
export type StatusOf = (id: string) => QStatus | undefined;

export interface Filters {
  tab: Tab;
  domains: string[];
  skills: string[];
  difficulties: Difficulty[];
  types: QType[];
  statuses: StatusKey[];
  q: string;
}

export interface SortItem {
  id: string;
  desc: boolean;
}

export const EMPTY_FILTERS: Filters = {
  tab: 'both', domains: [], skills: [], difficulties: [], types: [], statuses: [], q: '',
};

const DIFFS: Difficulty[] = ['Easy', 'Medium', 'Hard'];
const TYPES: QType[] = ['mcq', 'spr'];

// ------------------------------------------------------------------ URL codec
export function filtersFromParams(p: URLSearchParams): Filters {
  const tab = p.get('tab');
  return {
    tab: tab === 'reading' || tab === 'math' ? tab : 'both',
    domains: p.getAll('domain'),
    skills: p.getAll('skill'),
    difficulties: p.getAll('diff').filter((d): d is Difficulty => DIFFS.includes(d as Difficulty)),
    types: p.getAll('type').filter((t): t is QType => TYPES.includes(t as QType)),
    statuses: p.getAll('status').filter((s): s is StatusKey => STATUS_KEYS.includes(s as StatusKey)),
    q: p.get('q') ?? '',
  };
}

export function sortFromParams(p: URLSearchParams): SortItem[] {
  const raw = p.get('sort');
  if (!raw) return [];
  return raw.split(',').filter(Boolean).map((s) => (s.startsWith('-') ? { id: s.slice(1), desc: true } : { id: s, desc: false }));
}

export function toParams(f: Filters, sort: SortItem[]): URLSearchParams {
  const p = new URLSearchParams();
  if (f.tab !== 'both') p.set('tab', f.tab);
  f.domains.forEach((d) => p.append('domain', d));
  f.skills.forEach((s) => p.append('skill', s));
  f.difficulties.forEach((d) => p.append('diff', d));
  f.types.forEach((t) => p.append('type', t));
  f.statuses.forEach((s) => p.append('status', s));
  if (f.q.trim()) p.set('q', f.q);
  if (sort.length) p.set('sort', sort.map((s) => (s.desc ? '-' : '') + s.id).join(','));
  return p;
}

// ------------------------------------------------------------------ matching
export function searchTerms(q: string): string[] {
  return q.toLowerCase().split(/\s+/).filter(Boolean);
}

export function statusKeys(st: QStatus | undefined): StatusKey[] {
  const keys: StatusKey[] = [];
  if (st?.result) keys.push(st.result);
  else keys.push('unseen');
  if (st?.flagged) keys.push('flagged');
  return keys;
}

type Group = keyof Omit<Filters, 'q'>;

/** Does `e` pass every filter except those in `skip`? */
function passes(e: IndexEntry, f: Filters, statusOf: StatusOf, hay: HayFn, terms: string[], skip: Group[]): boolean {
  if (!skip.includes('tab') && f.tab !== 'both' && e.section !== f.tab) return false;
  if (!skip.includes('domains') && f.domains.length && !f.domains.includes(e.domain)) return false;
  if (!skip.includes('skills') && f.skills.length && !f.skills.includes(e.skill)) return false;
  if (!skip.includes('difficulties') && f.difficulties.length && !f.difficulties.includes(e.difficulty)) return false;
  if (!skip.includes('types') && f.types.length && !f.types.includes(e.type)) return false;
  if (!skip.includes('statuses') && f.statuses.length) {
    const keys = statusKeys(statusOf(e.id));
    if (!f.statuses.some((s) => keys.includes(s))) return false;
  }
  if (terms.length) {
    const text = hay(e);
    if (!terms.every((t) => text.includes(t))) return false;
  }
  return true;
}

/** Searchable text for an entry: full text once search.json has loaded, else ID + preview. */
export type HayFn = (e: IndexEntry) => string;

export function makeHay(full: Map<string, string> | null): HayFn {
  const cache = new Map<string, string>();
  return (e) => {
    let h = cache.get(e.id);
    if (h === undefined) {
      h = `${e.id} ${full?.get(e.id) ?? e.preview.toLowerCase()}`;
      cache.set(e.id, h);
    }
    return h;
  };
}

export function applyFilters(entries: IndexEntry[], f: Filters, statusOf: StatusOf, hay: HayFn): IndexEntry[] {
  const terms = searchTerms(f.q);
  return entries.filter((e) => passes(e, f, statusOf, hay, terms, []));
}

export interface Facets {
  tabs: Record<Tab, number>;
  domains: Map<string, number>;
  skills: Map<string, number>;
  difficulties: Map<Difficulty, number>;
  types: Map<QType, number>;
  statuses: Map<StatusKey, number>;
}

const bump = <K>(m: Map<K, number>, k: K) => m.set(k, (m.get(k) ?? 0) + 1);

/** Count, for every option, how many questions would match if it were chosen:
 *  each group is counted with all *other* filters applied. Domain counts ignore
 *  the skill filter too, since skills are narrowed by domain. */
export function facetCounts(entries: IndexEntry[], f: Filters, statusOf: StatusOf, hay: HayFn): Facets {
  const terms = searchTerms(f.q);
  const out: Facets = {
    tabs: { reading: 0, math: 0, both: 0 },
    domains: new Map(), skills: new Map(), difficulties: new Map(), types: new Map(), statuses: new Map(),
  };
  for (const e of entries) {
    if (passes(e, f, statusOf, hay, terms, ['tab'])) {
      out.tabs[e.section]++;
      out.tabs.both++;
    }
    if (passes(e, f, statusOf, hay, terms, ['domains', 'skills'])) bump(out.domains, e.domain);
    if (passes(e, f, statusOf, hay, terms, ['skills'])) bump(out.skills, e.skill);
    if (passes(e, f, statusOf, hay, terms, ['difficulties'])) bump(out.difficulties, e.difficulty);
    if (passes(e, f, statusOf, hay, terms, ['types'])) bump(out.types, e.type);
    if (passes(e, f, statusOf, hay, terms, ['statuses'])) statusKeys(statusOf(e.id)).forEach((k) => bump(out.statuses, k));
  }
  return out;
}

/** Skills available for the current tab and chosen domains, grouped by domain. */
export function skillOptions(entries: IndexEntry[], f: Filters): { domain: string; skills: string[] }[] {
  const by = new Map<string, Set<string>>();
  for (const e of entries) {
    if (f.tab !== 'both' && e.section !== f.tab) continue;
    if (f.domains.length && !f.domains.includes(e.domain)) continue;
    if (!by.has(e.domain)) by.set(e.domain, new Set());
    by.get(e.domain)!.add(e.skill);
  }
  return [...by.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([domain, s]) => ({ domain, skills: [...s].sort((a, b) => a.localeCompare(b)) }));
}

export function domainOptions(entries: IndexEntry[], tab: Tab): string[] {
  const s = new Set<string>();
  for (const e of entries) if (tab === 'both' || e.section === tab) s.add(e.domain);
  return [...s].sort((a, b) => a.localeCompare(b));
}

/** Drop domain/skill choices that no longer exist after the tab changes. */
export function normalizeFilters(entries: IndexEntry[], f: Filters): Filters {
  const doms = new Set(domainOptions(entries, f.tab));
  const domains = f.domains.filter((d) => doms.has(d));
  const skills = new Set(skillOptions(entries, { ...f, domains }).flatMap((g) => g.skills));
  return { ...f, domains, skills: f.skills.filter((s) => skills.has(s)) };
}

export function activeFilterCount(f: Filters): number {
  return f.domains.length + f.skills.length + f.difficulties.length + f.types.length + f.statuses.length + (f.q.trim() ? 1 : 0);
}
