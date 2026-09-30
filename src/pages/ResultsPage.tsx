// Results of a completed set: score, breakdowns, timing, follow-up actions, and review.
import { lazy, Suspense, useMemo } from 'react';
import { DifficultyBadge } from '../components/Badges';
import { Breakdown, weakestFirst } from '../components/Breakdown';
import { btn } from '../components/Dialog';
import { IconCheck, IconFlag, IconX } from '../components/Icons';
import { useStartTest } from '../components/StartGuard';
import { toDisplay } from '../lib/letters';
import { navigate, reviewHref, useRoute } from '../lib/router';
import { formatClock, formatDuration, isSlow, summarize, type Outcome, type TestResult } from '../lib/scoring';
import { PACE, SLOW_FACTOR, practiceSet } from '../lib/sets';
import { SECTION_LABEL, type IndexEntry, type Letter } from '../lib/types';
import { useData } from '../store/data';
import { useSession } from '../store/session';
import { useUi } from '../store/ui';

const Review = lazy(() => import('./results/Review'));

export default function ResultsPage() {
  const { path, params } = useRoute();
  const key = decodeURIComponent(path.slice('/results/'.length));
  const result = useSession((s) => s.history.find((h) => h.key === key));
  const byId = useData((s) => s.byId);
  if (!result) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">These results aren’t in this session</h1>
        <p className="mt-2 text-sm text-muted">Results live only in memory. If you exported them earlier, import the file on the History page.</p>
        <a href="#/history" className={`${btn.primary} mt-6`}>Go to History</a>
      </div>
    );
  }
  if (!byId.size) return <p className="p-8 text-center text-muted">Loading…</p>;
  if (params.has('review')) {
    return <Suspense fallback={<p className="p-8 text-center text-muted">Loading review…</p>}><Review result={result} /></Suspense>;
  }
  return <Summary result={result} />;
}

function answerLabel(r: TestResult, e: IndexEntry): string {
  const a = r.answers[e.id];
  if (!a) return '—';
  if (e.type === 'spr') return a;
  const item = r.items.find((i) => i.id === e.id);
  return toDisplay(item?.choices, a as Letter);
}

function OutcomeText({ o }: { o: Outcome }) {
  if (o === 'correct') return <span className="inline-flex items-center gap-1 font-semibold text-easy"><IconCheck width={16} height={16} />Correct</span>;
  if (o === 'incorrect') return <span className="inline-flex items-center gap-1 font-semibold text-hard"><IconX width={16} height={16} />Incorrect</span>;
  return <span className="text-muted">Unanswered</span>;
}

