import { describe, expect, it } from 'vitest';
import { markupText, parseMarkup } from './markup';

describe('parseMarkup', () => {
  it('splits text and inline math', () => {
    expect(parseMarkup('If $x=3$, then $y>0$.')).toEqual([
      { t: 'text', v: 'If ' }, { t: 'math', tex: 'x=3' }, { t: 'text', v: ', then ' }, { t: 'math', tex: 'y>0' }, { t: 'text', v: '.' },
    ]);
  });

  it('keeps escaped dollars inside and outside math', () => {
    expect(parseMarkup('It costs \\$5 or $\\$6$.')).toEqual([
      { t: 'text', v: 'It costs $5 or ' }, { t: 'math', tex: '\\$6' }, { t: 'text', v: '.' },
    ]);
  });

  it('nests emphasis and decodes entities', () => {
    expect(parseMarkup('<u>a <i>b</i></u> &lt; c &amp; d')).toEqual([
      { t: 'el', tag: 'u', children: [{ t: 'text', v: 'a ' }, { t: 'el', tag: 'i', children: [{ t: 'text', v: 'b' }] }] },
      { t: 'text', v: ' < c & d' },
    ]);
  });

  it('reads inline images and line breaks', () => {
    expect(parseMarkup('x<br/><img src="figures/a-r1.webp" w="40" h="22" alt="math expression"/>')).toEqual([
      { t: 'text', v: 'x' }, { t: 'br' }, { t: 'img', src: 'figures/a-r1.webp', w: 40, h: 22, alt: 'math expression' },
    ]);
  });

  it('tolerates unbalanced markup', () => {
    expect(markupText('a $ b </i> c <b>d')).toBe('a $ b  c d');
  });
});
