"""Recognize vector math glyphs by shape.

Every math symbol in the source PDFs is drawn as its own filled vector path.
Identical symbols produce identical paths up to translation and scale, so a
path normalized to its bounding box identifies the symbol. The labeled shapes
live in glyph_catalog.json (built once by hand-labeling rendered samples).

Label conventions:
  "x", "7", "A"      italic letter / digit, as TeX would render it in math
  "rm:e"             upright (roman) letter, i.e. part of \\text{...} or \\sin
  "\\pi", "\\le" ...  TeX control sequence
  "sqrt"             radical sign (vinculum is a separate rule)
  "FIG"              figure element (arrowhead, plotted point, line)
"""
import json
import os
from collections import defaultdict

TOL = 0.03

_CATALOG_PATH = os.path.join(os.path.dirname(__file__), "glyph_catalog.json")


def path_signature(drawing):
    """Return (op string, normalized points) for a PyMuPDF drawing dict."""
    r = drawing["rect"]
    s = max(r.width, r.height) or 1.0
    ops, pts = [], []
    for it in drawing["items"]:
        op = it[0]
        ops.append(op)
        if op == "l":
            pts += [it[1], it[2]]
        elif op == "c":
            pts += [it[1], it[2], it[3], it[4]]
        elif op == "re":
            pts += [it[1].tl, it[1].br]
        elif op == "qu":
            q = it[1]
            pts += [q.ul, q.ur, q.ll, q.lr]
    norm = [((p.x - r.x0) / s, (p.y - r.y0) / s) for p in pts]
    return "".join(ops), norm


class GlyphMatcher:
    def __init__(self, path=_CATALOG_PATH):
        with open(path) as f:
            entries = json.load(f)
        self.groups = defaultdict(list)
        for e in entries:
            self.groups[(e["ops"], len(e["norm"]))].append((e["norm"], e["label"]))

    def match(self, drawing):
        ops, norm = path_signature(drawing)
        best, best_d = None, TOL
        for ref, label in self.groups.get((ops, len(norm)), ()):
            d = max(max(abs(a[0] - b[0]), abs(a[1] - b[1])) for a, b in zip(ref, norm))
            if d < best_d:
                best, best_d = label, d
        return best


def is_glyph_path(drawing):
    """Math glyphs are drawn as black fill+stroke ('fs') paths."""
    return drawing["type"] == "fs" and drawing.get("fill") == (0.0, 0.0, 0.0)
