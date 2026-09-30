"""Extract low-level primitives from a PDF page.

Returns a PagePrims with:
  chars   text characters (with face: r/b/i/bi, baseline, size)
  atoms   recognized math glyphs (mathparse Nodes)
  rules   thin black horizontal rectangles (fraction bars, underlines, table lines)
  vrules  thin black vertical rectangles (table lines)
  figs    everything that belongs to a drawing (strokes, colored fills, figure glyphs)
  images  raster images (placement + xref)
All coordinates are shifted by `yoff` so multi-page questions stack vertically.
"""
import hashlib
import json
import os
import re
from collections import Counter

from .glyphs import GlyphMatcher, is_glyph_path
from .mathnodes import Rule, make_atom

_FACE_TABLE = json.load(open(os.path.join(os.path.dirname(__file__), "face_table.json"), encoding="utf-8"))
_MATCHER = None

BLACK = (0.0, 0.0, 0.0)
WHITE = (1.0, 1.0, 1.0)


def matcher():
    global _MATCHER
    if _MATCHER is None:
        _MATCHER = GlyphMatcher()
    return _MATCHER


class Box:
    __slots__ = ("x0", "y0", "x1", "y1", "kind", "data")
    is_rule = False

    def __init__(self, x0, y0, x1, y1, kind="", data=None):
        self.x0, self.y0, self.x1, self.y1 = x0, y0, x1, y1
        self.kind, self.data = kind, data


class Char:
    __slots__ = ("c", "x0", "y0", "x1", "y1", "base", "size", "face", "under", "page")

    def __init__(self, c, bbox, base, size, face, page):
        self.c = c
        self.x0, self.y0, self.x1, self.y1 = bbox
        self.base, self.size, self.face, self.page = base, size, face, page
        self.under = False


class PagePrims:
    KINDS = ("chars", "atoms", "rules", "vrules", "figs", "images")

    def __init__(self):
        self.chars, self.atoms, self.rules, self.vrules, self.figs, self.images = [], [], [], [], [], []

    def all(self):
        return [it for k in self.KINDS for it in getattr(self, k)]

    def drop_above(self, y):
        for k in self.KINDS:
            setattr(self, k, [it for it in getattr(self, k) if it.y0 >= y])

    def shift(self, dy):
        if not dy:
            return
        for it in self.all():
            it.y0 += dy
            it.y1 += dy
            if hasattr(it, "base") and it.base is not None:
                it.base += dy


# ------------------------------------------------------------------ fonts
class FaceResolver:
    """Map a Type3 font xref to a text face ('r', 'b', 'i', 'bi') via glyph hashes."""

    def __init__(self, doc):
        self.doc, self.cache = doc, {}

    def face(self, xref):
        if xref not in self.cache:
            votes = Counter()
            for ch, h in _font_glyph_hashes(self.doc, xref).items():
                f = _FACE_TABLE.get(ch, {}).get(h)
                if f:
                    votes[f] += 1
            self.cache[xref] = votes.most_common(1)[0][0] if votes else "r"
        return self.cache[xref]


