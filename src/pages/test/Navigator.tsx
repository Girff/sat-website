// Question navigator (grid of numbered boxes) and the submit confirmation.
import { useEffect, useRef } from 'react';
import { Dialog, btn } from '../../components/Dialog';
import { IconFlag, IconX } from '../../components/Icons';
import type { ActiveTest } from '../../store/test';

const isAnswered = (t: ActiveTest, id: string) => (t.answers[id] ?? '').trim() !== '';

function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      <li className="flex items-center gap-1.5"><span className="size-3.5 rounded-sm border-2 border-accent ring-2 ring-accent/30" />Current</li>
      <li className="flex items-center gap-1.5"><span className="size-3.5 rounded-sm bg-accent" />Answered</li>
      <li className="flex items-center gap-1.5"><span className="size-3.5 rounded-sm border-2 border-dashed border-line-strong" />Unanswered</li>
      <li className="flex items-center gap-1.5"><IconFlag width={14} height={14} className="fill-current text-flag" />For review</li>
    </ul>
  );
}

function Boxes({ test, onJump }: { test: ActiveTest; onJump: (i: number) => void }) {
  return (
    <ol className="grid grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-2">
      {test.items.map(({ id }, i) => {
        const answered = isAnswered(test, id);
        const marked = !!test.marked[id];
        const current = i === test.current;
        const label = [`Question ${i + 1}`, answered ? 'answered' : 'unanswered', marked && 'marked for review', current && 'current'].filter(Boolean).join(', ');
        return (
          <li key={id}>
            <button
              type="button"
              onClick={() => onJump(i)}
              aria-label={label}
              aria-current={current ? 'step' : undefined}
              className={`relative grid h-10 w-full place-items-center rounded-md text-sm font-semibold tabular-nums ${
                answered ? 'bg-accent text-accent-ink' : 'border-2 border-dashed border-line-strong text-ink hover:border-accent'} ${
                current ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : ''}`}
            >
              {i + 1}
              {marked && <IconFlag aria-hidden width={13} height={13} className="absolute -right-1 -top-1.5 fill-current text-flag" />}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** Popover above the footer, like Bluebook's "Question 3 of 20" menu. */
export function NavigatorPanel({ test, onJump, onClose, onReview }: { test: ActiveTest; onJump: (i: number) => void; onClose: () => void; onReview: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[aria-current="step"]')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (!ref.current?.contains(t) && !t.closest('[data-nav-toggle]')) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [onClose]);
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Question navigator"
      className="absolute bottom-full left-1/2 z-30 mb-2 w-[min(34rem,calc(100vw-1.5rem))] -translate-x-1/2 rounded-xl border border-line bg-surface p-4 shadow-2xl"
    >
      <div className="mb-3 flex items-center gap-2">
        <h2 className="flex-1 font-semibold">{test.name}</h2>
        <button type="button" onClick={onClose} aria-label="Close navigator" className="grid size-8 place-items-center rounded-md text-muted hover:bg-surface-2"><IconX width={18} height={18} /></button>
      </div>
      <Legend />
      <div className="mt-3 max-h-[50vh] overflow-auto p-1.5"><Boxes test={test} onJump={(i) => { onJump(i); onClose(); }} /></div>
      <div className="mt-3 flex justify-center">
        <button type="button" className={btn.secondary} onClick={onReview}>Review &amp; submit</button>
      </div>
    </div>
  );
}

/** Confirmation before submitting: lists unanswered and marked questions. */
export function SubmitDialog({ open, test, onClose, onJump, onSubmit, submitting }: {
  open: boolean; test: ActiveTest; onClose: () => void; onJump: (i: number) => void; onSubmit: () => void; submitting: boolean;
}) {
  const unanswered = test.items.map((it, i) => (isAnswered(test, it.id) ? -1 : i)).filter((i) => i >= 0);
  const marked = test.items.map((it, i) => (test.marked[it.id] ? i : -1)).filter((i) => i >= 0);
  const jumpList = (idx: number[]) => (
    <span className="flex flex-wrap gap-1.5">
      {idx.map((i) => (
        <button key={i} type="button" onClick={() => { onJump(i); onClose(); }} className="min-w-8 rounded border border-line-strong px-1.5 py-0.5 text-sm font-semibold tabular-nums hover:border-accent hover:text-accent">
          {i + 1}
        </button>
      ))}
    </span>
  );
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Submit this set?"
      className="max-w-2xl"
      footer={(
        <>
          <button type="button" className={btn.secondary} onClick={onClose}>Keep working</button>
          <button type="button" className={btn.primary} onClick={onSubmit} disabled={submitting}>{submitting ? 'Submitting…' : 'Submit'}</button>
        </>
      )}
    >
      <div className="grid gap-4 px-5 py-4 text-sm">
        <p>
          You answered <strong>{test.items.length - unanswered.length}</strong> of <strong>{test.items.length}</strong> questions.
          After submitting you’ll see your score and can review every question.
        </p>
        <div>
          <h3 className="mb-1.5 font-semibold">Unanswered ({unanswered.length})</h3>
          {unanswered.length ? jumpList(unanswered) : <p className="text-muted">None.</p>}
        </div>
        <div>
          <h3 className="mb-1.5 font-semibold">Marked for review ({marked.length})</h3>
          {marked.length ? jumpList(marked) : <p className="text-muted">None.</p>}
        </div>
        <div className="border-t border-line pt-4">
          <Legend />
          <div className="mt-3 max-h-56 overflow-auto p-1.5"><Boxes test={test} onJump={(i) => { onJump(i); onClose(); }} /></div>
        </div>
      </div>
    </Dialog>
  );
}
