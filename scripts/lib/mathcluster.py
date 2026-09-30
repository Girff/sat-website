"""Group math atoms and rules into expressions (one per inline/display formula).

Items are linked by proximity; a text character between two items keeps them
apart. The rules below were tuned against every expression in the source PDFs.
"""
from .mathnodes import STACK_GAP, SPECIAL_SUP, Node, num_gap


# --------------------------------------------------------------------------
# 1. clustering
# --------------------------------------------------------------------------
class _DSU:
    def __init__(self, n):
        self.p = list(range(n))

    def find(self, a):
        while self.p[a] != a:
            self.p[a] = self.p[self.p[a]]
            a = self.p[a]
        return a

    def union(self, a, b):
        self.p[self.find(a)] = self.find(b)


def _blocked(a, b, chars):
    """True if a text character sits horizontally between items a and b."""
    if getattr(b, "label", None) in SPECIAL_SUP:
        return False            # a degree sign / prime always belongs to what precedes it
    lo, hi = min(a.x1, b.x1), max(a.x0, b.x0)
    if hi - lo < 0.8:
        return False
    y0, y1 = min(a.y0, b.y0), max(a.y1, b.y1)
    for c in chars:
        cx = (c.x0 + c.x1) / 2
        if lo < cx < hi and c.y0 < y1 and c.y1 > y0:
            return True
    return False


def cluster_expressions(atoms, rules, chars):
    """Group atoms + rules into expressions. Returns [(atoms, rules), ...]."""
    sqrts = [a for a in atoms if a.label == "sqrt"]
    for r in rules:
        r.vinc = any(abs(r.x0 - q.x1) < 2.5 and abs(r.y0 - q.y0) < 2.0 for q in sqrts)
        if not r.vinc:
            # Overline over full-size letters (tight ink gap) with only small
            # glyphs above: those belong to the line above (e.g. a denominator),
            # since a fraction's numerator and denominator share a size.
            under = [q.s for q in atoms if r.x0 <= (q.x0 + q.x1) / 2 <= r.x1 and -0.6 <= q.y0 - r.y1 <= 1.6]
            over = [q.s for q in atoms if r.x0 <= (q.x0 + q.x1) / 2 <= r.x1 and -0.6 <= r.y0 - q.y1 <= num_gap(q)]
            if under and over and min(under) >= 0.9 and max(over) <= 0.8:
                r.vinc = True
    items = list(atoms) + list(rules)
    dsu = _DSU(len(items))
    order = sorted(range(len(items)), key=lambda i: items[i].x0)
    for ii, i in enumerate(order):
        a = items[i]
        for j in order[ii + 1:]:
            b = items[j]
            if b.x0 > a.x1 + 12.5:
                break
            if _linked(a, b) and not _blocked(a, b, chars):
                dsu.union(i, j)
    groups = {}
    for i, it in enumerate(items):
        groups.setdefault(dsu.find(i), []).append(it)
    return [([x for x in g if not x.is_rule], [x for x in g if x.is_rule]) for g in groups.values()]


def _vgap(a, b):
    return max(a.y0, b.y0) - min(a.y1, b.y1)   # negative = overlap


def _linked(a, b):
    """a.x0 <= b.x0. Are the two items part of the same expression?"""
    hgap = b.x0 - a.x1
    if not a.is_rule and not b.is_rule:
        if hgap > 8.0:
            # a superscript can sit between two glyphs of the main row
            return hgap <= 12.0 and abs(a.s - b.s) < 0.1 and abs(a.base - b.base) <= 1.0 \
                and _vgap(a, b) < 0
        vg = _vgap(a, b)
        if vg <= -1.0:
            return True
        if vg > 0.3 or hgap < -0.5:
            return False        # stacked glyphs must genuinely overlap
        # barely touching: fine for a script next to its base, i.e. a smaller glyph
        # raised (superscript, up to ~12pt on tall bases) or slightly lowered
        # (subscript, ~2-4pt). Anything else is two different lines touching.
        if abs(a.s - b.s) < 0.1:
            return abs(a.base - b.base) <= 3.0
        small, large = (a, b) if a.s < b.s else (b, a)
        raised = large.base - small.base
        return -4.5 * large.s <= raised <= 12.0 * large.s
    if a.is_rule and b.is_rule:
        return -1 <= hgap <= 8.0 and abs(a.cy - b.cy) < 1.2
    r, t = (a, b) if a.is_rule else (b, a)
    if t.label == "sqrt" and abs(r.x0 - t.x1) < 2.5 and abs(r.y0 - t.y0) < 2.0:
        return True
    tcx = (t.x0 + t.x1) / 2
    if r.vinc:
        # a radical's bar relates only to its sign and to the radicand below it
        return r.x0 <= tcx <= r.x1 and -0.6 <= t.mtop - r.y1 <= STACK_GAP
    if r.x0 + 0.3 <= tcx <= r.x1 - 0.3:
        if -0.6 <= r.y0 - t.y1 <= num_gap(t) or -0.6 <= t.mtop - r.y1 <= STACK_GAP:
            return True
    if r.x0 - 1.2 <= tcx <= r.x1 + 1.2:
        if t.y0 < r.cy < t.y1:
            return True
    gap = max(r.x0 - t.x1, t.x0 - r.x1)
    if not -1 <= gap <= 8.0:
        return False
    tol = 1.0 if t.y1 - t.y0 < 2.0 else 0.0     # thin glyphs: - = sit on the axis
    if t.y0 - tol < r.cy < t.y1 + tol:
        return True              # glyph crossing the fraction's axis
    # low punctuation on the fraction's baseline: (a/b, c/d) or "= a/b."
    return t.label in (",", ".") and 1.5 <= t.base - r.cy <= 3.5


_TEXT_LABEL = {",": ",", ".": ".", "(": "(", ")": ")", "=": "=", "+": "+", "\u2212": "-", "-": "-"}


def absorb_text(atoms, base, chars):
    """Text characters sitting inside an expression on its baseline (e.g. the
    comma of (x1+x2)/2 , (y1+y2)/2 set in the text font) become atoms."""
    x0, x1 = min(a.x0 for a in atoms), max(a.x1 for a in atoms)
    took = []
    for c in chars:
        cx = (c.x0 + c.x1) / 2
        if not c.c.strip() or not (x0 < cx < x1) or abs(c.base - base) > 2.0:
            continue
        lab = _TEXT_LABEL.get(c.c) or (c.c if c.c.isdigit() else ("rm:" + c.c if c.c.isalpha() else None))
        if lab is None:
            continue
        took.append((c, Node("atom", (c.x0, c.y0, c.x1, c.y1), 1.0, c.base, label=lab)))
    return took
