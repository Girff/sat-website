import { useEffect, useRef, useState } from 'react';
import { IconSearch, IconX } from '../../components/Icons';
import { MultiSelect, type Option } from '../../components/MultiSelect';
import {
  STATUS_KEYS, STATUS_LABEL, domainOptions, skillOptions,
  type Facets, type Filters, type StatusKey,
} from '../../lib/filters';
import { DIFFICULTIES, SECTION_LABEL, TYPE_LABEL, type Difficulty, type IndexEntry, type QType } from '../../lib/types';

interface Props {
  entries: IndexEntry[];
  filters: Filters;
  facets: Facets;
  onChange: (patch: Partial<Filters>) => void;
  onSearchStart: () => void;
  searchPending: boolean;
}

export function FilterBar({ entries, filters, facets, onChange, onSearchStart, searchPending }: Props) {
  const [text, setText] = useState(filters.q);
  const lastSent = useRef(filters.q);

  // follow the URL when it changes from outside (back button, chip removal)
  useEffect(() => {
    if (filters.q !== lastSent.current) {
      setText(filters.q);
      lastSent.current = filters.q;
    }
  }, [filters.q]);

  useEffect(() => {
    if (text === lastSent.current) return;
    const t = window.setTimeout(() => {
      lastSent.current = text;
      onChange({ q: text });
    }, 180);
    return () => window.clearTimeout(t);
  }, [text, onChange]);

  const sectionOf = new Map(entries.map((e) => [e.domain, e.section]));
  const domains: Option<string>[] = domainOptions(entries, filters.tab)
    .sort((a, b) => (sectionOf.get(b) ?? '').localeCompare(sectionOf.get(a) ?? '') || a.localeCompare(b))
    .map((d) => ({
      value: d, label: d, count: facets.domains.get(d) ?? 0,
      group: filters.tab === 'both' ? SECTION_LABEL[sectionOf.get(d) ?? 'math'] : undefined,
    }));
  const skills: Option<string>[] = skillOptions(entries, filters).flatMap((g) =>
    g.skills.map((s) => ({ value: s, label: s, group: g.domain, count: facets.skills.get(s) ?? 0 })));
  const diffs: Option<Difficulty>[] = DIFFICULTIES.map((d) => ({ value: d, label: d, count: facets.difficulties.get(d) ?? 0 }));
  const types: Option<QType>[] = (['mcq', 'spr'] as QType[]).map((t) => ({ value: t, label: TYPE_LABEL[t], count: facets.types.get(t) ?? 0 }));
  const statuses: Option<StatusKey>[] = STATUS_KEYS.map((s) => ({ value: s, label: STATUS_LABEL[s], count: facets.statuses.get(s) ?? 0 }));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[14rem] flex-1 basis-64">
        <label htmlFor="bank-search" className="sr-only">Search question ID, passage and question text</label>
        <IconSearch width={18} height={18} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          id="bank-search"
          type="search"
          value={text}
          placeholder="Search ID, passage or question text"
          autoComplete="off"
          onFocus={onSearchStart}
          onChange={(e) => {
            onSearchStart();
            setText(e.target.value);
          }}
          className="h-9 w-full rounded-md border border-line bg-surface pl-9 pr-9 text-sm placeholder:text-muted focus:border-accent"
        />
        {text && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setText('')}
            className="absolute right-1.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded text-muted hover:text-ink"
          >
            <IconX width={16} height={16} />
          </button>
        )}
        {searchPending && filters.q && (
          <span className="absolute -bottom-5 left-1 text-xs text-muted" role="status">Loading full-text search…</span>
        )}
      </div>
      <MultiSelect label="Domain" options={domains} selected={filters.domains} onChange={(domains) => onChange({ domains })} />
      <MultiSelect label="Skill" options={skills} selected={filters.skills} onChange={(skills) => onChange({ skills })} />
      <MultiSelect label="Difficulty" options={diffs} selected={filters.difficulties} onChange={(difficulties) => onChange({ difficulties })} />
      <MultiSelect label="Type" options={types} selected={filters.types} onChange={(types) => onChange({ types })} />
      <MultiSelect label="Status" options={statuses} selected={filters.statuses} onChange={(statuses) => onChange({ statuses })} />
    </div>
  );
}
