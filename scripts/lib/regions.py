"""Region-level structure detection: underlines, tables, bullets, figures.

Each detector consumes primitives from a Region (removing what it claims) and
returns structured objects positioned in the region's stacked coordinates.
"""
import re

from .mathnodes import Rule

# ---------------------------------------------------------------- helpers


def overlaps(a, b, pad=0.0):
    return a.x0 - pad < b.x1 and b.x0 - pad < a.x1 and a.y0 - pad < b.y1 and b.y0 - pad < a.y1


def inside(a, b, pad=0.0):
    """a inside b (with padding)."""
    return a.x0 >= b.x0 - pad and a.x1 <= b.x1 + pad and a.y0 >= b.y0 - pad and a.y1 <= b.y1 + pad


class BBox:
    __slots__ = ("x0", "y0", "x1", "y1")
    is_rule = False

    def __init__(self, x0, y0, x1, y1):
        self.x0, self.y0, self.x1, self.y1 = x0, y0, x1, y1

    @classmethod
    def of(cls, items):
        return cls(min(i.x0 for i in items), min(i.y0 for i in items),
                   max(i.x1 for i in items), max(i.y1 for i in items))

    def add(self, it):
        self.x0, self.y0 = min(self.x0, it.x0), min(self.y0, it.y0)
        self.x1, self.y1 = max(self.x1, it.x1), max(self.y1, it.y1)

    @property
    def w(self):
        return self.x1 - self.x0

    @property
    def h(self):
        return self.y1 - self.y0


def text_runs(chars, gap=4.0):
    """Group horizontal chars into runs: same baseline, horizontally contiguous."""
    rows = {}
    for c in sorted(chars, key=lambda c: (round(c.base, 0), c.x0)):
        rows.setdefault(round(c.base), []).append(c)
    runs = []
    for row in rows.values():
        row.sort(key=lambda c: c.x0)
        cur = [row[0]]
        for c in row[1:]:
            if c.x0 - cur[-1].x1 > gap:
                runs.append(cur)
                cur = [c]
            else:
                cur.append(c)
        runs.append(cur)
    return runs


# ---------------------------------------------------------------- underlines
def detect_underlines(region):
    """Thin rules sitting just under text chars are underlines, not math."""
    keep = []
    for r in region.rules:
        if any(a.label == "sqrt" and abs(r.x0 - a.x1) < 2.5 and abs(r.y0 - a.y0) < 2.0 for a in region.atoms):
            keep.append(r)        # radical vinculum
            continue
        above = [c for c in region.chars if c.c.strip() and 0.3 <= r.y0 - c.base <= 1.8
                 and c.x1 > r.x0 and c.x0 < r.x1]
        covered = sum(min(c.x1, r.x1) - max(c.x0, r.x0) for c in above)
        if above and covered >= 0.45 * (r.x1 - r.x0):
            for c in region.chars:
                if abs(c.base - above[0].base) < 1.5 and r.x0 - 0.5 <= (c.x0 + c.x1) / 2 <= r.x1 + 0.5:
                    c.under = True
        else:
            keep.append(r)
    region.rules = keep


# ---------------------------------------------------------------- tables
class Table:
    def __init__(self, box, cols, rows, cells):
        self.box = box            # BBox
        self.cols, self.rows = cols, rows   # boundary coordinates
        self.cells = cells        # list of (r, c, rowspan, colspan, BBox)
        self.x0, self.y0, self.x1, self.y1 = box.x0, box.y0, box.x1, box.y1


def _cluster_vals(vals, tol=1.6):
    out = []
    for v in sorted(vals):
        if out and v - out[-1][-1] <= tol:
            out[-1].append(v)
        else:
            out.append([v])
    return [sum(g) / len(g) for g in out]


