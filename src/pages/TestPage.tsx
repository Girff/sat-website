// Test mode: one question at a time, Bluebook style, with navigator, mark for review,
// answer eliminator, highlighter, calculator, reference sheet, timer and submit.
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Dialog, btn } from '../components/Dialog';
import { IconFlag, IconMoon, IconSun } from '../components/Icons';
import { ChoiceList } from '../components/question/ChoiceList';
import { AnswerReveal } from '../components/question/Explain';
import { GridIn } from '../components/question/GridIn';
import { QuestionLayout, hasPassagePane } from '../components/question/QuestionLayout';
import { loadQuestion } from '../lib/data';
import { navigate } from '../lib/router';
import { grade } from '../lib/scoring';
import { SECTION_LABEL, type Letter, type Question } from '../lib/types';
import { useData } from '../store/data';
import { TEXT_SCALES, useSession } from '../store/session';
import { submitTest, useTest, type ActiveTest } from '../store/test';
import { HighlightPassage, highlightSupported } from './test/HighlightPassage';
import { NavigatorPanel, SubmitDialog } from './test/Navigator';
import { ReferenceSheet } from './test/ReferenceSheet';
import { Timer } from './test/Timer';

const DesmosPanel = lazy(() => import('./test/DesmosPanel'));

export default function TestPage() {
  const test = useTest((s) => s.test);
  const history = useSession((s) => s.history);
  if (test) return <TestRunner test={test} />;
  const last = history[history.length - 1];
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">No test in progress</h1>
      <p className="mt-2 text-muted">Build a problem set to start one.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <a href="#/build" className={btn.primary}>Build a problem set</a>
        {last && <a href={`#/results/${last.key}`} className={btn.secondary}>Results of “{last.name}”</a>}
      </div>
    </div>
  );
}

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && !!t.closest('input, textarea, select, [contenteditable="true"]');

