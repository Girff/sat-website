// Parser for the inline markup used in text blocks (see types.ts):
//   $latex$  <b> <i> <u> <sup> <sub>  <br/>  <img src w h alt/>  &lt; &gt; &amp;  \$
export type MNode =
  | { t: 'text'; v: string }
  | { t: 'math'; tex: string }
  | { t: 'br' }
  | { t: 'img'; src: string; w: number; h: number; alt: string }
  | { t: 'el'; tag: Tag; children: MNode[] };

type Tag = 'b' | 'i' | 'u' | 'sup' | 'sub';
const TAGS = new Set<string>(['b', 'i', 'u', 'sup', 'sub']);
const ENTITIES: Record<string, string> = { '&lt;': '<', '&gt;': '>', '&amp;': '&' };

const attr = (tag: string, name: string) => tag.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? '';

export function parseMarkup(s: string): MNode[] {
  const root: MNode[] = [];
  const stack: { tag: Tag | null; children: MNode[] }[] = [{ tag: null, children: root }];
  let buf = '';
  const top = () => stack[stack.length - 1].children;
  const flush = () => {
    if (buf) top().push({ t: 'text', v: buf });
    buf = '';
  };
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '\\' && s[i + 1] === '$') {
      buf += '$';
      i += 2;
      continue;
    }
    if (c === '$') {
      let j = i + 1;
      while (j < s.length && !(s[j] === '$' && s[j - 1] !== '\\')) j++;
      if (j >= s.length) {        // unbalanced: keep the dollar as text
        buf += c;
        i++;
        continue;
      }
      flush();
      top().push({ t: 'math', tex: s.slice(i + 1, j) });
      i = j + 1;
      continue;
    }
    if (c === '<') {
      const j = s.indexOf('>', i);
      if (j < 0) { buf += c; i++; continue; }
      const tag = s.slice(i + 1, j);
      if (tag === 'br/') {
        flush();
        top().push({ t: 'br' });
      } else if (tag.startsWith('img ')) {
        flush();
        top().push({ t: 'img', src: attr(tag, 'src'), w: Number(attr(tag, 'w')) || 0, h: Number(attr(tag, 'h')) || 0, alt: attr(tag, 'alt') });
      } else if (TAGS.has(tag)) {
        flush();
        const el: MNode = { t: 'el', tag: tag as Tag, children: [] };
        top().push(el);
        stack.push({ tag: tag as Tag, children: el.children });
      } else if (tag.startsWith('/') && TAGS.has(tag.slice(1))) {
        flush();
        const k = stack.map((f) => f.tag).lastIndexOf(tag.slice(1) as Tag);
        if (k > 0) stack.length = k;   // close it (and anything left open inside it)
      } else {
        buf += s.slice(i, j + 1);
      }
      i = j + 1;
      continue;
    }
    if (c === '&') {
      const j = s.indexOf(';', i);
      const ent = j > 0 ? s.slice(i, j + 1) : '';
      if (ENTITIES[ent]) {
        buf += ENTITIES[ent];
        i = j + 1;
        continue;
      }
    }
    buf += c;
    i++;
  }
  flush();
  return root;
}

/** Plain text of a markup string (math kept as its LaTeX source). */
export function markupText(s: string): string {
  const walk = (ns: MNode[]): string => ns.map((n) => (n.t === 'text' ? n.v : n.t === 'math' ? n.tex : n.t === 'el' ? walk(n.children) : n.t === 'br' ? ' ' : '')).join('');
  return walk(parseMarkup(s));
}
