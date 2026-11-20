// Results of a completed set: score, breakdowns, timing, follow-up actions, and review.
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { DifficultyBadge, Flag } from '../components/Badges';
import { Breakdown, weakestFirst } from '../components/Breakdown';
import { btn } from '../components/Dialog';
import { IconPrint } from '../components/Icons';
import { useStartTest } from '../components/StartGuard';
import { loadQuestion } from '../lib/data';
import { LETTERS, toDisplay, toOriginal, type ChoiceOrder } from '../lib/letters';
import { navigate, reviewHref, useRoute } from '../lib/router';
import { formatClock, formatDuration, isSlow, summarize, type Outcome, type TestResult } from '../lib/scoring';
import { SLOW_FACTOR, practiceSet } from '../lib/sets';
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
      <div className="mx-auto max-w-xl px-4 py-20">
        <h1 className="text-3xl font-extrabold">These results aren’t in this session</h1>
        <p className="mt-2 text-muted">Results are kept only until you close the tab. If you exported them earlier, import the file on the Progress page.</p>
        <a href="#/progress" className={`${btn.primary} mt-6`}>Go to Progress</a>
      </div>
    );
  }
  if (!byId.size) return <p className="p-8 text-center text-muted">Loading…</p>;
  if (params.has('review')) {
    return <Suspense fallback={<p className="p-8 text-center text-muted">Loading review…</p>}><Review result={result} /></Suspense>;
  }
  return <Summary result={result} />;
}

/** Correct answers, loaded with the questions (the index doesn't carry them). */
function useAnswerKey(r: TestResult) {
  const byId = useData((s) => s.byId);
  const [key, setKey] = useState<Map<string, string[]> | null>(null);
  useEffect(() => {
    let live = true;
    Promise.all(r.items.map((it) => loadQuestion(byId.get(it.id) ?? { id: it.id, chunk: '' }).then((q) => [it.id, q.correct] as const)))
      .then((pairs) => { if (live) setKey(new Map(pairs)); }, () => undefined);
    return () => { live = false; };
  }, [r, byId]);
  return key;
}

function verdict(pct: number, answered: number, total: number) {
  if (!answered) return 'You didn’t answer any questions in this set.';
  if (pct === 100) return 'Every answer right.';
  if (pct >= 80) return 'Strong set. Review the few you missed while they’re fresh.';
  if (pct >= 50) return 'About half right. The missed questions below show where to focus.';
  return answered < total ? 'A tough set, with some questions left blank.' : 'A tough set. Reviewing the explanations is the fastest way to improve.';
}