def detect_tables(region):
    hs = [r for r in region.rules if r.x1 - r.x0 >= 3]
    vs = [v for v in region.vrules if v.y1 - v.y0 >= 3]
    if not vs or len(hs) < 2:
        return []
    items = hs + vs
    parent = list(range(len(items)))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    for i in range(len(items)):
        for j in range(i + 1, len(items)):
            if overlaps(items[i], items[j], pad=1.6):
                parent[find(i)] = find(j)
    comps = {}
    for i, it in enumerate(items):
        comps.setdefault(find(i), []).append(it)
    tables = []
    for comp in comps.values():
        ch = [x for x in comp if isinstance(x, Rule)]
        cv = [x for x in comp if not isinstance(x, Rule)]
        if len(ch) < 2 or not cv:
            continue
        box = BBox.of(comp)
        if box.w < 20 or box.h < 10:
            continue
        rows = _cluster_vals([(h.y0 + h.y1) / 2 for h in ch])
        cols = _cluster_vals([(v.x0 + v.x1) / 2 for v in cv])
        if box.x0 < cols[0] - 3:
            cols.insert(0, box.x0)
        if box.x1 > cols[-1] + 3:
            cols.append(box.x1)
        if len(rows) < 2 or len(cols) < 2 or (len(rows) - 1) * (len(cols) - 1) < 2:
            continue

        def vline_at(x, y):
            return any(abs((v.x0 + v.x1) / 2 - x) < 1.6 and v.y0 - 1 <= y <= v.y1 + 1 for v in cv)

        def hline_at(y, x):
            return any(abs((h.y0 + h.y1) / 2 - y) < 1.6 and h.x0 - 1 <= x <= h.x1 + 1 for h in ch)

        nr, nc = len(rows) - 1, len(cols) - 1
        owner = {}
        cells = []
        for r in range(nr):
            for c in range(nc):
                if (r, c) in owner:
                    continue
                cs = 1
                ymid = (rows[r] + rows[r + 1]) / 2
                while c + cs < nc and not vline_at(cols[c + cs], ymid):
                    cs += 1
                rs = 1
                xmid = (cols[c] + cols[c + cs]) / 2
                while r + rs < nr and not hline_at(rows[r + rs], xmid):
                    rs += 1
                for rr in range(r, r + rs):
                    for cc in range(c, c + cs):
                        owner[(rr, cc)] = (r, c)
                cells.append((r, c, rs, cs, BBox(cols[c], rows[r], cols[c + cs], rows[r + rs])))
        tables.append(Table(box, cols, rows, cells))
        claimed = set(map(id, comp))
        region.rules = [r for r in region.rules if id(r) not in claimed]
        region.vrules = [v for v in region.vrules if id(v) not in claimed]
        # table backgrounds (header shading) are part of the table
        region.figs = [f for f in region.figs if not (f.kind == "fill" and inside(f, box, 1.0))]
    return tables


# ---------------------------------------------------------------- bullets
def detect_bullets(region):
    """Small round filled marks at the start of a text line (notes lists)."""
    bullets, keep = [], []
    for f in region.figs:
        w, h = f.x1 - f.x0, f.y1 - f.y0
        if f.kind == "fill" and 1.5 <= w <= 5.5 and abs(w - h) < 0.8 and f.x0 < 80:
            cy = (f.y0 + f.y1) / 2
            right = [c for c in region.chars if 0 < c.x0 - f.x1 < 14 and c.y0 < cy < c.y1]
            if right:
                bullets.append(BBox(f.x0, f.y0, f.x1, f.y1))
                continue
        keep.append(f)
    region.figs = keep
    return bullets


# ---------------------------------------------------------------- figures
class Figure:
    def __init__(self, box):
        self.box = box
        self.labels = []          # absorbed text runs (for alt text)
        self.atoms = []

    @property
    def x0(self):
        return self.box.x0

    @property
    def y0(self):
        return self.box.y0

    @property
    def x1(self):
        return self.box.x1

    @property
    def y1(self):
        return self.box.y1


def detect_figures(region, margin=12.0):
    """Cluster vector drawing parts into figures and absorb their labels."""
    # yellow boxes behind text are highlights (the source's "Math output error"), not drawings
    figs = [f for f in region.figs if not (f.kind == "fill" and f.data and f.data.get("fill") == (1.0, 1.0, 0.0))]
    if not figs:
        return []
    parent = list(range(len(figs)))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    order = sorted(range(len(figs)), key=lambda i: figs[i].y0)
    for ii, i in enumerate(order):
        for j in order[ii + 1:]:
            if figs[j].y0 > figs[i].y1 + 8:
                break
            if overlaps(figs[i], figs[j], pad=8):
                parent[find(i)] = find(j)
    groups = {}
    for i, f in enumerate(figs):
        groups.setdefault(find(i), []).append(f)
    out = []
    for g in groups.values():
        box = BBox.of(g)
        if box.w < 6 and box.h < 6 and len(g) < 3:
            continue            # isolated speck
        fig = Figure(box)
        fig.labels += [(f.y0, f.x0, f.data) for f in g if f.kind == "vtext"]
        out.append(fig)
    # merge figures whose boxes overlap after clustering
    merged = True
    while merged:
        merged = False
        for a in out:
            for b in out:
                if a is not b and overlaps(a.box, b.box, pad=4):
                    a.box.add(b.box)
                    a.labels += b.labels
                    out.remove(b)
                    merged = True
                    break
            if merged:
                break
    region.figs = []
    for fig in out:
        _absorb(region, fig, margin)
    # pieces of one chart (plot, rotated axis title, legend) sit close together
    # with no body text between them
    merged = True
    while merged:
        merged = False
        for a in out:
            for b in out:
                if a is b:
                    continue
                gx = max(0.0, b.box.x0 - a.box.x1, a.box.x0 - b.box.x1)
                gy = max(0.0, b.box.y0 - a.box.y1, a.box.y0 - b.box.y1)
                if max(gx, gy) >= 60:
                    continue
                u = BBox(min(a.box.x0, b.box.x0), min(a.box.y0, b.box.y0),
                         max(a.box.x1, b.box.x1), max(a.box.y1, b.box.y1))
                if any(c.c.strip() and inside(c, u) and not inside(c, a.box) and not inside(c, b.box)
                       for c in region.chars):
                    continue
                a.box.add(b.box)
                a.labels += b.labels
                a.atoms += b.atoms
                out.remove(b)
                _absorb(region, a, margin)
                merged = True
                break
            if merged:
                break
    return out


