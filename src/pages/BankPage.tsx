import type { SortingState } from '@tanstack/react-table';
import { useCallback, useEffect, useMemo } from 'react';
import {
  EMPTY_FILTERS, applyFilters, facetCounts, filtersFromParams, makeHay, normalizeFilters,
  sortFromParams, toParams, type Filters, type Tab,
} from '../lib/filters';
import { navigate, useRoute } from '../lib/router';
import { useData } from '../store/data';
import { useSession } from '../store/session';
import { useUi } from '../store/ui';
import { ActiveChips } from './bank/ActiveChips';
import { FilterBar } from './bank/FilterBar';
import { QuestionTable } from './bank/QuestionTable';
import { SelectionBar } from './bank/SelectionBar';

const TABS: { id: Tab; label: string }[] = [
  { id: 'reading', label: 'Reading & Writing' },
  { id: 'math', label: 'Math' },
  { id: 'both', label: 'Both' },
];

export default function BankPage() {
  const { path, params } = useRoute();
  const entries = useData((s) => s.entries);
  const loadStatus = useData((s) => s.status);
  const loadError = useData((s) => s.error);
  const fullText = useData((s) => s.fullText);
  const fullTextStatus = useData((s) => s.fullTextStatus);
  const loadFullText = useData((s) => s.loadFullText);
  const statusMap = useSession((s) => s.status);
  const selected = useSession((s) => s.selected);
  const setSelected = useSession((s) => s.setSelected);
  const openPopup = useUi((s) => s.openPopup);
  const setBankQuery = useUi((s) => s.setBankQuery);

  const filters = useMemo(() => filtersFromParams(params), [params]);
  const sort = useMemo(() => sortFromParams(params), [params]);
  const statusOf = useCallback((id: string) => statusMap[id], [statusMap]);
  const hay = useMemo(() => makeHay(fullText), [fullText]);
  const rows = useMemo(() => applyFilters(entries, filters, statusOf, hay), [entries, filters, statusOf, hay]);
  const facets = useMemo(() => facetCounts(entries, filters, statusOf, hay), [entries, filters, statusOf, hay]);

  // (the route can change to another page just before this one unmounts)
  useEffect(() => { if (path === '/') setBankQuery(params.toString()); }, [path, params, setBankQuery]);
  useEffect(() => { if (filters.q) void loadFullText(); }, [filters.q, loadFullText]);

  const update = useCallback((patch: Partial<Filters>) => {
    navigate('/', toParams(normalizeFilters(entries, { ...filters, ...patch }), sort), true);
  }, [entries, filters, sort]);
  const setSort = useCallback((s: SortingState) => navigate('/', toParams(filters, s), true), [filters]);
  const clearAll = () => navigate('/', toParams({ ...EMPTY_FILTERS, tab: filters.tab }, sort), true);

  const selectedInView = rows.reduce((n, r) => n + (selected.has(r.id) ? 1 : 0), 0);
  const allInView = rows.length > 0 && selectedInView === rows.length;

  return (
    <div className={`mx-auto flex h-[calc(100dvh-var(--nav-h,3.5rem))] max-w-[1440px] flex-col gap-3 px-4 pt-4 ${selected.size ? 'pb-20' : 'pb-4'}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="sr-only">Question bank</h1>
        <div role="tablist" aria-label="Section" className="inline-flex rounded-lg border border-line bg-surface p-1">
          {TABS.map((t) => {
            const on = filters.tab === t.id;
            return (
              <button
                key={t.id}
                id={`tab-${t.id}`}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls="bank-panel"
                onClick={() => update({ tab: t.id })}
                className={`rounded-md px-3 py-1.5 text-sm font-medium sm:px-4 ${on ? 'bg-accent text-accent-ink shadow-sm' : 'text-muted hover:text-ink'}`}
              >
                {t.label} <span className={`tabular-nums ${on ? 'opacity-90' : 'text-muted'}`}>({facets.tabs[t.id].toLocaleString()})</span>
              </button>
            );
          })}
        </div>
      </div>

      <FilterBar
        entries={entries}
        filters={filters}
        facets={facets}
        onChange={update}
        onSearchStart={loadFullText}
        searchPending={fullTextStatus === 'loading'}
      />

      <div className="flex min-h-7 flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-sm text-muted" aria-live="polite">
          <span className="font-semibold text-ink tabular-nums">{rows.length.toLocaleString()}</span> of {entries.length.toLocaleString()} questions
        </p>
        {rows.length > 0 && (
          <button
            type="button"
            onClick={() => setSelected(rows.map((r) => r.id), !allInView)}
            className="text-sm font-medium text-accent hover:underline"
          >
            {allInView ? 'Deselect all shown' : `Select all ${rows.length.toLocaleString()} shown`}
          </button>
        )}
        <ActiveChips filters={filters} onChange={update} onClear={clearAll} />
      </div>

      <div id="bank-panel" role="tabpanel" aria-labelledby={`tab-${filters.tab}`} className="min-h-0 flex-1">
        {loadStatus === 'error' ? (
          <Message title="The question bank could not be loaded." detail={loadError ?? ''} />
        ) : loadStatus !== 'ready' ? (
          <Message title="Loading questions…" />
        ) : rows.length === 0 ? (
          <Message title="No questions match these filters.">
            <button type="button" onClick={clearAll} className="mt-3 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:bg-accent-hover">
              Clear filters
            </button>
          </Message>
        ) : (
          <QuestionTable
            rows={rows}
            sorting={sort}
            onSortingChange={setSort}
            showSection={filters.tab === 'both'}
            onOpen={openPopup}
            labelledBy={`tab-${filters.tab}`}
          />
        )}
      </div>
      <SelectionBar />
    </div>
  );
}

function Message({ title, detail, children }: { title: string; detail?: string; children?: React.ReactNode }) {
  return (
    <div className="grid h-full place-items-center rounded-lg border border-dashed border-line bg-surface p-8 text-center">
      <div>
        <p className="font-semibold">{title}</p>
        {detail && <p className="mt-1 text-sm text-muted">{detail}</p>}
        {children}
      </div>
    </div>
  );
}