function Summary({ result: r }: { result: TestResult }) {
  const byId = useData((s) => s.byId);
  const entries = useData((s) => s.entries);
  const status = useSession((s) => s.status);
  const history = useSession((s) => s.history);
  const { start, dialog } = useStartTest();
  const s = useMemo(() => summarize(r, byId), [r, byId]);
  const rows = r.items.map((it) => byId.get(it.id)).filter((e): e is IndexEntry => !!e);
  const missed = rows.filter((e) => r.outcome[e.id] !== 'correct');

  const seen = useMemo(() => {
    const ids = new Set(Object.keys(status).filter((id) => status[id].result));
    for (const h of history) for (const it of h.items) ids.add(it.id);
    return ids;
  }, [status, history]);
  const practice = useMemo(
    () => practiceSet(entries, [...new Set(missed.map((e) => e.skill))], seen, Math.min(20, Math.max(5, missed.length))),
    [entries, seen, r.key], // missed depends only on the result

  );

  const retry = () => start(missed, { ...r.config, name: `Retry: ${r.name}`.slice(0, 80) });
  const more = () => start(practice, { ...r.config, name: `More like ${r.name}`.slice(0, 80) });
  const printSet = () => {
    useUi.setState({ printJob: { title: r.name, items: r.items, answers: true } });
    navigate('/print');
  };
  const when = new Date(r.finishedAt);

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6">
      <p className="text-sm text-muted print:hidden"><a href="#/history" className="text-accent hover:underline">History</a> / Results</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{r.name}</h1>
      <p className="mt-1 text-sm text-muted">
        Finished {when.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} · {s.total} questions
        {r.config.checkAnswer && ' · Check Answer on'}
        {r.autoSubmitted && <strong className="text-hard"> · Time ran out; submitted automatically</strong>}
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <Stat label="Score" value={<>{s.correct}<span className="text-xl text-muted"> / {s.total}</span></>} sub={`${s.pct}% correct · ${s.answered} answered`} />
        <Stat label="Total time" value={formatClock(s.totalMs)} sub={`${formatDuration(s.avgMs)} per question on average`} />
        <Stat label="Slow questions" value={String(s.slow.length)} sub={`Over ${SLOW_FACTOR}× SAT pace (${PACE.reading} s R&W, ${PACE.math} s Math)`} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2 print:hidden">
        <a href={reviewHref(r.key)} className={btn.primary}>Review questions</a>
        <button type="button" className={btn.secondary} onClick={retry} disabled={!missed.length}>Retry incorrect questions ({missed.length})</button>
        <button type="button" className={btn.secondary} onClick={more} disabled={!practice.length}
          title="A new set from the skills you missed, without questions you’ve already seen">
          Practice more like these{practice.length ? ` (${practice.length})` : ''}
        </button>
        <button type="button" className={btn.ghost} onClick={() => window.print()}>Print results</button>
        <button type="button" className={btn.ghost} onClick={printSet}>Print questions + answer key</button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Breakdown title="By section" rows={[...s.bySection].map(([k, t]) => ({ key: k, label: SECTION_LABEL[k], t }))} />
        <Breakdown title="By difficulty" rows={(['Easy', 'Medium', 'Hard'] as const).filter((d) => s.byDifficulty.has(d)).map((d) => ({ key: d, label: <DifficultyBadge value={d} />, t: s.byDifficulty.get(d)! }))} />
        <Breakdown title="By domain (weakest first)" rows={weakestFirst(s.byDomain).map(([k, t]) => ({ key: k, label: k, t }))} />
        <Breakdown title="By skill (weakest first)" rows={weakestFirst(s.bySkill).map(([k, t]) => ({ key: k, label: k, t }))} />
      </div>

      <section className="mt-6 overflow-hidden rounded-xl border border-line bg-surface">
        <h2 className="border-b border-line px-4 py-3 font-semibold">Questions</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-surface-2 text-left text-xs text-muted">
              <tr>
                <th scope="col" className="px-3 py-2">#</th><th scope="col" className="px-3 py-2">Question</th><th scope="col" className="px-3 py-2">Skill</th>
                <th scope="col" className="px-3 py-2">Difficulty</th><th scope="col" className="px-3 py-2">Your answer</th><th scope="col" className="px-3 py-2">Result</th>
                <th scope="col" className="px-3 py-2 text-right">Time</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e, i) => {
                const slow = isSlow(r.timeMs[e.id], e.section);
                return (
                  <tr key={e.id} className="border-t border-line hover:bg-surface-2">
                    <td className="px-3 py-2 tabular-nums text-muted">{i + 1}</td>
                    <td className="px-3 py-2">
                      <a href={reviewHref(r.key, i + 1)} className="font-mono text-[0.8rem] text-accent hover:underline">{e.id}</a>
                      {r.marked.includes(e.id) && <><IconFlag width={14} height={14} className="ml-1.5 inline fill-current text-flag" /><span className="sr-only"> (marked for review)</span></>}
                    </td>
                    <td className="max-w-64 truncate px-3 py-2" title={e.skill}>{e.skill}</td>
                    <td className="px-3 py-2"><DifficultyBadge value={e.difficulty} /></td>
                    <td className="px-3 py-2 font-mono">{answerLabel(r, e)}</td>
                    <td className="px-3 py-2"><OutcomeText o={r.outcome[e.id]} /></td>
                    <td className={`px-3 py-2 text-right tabular-nums ${slow ? 'font-semibold text-hard' : ''}`}>
                      {formatClock(r.timeMs[e.id] ?? 0)}{slow && <span className="ml-1 text-xs">(slow)</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      {dialog}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted">{sub}</p>
    </div>
  );
}