function TestRunner({ test }: { test: ActiveTest }) {
  const { goTo, suspend, resume, abandon } = useTest.getState();
  const submitting = useTest((s) => s.submitting);
  const byId = useData((s) => s.byId);
  const theme = useSession((s) => s.theme);
  const setTheme = useSession((s) => s.setTheme);
  const scale = useSession((s) => s.textScale);
  const setScale = useSession((s) => s.setTextScale);
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcLoaded, setCalcLoaded] = useState(false);
  const [refOpen, setRefOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [highlighter, setHighlighter] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const item = test.items[test.current];
  const entry = byId.get(item.id);
  const isMath = entry?.section === 'math';
  const last = test.current === test.items.length - 1;
  const onWarn = useCallback(() => setWarning('5 minutes remaining.'), []);

  useEffect(() => {
    resume();
    return () => suspend();
  }, [resume, suspend]);

  const submit = () => {
    setSubmitError(null);
    submitTest(false).catch((e) => setSubmitError(e instanceof Error ? e.message : String(e)));
  };
  const idx = TEXT_SCALES.indexOf(scale);
  const toolBtn = (on: boolean) => `inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium ${on ? 'bg-accent-soft text-accent' : 'text-ink hover:bg-surface-2'}`;

  return (
    <div className="flex h-dvh flex-col bg-surface">
      <header className="border-b-2 border-dashed border-line-strong">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold">{test.name}</h1>
            <p className="text-xs text-muted">{entry ? SECTION_LABEL[entry.section] : ''}</p>
          </div>
          <Timer startedAt={test.startedAt} deadline={test.deadline} stopwatch={test.config.timer === 'stopwatch'} onWarn={onWarn} />
          <div className="-mx-1 flex w-full items-center gap-1 overflow-x-auto px-1 pb-1 sm:mx-0 sm:w-auto sm:flex-1 sm:justify-end sm:px-0 sm:pb-0" role="toolbar" aria-label="Tools">
            {!isMath && highlightSupported() && (
              <button type="button" className={toolBtn(highlighter)} aria-pressed={highlighter} onClick={() => setHighlighter((h) => !h)}
                title="Select passage text to highlight it; click a highlight to remove it">
                <span aria-hidden className="h-3 w-3 shrink-0 rounded-sm bg-[#fde68a] ring-1 ring-line-strong" />Highlight
              </button>
            )}
            {isMath && (
              <>
                <button type="button" className={toolBtn(calcOpen)} aria-pressed={calcOpen} onClick={() => { setCalcLoaded(true); setCalcOpen((o) => !o); }}>Calculator</button>
                <button type="button" className={toolBtn(false)} onClick={() => setRefOpen(true)}>Reference</button>
              </>
            )}
            <div className="flex shrink-0 items-center rounded-md border border-line" role="group" aria-label="Text size">
              <button type="button" className="px-2 py-1 text-xs font-semibold text-muted hover:text-ink disabled:opacity-40" onClick={() => setScale(TEXT_SCALES[idx - 1])} disabled={idx <= 0} aria-label="Smaller text">A−</button>
              <button type="button" className="border-l border-line px-2 py-1 text-sm font-semibold text-muted hover:text-ink disabled:opacity-40" onClick={() => setScale(TEXT_SCALES[idx + 1])} disabled={idx >= TEXT_SCALES.length - 1} aria-label="Larger text">A+</button>
            </div>
            <button type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="grid size-8 shrink-0 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink" aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              {theme === 'dark' ? <IconSun width={18} height={18} /> : <IconMoon width={18} height={18} />}
            </button>
            <button type="button" className={`${btn.ghost} shrink-0`} onClick={() => setExitOpen(true)}>Exit</button>
            <button type="button" className={`${btn.secondary} shrink-0 sm:ml-1`} onClick={() => setSubmitOpen(true)}>Submit</button>
          </div>
        </div>
        {warning && (
          <div role="alert" className="flex items-center gap-3 bg-hard-soft px-4 py-1.5 text-sm font-semibold text-hard">
            <span className="flex-1">{warning}</span>
            <button type="button" className="text-xs underline" onClick={() => setWarning(null)}>Dismiss</button>
          </div>
        )}
        {submitError && <p role="alert" className="bg-hard-soft px-4 py-1.5 text-sm text-hard">Couldn’t submit: {submitError}. Check your connection and try again.</p>}
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* outside the per-question component, so the calculator keeps its state between questions */}
        {calcLoaded && <Suspense fallback={null}><DesmosPanel open={calcOpen && isMath} onClose={() => setCalcOpen(false)} /></Suspense>}
        <TestQuestion
          key={item.id}
          test={test}
          highlighter={highlighter}
          onPrev={() => goTo(test.current - 1)}
          onNext={() => (last ? setSubmitOpen(true) : goTo(test.current + 1))}
        />
      </div>

      <footer className="relative flex items-center gap-2 border-t border-line px-4 py-2.5">
        <div className="hidden flex-1 text-sm text-muted sm:block">{test.items.length} questions</div>
        <button
          type="button"
          data-nav-toggle
          aria-expanded={navOpen}
          onClick={() => setNavOpen((o) => !o)}
          className="mx-auto inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-sm font-semibold text-bg hover:opacity-90"
        >
          Question {test.current + 1} of {test.items.length}
          <span aria-hidden className={`inline-block transition-transform ${navOpen ? '' : 'rotate-180'}`}>▾</span>
        </button>
        {navOpen && <NavigatorPanel test={test} onJump={goTo} onClose={() => setNavOpen(false)} onReview={() => { setNavOpen(false); setSubmitOpen(true); }} />}
        <div className="flex flex-1 justify-end gap-2">
          <button type="button" className={btn.secondary} disabled={test.current === 0} onClick={() => goTo(test.current - 1)}>Back</button>
          <button type="button" className={btn.primary} onClick={() => (last ? setSubmitOpen(true) : goTo(test.current + 1))}>{last ? 'Review & submit' : 'Next'}</button>
        </div>
      </footer>

      <ReferenceSheet open={refOpen} onClose={() => setRefOpen(false)} />
      <SubmitDialog open={submitOpen} test={test} onClose={() => setSubmitOpen(false)} onJump={goTo} onSubmit={submit} submitting={submitting} />
      <Dialog
        open={exitOpen}
        onClose={() => setExitOpen(false)}
        title="Leave the test?"
        footer={(
          <>
            <button type="button" className={btn.danger} onClick={() => { setExitOpen(false); abandon(); navigate('/build'); }}>Discard test</button>
            <span className="flex-1" />
            <button type="button" className={btn.secondary} onClick={() => setExitOpen(false)}>Stay</button>
            <button type="button" className={btn.primary} onClick={() => { setExitOpen(false); navigate('/'); }}>Leave for now</button>
          </>
        )}
      >
        <p className="px-5 py-4 text-sm">
          Your answers are kept and {test.deadline ? 'the countdown keeps running' : 'you can pick up where you left off'}.
          Return to it from <strong>Build Test</strong>. Discarding the test throws its answers away.
        </p>
      </Dialog>
    </div>
  );
}

interface QuestionProps {
  test: ActiveTest;
  highlighter: boolean;
  onPrev: () => void;
  onNext: () => void;
}

