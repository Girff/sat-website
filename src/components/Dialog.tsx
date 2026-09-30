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
      className={`q-dialog m-auto w-[calc(100vw-1.5rem)] rounded-xl border border-line bg-surface p-0 text-ink shadow-2xl ${className}`}
    >
      {open && (
        <div className="flex h-full max-h-[inherit] flex-col">
          {header ?? (
            <div className="flex items-center gap-3 border-b border-line px-5 py-3">
              <h2 id={titleId} className="min-w-0 flex-1 text-lg font-semibold">{title}</h2>
              <button type="button" onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink">
                <IconX />
              </button>
            </div>
          )}
          <div className="flex min-h-0 flex-1 flex-col overflow-auto">{children}</div>
          {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

/** Standard buttons, shared by dialogs and pages. */
export const btn = {
  primary: 'inline-flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50',
  secondary: 'inline-flex items-center justify-center gap-2 rounded-md border border-line-strong bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50',
  ghost: 'inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50',
  danger: 'inline-flex items-center justify-center gap-2 rounded-md bg-hard px-4 py-2 text-sm font-semibold text-white hover:opacity-90 dark:text-bg',
};
