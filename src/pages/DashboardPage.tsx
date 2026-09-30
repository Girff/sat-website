// Session dashboard: attempts, accuracy by domain and skill, and the three weakest skills.
import { useMemo } from 'react';
import { Breakdown, weakestFirst } from '../components/Breakdown';
import { btn } from '../components/Dialog';
import { useStartTest } from '../components/StartGuard';
import { TransferControls } from '../components/Transfer';
import { formatDuration, percent, type Tally } from '../lib/scoring';
import { DEFAULT_CONFIG, practiceSet } from '../lib/sets';
import { SECTION_LABEL, type Section } from '../lib/types';
import { useData } from '../store/data';
import { useSession } from '../store/session';

const PRACTICE_SIZE = 10;

export default function DashboardPage() {
  const byId = useData((s) => s.byId);
  const entries = useData((s) => s.entries);
  const status = useSession((s) => s.status);
  const history = useSession((s) => s.history);
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

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-1 text-sm text-muted">This session’s practice: questions checked in the bank and questions answered in tests (latest result per question).</p>
      <div className="mt-4"><TransferControls /></div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Questions attempted" value={stats.all.total.toLocaleString()} />
        <Stat label="Accuracy" value={stats.all.total ? `${percent(stats.all)}%` : '—'} sub={stats.all.total ? `${stats.all.correct} correct` : undefined} />
        <Stat label="Sets completed" value={String(history.length)} sub={history.length ? `${formatDuration(stats.timeMs)} in tests` : undefined} />
        <Stat label="Flagged" value={String(stats.flagged)} sub="Filter the bank by status to find them" />
      </div>

      {stats.all.total === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-line bg-surface px-4 py-14 text-center">
          <p className="font-semibold">Nothing attempted yet.</p>
          <p className="mt-1 text-sm text-muted">Check answers in the question bank or complete a problem set, and your accuracy by skill appears here.</p>
          <div className="mt-4 flex justify-center gap-2">
            <a href="#/" className={btn.secondary}>Question bank</a>
            <a href="#/build" className={btn.primary}>Build a problem set</a>
          </div>
        </div>
      ) : (
        <>
          <section className="mt-6 rounded-xl border border-line bg-surface p-4">
            <h2 className="font-semibold">Weakest skills</h2>
            {weakest.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Everything you’ve attempted is correct so far. Nice work.</p>
            ) : (
              <ol className="mt-3 grid gap-3 md:grid-cols-3">
                {weakest.map(([skill, t], i) => (
                  <li key={skill} className="flex flex-col rounded-lg border border-line p-4">
                    <span className="text-xs font-semibold text-muted">#{i + 1} · {SECTION_LABEL[entries.find((e) => e.skill === skill)?.section ?? 'math']}</span>
                    <span className="mt-1 font-semibold">{skill}</span>
                    <span className="mt-1 text-sm text-muted">{t.correct} of {t.total} correct ({percent(t)}%)</span>
                    <button type="button" className={`${btn.primary} mt-3`} disabled={!left(skill)} onClick={() => practice(skill)}>
                      Practice this skill
                    </button>
                    <span className="mt-1 text-xs text-muted">{Math.min(PRACTICE_SIZE, left(skill))} new questions, Check Answer on</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Breakdown title="Accuracy by section" rows={[...stats.bySection].map(([k, t]) => ({ key: k, label: SECTION_LABEL[k], t }))} />
            <Breakdown title="Accuracy by domain (weakest first)" rows={weakestFirst(stats.byDomain).map(([k, t]) => ({ key: k, label: k, t }))} />
          </div>
          <div className="mt-4">
            <Breakdown
              title="Accuracy by skill (weakest first)"
              rows={weakestFirst(stats.bySkill).map(([k, t]) => ({
                key: k, label: k, t,
                action: <button type="button" className="text-sm font-medium text-accent hover:underline disabled:text-muted disabled:no-underline" disabled={!left(k)} onClick={() => practice(k)}>Practice<span className="sr-only"> {k}</span></button>,
              }))}
            />
          </div>
        </>
      )}
      {dialog}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}
