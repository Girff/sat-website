import type { QStatus } from '../lib/filters';
import type { Difficulty } from '../lib/types';
import { IconCheck, IconFlag, IconX } from './Icons';

const LEVEL: Record<Difficulty, number> = { Easy: 1, Medium: 2, Hard: 3 };
const TONE: Record<Difficulty, string> = {
  Easy: 'text-easy bg-easy-soft',
  Medium: 'text-medium bg-medium-soft',
  Hard: 'text-hard bg-hard-soft',
};

/** Colour + 1–3 bar meter (as in the source PDFs) + text, never colour alone. */
export function DifficultyBadge({ value }: { value: Difficulty }) {
  const level = LEVEL[value];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${TONE[value]}`}>
      <span aria-hidden className="flex gap-[2px]">
        {[1, 2, 3].map((i) => (
          <span key={i} className={`h-2 w-1 rounded-[1px] ${i <= level ? 'bg-current' : 'bg-current opacity-25'}`} />
        ))}
      </span>
      {value}
    </span>
  );
}

export function StatusBadges({ status }: { status: QStatus | undefined }) {
  const parts = [];
  if (status?.result === 'correct') {
    parts.push(<span key="c" className="inline-flex items-center gap-1 text-easy"><IconCheck width={16} height={16} />Correct</span>);
  } else if (status?.result === 'incorrect') {
    parts.push(<span key="i" className="inline-flex items-center gap-1 text-hard"><IconX width={16} height={16} />Incorrect</span>);
  }
  if (status?.flagged) {
    const label = parts.length ? <span className="sr-only">Flagged</span> : 'Flagged';
    parts.push(<span key="f" className="inline-flex items-center gap-1 text-flag"><IconFlag width={15} height={15} />{label}</span>);
  }
  if (!parts.length) return <span className="text-xs text-muted">Unseen</span>;
  return <span className="inline-flex items-center gap-2 text-xs font-semibold">{parts}</span>;
}
