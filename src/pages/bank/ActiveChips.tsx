import { IconX } from '../../components/Icons';
import { DESMOS_LABEL } from '../../lib/desmos';
import { STATUS_LABEL, activeFilterCount, skillOptions, type Filters } from '../../lib/filters';
import { TYPE_LABEL, type IndexEntry } from '../../lib/types';

interface Chip {
  key: string;
  label: string;
  remove: Partial<Filters>;
}

interface Props {
  entries: IndexEntry[];
  filters: Filters;
  onChange: (p: Partial<Filters>) => void;
  onClear: () => void;
}

export function ActiveChips({ entries, filters, onChange, onClear }: Props) {
  if (!activeFilterCount(filters)) return null;
  // a domain whose skills are all ticked shows as one chip
  const groups = skillOptions(entries, { ...filters, domains: [] });
  const skillChips: Chip[] = [];
  const covered = new Set<string>();
  for (const g of groups) {
    if (g.skills.length > 1 && g.skills.every((s) => filters.skills.includes(s))) {
      g.skills.forEach((s) => covered.add(s));
      skillChips.push({ key: `g:${g.domain}`, label: g.domain, remove: { skills: filters.skills.filter((s) => !g.skills.includes(s)) } });
    }
  }
  for (const s of filters.skills) {
    if (!covered.has(s)) skillChips.push({ key: `s:${s}`, label: s, remove: { skills: filters.skills.filter((x) => x !== s) } });
  }
  const chips: Chip[] = [
    ...filters.domains.map((d) => ({ key: `d:${d}`, label: d, remove: { domains: filters.domains.filter((x) => x !== d) } })),
    ...skillChips,
    ...filters.difficulties.map((d) => ({ key: `f:${d}`, label: d, remove: { difficulties: filters.difficulties.filter((x) => x !== d) } })),
    ...filters.types.map((t) => ({ key: `t:${t}`, label: TYPE_LABEL[t], remove: { types: filters.types.filter((x) => x !== t) } })),
    ...filters.statuses.map((s) => ({ key: `st:${s}`, label: STATUS_LABEL[s], remove: { statuses: filters.statuses.filter((x) => x !== s) } })),
    ...(filters.desmos ? [{ key: 'desmos', label: DESMOS_LABEL, remove: { desmos: false } }] : []),
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
            className="inline-flex max-w-[22rem] items-center gap-1 rounded-full border border-line-strong bg-marker-soft py-0.5 pl-2.5 pr-1.5 text-[0.8125rem] font-bold hover:border-ink"
          >
            <span className="truncate">{c.label}</span>
            <IconX width={14} height={14} className="shrink-0 text-muted" />
          </button>
        </li>
      ))}
      <li>
        <button type="button" onClick={onClear} className="rounded px-2 py-0.5 text-[0.8125rem] font-bold underline decoration-control underline-offset-2 hover:decoration-ink">
          Clear all
        </button>
      </li>
    </ul>
  );
}
