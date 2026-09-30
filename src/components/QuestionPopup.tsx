// Question preview popup (lazy-loaded). Answer visibility rules:
//  - the answer and explanation are hidden every time a question is shown;
//  - "Check Answer" reveals them for this question only;
//  - Previous/Next always show the next question hidden (each question is a fresh,
//    keyed component, so nothing carries over). There is no "always show" setting.
import { useEffect, useState } from 'react';
import { loadQuestion, prefetchChunks } from '../lib/data';
import { grade } from '../lib/scoring';
import type { IndexEntry, Letter, Question } from '../lib/types';
import { useData } from '../store/data';
import { useSession } from '../store/session';
import { useUi } from '../store/ui';
import { Dialog, btn } from './Dialog';
import { IconCheck, IconFlag, IconX } from './Icons';
import { ChoiceList } from './question/ChoiceList';
import { AnswerReveal } from './question/Explain';
import { GridIn } from './question/GridIn';
import { QuestionLayout, QuestionMeta } from './question/QuestionLayout';

export default function QuestionPopup() {
  const popup = useUi((s) => s.popup);
  const close = useUi((s) => s.closePopup);
  const byId = useData((s) => s.byId);
  if (!popup) return null;
  const entry = byId.get(popup.id);
  const index = popup.order.indexOf(popup.id);
  const go = (d: number) => {
    const next = popup.order[index + d];
    if (next) useUi.setState({ popup: { ...popup, id: next } });
  };
  return (
    <Dialog
      open
      onClose={close}
      title={popup.id}
      labelledBy="popup-title"
      focusSelf
      className="h-[calc(100dvh-1.5rem)] max-w-[1280px]"
      header={entry && <PopupHeader entry={entry} onClose={close} />}
    >
      {entry ? (
        <PopupBody key={entry.id} entry={entry} index={index} total={popup.order.length} onPrev={() => go(-1)} onNext={() => go(1)} order={popup.order} />
      ) : (
        <p className="p-8 text-center text-muted">This question isn’t in the bank.</p>
      )}
    </Dialog>
  );
}

function PopupHeader({ entry, onClose }: { entry: IndexEntry; onClose: () => void }) {
  const flagged = useSession((s) => !!s.status[entry.id]?.flagged);
  const inSet = useSession((s) => s.selected.has(entry.id));
  const toggleFlag = useSession((s) => s.toggleFlag);
  const toggleSelected = useSession((s) => s.toggleSelected);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-2.5 sm:px-5">
      <QuestionMeta entry={entry} as="h2" id="popup-title" />
      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => toggleSelected(entry.id)}
          aria-pressed={inSet}
          className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium ${inSet ? 'border-accent bg-accent-soft text-accent' : 'border-line hover:bg-surface-2'}`}
        >
          {inSet ? <IconCheck width={16} height={16} /> : <span aria-hidden className="text-base leading-none">+</span>}
          {inSet ? 'In problem set' : 'Add to selection'}
        </button>
        <button
          type="button"
          onClick={() => toggleFlag(entry.id)}
          aria-pressed={flagged}
          className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium ${flagged ? 'border-flag text-flag' : 'border-line hover:bg-surface-2'}`}
        >
          <IconFlag width={16} height={16} className={flagged ? 'fill-current' : ''} />
          {flagged ? 'Flagged' : 'Flag'}
        </button>
        <button type="button" onClick={onClose} aria-label="Close question" title="Close (Esc)" className="grid size-9 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink">
          <IconX />
        </button>
      </div>
    </div>
  );
}

interface BodyProps {
  entry: IndexEntry;
  index: number;
  total: number;
  order: string[];
  onPrev: () => void;
  onNext: () => void;
}

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && !!t.closest('input, textarea, select, [contenteditable="true"]');

