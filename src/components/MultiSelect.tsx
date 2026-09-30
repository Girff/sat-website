import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { IconChevron } from './Icons';

export interface Option<V extends string> {
  value: V;
  label: string;
  count?: number;
  group?: string;
}

interface Props<V extends string> {
  label: string;
  options: Option<V>[];
  selected: V[];
  onChange: (next: V[]) => void;
}

/** Filter dropdown: a button that opens a list of checkboxes with match counts. */
export function MultiSelect<V extends string>({ label, options, selected, onChange }: Props<V>) {
  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !button.current) return;
    const r = button.current.getBoundingClientRect();
    setAlignRight(r.left + 320 > window.innerWidth);
    root.current?.querySelector<HTMLInputElement>('input[type=checkbox]')?.focus();
  }, [open]);

  const toggle = (v: V) => onChange(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v]);
  const groups: { name: string | undefined; items: Option<V>[] }[] = [];
  for (const o of options) {
    const last = groups[groups.length - 1];
    if (last && last.name === o.group) last.items.push(o);
    else groups.push({ name: o.group, items: [o] });
  }

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className={`flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium ${
          selected.length ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-ink hover:border-line-strong'
        }`}
      >
        {label}
        {selected.length > 0 && <span className="rounded-full bg-accent px-1.5 text-xs leading-5 text-accent-ink">{selected.length}</span>}
        <IconChevron width={16} height={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          id={panelId}
          role="group"
          aria-label={`${label} filter`}
          className={`absolute z-40 mt-1 max-h-[min(28rem,70vh)] w-[min(20rem,calc(100vw-2rem))] overflow-auto rounded-lg border border-line bg-surface p-1 shadow-lg ${alignRight ? 'right-0' : 'left-0'}`}
        >
          {groups.map((g, gi) => (
            <div key={gi} role={g.name ? 'group' : undefined} aria-label={g.name}>
              {g.name && <div className="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted">{g.name}</div>}
              {g.items.map((o) => {
                const checked = selected.includes(o.value);
                const empty = o.count === 0 && !checked;
                return (
                  <label
                    key={o.value}
                    className={`flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-2 ${empty ? 'text-muted' : ''}`}
                  >
                    <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[var(--c-accent)]" checked={checked} onChange={() => toggle(o.value)} />
                    <span className="flex-1">{o.label}</span>
                    {o.count !== undefined && <span className="tabular-nums text-xs text-muted">{o.count.toLocaleString()}</span>}
                  </label>
                );
              })}
            </div>
          ))}
          <div className="sticky bottom-0 mt-1 flex justify-end border-t border-line bg-surface px-1 pt-1">
            <button
              type="button"
              disabled={!selected.length}
              onClick={() => onChange([])}
              className="rounded px-2 py-1 text-xs font-medium text-accent hover:bg-accent-soft disabled:text-muted disabled:hover:bg-transparent"
            >
              Clear {label.toLowerCase()}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
