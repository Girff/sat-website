// Desmos graphing calculator in a resizable side panel. This module (and the iframe)
// loads only when the calculator is first opened; afterwards it stays mounted while
// hidden so the calculator keeps its state.
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { IconX } from '../../components/Icons';

const MIN = 280;
const maxWidth = () => Math.max(MIN, Math.round(window.innerWidth * 0.7));

export default function DesmosPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [width, setWidth] = useState(() => Math.min(480, Math.round(window.innerWidth * 0.42)));
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; w: number } | null>(null);

  const clamp = (w: number) => Math.min(maxWidth(), Math.max(MIN, w));
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, w: width };
    setDragging(true);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (start.current) setWidth(clamp(start.current.w + e.clientX - start.current.x));
  };
  const onUp = () => {
    start.current = null;
    setDragging(false);
  };
  const onKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 80 : 24;
    if (e.key === 'ArrowLeft') setWidth((w) => clamp(w - step));
    else if (e.key === 'ArrowRight') setWidth((w) => clamp(w + step));
    else return;
    e.preventDefault();
  };

  return (
    <section
      aria-label="Calculator"
      hidden={!open}
      style={{ '--calc-w': `${width}px` } as React.CSSProperties}
      className="relative flex h-[55vh] w-full shrink-0 flex-col border-b border-line bg-surface md:h-auto md:w-[var(--calc-w)] md:border-b-0 md:border-r"
    >
      <div className="flex items-center gap-2 border-b border-line px-3 py-1.5">
        <h2 className="flex-1 text-sm font-semibold">Calculator</h2>
        <button type="button" onClick={onClose} aria-label="Close calculator" className="grid size-8 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink">
          <IconX width={18} height={18} />
        </button>
      </div>
      <iframe
        title="Desmos graphing calculator"
        src="https://www.desmos.com/calculator"
        referrerPolicy="no-referrer"
        className={`w-full flex-1 border-0 bg-white ${dragging ? 'pointer-events-none' : ''}`}
      />
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize calculator"
        aria-valuemin={MIN}
        aria-valuemax={maxWidth()}
        aria-valuenow={width}
        tabIndex={0}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={onKey}
        className="absolute -right-1.5 top-0 z-10 hidden h-full w-3 cursor-col-resize touch-none md:block"
      >
        <span aria-hidden className={`mx-auto block h-full w-0.5 ${dragging ? 'bg-accent' : 'bg-transparent hover:bg-accent'}`} />
        <span aria-hidden className="absolute left-1/2 top-1/2 h-10 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-line-strong" />
      </div>
    </section>
  );
}