function PopupBody({ entry, index, total, order, onPrev, onNext }: BodyProps) {
  const byId = useData((s) => s.byId);
  const recordResult = useSession((s) => s.recordResult);
  const [q, setQ] = useState<Question | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [picked, setPicked] = useState<Letter | undefined>();
  const [typed, setTyped] = useState('');
  const [revealed, setRevealed] = useState(false);

  // the previous question's elements are gone: keep focus in the dialog
  useEffect(() => {
    const d = document.querySelector<HTMLDialogElement>('dialog[open]');
    if (d && (!document.activeElement || document.activeElement === document.body || !d.contains(document.activeElement))) d.focus();
  }, []);

  useEffect(() => {
    let live = true;
    setError(null);
    loadQuestion(entry).then((x) => { if (live) setQ(x); }, (e) => { if (live) setError(e instanceof Error ? e.message : String(e)); });
    const near = [order[index - 1], order[index + 1]].map((id) => id && byId.get(id)?.chunk).filter((c): c is string => !!c);
    prefetchChunks(near);
    return () => { live = false; };
  }, [entry, attempt, order, index, byId]);

  const answer = q?.type === 'spr' ? typed.trim() || undefined : picked;
  const check = () => {
    if (!q || revealed) return;
    setRevealed(true);
    if (answer !== undefined) recordResult(q.id, grade(q, answer) === 'correct');
    requestAnimationFrame(() => document.getElementById('popup-reveal')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const typing = isTyping(e.target);
      if (e.key === 'ArrowLeft' && !typing && index > 0) { e.preventDefault(); onPrev(); }
      else if (e.key === 'ArrowRight' && !typing && index < total - 1) { e.preventDefault(); onNext(); }
      else if (/^[a-d]$/i.test(e.key) && !typing && q?.type === 'mcq' && !revealed && !e.shiftKey) {
        const l = e.key.toUpperCase() as Letter;
        if (q.choices?.some((c) => c.label === l)) { e.preventDefault(); setPicked(l); }
      } else if (e.key === 'Enter' && !typing) {
        if (e.target instanceof Element && e.target.closest('button, a, [role="button"]')) return;   // buttons do their own thing
        e.preventDefault();
        check();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const footer = (
    <div className="flex items-center gap-2 border-t border-line px-4 py-2.5 sm:px-5">
      <button type="button" onClick={onPrev} disabled={index <= 0} className={btn.secondary} title="Previous question (←)">
        <span aria-hidden>←</span> Previous
      </button>
      <p className="flex-1 text-center text-sm text-muted" aria-live="polite">
        Question <span className="font-semibold text-ink tabular-nums">{index + 1}</span> of <span className="tabular-nums">{total.toLocaleString()}</span>
      </p>
      <button type="button" onClick={onNext} disabled={index >= total - 1} className={btn.secondary} title="Next question (→)">
        Next <span aria-hidden>→</span>
      </button>
    </div>
  );

  if (error) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="grid flex-1 place-items-center p-8 text-center">
          <div>
            <p className="font-semibold">This question couldn’t be loaded.</p>
            <p className="mt-1 text-sm text-muted">{error}</p>
            <button type="button" className={`${btn.primary} mt-4`} onClick={() => setAttempt((a) => a + 1)}>Try again</button>
          </div>
        </div>
        {footer}
      </div>
    );
  }
  if (!q) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="grid flex-1 place-items-center text-muted" role="status">Loading question…</div>
        {footer}
      </div>
    );
  }

  const outcome = grade(q, answer);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <QuestionLayout q={q}>
        {q.type === 'mcq' ? (
          <ChoiceList q={q} selected={picked} onSelect={setPicked} disabled={revealed} reveal={revealed} onEnter={check} />
        ) : (
          <GridIn id={`popup-answer-${q.id}`} value={typed} onChange={setTyped} disabled={revealed} onEnter={check} verdict={revealed ? outcome : undefined} />
        )}
        {!revealed ? (
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={check} className={btn.primary}>Check Answer</button>
            <span className="text-xs text-muted">
              {q.type === 'mcq' ? 'Choose an answer first (optional). Keys: A–D, Enter, ← →, Esc' : 'Enter an answer first (optional).'}
            </span>
          </div>
        ) : (
          <div id="popup-reveal">
            <AnswerReveal q={q} outcome={outcome} answer={answer} />
          </div>
        )}
      </QuestionLayout>
      {footer}
    </div>
  );
}
