// Build Test: turn the selection (or a randomly generated set) into a problem set.
import { useMemo } from 'react';
import { DifficultyBadge } from '../components/Badges';
import { btn } from '../components/Dialog';
import { IconX } from '../components/Icons';
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
  const canGenerate = generatorPool(entries, gen, answered).length > 0 && mixTotal(gen.mix) === 100;

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

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Build a problem set</h1>
      <p className="mt-1 text-sm text-muted">Use the questions you selected in the question bank, or generate a random set.</p>
      {activeTest && (
        <p className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-accent bg-accent-soft px-4 py-3 text-sm">
          <span><strong>{activeTest.name}</strong> is in progress.</span>
          <a href={hrefFor('/test')} className={btn.primary}>Resume test</a>
        </p>
      )}

      <div className="mt-5">
        <Segmented
          legend={<span className="sr-only">Source</span>}
          value={mode}
          onChange={(m) => setBuilder({ mode: m })}
          options={[
            { value: 'selection', label: `From your selection (${selected.size.toLocaleString()})` },
            { value: 'generate', label: 'Generate random set' },
          ]}
        />
      </div>

      <div className="mt-5 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section aria-label={mode === 'selection' ? 'Selected questions' : 'Random set'} className="min-w-0 rounded-xl border border-line bg-surface p-5">
          {mode === 'selection' ? (
            picked.length === 0 ? (
              <Empty>
                No questions selected yet. Tick questions in the <a className="text-accent underline" href={hrefFor('/', new URLSearchParams(bankQuery))}>question bank</a>, or generate a random set.
              </Empty>
            ) : (
              <>
                {pickedBoth && (
                  <div className="mb-4">
                    <Segmented<Tab>
                      legend="Include"
                      value={include}
                      onChange={(v) => setBuilder({ include: v })}
                      options={(['reading', 'math', 'both'] as Tab[]).map((t) => ({
                        value: t,
                        label: `${t === 'both' ? 'Both' : SECTION_LABEL[t]} (${(t === 'both' ? picked : picked.filter((e) => e.section === t)).length})`,
                      }))}
                      description="Reading-only, Math-only, or a mixed set from your selection."
                    />
                  </div>
                )}
                <QuestionList
                  entries={fromSelection}
                  onRemove={(id) => setSelected([id], false)}
                  footer={<a className="text-sm font-medium text-accent hover:underline" href={hrefFor('/', new URLSearchParams(bankQuery))}>Change the selection in the question bank</a>}
                />
              </>
            )
          ) : (
            <>
              <Generator entries={entries} answered={answered} options={gen} onChange={(p) => setBuilder({ gen: { ...builder.gen, ...p }, generated: builder.generated })} />
              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" className={generated.length ? btn.secondary : btn.primary} disabled={!canGenerate} onClick={generate}>
                  {generated.length ? 'Generate again' : 'Generate set'}
                </button>
              </div>
              {generated.length > 0 && (
                <div className="mt-5 border-t border-line pt-5">
                  <QuestionList entries={generated} onRemove={(id) => setBuilder({ generated: builder.generated.filter((g) => g !== id) })} />
                </div>
              )}
            </>
          )}
        </section>

        <aside aria-label="Set options" className="rounded-xl border border-line bg-surface p-5 lg:sticky lg:top-20">
          <h2 className="mb-4 text-lg font-semibold">Options</h2>
          <SetOptions config={config} onChange={setConfig} entries={list} autoName={name} showOrder={mode === 'selection'} />
          <div className="mt-6 grid gap-2">
            <button type="button" className={btn.primary} disabled={!list.length} onClick={() => start(list)}>
              Start test{list.length ? ` (${list.length} question${list.length === 1 ? '' : 's'})` : ''}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={btn.secondary} disabled={!list.length} onClick={() => print(false)}>Print questions</button>
              <button type="button" className={btn.secondary} disabled={!list.length} onClick={() => print(true)}>Print with key</button>
            </div>
          </div>
        </aside>
      </div>

      {dialog}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-line px-4 py-10 text-center text-sm text-muted">{children}</p>;
}

function QuestionList({ entries, onRemove, footer }: { entries: IndexEntry[]; onRemove: (id: string) => void; footer?: React.ReactNode }) {
  const reading = entries.filter((e) => e.section === 'reading').length;
  const diff = (d: string) => entries.filter((e) => e.difficulty === d).length;
  return (
    <div>
      <p className="text-sm">
        <strong>{entries.length.toLocaleString()} question{entries.length === 1 ? '' : 's'}</strong>
        <span className="text-muted">
          {' '}· {reading} Reading &amp; Writing · {entries.length - reading} Math · {diff('Easy')} Easy · {diff('Medium')} Medium · {diff('Hard')} Hard
        </span>
      </p>
      <ol className="mt-3 max-h-[28rem] divide-y divide-line overflow-auto rounded-lg border border-line">
        {entries.map((e, i) => (
          <li key={e.id} className="flex items-center gap-3 px-3 py-2 text-sm">
            <span className="w-6 text-right tabular-nums text-muted">{i + 1}</span>
            <button type="button" className="font-mono text-[0.8rem] text-accent hover:underline" onClick={() => useUi.getState().openPopup(e.id, entries.map((x) => x.id))}>
              {e.id}
            </button>
            <span className="min-w-0 flex-1 truncate" title={e.skill}>{e.skill}</span>
            <DifficultyBadge value={e.difficulty} />
            <button type="button" onClick={() => onRemove(e.id)} aria-label={`Remove question ${e.id}`} className="grid size-7 place-items-center rounded text-muted hover:bg-surface-2 hover:text-ink">
              <IconX width={16} height={16} />
            </button>
          </li>
        ))}
      </ol>
      {footer && <div className="mt-3">{footer}</div>}
    </div>
  );
}
