import type { QStatus } from '../lib/filters';
import type { Difficulty } from '../lib/types';
import { IconCheck, IconFlag, IconX } from './Icons';

const LEVEL: Record<Difficulty, number> = { Easy: 1, Medium: 2, Hard: 3 };

/** A 1–3 bar meter (as in the source PDFs) plus the word. Difficulty isn't good or bad,
 *  so it gets no colour. */
export function DifficultyBadge({ value, compact }: { value: Difficulty; compact?: boolean }) {
  const level = LEVEL[value];
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span aria-hidden className="flex items-end gap-[2px]">
        {[1, 2, 3].map((i) => (
          <span key={i} className={`w-[5px] rounded-[1px] ${i <= level ? 'bg-ink' : 'bg-line-strong'}`} style={{ height: `${5 + i * 3}px` }} />
        ))}
      </span>
      <span className={compact ? 'sr-only sm:not-sr-only' : ''}>{value}</span>
    </span>
  );
}

/** The marked-for-review flag: highlighter-yellow, outlined in graphite. */
export function Flag({ size = 16, className = '' }: { size?: number; className?: string }) {
  return <IconFlag width={size} height={size} className={`shrink-0 fill-marker text-ink ${className}`} />;
}

const STATUS_TEXT = { correct: 'Correct', incorrect: 'Incorrect', unseen: 'Unseen' } as const;

/** An answer bubble for a question's session status, with a flag when it is flagged. */
export function StatusBubble({ status, showLabel }: { status: QStatus | undefined; showLabel?: boolean }) {
  const r = status?.result ?? 'unseen';
  const label = `${STATUS_TEXT[r]}${status?.flagged ? ', flagged' : ''}`;
  return (
    <span className="inline-flex items-center gap-1.5" title={label}>
      <span className="bubble" data-state={r === 'unseen' ? 'empty' : r} aria-hidden>
        {r === 'correct' ? <IconCheck width={11} height={11} strokeWidth={3} /> : r === 'incorrect' ? <IconX width={10} height={10} strokeWidth={3} /> : null}
      </span>
      {status?.flagged && <Flag size={15} />}
      <span className={showLabel ? 'text-sm' : 'sr-only'}>{label}</span>
    </span>
  );
}

/** Kept for the results/print views: text status with the bubble. */
export function StatusBadges({ status }: { status: QStatus | undefined }) {
  return <StatusBubble status={status} showLabel />;
}
