import { useEffect, useRef, useState } from 'react';
import { IconSearch, IconSliders, IconX } from '../../components/Icons';
import { MultiSelect, type Option } from '../../components/MultiSelect';
import { DESMOS_LABEL } from '../../lib/desmos';
import { STATUS_KEYS, STATUS_LABEL, type Facets, type Filters, type StatusKey } from '../../lib/filters';
import { DIFFICULTIES, TYPE_LABEL, type Difficulty, type QType } from '../../lib/types';

interface Props {
  filters: Filters;
  facets: Facets;
  onChange: (patch: Partial<Filters>) => void;
  onSearchStart: () => void;
  searchPending: boolean;
  /** Phones and tablets: the skill index opens as a sheet from this button. */
  onOpenTopics: () => void;
  topicsCount: number;
}

export function FilterBar({ filters, facets, onChange, onSearchStart, searchPending, onOpenTopics, topicsCount }: Props) {
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

  const diffs: Option<Difficulty>[] = DIFFICULTIES.map((d) => ({ value: d, label: d, count: facets.difficulties.get(d) ?? 0 }));
  const types: Option<QType>[] = (['mcq', 'spr'] as QType[]).map((t) => ({ value: t, label: TYPE_LABEL[t], count: facets.types.get(t) ?? 0 }));
  const statuses: Option<StatusKey>[] = STATUS_KEYS.map((s) => ({ value: s, label: STATUS_LABEL[s], count: facets.statuses.get(s) ?? 0 }));
  const pill = (on: boolean) => `flex h-9 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-md border px-3 text-sm font-bold ${
    on ? 'border-ink bg-marker-soft text-ink' : 'border-line-strong bg-surface text-ink hover:border-control'}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[14rem] flex-1 basis-72">
        <label htmlFor="bank-search" className="sr-only">Search question ID, passage and question text</label>
        <IconSearch width={18} height={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          id="bank-search"
          type="search"
          value={text}
          placeholder="Search question text, passages or an ID"
          autoComplete="off"
          onFocus={onSearchStart}
          onChange={(e) => {
            onSearchStart();
            setText(e.target.value);
          }}
          className="h-10 w-full rounded-md border border-control bg-surface pl-10 pr-9 text-[0.9375rem] placeholder:text-muted focus:border-ink focus:outline-none focus:ring-2 focus:ring-marker"
        />
        {text && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setText('')}
            className="absolute right-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded text-muted hover:bg-surface-2 hover:text-ink"
          >
            <IconX width={16} height={16} />
          </button>
        )}
        {searchPending && filters.q && (
          <span className="absolute -bottom-5 left-1 text-xs text-muted" role="status">Loading full-text search…</span>
        )}
      </div>
      <button type="button" onClick={onOpenTopics} className={`${pill(topicsCount > 0)} lg:hidden`}>
        <IconSliders width={16} height={16} />
        Skills
        {topicsCount > 0 && <span className="rounded-full bg-ink px-1.5 text-xs leading-5 text-bg">{topicsCount}</span>}
      </button>
      <MultiSelect label="Difficulty" options={diffs} selected={filters.difficulties} onChange={(difficulties) => onChange({ difficulties })} />
      <MultiSelect label="Type" options={types} selected={filters.types} onChange={(types) => onChange({ types })} />
      <MultiSelect label="Status" options={statuses} selected={filters.statuses} onChange={(statuses) => onChange({ statuses })} />
      {/* math only, so hidden on the Reading & Writing tab unless it is already on */}
      {(filters.tab !== 'reading' || filters.desmos) && (
        <label
          title="Math questions that are good practice for Desmos regression (~): tables, points, equivalent expressions, infinitely many solutions and best fit"
          className={`${pill(filters.desmos)} has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink`}
        >
          <input
            type="checkbox"
            className="check"
            checked={filters.desmos}
            onChange={(e) => onChange({ desmos: e.target.checked })}
          />
          {DESMOS_LABEL}
          <span className="tabular-nums font-normal text-muted">{facets.desmos.toLocaleString()}</span>
        </label>
      )}
    </div>
  );
}