function Summary({ result: r }: { result: TestResult }) {
  const byId = useData((s) => s.byId);
  const entries = useData((s) => s.entries);
  const status = useSession((s) => s.status);
  const history = useSession((s) => s.history);
  const { start, dialog } = useStartTest();
  const s = useMemo(() => summarize(r, byId), [r, byId]);
  const answerKey = useAnswerKey(r);
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
  const weakest = weakestFirst(s.bySkill).find(([, t]) => t.correct < t.total);

  const retry = () => start(missed, { ...r.config, name: `Retry: ${r.name}`.slice(0, 80) });
  const more = () => start(practice, { ...r.config, name: `More like ${r.name}`.slice(0, 80) });
  const printSet = () => {
    useUi.setState({ printJob: { title: r.name, items: r.items, answers: true } });
    navigate('/print');
  };
  const when = new Date(r.finishedAt);
  const firstMissed = r.items.findIndex((it) => r.outcome[it.id] !== 'correct');

  return (
    <div className="mx-auto max-w-[1100px] px-4 pb-14 pt-8">
      <p className="text-sm text-muted print:hidden"><a href="#/progress" className="link font-normal">Progress</a> <span aria-hidden>/</span> Results</p>
      <h1 className="mt-2 text-xl font-extrabold">{r.name}</h1>
      <p className="mt-1 text-sm text-muted">
        Finished {when.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}, {s.total} questions{r.config.checkAnswer ? ', with Check Answer on' : ''}.
        {r.autoSubmitted && <strong className="text-bad"> Time ran out, so the set was submitted automatically.</strong>}
      </p>

      <section aria-label="Score" className="mt-8 border-y border-line-strong py-8">
        <p className="text-3xl font-extrabold sm:text-4xl">
          {s.correct} of {s.total} right
        </p>
        <p className="mt-3 max-w-[60ch] text-lg">{verdict(s.pct, s.answered, s.total)}</p>
        <p className="mt-2 max-w-[60ch] text-muted">
          {s.answered < s.total && <>{s.total - s.answered} left blank. </>}
          Took {formatClock(s.totalMs)}, about {formatDuration(s.avgMs)} a question
          {s.slow.length ? `; ${s.slow.length} ran slow (over ${SLOW_FACTOR}× the real test’s pace).` : '.'}
          {weakest && <> The skill that cost the most: <strong className="text-ink">{weakest[0]}</strong> ({weakest[1].correct} of {weakest[1].total}).</>}
        </p>
        <div className="mt-6 flex flex-wrap gap-2 print:hidden">
          <a href={reviewHref(r.key, firstMissed >= 0 ? firstMissed + 1 : 1, firstMissed >= 0 && missed.some((e) => r.outcome[e.id] === 'incorrect') ? 'incorrect' : undefined)} className={btn.hero}>
            {missed.length ? 'Review what you missed' : 'Review your answers'}
          </a>
          <button type="button" className={btn.secondary} onClick={retry} disabled={!missed.length}>Retry the {missed.length} missed</button>
          <button type="button" className={btn.secondary} onClick={more} disabled={!practice.length}
            title="A new set from the skills you missed, without questions you’ve already seen">
            Practice more like these{practice.length ? ` (${practice.length})` : ''}
          </button>
          <span className="flex-1" />
          <button type="button" className={btn.ghost} onClick={() => window.print()}><IconPrint width={16} height={16} />Print results</button>
          <button type="button" className={btn.ghost} onClick={printSet}><IconPrint width={16} height={16} />Print with answer key</button>
        </div>
      </section>

      <section aria-labelledby="sheet-h" className="mt-10">
        <h2 id="sheet-h" className="text-xl font-extrabold">Answer sheet</h2>
        <p className="mt-1 max-w-[75ch] text-sm text-muted">Filled bubbles are your answers: green is right, red is wrong. A green outline marks the right answer when you missed it. For grid-ins, the right answer is shown in green. Click a row to review that question.</p>
        <ol className="mt-4 divide-y divide-line border-y border-line-strong">
          {rows.map((e, i) => {
            const item = r.items[i];
            const o = r.outcome[e.id];
            const slow = isSlow(r.timeMs[e.id], e.section);
            return (
              <li key={e.id}>
                <a href={reviewHref(r.key, i + 1)} className="grid grid-cols-[1.75rem_minmax(9.5rem,auto)_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-1 py-2.5 hover:bg-surface-2 sm:grid-cols-[2rem_13rem_minmax(0,1fr)_6.5rem_4.5rem]">
                  <span className="text-right font-extrabold tabular-nums">{i + 1}</span>
                  <span className="flex items-center gap-1.5">
                    {e.type === 'mcq' ? (
                      <AnswerBubbles order={item.choices} answer={r.answers[e.id] as Letter | undefined} correct={answerKey?.get(e.id)} />
                    ) : (
                      <GridAnswer answer={r.answers[e.id]} correct={answerKey?.get(e.id)} outcome={o} />
                    )}
                    {r.marked.includes(e.id) && <><Flag size={15} /><span className="sr-only">Marked for review</span></>}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate">{e.skill}</span>
                    <span className="sr-only">{o === 'unanswered' ? 'Unanswered' : o === 'correct' ? 'Correct' : 'Incorrect'}. </span>
                  </span>
                  <span className="max-sm:hidden"><DifficultyBadge value={e.difficulty} /></span>
                  <span className={`text-right text-sm tabular-nums ${slow ? 'font-extrabold text-bad' : 'text-muted'}`}>
                    {formatClock(r.timeMs[e.id] ?? 0)}{slow && <span className="block text-xs font-bold">slow</span>}
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="mt-10 grid gap-x-10 gap-y-8 md:grid-cols-2">
        <Breakdown title="By skill, weakest first" rows={weakestFirst(s.bySkill).map(([k, t]) => ({ key: k, label: k, t }))} />
        <Breakdown title="By domain, weakest first" rows={weakestFirst(s.byDomain).map(([k, t]) => ({ key: k, label: k, t }))} />
        <Breakdown title="By difficulty" rows={(['Easy', 'Medium', 'Hard'] as const).filter((d) => s.byDifficulty.has(d)).map((d) => ({ key: d, label: <DifficultyBadge value={d} />, t: s.byDifficulty.get(d)! }))} />
        <Breakdown title="By section" rows={[...s.bySection].map(([k, t]) => ({ key: k, label: SECTION_LABEL[k], t }))} />
      </div>
      {dialog}
    </div>
  );
}

/** A–D bubbles in the order the student saw them: their answer filled, the key outlined. */
function AnswerBubbles({ order, answer, correct }: { order?: ChoiceOrder; answer?: Letter; correct?: string[] }) {
  return (
    <span className="flex gap-1" aria-label={answer ? `You answered ${toDisplay(order, answer)}` : 'No answer'}>
      {LETTERS.map((shown) => {
        const orig = toOriginal(order, shown);
        const mine = answer === orig;
        const right = correct?.includes(orig);
        const state = mine ? (correct ? (right ? 'correct' : 'incorrect') : 'filled') : undefined;
        return (
          <span key={shown} className={`bubble !text-[0.875rem] ${!mine && right ? '!border-2 !border-good !text-good' : ''}`} data-state={state} aria-hidden>
            {shown}
          </span>
        );
      })}
    </span>
  );
}

function GridAnswer({ answer, correct, outcome }: { answer?: string; correct?: string[]; outcome: Outcome }) {
  const tone = outcome === 'correct' ? 'border-good bg-good-soft' : outcome === 'incorrect' ? 'border-bad bg-bad-soft' : 'border-control';
  return (
    <span className="flex items-center gap-2 text-sm">
      <span className={`min-w-[3.25rem] rounded border-2 px-1.5 text-center font-bold ${tone}`}>{answer || '—'}</span>
      {outcome !== 'correct' && correct && <span className="text-good">{correct[0]}</span>}
    </span>
  );
}
