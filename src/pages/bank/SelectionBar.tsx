import { btn } from '../../components/Dialog';
import { navigate } from '../../lib/router';
import { useData } from '../../store/data';
import { useSession } from '../../store/session';

/** The tray shown whenever questions are ticked: what's in it, and the way to build a set from it. */
export function SelectionBar() {
  const selected = useSession((s) => s.selected);
  const clear = useSession((s) => s.clearSelection);
  const byId = useData((s) => s.byId);
  if (!selected.size) return null;

  let math = 0;
  for (const id of selected) if (byId.get(id)?.section === 'math') math++;
  const reading = selected.size - math;
  const parts = [reading && `${reading} Reading & Writing`, math && `${math} Math`].filter(Boolean).join(', ');

  return (
    <div
      role="region"
      aria-label="Selected questions"
      className="fixed inset-x-0 bottom-0 z-20 bg-ink px-4 py-3 text-bg [&_:focus-visible]:outline-marker dark:border-t dark:border-line-strong dark:bg-surface-3 dark:text-ink"
    >
      <div className="mx-auto flex max-w-[1480px] flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-[0.9375rem]" aria-live="polite">
          <strong className="font-extrabold">{selected.size.toLocaleString()} question{selected.size === 1 ? '' : 's'} ticked</strong>
          <span className="opacity-75"> ({parts})</span>
        </p>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={clear} className="rounded-md px-3 py-2 text-sm font-bold opacity-80 hover:opacity-100 hover:underline">
            Clear
          </button>
          <button type="button" onClick={() => navigate('/build')} className={btn.hero}>
            Build a set
          </button>
        </div>
      </div>
    </div>
  );
}
