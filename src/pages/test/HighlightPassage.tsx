// Passage with an in-session highlighter. Highlights are character ranges of the
// passage text, painted with the CSS Custom Highlight API, so the rendered passage
// (including KaTeX) is never modified.
import { useEffect, useRef } from 'react';
import { Blocks } from '../../components/RichContent';
import type { RichContent } from '../../lib/types';
import type { Ranges } from '../../store/test';

export const highlightSupported = () => typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined';

/** Character offset of a DOM position within `root`'s text. */
function offsetOf(root: Node, node: Node, offset: number): number {
  const r = document.createRange();
  r.setStart(root, 0);
  r.setEnd(node, offset);
  return r.toString().length;
}

function rangeFor(root: Node, start: number, end: number): Range | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const r = document.createRange();
  let pos = 0;
  let started = false;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const len = (n as Text).data.length;
    if (!started && start <= pos + len) {
      r.setStart(n, start - pos);
      started = true;
    }
    if (started && end <= pos + len) {
      r.setEnd(n, end - pos);
      return r;
    }
    pos += len;
  }
  return null;
}

/** Add [a, b), merging with overlapping ranges. */
export function addRange(ranges: Ranges, a: number, b: number): Ranges {
  const out: Ranges = [];
  let [s, e] = [a, b];
  for (const [x, y] of ranges) {
    if (y < s || x > e) out.push([x, y]);
    else [s, e] = [Math.min(s, x), Math.max(e, y)];
  }
  out.push([s, e]);
  return out.sort((p, q) => p[0] - q[0]);
}

interface Props {
  blocks: RichContent | undefined;
  ranges: Ranges;
  onChange: (r: Ranges) => void;
  /** Highlighter tool is on: selecting text highlights it, clicking a highlight removes it. */
  active: boolean;
}

export function HighlightPassage({ blocks, ranges, onChange, active }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root || !highlightSupported()) return;
    const hl = new Highlight(...ranges.map(([a, b]) => rangeFor(root, a, b)).filter((r): r is Range => r !== null));
    CSS.highlights.set('q-hl', hl);
    return () => { CSS.highlights.delete('q-hl'); };
  }, [ranges, blocks]);

  const apply = () => {
    const root = ref.current;
    const sel = window.getSelection();
    if (!active || !root || !sel || !sel.rangeCount) return;
    const r = sel.getRangeAt(0);
    if (!root.contains(r.commonAncestorContainer)) return;
    const a = offsetOf(root, r.startContainer, r.startOffset);
    const b = offsetOf(root, r.endContainer, r.endOffset);
    if (a === b) {
      const hit = ranges.find(([x, y]) => a >= x && a <= y);
      if (hit) onChange(ranges.filter((x) => x !== hit));
      return;
    }
    onChange(addRange(ranges, Math.min(a, b), Math.max(a, b)));
    sel.removeAllRanges();
  };

  return (
    <div
      ref={ref}
      onMouseUp={apply}
      onKeyUp={(e) => { if (e.shiftKey) apply(); }}
      className={active ? 'cursor-text q-highlighting' : undefined}
    >
      <Blocks blocks={blocks} variant="passage" />
    </div>
  );
}
