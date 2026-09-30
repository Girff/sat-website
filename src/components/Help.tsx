// "How to use" popover in the top bar.
import { useEffect, useId, useRef, useState } from 'react';
import { IconX } from './Icons';

const TOPICS: [string, string][] = [
  ['Find questions', 'Pick Reading & Writing, Math or Both, then filter, search, and sort by clicking column headers (Shift-click adds a second sort). The address bar keeps your filters, so you can bookmark a view.'],
  ['Preview', 'Click a row to open a question. Answers stay hidden until you press Check Answer, and hide again when you move on. Keys: A–D choose, Enter checks, ← → move, Esc closes.'],
  ['Build a set', 'Tick questions (Shift-click for a range) and press Build Problem Set, or generate a random set on Build Test. Choose the timer, Check Answer, and shuffling there.'],
  ['Take a test', 'Use the navigator at the bottom to jump around, Mark for Review, and ABC to cross out choices. Reading has a highlighter; Math has the Desmos calculator and the reference sheet.'],
  ['Review', 'After submitting, click any answer choice to see why it is right or wrong. Retry missed questions or practice more of the same skills.'],
  ['Saving', 'Nothing is stored on this computer. Export your results from History or the Dashboard, and import the file next time.'],
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
        className="grid size-9 place-items-center rounded-md text-base font-semibold text-muted hover:bg-surface-2 hover:text-ink"
      >
        ?
      </button>
      {open && (
        <div id={id} role="dialog" aria-label="How to use" className="absolute right-0 z-50 mt-2 w-[min(26rem,calc(100vw-1.5rem))] rounded-xl border border-line bg-surface p-4 shadow-2xl">
          <div className="mb-2 flex items-center">
            <h2 className="flex-1 font-semibold">How to use</h2>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close help" className="grid size-8 place-items-center rounded-md text-muted hover:bg-surface-2"><IconX width={18} height={18} /></button>
          </div>
          <dl className="grid max-h-[70vh] gap-3 overflow-auto text-sm">
            {TOPICS.map(([t, d]) => (
              <div key={t}>
                <dt className="font-semibold">{t}</dt>
                <dd className="mt-0.5 text-muted">{d}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
