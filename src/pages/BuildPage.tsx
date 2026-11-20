// Build Test: turn the selection (or a randomly generated set) into a problem set.
import { useMemo } from 'react';
import { DifficultyBadge } from '../components/Badges';
import { btn } from '../components/Dialog';
import { IconPrint, IconX } from '../components/Icons';
import { Segmented } from '../components/Segmented';
import { useStartTest } from '../components/StartGuard';
import type { Tab } from '../lib/filters';
import { hrefFor, navigate } from '../lib/router';
import { autoName, generateSet, generatorPool, type SetConfig } from '../lib/sets';
import { SECTION_LABEL, type IndexEntry } from '../lib/types';
import { useData } from '../store/data';
import { useSession } from '../store/session';
import { useTest } from '../store/test';
import { bankTab, useUi } from '../store/ui';
import { Generator, mixTotal } from './build/Generator';
import { SetOptions } from './build/SetOptions';

export default function BuildPage() {
  const byId = useData((s) => s.byId);
  const entries = useData((s) => s.entries);
  const selected = useSession((s) => s.selected);
  const status = useSession((s) => s.status);
  const setSelected = useSession((s) => s.setSelected);
  const builder = useUi((s) => s.builder);
  const setBuilder = useUi((s) => s.setBuilder);
  const bankQuery = useUi((s) => s.bankQuery);
  const activeTest = useTest((s) => s.test);
  const { start: startSet, dialog } = useStartTest();

  const tab = bankTab(bankQuery);
  const answered = useMemo(() => new Set(Object.keys(status).filter((id) => status[id].result)), [status]);
  const picked = useMemo(() => [...selected].map((id) => byId.get(id)).filter((e): e is IndexEntry => !!e), [selected, byId]);
  const pickedBoth = picked.some((e) => e.section === 'reading') && picked.some((e) => e.section === 'math');
  // a selection with both sections starts on the bank's tab (Reading-only, Math-only or both)
  const include: Tab = pickedBoth ? builder.include ?? tab : 'both';
  const fromSelection = picked.filter((e) => include === 'both' || e.section === include);
  const gen = { ...builder.gen, section: builder.gen.section ?? tab };
  const generated = useMemo(() => builder.generated.map((id) => byId.get(id)).filter((e): e is IndexEntry => !!e), [builder.generated, byId]);

  const mode = builder.mode ?? (selected.size ? 'selection' : 'generate');
  const list = mode === 'selection' ? fromSelection : generated;
  const name = autoName(list);
  const config = builder.config;
  const setConfig = (patch: Partial<SetConfig>) => setBuilder({ config: { ...config, ...patch } });
  const poolSize = generatorPool(entries, gen, answered).length;
  const canGenerate = poolSize > 0 && mixTotal(gen.mix) === 100;
  const pickCount = Math.min(gen.count, poolSize);

  const generate = () => {
    const set = generateSet(generatorPool(entries, gen, answered), gen.count, gen.mix);
    setBuilder({ generated: set.map((e) => e.id) });
  };
  const start = (items: IndexEntry[]) =>
    startSet(items, { ...config, name: config.name.trim() || autoName(items), order: mode === 'generate' ? 'selected' : config.order });
  const print = (answers: boolean) => {
    useUi.setState({ printJob: { title: config.name.trim() || name, items: list.map((e) => ({ id: e.id })), answers } });
    navigate('/print');
  };

  const reading = list.filter((e) => e.section === 'reading').length;
  const why = mode === 'selection'
    ? 'Tick questions in the question bank first.'
    : 'Generate a set first.';

  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-12 pt-8">
      <h1 className="text-3xl font-extrabold">Build a set</h1>
      <p className="mt-2 max-w-[62ch] text-muted">Take the questions you ticked in the bank, or let the site pick them at random. Then choose how you want to be timed.</p>
      {activeTest && (
        <p className="mt-5 flex flex-wrap items-center gap-3 rounded-md border border-ink bg-marker-soft px-4 py-3">
          <span><strong>{activeTest.name}</strong> is still in progress.</span>
          <a href={hrefFor('/test')} className={btn.primary}>Resume test</a>
        </p>
      )}

      <div className="mt-7 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <section aria-label="Questions" className="min-w-0">
          <Segmented
            legend="Where the questions come from"
            value={mode}
            onChange={(m) => setBuilder({ mode: m })}
            options={[
              { value: 'selection', label: `Ticked in the bank (${selected.size.toLocaleString()})` },
              { value: 'generate', label: 'At random' },
            ]}
          />
          <div className="mt-6">
            {mode === 'selection' ? (
              picked.length === 0 ? (
                <Empty>
                  <p className="text-lg font-bold">No questions ticked yet</p>
                  <p className="mt-1 text-muted">Tick questions in the question bank and they’ll appear here. Or pick at random instead.</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <a className={btn.primary} href={hrefFor('/', new URLSearchParams(bankQuery))}>Go to the questions</a>
                    <button type="button" className={btn.secondary} onClick={() => setBuilder({ mode: 'generate' })}>Pick at random</button>
                  </div>
                </Empty>
              ) : (
                <>
                  {pickedBoth && (
                    <div className="mb-5">
                      <Segmented<Tab>
                        legend="Include"
                        value={include}
                        onChange={(v) => setBuilder({ include: v })}
                        options={(['reading', 'math', 'both'] as Tab[]).map((t) => ({
                          value: t,
                          label: `${t === 'both' ? 'Both' : SECTION_LABEL[t]} (${(t === 'both' ? picked : picked.filter((e) => e.section === t)).length})`,
                        }))}
                        description="Reading & Writing only, Math only, or a mixed set from what you ticked."
                      />
                    </div>
                  )}
                  <QuestionList
                    entries={fromSelection}
                    onRemove={(id) => setSelected([id], false)}
                    footer={<a className="link text-sm" href={hrefFor('/', new URLSearchParams(bankQuery))}>Change what’s ticked in the question bank</a>}
                  />
                </>
              )
            ) : (
              <>
                <Generator entries={entries} answered={answered} options={gen} onChange={(p) => setBuilder({ gen: { ...builder.gen, ...p }, generated: builder.generated })} />
                <div className="mt-6 flex flex-wrap gap-2">
                  <button type="button" className={generated.length ? btn.secondary : btn.primary} disabled={!canGenerate} onClick={generate}>
                    {generated.length ? 'Pick again' : pickCount ? `Pick ${pickCount} question${pickCount === 1 ? '' : 's'}` : 'Pick questions'}
                  </button>
                </div>
                {generated.length > 0 && (
                  <div className="mt-6">
                    <QuestionList entries={generated} onRemove={(id) => setBuilder({ generated: builder.generated.filter((g) => g !== id) })} />
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        <aside aria-label="Your set" className="rounded-lg border border-line-strong bg-surface-2 p-5 lg:sticky lg:top-20">
          <h2 className="text-xl font-extrabold">Your set</h2>
          {list.length ? (
            <p className="mt-1 text-sm text-muted">
              {list.length} question{list.length === 1 ? '' : 's'}: {[reading && `${reading} Reading & Writing`, list.length - reading && `${list.length - reading} Math`].filter(Boolean).join(', ')}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted">Empty so far.</p>
          )}
          <div className="mt-5 grid gap-2">
            <button type="button" className={`${btn.hero} w-full`} disabled={!list.length} onClick={() => start(list)} aria-describedby={list.length ? undefined : 'start-why'}>
              Start test{list.length ? ` (${list.length} question${list.length === 1 ? '' : 's'})` : ''}
            </button>
            {!list.length && <p id="start-why" className="text-center text-sm text-muted">{why}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={btn.secondary} disabled={!list.length} onClick={() => print(false)}><IconPrint width={16} height={16} />Questions</button>
              <button type="button" className={btn.secondary} disabled={!list.length} onClick={() => print(true)}><IconPrint width={16} height={16} />With answers</button>
            </div>
          </div>
          <div className="mt-6 border-t border-line-strong pt-5">
            <SetOptions config={config} onChange={setConfig} entries={list} autoName={name} showOrder={mode === 'selection'} />
          </div>
        </aside>
      </div>

      {dialog}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border-2 border-dashed border-line-strong px-4 py-12 text-center">{children}</div>;
}

function QuestionList({ entries, onRemove, footer }: { entries: IndexEntry[]; onRemove: (id: string) => void; footer?: React.ReactNode }) {
  return (
    <div>
      <ol className="max-h-[32rem] divide-y divide-line overflow-auto rounded-md border border-line-strong">
        {entries.map((e, i) => (
          <li key={e.id} className="flex items-center gap-3 px-3 py-2.5">
            <span className="w-6 shrink-0 text-right text-sm font-bold tabular-nums text-muted">{i + 1}</span>
            <button type="button" className="min-w-0 flex-1 rounded text-left hover:underline" onClick={() => useUi.getState().openPopup(e.id, entries.map((x) => x.id))}>
              <span className="block truncate">{e.preview || `Question ${e.id}`}</span>
              <span className="block truncate text-[0.8125rem] text-muted">{e.skill}</span>
            </button>
            <DifficultyBadge value={e.difficulty} compact />
            <button type="button" onClick={() => onRemove(e.id)} aria-label={`Remove question ${e.id}`} title="Remove" className="grid size-8 shrink-0 place-items-center rounded text-muted hover:bg-surface-2 hover:text-ink">
              <IconX width={16} height={16} />
            </button>
          </li>
        ))}
      </ol>
      {footer && <div className="mt-3">{footer}</div>}
    </div>
  );
}
