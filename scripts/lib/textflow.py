"""Assemble text chars, inline math and inline images into lines and paragraphs.

Inline markup used in text block values (parsed by the frontend):
  $...$              inline LaTeX (a literal dollar in text is written \\$)
  <b> <i> <u> <sup> <sub>   emphasis
  <br/>              hard line break (poems, stacked lines)
  <img src="" w="" h="" alt=""/>   inline image (raster math)
  &lt; &gt; &amp;    escaped literals
"""
import re
from statistics import median

RIGHT_MARGIN = 594.0


class Item:
    """One thing on a line: a text run, a math expression or an inline image."""
    __slots__ = ("kind", "x0", "y0", "x1", "y1", "base", "chars", "latex", "img", "size")

    def __init__(self, kind, x0, y0, x1, y1, base, chars=None, latex=None, img=None, size=9.0):
        self.kind = kind
        self.x0, self.y0, self.x1, self.y1 = x0, y0, x1, y1
        self.base, self.chars, self.latex, self.img, self.size = base, chars, latex, img, size


class Line:
    def __init__(self, base):
        self.base = base
        self.items = []

    @property
    def x0(self):
        return min(i.x0 for i in self.items)

    @property
    def x1(self):
        return max(i.x1 for i in self.items)

    @property
    def top(self):
        return min(_top(i) for i in self.items)

    @property
    def bottom(self):
        return max(_bottom(i) for i in self.items)

    @property
    def has_text(self):
        return any(i.kind == "text" and any(c.c.strip() for c in i.chars) for i in self.items)


def _top(i):
    return i.base - 0.72 * i.size if i.kind == "text" else i.y0


def _bottom(i):
    return i.base + 0.22 * i.size if i.kind == "text" else i.y1


# ------------------------------------------------------------------ lines
def build_lines(chars, exprs, images):
    """chars: Char list; exprs: Items(kind='math'); images: Items(kind='img')."""
    lines = []
    body = median([c.size for c in chars if c.c.strip()] or [9.0])
    # text lines by baseline
    for c in sorted(chars, key=lambda c: c.base):
        if lines and abs(lines[-1].base - c.base) <= 1.5:
            lines[-1].items.append(c)
        else:
            ln = Line(c.base)
            ln.items.append(c)
            lines.append(ln)
    # merge small raised/lowered text (superscript ordinals etc.) into neighbors
    normal = [ln for ln in lines if median(c.size for c in ln.items) >= 0.9 * body]
    for ln in lines:
        if ln in normal or not normal:
            continue
        host = min(normal, key=lambda h: abs(h.base - ln.base))
        if abs(host.base - ln.base) < 7:
            for c in ln.items:
                c.face = c.face + ("^" if c.base < host.base else "_")
            host.items += ln.items
        else:
            normal.append(ln)
    lines = sorted(normal, key=lambda ln: ln.base)
    # attach math / images to the text line sharing their baseline, else a new line
    for it in list(exprs) + list(images):
        cands = [ln for ln in lines if abs(ln.base - it.base) < 3.0]
        if cands:
            min(cands, key=lambda ln: (not _has_text_chars(ln), abs(ln.base - it.base))).items.append(it)
        else:
            ln = Line(it.base)
            ln.items.append(it)
            lines.append(ln)
    # within each line, interleave chars and items by x, then group chars into runs
    out = []
    for ln in lines:
        new = Line(ln.base)
        new.items = _runs(sorted(ln.items, key=lambda i: i.x0), body)
        out.append(new)
    out.sort(key=lambda ln: ln.base)
    return [ln for ln in out if ln.items], body


def _has_text_chars(ln):
    return any(not isinstance(i, Item) and i.c.strip() for i in ln.items)


def _runs(elems, body):
    """elems: chars and Items sorted by x. Consecutive chars become text Items."""
    items, cur = [], []

    def flush():
        if not cur:
            return
        plain = [c for c in cur if "^" not in c.face and "_" not in c.face] or cur
        items.append(Item("text", min(c.x0 for c in cur), min(c.y0 for c in cur), max(c.x1 for c in cur),
                          max(c.y1 for c in cur), median(c.base for c in plain), chars=list(cur), size=body))
        cur.clear()

    for e in elems:
        if isinstance(e, Item):
            flush()
            items.append(e)
        else:
            if cur and e.x0 - cur[-1].x1 > 6.0:
                flush()
            cur.append(e)
    flush()
    return items


