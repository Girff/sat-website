import { IconX } from '../../components/Icons';
import { STATUS_LABEL, activeFilterCount, type Filters } from '../../lib/filters';
import { TYPE_LABEL } from '../../lib/types';

interface Chip {
  key: string;
  label: string;
  remove: Partial<Filters>;
}

export function ActiveChips({ filters, onChange, onClear }: { filters: Filters; onChange: (p: Partial<Filters>) => void; onClear: () => void }) {
  if (!activeFilterCount(filters)) return null;
  const chips: Chip[] = [
    ...filters.domains.map((d) => ({ key: `d:${d}`, label: `Domain: ${d}`, remove: { domains: filters.domains.filter((x) => x !== d) } })),
    ...filters.skills.map((s) => ({ key: `s:${s}`, label: `Skill: ${s}`, remove: { skills: filters.skills.filter((x) => x !== s) } })),
    ...filters.difficulties.map((d) => ({ key: `f:${d}`, label: d, remove: { difficulties: filters.difficulties.filter((x) => x !== d) } })),
    ...filters.types.map((t) => ({ key: `t:${t}`, label: TYPE_LABEL[t], remove: { types: filters.types.filter((x) => x !== t) } })),
    ...filters.statuses.map((s) => ({ key: `st:${s}`, label: `Status: ${STATUS_LABEL[s]}`, remove: { statuses: filters.statuses.filter((x) => x !== s) } })),
    ...(filters.q.trim() ? [{ key: 'q', label: `“${filters.q.trim()}”`, remove: { q: '' } }] : []),
  ];
  return (
    <ul className="flex flex-wrap items-center gap-1.5" aria-label="Active filters">
      {chips.map((c) => (
        <li key={c.key}>
          <button
            type="button"
            onClick={() => onChange(c.remove)}
            aria-label={`Remove filter ${c.label}`}
            className="inline-flex max-w-[22rem] items-center gap-1 rounded-full border border-line bg-surface py-0.5 pl-2.5 pr-1.5 text-xs font-medium hover:border-line-strong"
          >
            <span className="truncate">{c.label}</span>
            <IconX width={14} height={14} className="shrink-0 text-muted" />
          </button>
        </li>
      ))}
      <li>
        <button type="button" onClick={onClear} className="rounded px-2 py-0.5 text-xs font-semibold text-accent hover:bg-accent-soft">
          Clear all
        </button>
      </li>
    </ul>
  );
}
