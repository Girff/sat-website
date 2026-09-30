// Bluebook layout: Reading & Writing questions with a passage use two panes
// (passage left, question right) that stack on narrow screens; everything else
// is a single centred column.
import type { ReactNode } from 'react';
import type { IndexEntry, Question } from '../../lib/types';
import { SECTION_LABEL } from '../../lib/types';
import { DifficultyBadge } from '../Badges';
import { Blocks } from '../RichContent';

export const hasPassagePane = (q: Question) => q.section === 'reading' && !!q.passage?.length;

interface Props {
  q: Question;
  /** Replaces the default passage rendering (e.g. the highlighter). */
  passage?: ReactNode;
  /** Question pane content under the stem: choices, answer box, explanation. */
  children: ReactNode;
  /** Above the stem (question number, mark-for-review…). */
  toolbar?: ReactNode;
}

export function QuestionLayout({ q, passage, children, toolbar }: Props) {
  const question = (
    <>
      {toolbar}
      {!hasPassagePane(q) && q.passage?.length ? <Blocks blocks={q.passage} /> : null}
      <Blocks blocks={q.stem} className="q-stem" />
      {children}
    </>
  );
  if (hasPassagePane(q)) {
    return (
      <div className="grid min-h-0 min-w-0 flex-1 overflow-auto md:grid-cols-2 md:overflow-hidden">
        <section aria-label="Passage" className="border-line p-5 md:overflow-auto md:border-r md:p-8">
          {passage ?? <Blocks blocks={q.passage} variant="passage" />}
        </section>
        <section aria-label="Question" className="border-t border-line p-5 md:overflow-auto md:border-t-0 md:p-8">{question}</section>
      </div>
    );
  }
  return (
    <section aria-label="Question" className="min-h-0 min-w-0 flex-1 overflow-auto">
      <div className="mx-auto max-w-3xl p-5 md:p-8">{question}</div>
    </section>
  );
}

/** ID, section, domain, skill and difficulty. */
export function QuestionMeta({ entry, as: Tag = 'p', id }: { entry: Pick<IndexEntry, 'id' | 'section' | 'domain' | 'skill' | 'difficulty'>; as?: 'p' | 'h2'; id?: string }) {
  return (
    <Tag id={id} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span className="font-mono font-semibold">{entry.id}</span>
      <span className="min-w-0 text-muted">
        {SECTION_LABEL[entry.section]} <span aria-hidden>·</span> {entry.domain} <span aria-hidden>·</span> <span className="text-ink">{entry.skill}</span>
      </span>
      <DifficultyBadge value={entry.difficulty} />
    </Tag>
  );
}
