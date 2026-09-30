// Renders RichContent blocks and inline markup, with KaTeX for math.
// Imported only by lazily loaded views, so KaTeX stays out of the home page bundle.
import katex from 'katex';
import 'katex/dist/katex.min.css';
import '@fontsource-variable/source-serif-4';
import { memo, type CSSProperties, type ReactNode } from 'react';
import { dataUrl } from '../lib/data';
import { parseMarkup, type MNode } from '../lib/markup';
import type { Block, RichContent as RC } from '../lib/types';

const katexCache = new Map<string, string>();

function renderTex(tex: string): string {
  let html = katexCache.get(tex);
  if (html === undefined) {
    html = katex.renderToString(tex, { throwOnError: false, strict: 'ignore', output: 'htmlAndMathml' });
    katexCache.set(tex, html);
  }
  return html;
}

export const TeX = memo(function TeX({ tex }: { tex: string }) {
  return <span className="q-tex" dangerouslySetInnerHTML={{ __html: renderTex(tex) }} />;
});

function QImg({ src, w, h, alt, inline }: { src: string; w: number; h: number; alt: string; inline?: boolean }) {
  return (
    <img
      className={`q-img${inline ? ' q-img-inline' : ''}`}
      src={dataUrl(src)}
      width={w}
      height={h}
      alt={alt}
      loading="lazy"
      decoding="async"
      style={{ '--w': `${w}px` } as CSSProperties}
    />
  );
}

function renderNodes(nodes: MNode[], keyPrefix = ''): ReactNode[] {
  return nodes.map((n, i) => {
    const key = keyPrefix + i;
    switch (n.t) {
      case 'text': return n.v;
      case 'math': return <TeX key={key} tex={n.tex} />;
      case 'br': return <br key={key} />;
      case 'img': return <QImg key={key} src={n.src} w={n.w} h={n.h} alt={n.alt} inline />;
      case 'el': {
        const Tag = n.tag;
        return <Tag key={key}>{renderNodes(n.children, key + '.')}</Tag>;
      }
    }
  });
}

/** Inline markup string → React nodes. */
export const Markup = memo(function Markup({ value }: { value: string }) {
  return <>{renderNodes(parseMarkup(value))}</>;
});

function TableBlock({ block }: { block: Extract<Block, { kind: 'table' }> }) {
  const rows = [block.headers, ...block.rows];
  const span = new Map<string, [number, number]>();
  const covered = new Set<string>();
  for (const [r, c, rs, cs] of block.merged ?? []) {
    span.set(`${r},${c}`, [rs, cs]);
    for (let a = r; a < r + rs; a++) for (let b = c; b < c + cs; b++) if (a !== r || b !== c) covered.add(`${a},${b}`);
  }
  const hasHeader = block.headers.some((h) => h.trim());
  return (
    <div className="q-table-wrap">
      <table className="q-table">
        <tbody>
          {rows.map((row, r) => (r === 0 && !hasHeader ? null : (
            <tr key={r}>
              {row.map((cell, c) => {
                if (covered.has(`${r},${c}`)) return null;
                const sp = span.get(`${r},${c}`);
                const Cell = r === 0 ? 'th' : 'td';
                return (
                  <Cell key={c} scope={r === 0 ? 'col' : undefined} rowSpan={sp?.[0]} colSpan={sp?.[1]}>
                    <Markup value={cell} />
                  </Cell>
                );
              })}
            </tr>
          )))}
        </tbody>
      </table>
    </div>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case 'text':
      return <p className={block.style}><Markup value={block.value} /></p>;
    case 'math':
      return <div className="q-math-block"><TeX tex={block.latex} /></div>;
    case 'image':
      return (
        <figure className={`q-figure${block.inline ? ' inline-eq' : ''}`}>
          <QImg src={block.src} w={block.width} h={block.height} alt={block.alt} />
        </figure>
      );
    case 'table':
      return <TableBlock block={block} />;
  }
}

/** A list of RichContent blocks. `variant` adds passage typography. */
export const Blocks = memo(function Blocks({ blocks, variant, className = '' }: { blocks: RC | undefined; variant?: 'passage'; className?: string }) {
  if (!blocks?.length) return null;
  return (
    <div className={`q-content ${variant === 'passage' ? 'q-passage' : ''} ${className}`}>
      {blocks.map((b, i) => <BlockView key={i} block={b} />)}
    </div>
  );
});
