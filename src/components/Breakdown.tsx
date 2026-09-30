// Accuracy tables with small bars (results and dashboard). Bars always carry the numbers.
import type { ReactNode } from 'react';
import { percent, type Tally } from '../lib/scoring';

export function tone(pct: number) {
  return pct >= 80 ? 'bg-easy' : pct >= 50 ? 'bg-medium' : 'bg-hard';
}

export function Bar({ t }: { t: Tally }) {
  const pct = percent(t);
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <div className={`h-full rounded-full ${tone(pct)}`} style={{ width: `${Math.max(pct, t.total ? 2 : 0)}%` }} />
      </div>
      <span className="w-10 text-right text-sm font-semibold tabular-nums">{pct}%</span>
    </div>
  );
}

interface Props {
  title: string;
  rows: { label: ReactNode; key: string; t: Tally; action?: ReactNode }[];
  empty?: string;
}

export function Breakdown({ title, rows, empty = 'Nothing yet.' }: Props) {
  return (
    <section className="rounded-xl border border-line bg-surface p-4 break-inside-avoid">
      <table className="w-full text-sm">
        <caption className="mb-2 text-left font-semibold">{title}</caption>
        <thead className="sr-only">
          <tr><th scope="col">Category</th><th scope="col">Correct</th><th scope="col">Accuracy</th>{rows.some((r) => r.action) && <th scope="col">Action</th>}</tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td className="py-2 text-muted">{empty}</td></tr>}
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-line first:border-t-0">
              <th scope="row" className="py-2 pr-3 text-left font-normal">{r.label}</th>
              <td className="w-16 whitespace-nowrap py-2 pr-3 text-right tabular-nums text-muted">{r.t.correct}/{r.t.total}</td>
              <td className="w-[38%] py-2"><Bar t={r.t} /></td>
              {r.action !== undefined && <td className="py-2 pl-3 text-right">{r.action}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** Map entries sorted weakest first (then by more attempts). */
export function weakestFirst<K>(m: Map<K, Tally>) {
  return [...m.entries()].sort((a, b) => percent(a[1]) - percent(b[1]) || b[1].total - a[1].total);
}
