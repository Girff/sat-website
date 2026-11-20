// "How to use" popover in the top bar.
import { useEffect, useId, useRef, useState } from 'react';
import { IconX } from './Icons';

const TOPICS: [string, string][] = [
  ['Find questions', 'Pick a section, then tick skills on the left (on a phone, under Skills). Search, filter by difficulty, type or status, and sort by clicking a column heading; Shift-click adds a second sort. The address bar keeps your filters, so you can bookmark a view.'],
  ['Try one', 'Click a question to open it. The answer stays hidden until you press Check Answer. Keys: A–D choose, Enter checks, ← → move, Esc closes.'],
  ['Build a set', 'Tick questions (Shift-click ticks a range) and press Build a set, or pick questions at random on the Build a set page. Choose the timer and whether to check answers as you go.'],
  ['Take a test', 'Like the real test: the navigator at the bottom jumps between questions, Mark for Review flags one, and ABC crosses out choices. Reading & Writing has a highlighter; Math has the Desmos calculator and the reference sheet.'],
  ['Desmos regression', 'Tick Desmos regression in the bank, or Only Desmos regression questions when picking at random, for Math questions that are fastest with Desmos’s ~ regression. Each one has a setup tip under the question.'],
  ['Review', 'After submitting, the answer sheet shows every answer. Click any answer choice in review to see why it is right or wrong, then retry what you missed or practice more of the same skills.'],
  ['Saving', 'Nothing is stored on this computer. Export your results from the Progress page, and import the file next time.'],
];

export function HelpButton() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
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

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label="How to use this site"
        title="How to use"
        onClick={() => setOpen((o) => !o)}
        className="grid size-9 place-items-center rounded-md text-base font-extrabold text-muted hover:bg-surface-2 hover:text-ink"
      >
        ?
      </button>
      {open && (
        <div id={id} role="dialog" aria-label="How to use" className="absolute right-0 z-50 mt-2 w-[min(27rem,calc(100vw-1.5rem))] rounded-lg border border-line-strong bg-surface p-5 shadow-[0_24px_60px_-12px_rgb(28_31_36/0.35)]">
          <div className="mb-2 flex items-center">
            <h2 className="flex-1 text-lg font-extrabold">How to use</h2>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close help" className="grid size-8 place-items-center rounded-md text-muted hover:bg-surface-2"><IconX width={18} height={18} /></button>
          </div>
          <dl tabIndex={0} className="grid max-h-[70vh] gap-3 overflow-auto rounded text-sm">
            {TOPICS.map(([t, d]) => (
              <div key={t}>
                <dt className="font-extrabold">{t}</dt>
                <dd className="mt-0.5 leading-relaxed text-muted">{d}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
