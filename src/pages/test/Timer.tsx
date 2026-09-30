// Test clock: countdown (with a 5-minute warning) or stopwatch, and it can be hidden.
import { useEffect, useRef, useState } from 'react';
import { formatClock } from '../../lib/scoring';

interface Props {
  startedAt: number;
  deadline: number | null;
  stopwatch: boolean;
  onWarn: () => void;
}

const FIVE_MIN = 5 * 60 * 1000;

export function Timer({ startedAt, deadline, stopwatch, onWarn }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [hidden, setHidden] = useState(false);
  const warned = useRef(false);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, []);

  const remaining = deadline === null ? null : deadline - now;
  const warning = remaining !== null && remaining <= FIVE_MIN;
  useEffect(() => {
    // warn once, and only if the test was longer than five minutes to begin with
    if (warning && !warned.current && deadline !== null && deadline - startedAt > FIVE_MIN) {
      warned.current = true;
      setHidden(false);
      onWarn();
    }
  }, [warning, deadline, startedAt, onWarn]);

  if (remaining === null && !stopwatch) return <span className="text-sm text-muted">Untimed</span>;
  const shown = remaining !== null ? formatClock(Math.max(0, remaining)) : formatClock(now - startedAt);
  return (
    <div className="flex items-center gap-2">
      {!hidden && (
        <span
          role="timer"
          aria-label={remaining !== null ? 'Time remaining' : 'Time elapsed'}
          className={`font-mono text-lg font-semibold tabular-nums ${warning ? 'text-hard' : ''}`}
        >
          {shown}
        </span>
      )}
      <button
        type="button"
        onClick={() => setHidden((h) => !h)}
        className="rounded-full border border-line-strong px-2.5 py-0.5 text-xs font-semibold text-muted hover:text-ink"
      >
        {hidden ? 'Show timer' : 'Hide'}
      </button>
    </div>
  );
}
