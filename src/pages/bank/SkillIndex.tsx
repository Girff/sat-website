// The skill index: every domain and skill of the current section, with how many
// questions match and how far you've got through each skill this session.
// Ticking works as "any of these" (a domain tick ticks all of its skills).
import { useEffect, useMemo, useRef } from 'react';
import { domainOptions, skillOptions, type Facets, type Filters, type QStatus } from '../../lib/filters';
import { SECTION_LABEL, type IndexEntry, type Section } from '../../lib/types';

interface Props {
  entries: IndexEntry[];
  filters: Filters;
  facets: Facets;
  status: Record<string, QStatus>;
  onChange: (patch: Partial<Filters>) => void;
}

interface Progress { done: number; correct: number; total: number }

/** Skills currently chosen, whether picked one by one or through a domain filter in the URL. */
export function chosenSkills(entries: IndexEntry[], f: Filters): Set<string> {
  if (f.skills.length) return new Set(f.skills);
  if (!f.domains.length) return new Set();
  return new Set(skillOptions(entries, f).flatMap((g) => g.skills));
}

export function SkillIndex({ entries, filters, facets, status, onChange }: Props) {
  const chosen = useMemo(() => chosenSkills(entries, filters), [entries, filters]);
  const groups = useMemo(() => skillOptions(entries, { ...filters, domains: [] }), [entries, filters]);
  const sectionOf = useMemo(() => new Map(entries.map((e) => [e.domain, e.section])), [entries]);
  const progress = useMemo(() => {
    const m = new Map<string, Progress>();
    for (const e of entries) {
      const p = m.get(e.skill) ?? { done: 0, correct: 0, total: 0 };
      p.total++;
      const r = status[e.id]?.result;
      if (r) p.done++;
      if (r === 'correct') p.correct++;
      m.set(e.skill, p);
    }
    return m;
  }, [entries, status]);

  const set = (skills: Set<string>) => onChange({ skills: [...skills], domains: [] });
  const toggleSkill = (s: string) => {
    const next = new Set(chosen);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    set(next);
  };
  const toggleDomain = (skills: string[], on: boolean) => {
    const next = new Set(chosen);
    for (const s of skills) {
      if (on) next.add(s);
      else next.delete(s);
    }
    set(next);
  };

  const ordered = domainOptions(entries, filters.tab)
    .sort((a, b) => (sectionOf.get(b) ?? '').localeCompare(sectionOf.get(a) ?? '') || a.localeCompare(b));
  let lastSection: Section | undefined;

  return (
    <nav aria-label="Skills" className="text-sm">
      <button
        type="button"
        onClick={() => set(new Set())}
        aria-pressed={chosen.size === 0}
        className={`mb-2 flex w-full items-baseline justify-between rounded px-2 py-1.5 text-left font-bold ${chosen.size === 0 ? 'bg-marker-soft text-ink shadow-[inset_0_0_0_1.5px_var(--c-ink)]' : 'hover:bg-surface-3'}`}
      >
        <span>All skills</span>
        <span className="tabular-nums">{facets.tabs[filters.tab].toLocaleString()}</span>
      </button>
      {ordered.map((domain) => {
        const g = groups.find((x) => x.domain === domain);
        if (!g) return null;
        const section = sectionOf.get(domain) ?? 'math';
        const heading = filters.tab === 'both' && section !== lastSection;
        lastSection = section;
        const picked = g.skills.filter((s) => chosen.has(s)).length;
        return (
          <div key={domain}>
            {heading && <p className="mb-1 mt-4 px-2 text-[0.8125rem] font-bold text-muted first:mt-0">{SECTION_LABEL[section]}</p>}
            <div role="group" aria-label={domain} className="mb-3">
              <DomainRow
                domain={domain}
                count={facets.domains.get(domain) ?? 0}
                state={picked === 0 ? 'off' : picked === g.skills.length ? 'on' : 'some'}
                onToggle={(on) => toggleDomain(g.skills, on)}
              />
              <ul>
                {g.skills.map((s) => (
                  <SkillRow
                    key={s}
                    skill={s}
                    count={facets.skills.get(s) ?? 0}
                    checked={chosen.has(s)}
                    progress={progress.get(s)}
                    onToggle={() => toggleSkill(s)}
                  />
                ))}
              </ul>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function DomainRow({ domain, count, state, onToggle }: { domain: string; count: number; state: 'on' | 'off' | 'some'; onToggle: (on: boolean) => void }) {
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => { if (box.current) box.current.indeterminate = state === 'some'; }, [state]);
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 font-bold hover:bg-surface-3">
      <input ref={box} type="checkbox" className="check" checked={state === 'on'} onChange={() => onToggle(state !== 'on')} />
      <span className="flex-1">{domain}</span>
      <span className="tabular-nums text-muted">{count.toLocaleString()}</span>
    </label>
  );
}

function SkillRow({ skill, count, checked, progress, onToggle }: { skill: string; count: number; checked: boolean; progress?: Progress; onToggle: () => void }) {
  const done = progress?.done ?? 0;
  return (
    <li>
      <label className={`flex cursor-pointer items-start gap-2.5 rounded py-1.5 pl-6 pr-2 hover:bg-surface-3 ${checked ? 'bg-marker-soft' : ''} ${count === 0 && !checked ? 'text-muted' : ''}`}>
        <input type="checkbox" className="check mt-0.5" checked={checked} onChange={onToggle} />
        <span className="min-w-0 flex-1">
          <span className="block leading-snug">{skill}</span>
          {done > 0 && progress && (
            <span className="mt-1 flex items-center gap-2 text-xs text-muted">
              <span aria-hidden className="flex h-1 w-14 overflow-hidden rounded-full bg-surface-3">
                <span className="bg-good" style={{ width: `${(progress.correct / progress.total) * 100}%` }} />
                <span className="bg-bad" style={{ width: `${((progress.done - progress.correct) / progress.total) * 100}%` }} />
              </span>
              {progress.correct} of {done} right
            </span>
          )}
        </span>
        <span className="tabular-nums text-muted">{count.toLocaleString()}</span>
      </label>
    </li>
  );
}