def _is_label(rb, box, grow, margin):
    """Is a text run (bbox rb) part of the figure with bbox `box`?"""
    if inside(rb, box, 2) or (inside(rb, grow) and rb.w <= box.w + 10):
        return True
    cy = (rb.y0 + rb.y1) / 2
    gap_x = max(box.x0 - rb.x1, rb.x0 - box.x1)
    if rb.w <= 70 and box.y0 <= cy <= box.y1 and gap_x <= 45:
        return True                       # tick labels / axis title beside the plot
    # centred on the plot (the box may include a rotated axis title on one side)
    centered = abs((rb.x0 + rb.x1) / 2 - (box.x0 + box.x1) / 2) < max(25, 0.2 * box.w) \
        and rb.x0 >= box.x0 - margin and rb.x1 <= box.x1 + margin
    if centered and rb.w <= box.w + 10 and rb.y1 <= box.y0 and box.y0 - rb.y1 < 30:
        return True                       # title above
    if centered and rb.w <= 0.9 * box.w and rb.y0 >= box.y1 and rb.y0 - box.y1 < 25:
        return True                       # axis title below
    return False


def _absorb(region, fig, margin):
    """Pull axis labels, titles and legends (text + glyphs) into the figure."""
    changed = True
    while changed:
        changed = False
        grow = BBox(fig.box.x0 - margin, fig.box.y0 - margin, fig.box.x1 + margin, fig.box.y1 + margin)
        for run in text_runs(region.chars):
            rb = BBox.of(run)
            ids = set(map(id, run))
            base = run[0].base
            # a fragment of a body-text line (e.g. the "?" after inline math) is not a label
            if any(abs(c.base - base) < 1 and id(c) not in ids and c.c.strip()
                   and (c.x1 < fig.box.x0 - 45 or c.x0 > fig.box.x1 + 45) for c in region.chars):
                continue
            if _is_label(rb, fig.box, grow, margin):
                ids = set(map(id, run))
                region.chars = [c for c in region.chars if id(c) not in ids]
                fig.labels.append((rb.y0, rb.x0, "".join(c.c for c in run)))
                fig.box.add(rb)
                changed = True
        took = [a for a in region.atoms if inside(a, grow)]
        if took:
            ids = set(map(id, took))
            region.atoms = [a for a in region.atoms if id(a) not in ids]
            fig.atoms += took
            for a in took:
                fig.box.add(a)
            changed = True
        rules = [r for r in region.rules if inside(r, grow)]
        if rules:
            ids = set(map(id, rules))
            region.rules = [r for r in region.rules if id(r) not in ids]
            for r in rules:
                fig.box.add(r)
            changed = True
        vr = [v for v in region.vrules if inside(v, grow)]
        if vr:
            ids = set(map(id, vr))
            region.vrules = [v for v in region.vrules if id(v) not in ids]
            for v in vr:
                fig.box.add(v)
            changed = True


def figure_alt(fig, kind="Figure"):
    """Alt text: figure type plus its titles/axis labels/legend (no tick numbers)."""
    words = []
    for _, _, t in sorted(fig.labels):
        t = " ".join(t.split())
        if t and not re.fullmatch(r"[-\u2212\ufffd\d.,%$ ]+", t) and t not in words:
            words.append(t)
    labels = {a.label for a in fig.atoms}
    if kind == "Figure" and "x" in labels and "y" in labels:
        kind = "Graph in the xy-plane"
    text = "; ".join(words)
    return (kind + (": " + text if text else ""))[:220]