# ------------------------------------------------------------------ markup
def escape(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("$", "\\$")


def _style(c):
    f = c.face.rstrip("^_")
    tags = []
    if "b" in f:
        tags.append("b")
    if "i" in f:
        tags.append("i")
    if c.under:
        tags.append("u")
    if c.face.endswith("^"):
        tags.append("sup")
    elif c.face.endswith("_"):
        tags.append("sub")
    return tuple(tags)


def run_markup(chars):
    out, cur = [], ()
    prev = None
    for c in chars:
        st = _style(c)
        if c.c == " " and prev is not None:
            st = tuple(t for t in cur if t in ("u",) and prev.under) or tuple(t for t in cur if t != "u")
            st = cur if prev.under and c.under else st
        if st != cur:
            for t in reversed(cur):
                out.append("</" + t + ">")
            for t in st:
                out.append("<" + t + ">")
            cur = st
        if prev is not None and c.x0 - prev.x1 > 0.3 * c.size and c.c != " " and prev.c != " ":
            out.append(" ")
        out.append(escape(c.c))
        prev = c
    for t in reversed(cur):
        out.append("</" + t + ">")
    return "".join(out).replace("</u> <u>", " ").replace("</i> <i>", " ").replace("</b> <b>", " ")


def line_markup(line):
    parts = []
    prev = None
    for it in line.items:
        if it.kind == "math" and prev is not None and prev.kind == "math" and parts \
                and it.x0 - prev.x1 < 6.0 and it.latex.startswith(("{}^", "{}'")):
            prev.latex = prev.latex + it.latex[2:]     # degree sign / prime of the previous expression
            prev.x1 = it.x1
            parts[-1] = "$" + prev.latex + "$"
            continue
        if it.kind == "math" and prev is not None and prev.kind == "math" and parts \
                and it.x0 - prev.x1 < 6.0 and _continues_math("$" + prev.latex + "$", "$" + it.latex + "$"):
            # one expression split by a stray text space: rejoin at the operator
            prev.latex = prev.latex + " " + it.latex
            prev.x1 = it.x1
            parts[-1] = "$" + prev.latex + "$"
            continue
        if it.kind == "text":
            s = run_markup(it.chars)
        elif it.kind == "math":
            s = "$" + it.latex + "$"
        else:
            im = it.img
            s = '<img src="%s" w="%d" h="%d" alt="%s"/>' % (im["src"], im["w"], im["h"], im.get("alt", "math"))
        if prev is not None and parts:
            gap = it.x0 - prev.x1
            left_space = parts[-1].endswith(" ")
            tight = s[:1] in ".,;:!?)]\u201d\u2019" or parts[-1][-1:] in "([\u201c\u2018"
            if gap > 1.6 and not left_space and not s.startswith(" ") and not tight:
                parts.append(" ")
        parts.append(s)
        prev = it
    return "".join(parts).strip()


# ------------------------------------------------------------------ paragraphs
def is_display(line):
    return not line.has_text and len(line.items) == 1


def paragraphs(lines, para_gap=7.0, right=RIGHT_MARGIN):
    """Group lines into paragraphs. Returns list of lists of lines.

    A math-only line is a standalone (display) equation unless it is the
    wrapped continuation of the previous line (previous line full, and this
    line starts at the paragraph's left edge). A standalone equation always
    forms its own paragraph.
    """
    paras = []
    for ln in lines:
        if paras:
            para = paras[-1]
            prev = para[-1]
            if ln.top - prev.bottom < para_gap:
                wrapped = _soft_wrap(prev, ln, right) and abs(ln.x0 - para[0].x0) < 4
                standalone_prev = len(para) == 1 and is_display(prev)
                if not standalone_prev and (wrapped or not is_display(ln)):
                    para.append(ln)
                    continue
        paras.append([ln])
    return paras


def _first_word_width(line):
    it = line.items[0]
    if it.kind != "text":
        return min(it.x1 - it.x0, 60)
    w = 0.0
    start = it.chars[0].x0
    for c in it.chars:
        if c.c == " ":
            break
        w = c.x1 - start
    return w


def _soft_wrap(prev, ln, right):
    return prev.x1 + 3.0 + _first_word_width(ln) > right - 2


def tidy_tags(s):
    """Merge adjacent same tags and move edge spaces outside tags."""
    for t in ("u", "i", "b", "sup", "sub"):
        s = s.replace("</%s> <%s>" % (t, t), " ").replace("</%s><%s>" % (t, t), "")
        s = re.sub(r" </%s>" % t, "</%s> " % t, s)
        s = re.sub(r"<%s> " % t, " <%s>" % t, s)
    return re.sub(r"  +", " ", s)


def join_paragraph(lines, right=RIGHT_MARGIN):
    """Join lines of one paragraph into a single markup string."""
    return tidy_tags(_join(lines, right))


def _join(lines, right):
    out = ""
    for i, ln in enumerate(lines):
        s = line_markup(ln)
        if i == 0:
            out = s
            continue
        prev = lines[i - 1]
        if _soft_wrap(prev, ln, right):
            tail = out.rstrip()
            if tail.endswith(("-", "—", "–", "/")) and s[:1].isalnum():
                out = tail + s
            elif tail.endswith("$") and s.startswith(("${}^", "${}'")):
                out = tail[:-1] + s[3:]                    # degree sign wrapped to the next line
            elif tail.endswith("$") and s.startswith("$") and _continues_math(tail, s):
                out = tail[:-1] + " " + s[1:]
            else:
                out = tail + " " + s
        else:
            out = out.rstrip() + "<br/>" + s
    return out


_OPS = ("+", "-", "=", "<", ">", "\\le", "\\ge", "\\pm", "\\times", "\\cdot", "\\div", "\\approx")


def _continues_math(tail, s):
    """A wrapped inline expression: split at an operator across the line break."""
    left = tail[:-1].rstrip()
    right = s[1:].lstrip()
    return left.endswith(_OPS) or right.startswith(_OPS)
