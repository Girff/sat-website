// Session history: every set completed in this session, newest first.
import { btn } from '../components/Dialog';
import { TransferControls } from '../components/Transfer';
import { hrefFor, reviewHref } from '../lib/router';
import { formatClock, percent, type TestResult } from '../lib/scoring';
import { useSession } from '../store/session';
import { useTest } from '../store/test';

const score = (r: TestResult) => {
  const correct = r.items.filter((i) => r.outcome[i.id] === 'correct').length;
  return { correct, total: r.items.length };
};

export default function HistoryPage() {
  const history = useSession((s) => s.history);
  const active = useTest((s) => s.test);
  const rows = [...history].reverse();
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Session history</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Sets completed in this session. Nothing is saved when you close the tab, so export your results to keep them.
      </p>
      <div className="mt-4"><TransferControls /></div>

      {active && (
        <p className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-accent bg-accent-soft px-4 py-3 text-sm">
          <span><strong>{active.name}</strong> is in progress.</span>
          <a href={hrefFor('/test')} className={btn.primary}>Resume test</a>
        </p>
      )}

      {rows.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-line bg-surface px-4 py-14 text-center">
          <p className="font-semibold">No completed sets yet.</p>
          <p className="mt-1 text-sm text-muted">Build a problem set, take it, and it will appear here.</p>
          <a href="#/build" className={`${btn.primary} mt-4`}>Build a problem set</a>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">Completed sets</caption>
            <thead className="bg-surface-2 text-left text-xs text-muted">
              <tr>
                <th scope="col" className="px-4 py-2">Set</th>
                <th scope="col" className="px-4 py-2">Finished</th>
                <th scope="col" className="px-4 py-2 text-right">Score</th>
                <th scope="col" className="px-4 py-2 text-right">Time</th>
                <th scope="col" className="px-4 py-2"><span className="sr-only">Links</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const s = score(r);
                return (
                  <tr key={r.key} className="border-t border-line">
                    <th scope="row" className="px-4 py-3 text-left font-medium">
                      <a href={hrefFor(`/results/${r.key}`)} className="text-accent hover:underline">{r.name}</a>
                      <span className="block text-xs font-normal text-muted">{r.items.length} questions{r.autoSubmitted ? ' · auto-submitted' : ''}</span>
                    </th>
                    <td className="px-4 py-3 text-muted">{new Date(r.finishedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</td>
                    <td className="px-4 py-3 text-right tabular-nums"><strong>{s.correct}/{s.total}</strong> <span className="text-muted">({percent(s)}%)</span></td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatClock(r.finishedAt - r.startedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <a href={reviewHref(r.key)} className="font-medium text-accent hover:underline">Review<span className="sr-only"> {r.name}</span></a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
