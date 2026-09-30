// Answer box for student-produced responses, with the SAT's answer preview.
import { MAX_INPUT, gridInError, gridInPreview, parseGridIn } from '../../lib/gridin';
import { TeX } from '../RichContent';

interface Props {
  id: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  onEnter?: () => void;
  /** After checking: was the answer right? */
  verdict?: 'correct' | 'incorrect' | 'unanswered';
}

export function GridIn({ id, value, onChange, disabled, onEnter, verdict }: Props) {
  const error = gridInError(value);
  const preview = value && !error && parseGridIn(value) ? gridInPreview(value) : null;
  const tone = verdict === 'correct' ? 'border-easy bg-easy-soft' : verdict === 'incorrect' ? 'border-hard bg-hard-soft' : error ? 'border-hard' : 'border-line-strong focus:border-accent';
  return (
    <div className="my-5">
      <label htmlFor={id} className="block text-sm font-semibold">Your answer</label>
      <input
        id={id}
        type="text"
        inputMode="text"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        maxLength={MAX_INPUT}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onEnter) {
            e.preventDefault();
            e.stopPropagation();
            onEnter();
          }
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-help`}
        className={`mt-1.5 h-12 w-44 rounded-md border-2 bg-surface px-3 text-center font-mono text-xl tracking-wider outline-none disabled:opacity-80 ${tone}`}
      />
      <p id={`${id}-help`} className="mt-2 min-h-6 text-sm" aria-live="polite">
        {error ? (
          <span className="text-hard">{error}</span>
        ) : preview ? (
          <span className="text-muted">Answer preview: <span className="ml-1 text-base text-ink"><TeX tex={preview} /></span></span>
        ) : (
          <span className="text-muted">Enter a whole number, a fraction like 3/4, or a decimal like .75. Negative answers start with −.</span>
        )}
      </p>
    </div>
  );
}
