// Dev-only QA page (not built into production): each low-confidence question
// next to its original PDF page, to spot-check the extraction.
import { useEffect, useMemo, useState } from 'react';
import { DifficultyBadge } from '../components/Badges';
import { Blocks } from '../components/RichContent';
import { dataUrl, loadQuestion } from '../lib/data';
import type { Question } from '../lib/types';
import { SECTION_LABEL } from '../lib/types';
import { useData } from '../store/data';

export default function QaPage() {
  const entries = useData((s) => s.entries);
  const low = useMemo(() => entries.filter((e) => e.low), [entries]);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!low.length) return;
    Promise.all(low.map(loadQuestion)).then(setQuestions, (e) => setError(String(e)));
  }, [low]);

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Extraction QA</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        {low.length} low-confidence question{low.length === 1 ? '' : 's'}. Left: the original PDF page. Right: the question rendered from the extracted data.
        This page exists only in development builds.
      </p>
      {error && <p className="mt-4 text-hard">{error}</p>}
      {!questions && !error && <p className="mt-6 text-muted">Loading…</p>}
      <div className="mt-6 grid gap-6">
        {questions?.map((q) => (
          <article key={q.id} className="overflow-hidden rounded-lg border border-line bg-surface">
            <header className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 text-sm">
              <span className="font-mono font-semibold">{q.id}</span>
              <span className="text-muted">{SECTION_LABEL[q.section]} · {q.skill}</span>
              <DifficultyBadge value={q.difficulty} />
              <span className="text-muted">{q.sourcePdf} p.{q.sourcePage}</span>
              <ul className="basis-full text-hard">{q.issues?.map((i) => <li key={i}>{i}</li>)}</ul>
            </header>
            <div className="grid md:grid-cols-2">
              <div className="border-b border-line bg-surface-2 p-3 md:border-b-0 md:border-r">
                {q.originalImages?.map((src) => <img key={src} src={dataUrl(src)} alt={`Original PDF page for ${q.id}`} className="mb-2 w-full rounded border border-line bg-white" />)}
              </div>
              <div className="min-w-0 p-4">
                {q.passage && <Blocks blocks={q.passage} variant="passage" />}
                <Blocks blocks={q.stem} className="font-medium" />
                {q.choices && (
                  <ol className="my-3 grid gap-2">
                    {q.choices.map((c) => (
                      <li key={c.label} className={`q-choice flex gap-3 rounded-md border px-3 py-2 ${q.correct.includes(c.label) ? 'border-easy bg-easy-soft' : 'border-line'}`}>
                        <span className="font-semibold">{c.label}.</span>
                        <Blocks blocks={c.content} className="min-w-0 flex-1" />
                      </li>
                    ))}
                  </ol>
                )}
                <p className="text-sm text-muted">Correct answer: <strong className="text-ink">{q.correct.join(', ')}</strong></p>
                <details className="mt-2 text-sm" open>
                  <summary className="cursor-pointer font-semibold text-accent">Rationale</summary>
                  <Blocks blocks={q.rationale.overall} />
                </details>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
