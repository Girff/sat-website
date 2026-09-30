// "Generate Random Set": section, size, domains/skills, difficulty mix, and
// whether to skip questions already answered this session.
import { useMemo } from 'react';
import { MultiSelect, type Option } from '../../components/MultiSelect';
import { Segmented } from '../../components/Segmented';
import type { Tab } from '../../lib/filters';
import { MIX_PRESETS, allocate, generatorPool, type GenOptions, type Mix } from '../../lib/sets';
import { DIFFICULTIES, SECTION_LABEL, type IndexEntry } from '../../lib/types';

interface Props {
  entries: IndexEntry[];
  answered: Set<string>;
  options: GenOptions;
  onChange: (patch: Partial<GenOptions>) => void;
}

const count = (xs: IndexEntry[], key: (e: IndexEntry) => string) => {
  const m = new Map<string, number>();
  for (const e of xs) m.set(key(e), (m.get(key(e)) ?? 0) + 1);
  return m;
};

export const mixTotal = (mix: Mix | null) => (mix ? DIFFICULTIES.reduce((t, d) => t + mix[d], 0) : 100);

export function Generator({ entries, answered, options: o, onChange }: Props) {
  const base = useMemo(() => generatorPool(entries, { ...o, domains: [], skills: [] }, answered), [entries, o, answered]);
  const inDomains = useMemo(() => base.filter((e) => !o.domains.length || o.domains.includes(e.domain)), [base, o.domains]);
  const pool = useMemo(() => generatorPool(entries, o, answered), [entries, o, answered]);

  const domainCounts = count(base, (e) => e.domain);
  const skillCounts = count(inDomains, (e) => e.skill);
  const sectionOf = new Map(entries.map((e) => [e.domain, e.section]));
  const domains: Option<string>[] = [...domainCounts.keys()]
    .sort((a, b) => (sectionOf.get(b) ?? '').localeCompare(sectionOf.get(a) ?? '') || a.localeCompare(b))
    .map((d) => ({ value: d, label: d, count: domainCounts.get(d), group: o.section === 'both' ? SECTION_LABEL[sectionOf.get(d) ?? 'math'] : undefined }));
  const domainOfSkill = new Map(entries.map((e) => [e.skill, e.domain]));
  const skills: Option<string>[] = [...skillCounts.keys()]
    .sort((a, b) => (domainOfSkill.get(a) ?? '').localeCompare(domainOfSkill.get(b) ?? '') || a.localeCompare(b))
    .map((s) => ({ value: s, label: s, count: skillCounts.get(s), group: domainOfSkill.get(s) }));

  const preset = MIX_PRESETS.find((p) => JSON.stringify(p.mix) === JSON.stringify(o.mix))?.label ?? 'Custom';
  const total = mixTotal(o.mix);
  const byDiff = count(pool, (e) => e.difficulty);
  const n = Math.min(o.count, pool.length);
  const plan = o.mix && total === 100 ? allocate(n, o.mix) : null;
  const short = plan ? DIFFICULTIES.filter((d) => plan[d] > (byDiff.get(d) ?? 0)) : [];

  const setSection = (section: Tab) => {
    const keep = (d: string) => section === 'both' || sectionOf.get(d) === section;
    const doms = o.domains.filter(keep);
    onChange({ section, domains: doms, skills: o.skills.filter((s) => keep(domainOfSkill.get(s) ?? '')) });
  };

  return (
    <div className="grid gap-5">
      <Segmented<Tab>
        legend="Section"
        value={o.section}
        onChange={setSection}
        options={[{ value: 'reading', label: 'Reading & Writing' }, { value: 'math', label: 'Math' }, { value: 'both', label: 'Both' }]}
      />

      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <label className="text-sm font-semibold">
          Number of questions
          <input
            type="number"
            min={1}
            max={100}
            value={o.count}
            onChange={(e) => onChange({ count: Math.min(100, Math.max(1, Math.round(Number(e.target.value)) || 1)) })}
            className="mt-1.5 block h-10 w-28 rounded-md border border-line-strong bg-surface px-3 text-right font-normal tabular-nums"
          />
        </label>
        <div>
          <p className="mb-1.5 text-sm font-semibold">Topics</p>
          <div className="flex flex-wrap gap-2">
            <MultiSelect label="Domain" options={domains} selected={o.domains} onChange={(ds) => {
              const skillOk = (s: string) => !ds.length || ds.includes(domainOfSkill.get(s) ?? '');
              onChange({ domains: ds, skills: o.skills.filter(skillOk) });
            }} />
            <MultiSelect label="Skill" options={skills} selected={o.skills} onChange={(skills) => onChange({ skills })} />
          </div>
        </div>
      </div>

      <div>
        <Segmented
          legend="Difficulty mix"
          value={preset}
          onChange={(label) => {
            const p = MIX_PRESETS.find((x) => x.label === label);
            onChange({ mix: p ? p.mix : { Easy: 34, Medium: 33, Hard: 33 } });
          }}
          options={[...MIX_PRESETS.map((p) => ({ value: p.label, label: p.label })), { value: 'Custom', label: 'Custom' }]}
        />
        {o.mix && (
          <div className="mt-3 flex flex-wrap items-center gap-4">
            {DIFFICULTIES.map((d) => (
              <label key={d} className="flex items-center gap-2 text-sm">
                <span className="w-14">{d}</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={o.mix![d]}
                  onChange={(e) => onChange({ mix: { ...o.mix!, [d]: Math.min(100, Math.max(0, Math.round(Number(e.target.value)) || 0)) } })}
                  className="h-9 w-20 rounded-md border border-line-strong bg-surface px-2 text-right tabular-nums"
                  aria-describedby="mix-total"
                />
                %
              </label>
            ))}
            <p id="mix-total" className={`text-sm ${total === 100 ? 'text-muted' : 'font-semibold text-hard'}`} aria-live="polite">
              {total === 100 ? (plan ? `${plan.Easy} Easy · ${plan.Medium} Medium · ${plan.Hard} Hard` : '') : `Adds up to ${total}%; make it 100%.`}
            </p>
          </div>
        )}
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 size-4 accent-[var(--c-accent)]"
          checked={o.excludeAnswered}
          onChange={(e) => onChange({ excludeAnswered: e.target.checked })}
        />
        <span>
          Exclude questions already answered this session
          <span className="block text-xs text-muted">{answered.size.toLocaleString()} answered so far</span>
        </span>
      </label>

      <p className="text-sm" aria-live="polite">
        <strong className="tabular-nums">{pool.length.toLocaleString()}</strong> question{pool.length === 1 ? '' : 's'} match.
        {pool.length < o.count && pool.length > 0 && <span className="text-medium"> The set will have {pool.length}.</span>}
        {pool.length === 0 && <span className="text-hard"> Loosen the filters to generate a set.</span>}
        {short.length > 0 && <span className="text-muted"> Not enough {short.join(' and ')} questions; the rest are filled from other difficulties.</span>}
      </p>
    </div>
  );
}
