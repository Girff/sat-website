// A row of native radio buttons styled as a segmented control. The chosen option
// carries the highlighter, like every other "you picked this" state.
import { useId, type ReactNode } from 'react';

interface Props<V extends string> {
  legend: ReactNode;
  value: V;
  options: { value: V; label: ReactNode; hint?: string }[];
  onChange: (v: V) => void;
  description?: ReactNode;
}

export function Segmented<V extends string>({ legend, value, options, onChange, description }: Props<V>) {
  const name = useId();
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-sm font-bold">{legend}</legend>
      <div className="flex flex-wrap gap-1 rounded-md border border-line-strong bg-surface-2 p-1">
        {options.map((o) => (
          <label
            key={o.value}
            title={o.hint}
            className={`flex-auto cursor-pointer whitespace-nowrap rounded px-3 py-1.5 text-center text-sm font-bold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-ink ${
              value === o.value ? 'bg-marker-soft text-ink shadow-[inset_0_0_0_1.5px_var(--c-ink)]' : 'text-muted hover:bg-surface hover:text-ink'}`}
          >
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
            {o.label}
          </label>
        ))}
      </div>
      {description && <p className="mt-1.5 text-sm text-muted">{description}</p>}
    </fieldset>
  );
}
