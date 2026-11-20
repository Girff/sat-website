import type { SortingState } from '@tanstack/react-table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog, btn } from '../components/Dialog';
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
import { SkillIndex, chosenSkills } from './bank/SkillIndex';

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
  const [topicsOpen, setTopicsOpen] = useState(false);

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
  const topicsCount = useMemo(() => chosenSkills(entries, filters).size, [entries, filters]);
  const index = <SkillIndex entries={entries} filters={filters} facets={facets} status={statusMap} onChange={update} />;

  return (
    <div className={`grid h-[calc(100dvh-var(--nav-h,3.5rem))] lg:grid-cols-[19rem_minmax(0,1fr)] ${selected.size ? 'pb-16' : ''}`}>
      <aside aria-label="Skills" className="hidden min-h-0 overflow-auto border-r border-line bg-surface-2 px-3 py-4 lg:block">
        {index}
      </aside>

      <section className="flex min-h-0 min-w-0 flex-col gap-3 px-4 py-4 lg:px-6">
        <h1 className="sr-only">Question bank</h1>
        <div role="tablist" aria-label="Section" className="flex gap-1 overflow-x-auto border-b border-line">
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
                className={`-mb-px shrink-0 whitespace-nowrap border-b-[3px] px-3 pb-2 pt-1 text-base font-bold ${on ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'}`}
              >
                {t.label} <span className="ml-0.5 font-normal tabular-nums text-muted max-sm:sr-only">{facets.tabs[t.id].toLocaleString()}</span>
              </button>
            );
          })}
        </div>

        <FilterBar
          filters={filters}
          facets={facets}
          onChange={update}
          onSearchStart={loadFullText}
          searchPending={fullTextStatus === 'loading'}
          onOpenTopics={() => setTopicsOpen(true)}
          topicsCount={topicsCount}
        />

        <div className="flex min-h-7 flex-wrap items-center gap-x-4 gap-y-2">
          <p className="text-[0.9375rem]" aria-live="polite">
            <strong className="font-extrabold tabular-nums">{rows.length.toLocaleString()}</strong>
            <span className="text-muted"> {rows.length === entries.length ? 'questions' : `of ${entries.length.toLocaleString()} questions`}</span>
          </p>
          {rows.length > 0 && (
            <button
              type="button"
              onClick={() => setSelected(rows.map((r) => r.id), !allInView)}
              className="text-sm font-bold underline decoration-control underline-offset-2 hover:decoration-ink"
            >
              {allInView ? 'Untick all shown' : `Tick all ${rows.length.toLocaleString()}`}
            </button>
          )}
          <ActiveChips entries={entries} filters={filters} onChange={update} onClear={clearAll} />
          {!selected.size && rows.length > 0 && (
            <p className="ml-auto hidden text-sm text-muted xl:block">Open a question to try it, or tick questions to build a set.</p>
          )}
        </div>

        <div id="bank-panel" role="tabpanel" aria-labelledby={`tab-${filters.tab}`} className="min-h-0 flex-1">
          {loadStatus === 'error' ? (
            <Message title="The question bank couldn’t be loaded." detail={`${loadError ?? ''} Check your connection and reload the page.`} />
          ) : loadStatus !== 'ready' ? (
            <Message title="Loading questions…" />
          ) : rows.length === 0 ? (
            <Message title="No questions match these filters." detail="Remove a filter above, or start over.">
              <button type="button" onClick={clearAll} className={`${btn.primary} mt-4`}>Clear all filters</button>
            </Message>
          ) : (
            <QuestionTable
              rows={rows}
              sorting={sort}
              onSortingChange={setSort}
              onOpen={openPopup}
              labelledBy={`tab-${filters.tab}`}
            />
          )}
        </div>
      </section>

      <Dialog
        open={topicsOpen}
        onClose={() => setTopicsOpen(false)}
        title="Skills"
        className="max-w-md"
        footer={<button type="button" className={btn.primary} onClick={() => setTopicsOpen(false)}>Show {rows.length.toLocaleString()} questions</button>}
      >
        <div className="px-3 py-3">{index}</div>
      </Dialog>
      <SelectionBar />
    </div>
  );
}

function Message({ title, detail, children }: { title: string; detail?: string; children?: React.ReactNode }) {
  return (
    <div className="grid h-full place-items-center rounded-md border border-dashed border-line-strong bg-surface p-8 text-center">
      <div>
        <p className="text-lg font-bold">{title}</p>
        {detail && <p className="mt-1 text-sm text-muted">{detail}</p>}
        {children}
      </div>
    </div>
  );
}
