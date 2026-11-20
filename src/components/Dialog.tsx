// Modal built on the native <dialog>: the browser keeps focus inside it, makes the
// page behind it inert, and returns focus to the opener when it closes.
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { IconX } from './Icons';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Visible heading; also the dialog's accessible name. */
  title: ReactNode;
  children: ReactNode;
  /** Extra classes for the dialog box (size). */
  className?: string;
  footer?: ReactNode;
  onKeyDown?: (e: KeyboardEvent<HTMLDialogElement>) => void;
  /** Replace the standard header (the caller must then label the dialog). */
  header?: ReactNode;
  labelledBy?: string;
  /** Focus the dialog itself on open instead of its first button. */
  focusSelf?: boolean;
}

let seq = 0;

export function Dialog({ open, onClose, title, children, className = 'max-w-lg', footer, onKeyDown, header, labelledBy, focusSelf }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useRef(`dlg-${++seq}`).current;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      if (focusSelf) d.focus();
    } else if (!open && d.open) d.close();
  }, [open, focusSelf]);

  useEffect(() => () => { if (ref.current?.open) ref.current.close(); }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy ?? titleId}
      tabIndex={-1}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onMouseDown={(e) => { if (e.target === ref.current) onClose(); }}
      onKeyDown={onKeyDown}
      className={`q-dialog m-auto w-[calc(100vw-1.5rem)] rounded-lg border border-line-strong bg-surface p-0 text-ink shadow-[0_24px_60px_-12px_rgb(28_31_36/0.35)] ${className}`}
    >
      {open && (
        <div className="flex h-full max-h-[inherit] flex-col">
          {header ?? (
            <div className="flex items-center gap-3 border-b border-line px-5 py-3">
              <h2 id={titleId} className="min-w-0 flex-1 text-lg font-bold">{title}</h2>
              <button type="button" onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink">
                <IconX />
              </button>
            </div>
          )}
          <div className="flex min-h-0 flex-1 flex-col overflow-auto">{children}</div>
          {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-2 px-5 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

/** Standard buttons, shared by dialogs and pages. */
const base = 'inline-flex items-center justify-center gap-2 rounded-md text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-45';
export const btn = {
  primary: `${base} bg-accent px-4 py-2 text-accent-ink hover:bg-accent-hover`,
  secondary: `${base} border border-control bg-surface px-4 py-2 text-ink hover:bg-surface-2`,
  ghost: `${base} px-3 py-2 text-muted hover:bg-surface-2 hover:text-ink`,
  danger: `${base} bg-bad px-4 py-2 text-white hover:opacity-90 dark:text-bg`,
  /** The one call to action on a screen: bigger, highlighter-yellow. */
  hero: `${base} bg-marker px-5 py-2.5 text-base text-marker-ink shadow-[inset_0_-2px_0_rgb(0_0_0/0.18)] hover:brightness-95`,
};
