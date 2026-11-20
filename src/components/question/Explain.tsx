// Answer reveal and explanations. Letters in explanations follow the order the
// student saw (shuffled choices are relabelled).
import { useMemo, useState } from 'react';
import { displayMap, remapBlocks, toDisplay, type ChoiceOrder } from '../../lib/letters';
import type { Outcome } from '../../lib/scoring';
import type { Letter, Question } from '../../lib/types';
import { IconCheck, IconX } from '../Icons';
import { Blocks } from '../RichContent';

export function useRationale(q: Question, order?: ChoiceOrder) {
  return useMemo(() => {
    const map = displayMap(order);
    const perChoice: Partial<Record<Letter, ReturnType<typeof remapBlocks>>> = {};
    for (const [l, b] of Object.entries(q.rationale.perChoice ?? {})) if (b) perChoice[l as Letter] = remapBlocks(b, map);
    return { overall: remapBlocks(q.rationale.overall, map), perChoice };
  }, [q, order]);
}

/** "B" or "3/4 (also accepted: .75, 0.75)". */
export function CorrectAnswer({ q, order }: { q: Question; order?: ChoiceOrder }) {
  if (q.type === 'mcq') return <strong>{q.correct.map((l) => toDisplay(order, l as Letter)).join(', ')}</strong>;
  const [first, ...rest] = q.correct;
  return (
    <>
      <strong>{first}</strong>
      {rest.length > 0 && <span className="text-muted"> (also accepted: {rest.join(', ')})</span>}
    </>
  );
}

export function Verdict({ outcome }: { outcome: Outcome }) {
  if (outcome === 'correct') return <span className="inline-flex items-center gap-1.5 font-extrabold text-good"><IconCheck />Correct</span>;
  if (outcome === 'incorrect') return <span className="inline-flex items-center gap-1.5 font-extrabold text-bad"><IconX />Incorrect</span>;
  return <span className="font-extrabold text-muted">No answer given</span>;
}

/** Shown after "Check Answer": right or wrong, the correct answer, and the full explanation. */
export function AnswerReveal({ q, order, outcome, answer }: { q: Question; order?: ChoiceOrder; outcome: Outcome; answer?: string }) {
  const { overall } = useRationale(q, order);
  return (
    <section aria-label="Answer and explanation" className="mt-5 border-l-4 border-ink bg-surface-2 py-4 pl-5 pr-4" tabIndex={-1}>
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
        <Verdict outcome={outcome} />
        {q.type === 'spr' && answer && <span className="text-sm">Your answer: <strong>{answer}</strong></span>}
        <span className="text-sm">Correct answer: <CorrectAnswer q={q} order={order} /></span>
      </div>
      <h3 className="mt-3 font-extrabold">Why</h3>
      <Blocks blocks={overall} className="max-w-[68ch] text-[0.95rem]" />
    </section>
  );
}

/** Review mode: the explanation for one clicked choice, with the full rationale on request. */
export function ChoiceExplanation({ q, order, letter }: { q: Question; order?: ChoiceOrder; letter?: Letter }) {
  const { overall, perChoice } = useRationale(q, order);
  const [full, setFull] = useState(false);
  const part = letter ? perChoice[letter] : undefined;
  const shown = letter ? toDisplay(order, letter) : undefined;
  const right = letter ? q.correct.includes(letter) : false;
  return (
    <section aria-label="Explanation" aria-live="polite" className="mt-5 border-l-4 border-ink bg-surface-2 py-4 pl-5 pr-4">
      {q.type === 'mcq' && !letter && <p className="text-sm text-muted">Click any answer choice to see why it is right or wrong.</p>}
      {q.type === 'mcq' && letter && !part && (
        <h3 className={`font-extrabold ${right ? 'text-good' : 'text-bad'}`}>Choice {shown} is {right ? 'correct' : 'incorrect'}</h3>
      )}
      {q.type === 'mcq' && letter && part && <Blocks blocks={part} className="max-w-[68ch] text-[0.95rem]" />}
      {q.type === 'mcq' && letter && !part && <p className="text-sm text-muted">This explanation isn’t split by choice, so the full explanation is shown.</p>}
      {(q.type === 'spr' || full || (letter && !part)) && (
        <>
          <h3 className="mt-3 font-extrabold">Full explanation</h3>
          <Blocks blocks={overall} className="max-w-[68ch] text-[0.95rem]" />
        </>
      )}
      {q.type === 'mcq' && (
        <button type="button" onClick={() => setFull((f) => !f)} aria-expanded={full} className="mt-3 text-sm font-bold underline decoration-control underline-offset-2 hover:decoration-ink">
          {full ? 'Hide full explanation' : 'Show full explanation'}
        </button>
      )}
    </section>
  );
}
