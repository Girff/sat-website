"""Shared math-layout definitions: sizes, glyph metrics, atoms and rules.

Units: PDF points, y grows downward. Sizes `s` are relative to normal math
size (1.0); script = ~0.71, scriptscript = ~0.5.
"""
import json
import os

EM = 10.7          # em at normal math size (pt)
AXIS = 2.875       # math axis above baseline at normal size (pt)
STACK_GAP = 2.4    # max gap between a fraction bar and its denominator (metric top)
NUM_GAP = 2.0      # max gap between a numerator's ink and the bar (99% are < 1.6)
NUM_GAP_DEEP = 2.8  # ...for glyphs that hang below the baseline: ( ) | and radicals
ASC = 7.2          # digit height at normal size (pt)

_MET = json.load(open(os.path.join(os.path.dirname(__file__), "glyph_metrics.json")))

DELIMS = {"(", ")", "|"}
SPECIAL_SUP = {"'", "\\circ"}           # always rendered as a superscript
BIN = {"+", "-", "\\pm", "\\times", "\\div"}
REL = {"=", "<", ">", "\\le", "\\ge", "\\approx"}
FUNCS = {"sin", "cos", "tan", "log", "ln", "exp", "min", "max", "sec", "csc", "cot"}
LATEX_OF = {"$": "\\$", "%": "\\%"}


def snap(s):
    for t in (1.0, 0.71, 0.5):
        if abs(s - t) < 0.1 * t:
            return t
    return round(s, 2)


class Rule:
    is_rule = True
    __slots__ = ("x0", "y0", "x1", "y1", "vinc")

    def __init__(self, rect):
        self.x0, self.y0, self.x1, self.y1 = rect
        self.vinc = False          # takes only glyphs below: radical bar or overline

    @property
    def cy(self):
        return (self.y0 + self.y1) / 2

    @property
    def mtop(self):
        return self.y0

    @property
    def mbot(self):
        return self.y1


class Node:
    """An atom (single glyph) or a composite (fraction / radical / overline)."""
    is_rule = False
    __slots__ = ("kind", "label", "x0", "y0", "x1", "y1", "s", "base", "big", "latex", "axis", "num_s")

    def __init__(self, kind, box, s, base, label=None, big=False, latex=None, axis=None, num_s=None):
        self.kind, self.label, self.big, self.latex = kind, label, big, latex
        self.x0, self.y0, self.x1, self.y1 = box
        self.s, self.base, self.axis, self.num_s = s, base, axis, num_s

    @property
    def mbot(self):
        """Bottom used for stacking: a radical's hook may dip toward a fraction bar."""
        if self.kind == "sqrt":
            return min(self.y1, self.base + 1.5 * self.s)
        return self.y1

    @property
    def mtop(self):
        """Top of the TeX box: short glyphs (a, x, -) still reserve digit height."""
        if self.kind != "atom" or self.big:
            return self.y0
        return min(self.y0, self.base - ASC * self.s)


def make_atom(label, rect):
    x0, y0, x1, y1 = rect
    h, w = y1 - y0, x1 - x0
    h0, w0, off = _MET[label]
    big = False
    if label in DELIMS or label == "sqrt":
        s = h / h0
        if s > 1.1:
            big, s = True, 1.0
    elif h0 < 1.5:
        s = w / w0
    else:
        s = (h + w) / (h0 + w0)
    s = snap(s)
    if big or label == "sqrt":
        base = (y0 + y1) / 2 + AXIS * s
    else:
        base = y1 - off * s
    return Node("atom", rect, s, base, label=label, big=big)


def num_gap(it):
    return NUM_GAP_DEEP if getattr(it, "label", None) in ("(", ")", "|", "sqrt") or \
        getattr(it, "kind", None) == "sqrt" else NUM_GAP


def union_box(items):
    return (min(i.x0 for i in items), min(i.y0 for i in items),
            max(i.x1 for i in items), max(i.y1 for i in items))
