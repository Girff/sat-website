// Review mode: every question of a completed set with the student's answer and the
// correct one marked. Clicking a choice shows why that choice is right or wrong.
import { useEffect, useState } from 'react';
import { btn } from '../../components/Dialog';
import { Flag } from '../../components/Badges';
import { IconArrowLeft, IconArrowRight } from '../../components/Icons';
import { ChoiceList } from '../../components/question/ChoiceList';
import { ChoiceExplanation, CorrectAnswer, Verdict } from '../../components/question/Explain';
import { GridIn } from '../../components/question/GridIn';
import { QuestionLayout } from '../../components/question/QuestionLayout';
import { loadQuestion } from '../../lib/data';
import { toDisplay } from '../../lib/letters';
import { hrefFor, navigate, useRoute } from '../../lib/router';
import { formatClock, isSlow, type TestResult } from '../../lib/scoring';
import type { IndexEntry, Letter, Question } from '../../lib/types';
import { useData } from '../../store/data';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'incorrect', label: 'Incorrect' },
  { id: 'flagged', label: 'Flagged' },
  { id: 'unanswered', label: 'Unanswered' },
  { id: 'slow', label: 'Slow' },
] as const;
type FilterId = (typeof FILTERS)[number]['id'];

export default function Review({ result: r }: { result: TestResult }) {
  const { params } = useRoute();
  const byId = useData((s) => s.byId);
  const filter = (FILTERS.find((f) => f.id === params.get('filter'))?.id ?? 'all') as FilterId;

  const test = (f: FilterId, id: string) => {
    const e = byId.get(id);
    if (f === 'incorrect') return r.outcome[id] === 'incorrect';
    if (f === 'flagged') return r.marked.includes(id);
    if (f === 'unanswered') return r.outcome[id] === 'unanswered';
    if (f === 'slow') return !!e && isSlow(r.timeMs[id], e.section);
    return true;
  };
  const indices = r.items.map((it, i) => (test(filter, it.id) ? i : -1)).filter((i) => i >= 0);
  const wanted = Number(params.get('review')) - 1;
  const cur = indices.includes(wanted) ? wanted : indices[0] ?? -1;
  const pos = indices.indexOf(cur);

  const go = (i: number, f: FilterId = filter) => {
    const p = new URLSearchParams({ review: String(i + 1) });
    if (f !== 'all') p.set('filter', f);
    navigate(`/results/${r.key}`, p, true);
  };
  const setFilter = (f: FilterId) => {
    const first = r.items.findIndex((it, i) => test(f, it.id) && i >= Math.max(0, cur));
    go(first >= 0 ? first : Math.max(0, r.items.findIndex((it) => test(f, it.id))), f);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || (e.target instanceof Element && e.target.closest('input, textarea'))) return;
      if (e.key === 'ArrowLeft' && pos > 0) go(indices[pos - 1]);
      else if (e.key === 'ArrowRight' && pos >= 0 && pos < indices.length - 1) go(indices[pos + 1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const item = cur >= 0 ? r.items[cur] : null;
  const entry = item ? byId.get(item.id) : undefined;
  return (
    <div className="flex h-[calc(100dvh-var(--nav-h,3.5rem))] flex-col bg-surface">
      <div className="border-b border-line px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <a href={hrefFor(`/results/${r.key}`)} className="link inline-flex items-center gap-1 text-sm"><IconArrowLeft width={15} height={15} />Results</a>
          <h1 className="min-w-0 flex-1 truncate font-extrabold">Review: {r.name}</h1>
          <div role="group" aria-label="Show questions" className="flex flex-wrap gap-1">
            {FILTERS.map((f) => {
              const n = r.items.filter((it) => test(f.id, it.id)).length;
              return (
                <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}
                  className={`rounded-full border px-3 py-1 text-sm font-bold ${filter === f.id ? 'border-ink bg-marker text-marker-ink' : 'border-line-strong hover:border-control'}`}>
                  {f.label} <span className="tabular-nums opacity-80">{n}</span>
                </button>
              );
            })}
          </div>
        </div>
        <ol className="mt-3 flex gap-2 overflow-x-auto px-1 pb-2 pt-1" aria-label="Questions">
          {indices.map((i) => {
            const id = r.items[i].id;
            const o = r.outcome[id];
            return (
              <li key={id}>
                <button type="button" onClick={() => go(i)} aria-current={i === cur ? 'step' : undefined}
                  aria-label={`Question ${i + 1}, ${o}`}
                  className={`grid h-7 min-w-10 place-items-center rounded-[50%] border-2 px-1.5 text-sm font-extrabold tabular-nums ${
                    o === 'correct' ? 'border-good bg-good text-surface' : o === 'incorrect' ? 'border-bad bg-bad text-surface' : 'border-control text-muted'} ${
                    i === cur ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface' : ''}`}>
                  {i + 1}
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {item && entry ? <ReviewQuestion key={item.id} r={r} index={cur} entry={entry} /> : (
        <div className="grid flex-1 place-items-center p-8 text-center text-muted">
          <div>
            <p className="font-bold text-ink">No questions in this list.</p>
            <button type="button" className={`${btn.secondary} mt-3`} onClick={() => setFilter('all')}>Show all</button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-line bg-surface-2 px-4 py-2.5">
        <button type="button" className={btn.secondary} disabled={pos <= 0} onClick={() => go(indices[pos - 1])}><IconArrowLeft width={16} height={16} />Previous</button>
        <p className="flex-1 text-center text-sm text-muted" aria-live="polite">
          {pos >= 0 && <>Question <strong className="text-ink">{cur + 1}</strong> of {r.items.length}{filter !== 'all' && <span className="max-sm:hidden"> ({pos + 1} of {indices.length} shown)</span>}</>}
        </p>
        <button type="button" className={btn.secondary} disabled={pos < 0 || pos >= indices.length - 1} onClick={() => go(indices[pos + 1])}>Next<IconArrowRight width={16} height={16} /></button>
      </div>
    </div>
  );
}

function ReviewQuestion({ r, index, entry }: { r: TestResult; index: number; entry: IndexEntry }) {
  const item = r.items[index];
  const [q, setQ] = useState<Question | null>(null);
  const [error, setError] = useState<string | null>(null);
  const answer = r.answers[item.id];
  const [explaining, setExplaining] = useState<Letter | undefined>(entry.type === 'mcq' ? (answer as Letter | undefined) : undefined);

  useEffect(() => {
    loadQuestion(entry).then((x) => {
      setQ(x);
      setExplaining((cur) => cur ?? (x.type === 'mcq' ? (x.correct[0] as Letter) : undefined));
    }, (e) => setError(e instanceof Error ? e.message : String(e)));
  }, [entry]);

  if (!q) return <div className="grid flex-1 place-items-center text-muted" role="status">{error ?? 'Loading question…'}</div>;
  const ms = r.timeMs[item.id] ?? 0;
  const slow = isSlow(ms, entry.section);
  const toolbar = (
    <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-1 border-b-2 border-dashed border-line-strong pb-2 text-sm">
      <span className="grid h-9 min-w-9 place-items-center bg-ink px-2 text-base font-extrabold text-bg tabular-nums">{index + 1}</span>
      <Verdict outcome={r.outcome[item.id]} />
      <span>Your answer: <strong>{answer ? (q.type === 'mcq' ? toDisplay(item.choices, answer as Letter) : answer) : 'none'}</strong></span>
      <span>Correct: <CorrectAnswer q={q} order={item.choices} /></span>
      <span className={slow ? 'font-extrabold text-bad' : 'text-muted'}>Time {formatClock(ms)}{slow && ' (slow)'}</span>
      {r.marked.includes(item.id) && <span className="inline-flex items-center gap-1 font-bold"><Flag size={15} />Marked</span>}
      <span className="ml-auto text-xs text-muted">{q.id}</span>
    </div>
  );
  return (
    <QuestionLayout q={q} toolbar={toolbar}>
      {q.type === 'mcq' ? (
        <ChoiceList q={q} order={item.choices} mode="review" selected={answer as Letter | undefined} reveal explaining={explaining} onSelect={setExplaining} />
      ) : (
        <GridIn id={`review-${q.id}`} value={answer ?? ''} onChange={() => undefined} disabled verdict={r.outcome[item.id]} />
      )}
      <ChoiceExplanation q={q} order={item.choices} letter={explaining} />
    </QuestionLayout>
  );
}
