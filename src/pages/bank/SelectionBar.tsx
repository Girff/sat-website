import { navigate } from '../../lib/router';
import { useData } from '../../store/data';
import { useSession } from '../../store/session';

/** Sticky bar shown whenever questions are selected. */
export function SelectionBar() {
  const selected = useSession((s) => s.selected);
  const clear = useSession((s) => s.clearSelection);
  const byId = useData((s) => s.byId);
  if (!selected.size) return null;

  let math = 0;
  for (const id of selected) if (byId.get(id)?.section === 'math') math++;
  const reading = selected.size - math;
  const parts = [reading && `${reading} Reading & Writing`, math && `${math} Math`].filter(Boolean).join(' · ');

  return (
    <div
      role="region"
      aria-label="Selected questions"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur"
    >
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-sm" aria-live="polite">
          <strong className="font-semibold">{selected.size.toLocaleString()} question{selected.size === 1 ? '' : 's'} selected</strong>
          <span className="text-muted"> ({parts})</span>
        </p>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={clear} className="rounded-md px-3 py-2 text-sm font-medium text-muted hover:bg-surface-2 hover:text-ink">
            Clear selection
          </button>
          <button
            type="button"
            onClick={() => navigate('/build')}
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:bg-accent-hover"
          >
            Build Problem Set
          </button>
        </div>
      </div>
    </div>
  );
}
