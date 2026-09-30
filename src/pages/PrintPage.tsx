// Printable problem set (questions only, or with an answer key), for Print / Save as PDF.
import { useEffect, useState } from 'react';
import { btn } from '../components/Dialog';
import { CorrectAnswer, useRationale } from '../components/question/Explain';
import { Blocks } from '../components/RichContent';
import { loadQuestion } from '../lib/data';
import { LETTERS, type ChoiceOrder } from '../lib/letters';
import { SECTION_LABEL, type Question } from '../lib/types';
import { useData } from '../store/data';
import { useUi } from '../store/ui';

export default function PrintPage() {
  const job = useUi((s) => s.printJob);
  const byId = useData((s) => s.byId);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState(job?.answers ?? false);

  useEffect(() => {
    if (!job || !byId.size) return;
    Promise.all(job.items.map((it) => loadQuestion(byId.get(it.id) ?? { id: it.id, chunk: '' })))
      .then(setQuestions, (e) => setError(e instanceof Error ? e.message : String(e)));
  }, [job, byId]);

  if (!job) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Nothing to print</h1>
        <p className="mt-2 text-sm text-muted">Choose “Print questions” on the Build Test page or on a set’s results.</p>
        <a href="#/build" className={`${btn.primary} mt-6`}>Build Test</a>
      </div>
    );
  }
  const date = new Date().toLocaleDateString([], { dateStyle: 'medium' });
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 print:max-w-none print:p-0">
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface p-3 print:hidden">
        <button type="button" className={btn.ghost} onClick={() => history.back()}>← Back</button>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-[var(--c-accent)]" checked={answers} onChange={(e) => setAnswers(e.target.checked)} />
          Include answer key and explanations
        </label>
        <button type="button" className={`${btn.primary} ml-auto`} disabled={!questions} onClick={() => window.print()}>Print / Save as PDF</button>
      </div>
      {error && <p className="text-hard">Couldn’t load the questions: {error}</p>}
      {!questions && !error && <p className="text-muted" role="status">Preparing {job.items.length} questions…</p>}
      {questions && (
        <article className="print-doc">
          <header className="mb-6 border-b border-line pb-3">
            <h1 className="text-2xl font-semibold">{job.title}</h1>
            <p className="text-sm text-muted">{questions.length} questions · {date}</p>
          </header>
          {questions.map((q, i) => <PrintQuestion key={q.id} q={q} n={i + 1} order={job.items[i]?.choices} />)}
          {answers && (
            <section className="mt-10 break-before-page">
              <h2 className="mb-4 border-b border-line pb-2 text-xl font-semibold">Answer key</h2>
              {questions.map((q, i) => <KeyEntry key={q.id} q={q} n={i + 1} order={job.items[i]?.choices} />)}
            </section>
          )}
        </article>
      )}
    </div>
  );
}

function PrintQuestion({ q, n, order }: { q: Question; n: number; order?: ChoiceOrder }) {
  return (
    <section className="mb-8 break-inside-avoid-page border-b border-line pb-6">
      <h2 className="mb-2 flex flex-wrap items-baseline gap-x-3 text-base font-semibold">
        Question {n}
        <span className="text-xs font-normal text-muted">{q.id} · {SECTION_LABEL[q.section]} · {q.skill} · {q.difficulty}</span>
      </h2>
      {q.passage && <Blocks blocks={q.passage} variant={q.section === 'reading' ? 'passage' : undefined} />}
      <Blocks blocks={q.stem} className="q-stem" />
      {q.type === 'mcq' ? (
        <ol className="mt-2 grid gap-1.5">
          {LETTERS.map((shown, i) => {
            const c = q.choices?.find((x) => x.label === (order?.[i] ?? shown));
            return c && (
              <li key={shown} className="q-choice flex gap-3">
                <span className="font-semibold">{shown}.</span>
                <Blocks blocks={c.content} className="min-w-0 flex-1" />
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-3 text-sm">Answer: <span className="inline-block w-40 border-b border-ink">&nbsp;</span></p>
      )}
    </section>
  );
}

function KeyEntry({ q, n, order }: { q: Question; n: number; order?: ChoiceOrder }) {
  const { overall } = useRationale(q, order);
  return (
    <div className="mb-5 break-inside-avoid-page">
      <p className="font-semibold">{n}. <CorrectAnswer q={q} order={order} /></p>
      <Blocks blocks={overall} className="text-sm" />
    </div>
  );
}