/** The current question. Keyed by question, so a revealed answer never carries over. */
function TestQuestion({ test, highlighter, onPrev, onNext }: QuestionProps) {
  const { answer, toggleEliminated, toggleMarked, setHighlights } = useTest.getState();
  const byId = useData((s) => s.byId);
  const item = test.items[test.current];
  const [q, setQ] = useState<Question | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [eliminator, setEliminator] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    let live = true;
    setError(null);
    loadQuestion(byId.get(item.id) ?? { id: item.id, chunk: '' })
      .then((x) => { if (live) setQ(x); }, (e) => { if (live) setError(e instanceof Error ? e.message : String(e)); });
    return () => { live = false; };
  }, [item.id, byId, attempt]);

  const value = test.answers[item.id];
  const canCheck = test.config.checkAnswer;
  const check = () => { if (canCheck && q) setRevealed(true); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || document.querySelector('dialog[open]')) return;
      const typing = isTyping(e.target);
      if (e.key === 'ArrowLeft' && !typing && test.current > 0) { e.preventDefault(); onPrev(); }
      else if (e.key === 'ArrowRight' && !typing && test.current < test.items.length - 1) { e.preventDefault(); onNext(); }
      else if (/^[a-d]$/i.test(e.key) && !typing && !e.shiftKey && q?.type === 'mcq' && !revealed) {
        const shown = e.key.toUpperCase() as Letter;
        const orig = item.choices?.[['A', 'B', 'C', 'D'].indexOf(shown)] ?? shown;
        if (q.choices?.some((c) => c.label === orig)) { e.preventDefault(); answer(item.id, orig); }
      } else if (e.key === 'Enter' && !typing && canCheck && !(e.target instanceof Element && e.target.closest('button, a, [role="button"]'))) {
        e.preventDefault();
        check();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (error || !q) {
    return (
      <div className="grid flex-1 place-items-center p-8 text-center" role={error ? undefined : 'status'}>
        {error ? (
          <div>
            <p className="font-semibold">This question couldn’t be loaded.</p>
            <p className="mt-1 text-sm text-muted">{error}</p>
            <button type="button" className={`${btn.primary} mt-4`} onClick={() => setAttempt((a) => a + 1)}>Try again</button>
          </div>
        ) : <span className="text-muted">Loading question…</span>}
      </div>
    );
  }

  const marked = !!test.marked[item.id];
  const outcome = grade(q, value);
  const toolbar = (
    <div className="mb-4 flex items-center gap-3 border-b border-line pb-2">
      <span className="grid h-8 min-w-8 place-items-center rounded bg-ink px-2 text-sm font-bold text-bg tabular-nums"><span className="sr-only">Question </span>{test.current + 1}</span>
      <button type="button" aria-pressed={marked} onClick={() => toggleMarked(item.id)}
        className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium ${marked ? 'text-flag' : 'text-ink hover:bg-surface-2'}`}>
        <IconFlag width={17} height={17} className={marked ? 'fill-current' : ''} />Mark for Review
      </button>
      {q.type === 'mcq' && (
        <button type="button" aria-pressed={eliminator} onClick={() => setEliminator((x) => !x)} title="Cross out answer choices"
          className={`ml-auto rounded-md border px-2 py-0.5 text-sm font-bold ${eliminator ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong hover:bg-surface-2'}`}>
          <span className="sr-only">Answer eliminator</span><span aria-hidden className="line-through">ABC</span>
        </button>
      )}
    </div>
  );

  return (
    <QuestionLayout
      q={q}
      toolbar={toolbar}
      passage={hasPassagePane(q) ? (
        <HighlightPassage blocks={q.passage} ranges={test.highlights[item.id] ?? []} onChange={(r) => setHighlights(item.id, r)} active={highlighter} />
      ) : undefined}
    >
      {q.type === 'mcq' ? (
        <ChoiceList
          q={q}
          order={item.choices}
          selected={value as Letter | undefined}
          onSelect={(l) => answer(item.id, l)}
          disabled={revealed}
          reveal={revealed}
          eliminated={test.eliminated[item.id]}
          eliminator={eliminator && !revealed}
          onEliminate={(l) => toggleEliminated(item.id, l)}
          onEnter={canCheck ? check : undefined}
        />
      ) : (
        <GridIn id={`test-answer-${item.id}`} value={value ?? ''} onChange={(v) => answer(item.id, v)} disabled={revealed} onEnter={canCheck ? check : undefined} verdict={revealed ? outcome : undefined} />
      )}
      {canCheck && (revealed
        ? <AnswerReveal q={q} order={item.choices} outcome={outcome} answer={value} />
        : <button type="button" className={btn.secondary} onClick={check}>Check Answer</button>)}
    </QuestionLayout>
  );
}