def _font_glyph_hashes(doc, xref):
    o = doc.xref_object(xref)
    m = re.search(r"/CharProcs <<(.*?)>>", o, re.S)
    if not m:
        return {}
    procs = dict(re.findall(r"/(\S+) (\d+) 0 R", m.group(1)))
    diffs = {}
    em = re.search(r"/Encoding (\d+) 0 R", o)
    if em:
        dm = re.search(r"/Differences \[(.*?)\]", doc.xref_object(int(em.group(1))), re.S)
        if dm:
            code = 0
            for tok in dm.group(1).split():
                if tok.startswith("/"):
                    diffs[code] = tok[1:]
                    code += 1
                else:
                    code = int(tok)
    tu = {}
    tm = re.search(r"/ToUnicode (\d+) 0 R", o)
    if tm:
        s = doc.xref_stream(int(tm.group(1))).decode("latin1")
        for blk in re.findall(r"beginbfchar(.*?)endbfchar", s, re.S):
            for a, b in re.findall(r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", blk):
                try:
                    tu[int(a, 16)] = bytes.fromhex(b).decode("utf-16-be")
                except ValueError:
                    pass
        for blk in re.findall(r"beginbfrange(.*?)endbfrange", s, re.S):
            for a, b, c in re.findall(r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", blk):
                for k in range(int(a, 16), int(b, 16) + 1):
                    tu[k] = chr(int(c, 16) + k - int(a, 16))
    res = {}
    for code, name in diffs.items():
        if name in procs and code in tu:
            st = doc.xref_stream(int(procs[name]))
            body = st.split(b"\n", 1)[1] if b"\n" in st else st
            if len(body) >= 20:
                res[tu[code]] = hashlib.md5(body).hexdigest()[:12]
    return res


def _overline_strokes(out):
    """Short isolated stroked lines with math right below them are overlines."""
    for f in [f for f in out.figs if f.data and isinstance(f.data, dict) and f.data.get("hline")]:
        if not 3 <= f.x1 - f.x0 <= 80:
            continue
        below = [a for a in out.atoms if f.x0 - 1 <= (a.x0 + a.x1) / 2 <= f.x1 + 1 and -0.8 <= a.y0 - f.y1 <= 3.0]
        touching = [g for g in out.figs if g is not f and g.x0 - 1 < f.x1 and f.x0 - 1 < g.x1
                    and g.y0 - 1.5 < f.y1 and f.y0 - 1.5 < g.y1]
        if below and not touching:
            lw = f.data["hline"]
            out.figs.remove(f)
            out.rules.append(Rule((f.x0, f.y0 - lw / 2, f.x1, f.y1 + lw / 2)))


# ------------------------------------------------------------------ page
def extract_page(doc, pno, faces, yoff=0.0, ymin=0.0):
    """Collect primitives of page `pno` whose top is below `ymin` (page coords)."""
    page = doc[pno]
    out = PagePrims()
    raw = page.get_text("rawdict", flags=0)
    for b in raw["blocks"]:
        for line in b.get("lines", []):
            if abs(line["dir"][0] - 1) >= 1e-3:          # rotated text belongs to a figure
                x0, y0, x1, y1 = line["bbox"]
                if y0 >= ymin:
                    text = "".join(c["c"] for sp in line["spans"] for c in sp["chars"])
                    out.figs.append(Box(x0, y0 + yoff, x1, y1 + yoff, "vtext", text))
                continue
            for sp in line["spans"]:
                m = re.search(r"\((\d+) 0 R\)", sp["font"])
                face = faces.face(int(m.group(1))) if m else "r"
                size = sp["size"] * 10 if sp["size"] < 3 else sp["size"]
                chars = sp["chars"]
                normal_space = 0.24 * size
                for c in chars:
                    x0, y0, x1, y1 = c["bbox"]
                    if y0 < ymin:
                        continue
                    ch = c["c"]
                    if ch == " " and x1 - x0 < 0.35 * normal_space:
                        continue        # zero-width kerning artifact ("repor ted")
                    if ch == "\xa0":
                        ch = " "
                    out.chars.append(Char(ch, (x0, y0 + yoff, x1, y1 + yoff), c["origin"][1] + yoff, size, face, pno))
    gm = matcher()
    drawings = page.get_drawings()
    # black rules are often drawn twice (fill + hairline stroke of the same rect)
    filled = {tuple(round(v, 1) for v in dr["rect"]) for dr in drawings
              if dr["type"] == "f" and dr.get("fill") == BLACK and len(dr["items"]) == 1 and dr["items"][0][0] == "re"}
    for dr in drawings:
        r = dr["rect"]
        if r.y0 < ymin or (r.width <= 0 and r.height <= 0):
            continue
        if dr["type"] == "s" and len(dr["items"]) == 1 and dr["items"][0][0] == "re" \
                and tuple(round(v, 1) for v in r) in filled:
            continue
        box = (r.x0, r.y0 + yoff, r.x1, r.y1 + yoff)
        fill, typ = dr.get("fill"), dr["type"]
        if is_glyph_path(dr):
            lab = gm.match(dr)
            if lab and lab != "FIG":
                out.atoms.append(make_atom(lab, box))
            else:
                out.figs.append(Box(*box, kind="fsglyph"))
            continue
        items = dr["items"]
        if typ == "f" and fill == BLACK and len(items) == 1 and items[0][0] == "re":
            w, h = r.width, r.height
            if h <= 1.3 and w >= 1.5:
                out.rules.append(Rule(box))
                continue
            if w <= 1.3 and h >= 1.5:
                out.vrules.append(Box(*box, kind="vrule"))
                continue
        if typ == "f" and fill == WHITE:
            continue            # white backgrounds are invisible
        kind = "stroke" if typ == "s" else "fill"
        data = dict(fill=fill, color=dr.get("color"), n=len(items))
        if typ == "s" and len(items) == 1 and items[0][0] == "l" and r.height < 0.05 \
                and dr.get("color") == BLACK and (dr.get("width") or 0) <= 1.2:
            data["hline"] = dr.get("width") or 0.5
        out.figs.append(Box(*box, kind=kind, data=data))
    _overline_strokes(out)
    for info in page.get_image_info(xrefs=True):
        x0, y0, x1, y1 = info["bbox"]
        if y1 <= ymin or x1 - x0 < 0.5 or y1 - y0 < 0.5:
            continue
        out.images.append(Box(x0, y0 + yoff, x1, y1 + yoff, "image",
                              dict(xref=info["xref"], w=info["width"], h=info["height"], page=pno)))
    return out
