// Progress: this session's accuracy by skill, what to practise next, and every completed set.
// (Replaces the separate Dashboard and History pages; their addresses still lead here.)
import { useMemo } from 'react';
import { Breakdown, weakestFirst } from '../components/Breakdown';
import { btn } from '../components/Dialog';
import { useStartTest } from '../components/StartGuard';
import { TransferControls } from '../components/Transfer';
import { hrefFor, reviewHref } from '../lib/router';
import { formatClock, formatDuration, percent, type Tally, type TestResult } from '../lib/scoring';
import { DEFAULT_CONFIG, practiceSet } from '../lib/sets';
import { SECTION_LABEL, type Section } from '../lib/types';
import { useData } from '../store/data';
import { useSession } from '../store/session';
import { useTest } from '../store/test';

const PRACTICE_SIZE = 10;

const score = (r: TestResult) => {
  const correct = r.items.filter((i) => r.outcome[i.id] === 'correct').length;
  return { correct, total: r.items.length };
};

export default function ProgressPage() {
  const byId = useData((s) => s.byId);
  const entries = useData((s) => s.entries);
  const status = useSession((s) => s.status);
  const history = useSession((s) => s.history);
  const active = useTest((s) => s.test);
  const { start, dialog } = useStartTest();

  const stats = useMemo(() => {
    const bySection = new Map<Section, Tally>();
    const byDomain = new Map<string, Tally>();
    const bySkill = new Map<string, Tally>();
    const all: Tally = { correct: 0, total: 0 };
    const answered = new Set<string>();
    const add = <K,>(m: Map<K, Tally>, k: K, ok: boolean) => {
      const t = m.get(k) ?? { correct: 0, total: 0 };
      t.total++;
      if (ok) t.correct++;
      m.set(k, t);
    };
    for (const [id, st] of Object.entries(status)) {
      const e = byId.get(id);
      if (!e || !st.result) continue;
      const ok = st.result === 'correct';
      answered.add(id);
      all.total++;
      if (ok) all.correct++;
      add(bySection, e.section, ok);
      add(byDomain, e.domain, ok);
      add(bySkill, e.skill, ok);
    }
    const flagged = Object.values(status).filter((s) => s.flagged).length;
    const timeMs = history.reduce((t, h) => t + (h.finishedAt - h.startedAt), 0);
    return { all, bySection, byDomain, bySkill, answered, flagged, timeMs };
  }, [status, history, byId]);

  const weakest = weakestFirst(stats.bySkill).filter(([, t]) => percent(t) < 100).slice(0, 3);
  const practice = (skill: string) => {
    const set = practiceSet(entries, [skill], stats.answered, PRACTICE_SIZE);
    start(set, { ...DEFAULT_CONFIG, name: `Practice: ${skill}`.slice(0, 80), checkAnswer: true, timer: 'stopwatch' });
  };
  const left = (skill: string) => entries.filter((e) => e.skill === skill && !stats.answered.has(e.id)).length;
  const sectionOf = (skill: string) => SECTION_LABEL[entries.find((e) => e.skill === skill)?.section ?? 'math'];
  const sets = [...history].reverse();
  const nothing = stats.all.total === 0 && history.length === 0;

  return (
    <div className="mx-auto max-w-[1100px] px-4 pb-14 pt-8">
      <h1 className="text-3xl font-extrabold">Progress</h1>
      <p className="mt-2 max-w-[62ch] text-muted">
        Everything you’ve answered this session, in the bank or in tests. Nothing is saved when you close the tab, so export your results to keep them.
      </p>
      <div className="mt-4"><TransferControls /></div>

      {active && (
        <p className="mt-6 flex flex-wrap items-center gap-3 rounded-md border border-ink bg-marker-soft px-4 py-3">
          <span><strong>{active.name}</strong> is still in progress.</span>
          <a href={hrefFor('/test')} className={btn.primary}>Resume test</a>
        </p>
      )}

      {nothing ? (
        <div className="mt-8 rounded-lg border-2 border-dashed border-line-strong px-6 py-14 text-center">
          <p className="text-lg font-bold">Nothing answered yet</p>
          <p className="mx-auto mt-1 max-w-[52ch] text-muted">Try a question in the bank or take a set, and your accuracy by skill shows up here, with what to practice next.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <a href="#/" className={btn.secondary}>Go to the questions</a>
            <a href="#/build" className={btn.primary}>Build a set</a>
          </div>
        </div>
      ) : (
        <>
          <section aria-label="Summary" className="mt-8 border-y border-line-strong py-7">
            {stats.all.total > 0 ? (
              <p className="max-w-[48ch] text-2xl leading-snug">
                <strong className="font-extrabold">{stats.all.correct} of {stats.all.total}</strong> answered right this session
                {' '}<span className="text-muted">({percent(stats.all)}%)</span>
                {history.length > 0 && <>, across {history.length} set{history.length === 1 ? '' : 's'} in {formatDuration(stats.timeMs)}</>}.
              </p>
            ) : (
              <p className="text-2xl">No answers recorded yet.</p>
            )}
            {stats.flagged > 0 && (
              <p className="mt-2 text-muted">
                {stats.flagged} question{stats.flagged === 1 ? '' : 's'} flagged. <a className="link" href={hrefFor('/', new URLSearchParams('status=flagged'))}>Show flagged questions</a>
              </p>
            )}
          </section>

          {stats.all.total > 0 && (
            <section aria-labelledby="next-h" className="mt-10">
              <h2 id="next-h" className="text-xl font-extrabold">What to practice next</h2>
              {weakest.length === 0 ? (
                <p className="mt-2 text-muted">Everything you’ve answered is right so far. Try harder questions in the bank.</p>
              ) : (
                <ol className="mt-4 divide-y divide-line border-y border-line-strong">
                  {weakest.map(([skill, t], i) => (
                    <li key={skill} className="flex flex-wrap items-center gap-x-5 gap-y-3 py-4">
                      <span className="text-3xl font-extrabold tabular-nums text-muted" aria-hidden>{i + 1}</span>
                      <span className="min-w-[14rem] flex-1">
                        <span className="block text-lg font-extrabold">{skill}</span>
                        <span className="block text-sm text-muted">{sectionOf(skill)}: {t.correct} of {t.total} right ({percent(t)}%)</span>
                      </span>
                      <span className="flex flex-col items-start gap-1 max-sm:pl-11 sm:items-end">
                        <button type="button" className={i === 0 ? btn.hero : btn.secondary} disabled={!left(skill)} onClick={() => practice(skill)}>
                          Practice {Math.min(PRACTICE_SIZE, left(skill))} new questions<span className="sr-only"> of {skill}</span>
                        </button>
                        <span className="text-xs text-muted">Check Answer on, with a stopwatch</span>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}

          <section aria-labelledby="sets-h" className="mt-10">
            <h2 id="sets-h" className="text-xl font-extrabold">Completed sets</h2>
            {sets.length === 0 ? (
              <p className="mt-2 text-muted">None yet. <a className="link" href="#/build">Build a set</a> and take it, and it appears here.</p>
            ) : (
              <div className="mt-4 overflow-x-auto border-y border-line-strong">
                <table className="w-full min-w-[600px] text-[0.9375rem]">
                  <caption className="sr-only">Completed sets, newest first</caption>
                  <thead className="text-left text-sm text-muted">
                    <tr>
                      <th scope="col" className="py-2 pr-4 font-bold">Set</th>
                      <th scope="col" className="py-2 pr-4 font-bold">Finished</th>
                      <th scope="col" className="py-2 pr-4 text-right font-bold">Score</th>
                      <th scope="col" className="py-2 pr-4 text-right font-bold">Time</th>
                      <th scope="col" className="py-2"><span className="sr-only">Review</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sets.map((r) => {
                      const s = score(r);
                      return (
                        <tr key={r.key} className="border-t border-line">
                          <th scope="row" className="py-3 pr-4 text-left font-normal">
                            <a href={hrefFor(`/results/${r.key}`)} className="link">{r.name}</a>
                            <span className="block text-sm text-muted">{r.items.length} questions{r.autoSubmitted ? ', submitted when time ran out' : ''}</span>
                          </th>
                          <td className="py-3 pr-4 text-muted">{new Date(r.finishedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</td>
                          <td className="py-3 pr-4 text-right tabular-nums"><strong className="font-extrabold">{s.correct}/{s.total}</strong> <span className="text-muted">({percent(s)}%)</span></td>
                          <td className="py-3 pr-4 text-right tabular-nums">{formatClock(r.finishedAt - r.startedAt)}</td>
                          <td className="py-3 text-right">
                            <a href={reviewHref(r.key)} className="link text-sm">Review<span className="sr-only"> {r.name}</span></a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {stats.all.total > 0 && (
            <div className="mt-10 grid gap-x-10 gap-y-8 md:grid-cols-2">
              <div className="md:col-span-2">
                <Breakdown
                  title="By skill, weakest first"
                  rows={weakestFirst(stats.bySkill).map(([k, t]) => ({
                    key: k, label: k, t,
                    action: <button type="button" className="text-sm font-bold underline decoration-control underline-offset-2 hover:decoration-ink disabled:text-muted disabled:no-underline" disabled={!left(k)} onClick={() => practice(k)}>Practice<span className="sr-only"> {k}</span></button>,
                  }))}
                />
              </div>
              <Breakdown title="By domain, weakest first" rows={weakestFirst(stats.byDomain).map(([k, t]) => ({ key: k, label: k, t }))} />
              <Breakdown title="By section" rows={[...stats.bySection].map(([k, t]) => ({ key: k, label: SECTION_LABEL[k], t }))} />
            </div>
          )}
        </>
      )}
      {dialog}
    </div>
  );
}
