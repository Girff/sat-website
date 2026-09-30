// Answer choices, Bluebook style: a lettered box per choice, an optional cross-out
// button beside each, and correct/incorrect marks once the answer is revealed.
import { useRef, type KeyboardEvent } from 'react';
import { LETTERS, type ChoiceOrder } from '../../lib/letters';
import type { Letter, Question } from '../../lib/types';
import { IconCheck, IconX } from '../Icons';
import { Blocks } from '../RichContent';

interface Props {
  q: Question;
  /** Display order of the original choices (shuffled sets). */
  order?: ChoiceOrder;
  /** 'answer': pick one choice (radio group). 'review': click a choice to see its explanation. */
  mode?: 'answer' | 'review';
  /** The student's answer (original letter). */
  selected?: Letter;
  onSelect?: (orig: Letter) => void;
  disabled?: boolean;
  eliminated?: Letter[];
  /** Show the cross-out buttons. */
  eliminator?: boolean;
  onEliminate?: (orig: Letter) => void;
  /** Mark the correct answer, and the student's answer if it is wrong. */
  reveal?: boolean;
  /** Review mode: the choice whose explanation is showing. */
  explaining?: Letter;
  /** Enter pressed on a choice (checks the answer where that is allowed). */
  onEnter?: () => void;
}

export function ChoiceList({
  q, order, mode = 'answer', selected, onSelect, disabled, eliminated = [], eliminator, onEliminate, reveal, explaining, onEnter,
}: Props) {
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const choices = LETTERS.map((shown, i) => {
    const orig = order?.[i] ?? shown;
    return { shown, orig, content: q.choices?.find((c) => c.label === orig)?.content };
  }).filter((c) => c.content);
  const radio = mode === 'answer';
  const focusIndex = Math.max(0, choices.findIndex((c) => c.orig === (radio ? selected : explaining)));

  const onKey = (e: KeyboardEvent, i: number) => {
    const c = choices[i];
    if (radio && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      e.stopPropagation();
      const n = (i + (e.key === 'ArrowDown' ? 1 : choices.length - 1)) % choices.length;
      refs.current[n]?.focus();
      if (!disabled) onSelect?.(choices[n].orig);
    } else if (e.key === ' ') {
      e.preventDefault();
      if (!disabled) onSelect?.(c.orig);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (onEnter) onEnter();
      else if (!disabled) onSelect?.(c.orig);
    }
  };

  return (
    <div role={radio ? 'radiogroup' : 'group'} aria-label="Answer choices" className="my-4 grid gap-2.5">
      {choices.map((c, i) => {
        const isSel = selected === c.orig;
        const isRight = q.correct.includes(c.orig);
        const isOut = eliminated.includes(c.orig);
        const isExplain = explaining === c.orig;
        let tone = 'border-line-strong hover:border-accent';
        if (reveal && isRight) tone = 'border-easy bg-easy-soft';
        else if (reveal && isSel) tone = 'border-hard bg-hard-soft';
        else if (radio && isSel) tone = 'border-accent bg-accent-soft';
        if (isExplain) tone += ' ring-2 ring-accent ring-offset-2 ring-offset-surface';
        const marks = [];
        if (reveal && isRight) marks.push(<Mark key="c" ok>Correct answer</Mark>);
        if (reveal && isSel) marks.push(<Mark key="y" ok={isRight}>Your answer</Mark>);
        return (
          <div key={c.shown} className="flex items-stretch gap-2">
            <div
              ref={(el) => { refs.current[i] = el; }}
              role={radio ? 'radio' : 'button'}
              aria-checked={radio ? isSel : undefined}
              aria-pressed={radio ? undefined : isExplain}
              aria-disabled={disabled || undefined}
              tabIndex={radio ? (i === focusIndex ? 0 : -1) : 0}
              onClick={() => { if (!disabled) onSelect?.(c.orig); }}
              onKeyDown={(e) => onKey(e, i)}
              className={`q-choice relative flex min-w-0 flex-1 items-start gap-3 rounded-lg border-2 px-3 py-2.5 transition-colors ${tone} ${
                disabled ? 'cursor-default' : 'cursor-pointer'} ${isOut ? 'q-eliminated' : ''}`}
            >
              <span
                aria-hidden
                className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border-2 text-sm font-bold ${
                  (radio && isSel && !reveal) ? 'border-accent bg-accent text-accent-ink' : 'border-current'}`}
              >
                {c.shown}
              </span>
              <span className="sr-only">Choice {c.shown}{isOut ? ' (crossed out)' : ''}:</span>
              <div className={`min-w-0 flex-1 ${isOut ? 'opacity-50' : ''}`}>
                <Blocks blocks={c.content} />
                {marks.length > 0 && <div className="mt-1 flex flex-wrap gap-2">{marks}</div>}
              </div>
            </div>
            {eliminator && (
              <button
                type="button"
                onClick={() => onEliminate?.(c.orig)}
                aria-pressed={isOut}
                aria-label={isOut ? `Undo cross-out of choice ${c.shown}` : `Cross out choice ${c.shown}`}
                className="grid w-11 shrink-0 place-items-center rounded-lg text-sm font-bold text-muted hover:bg-surface-2 hover:text-ink"
              >
                {isOut ? <span className="text-xs font-semibold underline">Undo</span> : <span className="relative">{c.shown}<span aria-hidden className="absolute inset-x-[-4px] top-1/2 border-t-2 border-current" /></span>}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Mark({ ok, children }: { ok: boolean; children: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${ok ? 'bg-easy text-white dark:text-bg' : 'bg-hard text-white dark:text-bg'}`}>
      {ok ? <IconCheck width={14} height={14} /> : <IconX width={14} height={14} />}
      {children}
    </span>
  );
}
