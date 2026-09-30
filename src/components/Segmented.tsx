// A row of native radio buttons styled as a segmented control.
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
      <legend className="mb-1.5 text-sm font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-1 rounded-lg border border-line bg-surface-2 p-1">
        {options.map((o) => (
          <label
            key={o.value}
            title={o.hint}
            className={`flex-1 cursor-pointer whitespace-nowrap rounded-md px-3 py-1.5 text-center text-sm font-medium has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${
              value === o.value ? 'bg-surface text-ink shadow-sm ring-1 ring-line-strong' : 'text-muted hover:text-ink'}`}
          >
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
            {o.label}
          </label>
        ))}
      </div>
      {description && <p className="mt-1.5 text-xs text-muted">{description}</p>}
    </fieldset>
  );
}
