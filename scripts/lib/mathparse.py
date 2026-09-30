"""Turn positioned math glyphs + horizontal rules into LaTeX.

Pipeline for one region of a page:
  1. cluster_expressions() (mathcluster.py): group atoms/rules into expressions.
  2. parse_expression(): build radicals and fractions (recursively), then read
     each row left to right, attaching superscripts/subscripts by size and
     baseline.
Anything unexpected is recorded in `flags`; the caller falls back to an image
crop for flagged expressions.
"""
from statistics import median

from .mathnodes import (AXIS, BIN, DELIMS, EM, FUNCS, LATEX_OF, REL, SPECIAL_SUP,
                        STACK_GAP, Node, num_gap, snap, union_box)


# --------------------------------------------------------------------------
# 2. structure: radicals, fractions, overlines
# --------------------------------------------------------------------------
def parse_expression(atoms, rules):
    """atoms: Nodes from make_atom; rules: Rules. Returns (latex, baseline, flags)."""
    flags = []
    latex, base, _ = _parse(list(atoms), list(rules), flags, 0)
    return latex, base, flags


def _parse(pool, rules, flags, depth):
    if depth > 10:
        flags.append("nesting too deep")
        return "", 0, 1.0
    pool, rules = list(pool), list(rules)
    _build_radicals(pool, rules, flags, depth)
    _build_fractions(pool, rules, flags, depth)
    return _row(pool, flags, depth)


def _build_radicals(pool, rules, flags, depth):
    sqs = sorted([n for n in pool if n.label == "sqrt"], key=lambda n: -(n.y1 - n.y0))
    for sq in sqs:
        if sq not in pool:
            continue
        vin = [r for r in rules if abs(r.x0 - sq.x1) < 2.5 and abs(r.y0 - sq.y0) < 2.0]
        if not vin:
            flags.append("radical without vinculum")
            continue
        v = max(vin, key=lambda r: r.x1 - r.x0)
        rules.remove(v)

        def inside(it):
            return (v.x0 - 0.5 <= (it.x0 + it.x1) / 2 <= v.x1 + 0.5
                    and it.y0 >= v.y1 - 0.8 and it.y1 <= sq.y1 + 1.5)

        rad = [n for n in pool if n is not sq and inside(n)]
        rad_rules = [r for r in rules if inside(r) and r.x0 >= v.x0 - 0.5 and r.x1 <= v.x1 + 0.5]
        idx = [n for n in pool if n is not sq and n not in rad and n.s < 0.9
               and sq.x0 - 8 <= n.x0 and sq.x0 + 0.15 * (sq.x1 - sq.x0) < n.x1 <= sq.x0 + 0.75 * (sq.x1 - sq.x0)
               and sq.y0 + 0.2 * (sq.y1 - sq.y0) <= n.y1 <= sq.y0 + 0.65 * (sq.y1 - sq.y0)]
        # a multi-digit index can extend left past the surd: grow it
        grow = True
        while idx and grow:
            grow = False
            for n in pool:
                if n is not sq and n not in rad and n not in idx and n.kind == "atom" \
                        and abs(n.s - idx[0].s) < 0.05 and abs(n.base - idx[0].base) < 0.8 \
                        and -0.5 < min(i.x0 for i in idx) - n.x1 < 1.5:
                    idx.append(n)
                    grow = True
        for n in rad + idx + [sq]:
            pool.remove(n)
        for r in rad_rules:
            rules.remove(r)
        if not rad:
            flags.append("empty radicand")
            continue
        rl, rb, rs = _parse(rad, rad_rules, flags, depth + 1)
        il = _parse(idx, [], flags, depth + 1)[0] if idx else ""
        latex = "\\sqrt" + ("[" + il + "]" if il else "") + "{" + rl + "}"
        pool.append(Node("sqrt", union_box([sq, v] + rad + idx), rs, rb, latex=latex))


def _build_fractions(pool, rules, flags, depth):
    for r in sorted(rules, key=lambda r: -(r.x1 - r.x0)):
        if r not in rules:
            continue
        rules.remove(r)

        def within(it):
            return r.x0 - 1.2 <= (it.x0 + it.x1) / 2 <= r.x1 + 1.2

        above = _stack([n for n in pool if within(n) and n.mbot <= r.cy + 0.3]
                       + [q for q in rules if within(q) and q.cy < r.cy], r, up=True)
        below = _stack([n for n in pool if within(n) and n.y0 >= r.cy - 0.3]
                       + [q for q in rules if within(q) and q.cy > r.cy], r, up=False)
        an = [n for n in above if not n.is_rule]
        bn = [n for n in below if not n.is_rule]
        if an and bn:
            ar = [q for q in above if q.is_rule]
            br = [q for q in below if q.is_rule]
            for n in an + bn:
                pool.remove(n)
            for q in ar + br:
                rules.remove(q)
            nl, _, ns = _parse(an, ar, flags, depth + 1)
            dl, _, ds = _parse(bn, br, flags, depth + 1)
            size = min(ns, ds)
            ctx = snap(size if size >= 0.9 else min(1.0, size / 0.71))
            # "\\frac" vs "\\dfrac" is decided in _row, relative to the row's glyphs
            pool.append(Node("frac", union_box([r] + an + bn), ctx, r.cy + AXIS * ctx,
                             latex="{" + nl + "}{" + dl + "}", axis=r.cy, num_s=size))
        elif bn and not an and min(n.y0 for n in bn) - r.y1 < 3.0:
            for n in bn:
                pool.remove(n)
            il, ib, is_ = _parse(bn, [], flags, depth + 1)
            pool.append(Node("over", union_box([r] + bn), is_, ib, latex="\\overline{" + il + "}"))
        else:
            flags.append("stray rule")


def _stack(cands, r, up):
    """Items stacked directly above/below rule r, stopping at a large gap."""
    key = (lambda it: r.y0 - it.y1) if up else (lambda it: it.mtop - r.y1)
    out, reach = [], None
    for it in sorted(cands, key=key):
        d = key(it)
        if reach is None:
            if d > (num_gap(it) if up else STACK_GAP) + 0.2:
                break
            out.append(it)
            reach = d + (it.y1 - it.y0)
        elif d <= reach + 1.0:
            out.append(it)
            reach = max(reach, d + (it.y1 - it.y0))
        else:
            break
    return out


# --------------------------------------------------------------------------
# 3. rows: scripts, spacing, emission
# --------------------------------------------------------------------------
def _row(nodes, flags, depth):
    if not nodes:
        flags.append("empty row")
        return "", 0, 1.0
    nodes = sorted(nodes, key=lambda n: (n.x0, n.y0))
    # Row size/baseline come from plain glyphs: composite sizes are unreliable
    # because the renderer clamps a minimum script size.
    core = [n for n in nodes if n.kind == "atom" and not (n.label in SPECIAL_SUP or n.big)]
    core = [n for n in core if n.label not in DELIMS] or core   # delimiters stretch
    # "." may be a raised \cdot and "," hangs low: neither sets the baseline
    core = [n for n in core if n.label not in (".", ",")]
    comps = [n for n in nodes if n.kind in ("sqrt", "over")]     # sized by their contents
    if not core and not comps:
        core = [n for n in nodes if n.kind != "atom"] or nodes
    S = max(n.s for n in core + comps)
    big = [n for n in core if n.s >= 0.88 * S] or [n for n in comps if n.s >= 0.88 * S]
    B0 = big[0].base
    B = median(n.base for n in big if abs(n.base - B0) <= 1.2 * S)
    # Stretched delimiters are centred on the row's axis. If no plain glyph sits
    # on that axis (e.g. \left(\frac{a}{b}\right)^2), the glyphs we found are
    # scripts and the delimiters define the main level.
    delims = [n for n in nodes if n.big]
    if delims:
        axis = median((n.y0 + n.y1) / 2 for n in delims)
        plain = [n for n in core if n.kind == "atom"]
        if plain and not any(abs((n.base - AXIS * n.s) - axis) <= 1.5 for n in plain):
            S = 1.0
            B = axis + AXIS
    groups = []   # [base, sups, subs, primes, circ, right edge of primes/degree]
    for n in nodes:
        if n.label in SPECIAL_SUP:
            if not groups:               # degree sign wrapped away from its number
                groups.append([None, [], [], 0, False, 0.0])
            if n.label == "'":
                groups[-1][3] += 1
            else:
                groups[-1][4] = True
            groups[-1][5] = max(groups[-1][5], n.x1)
            continue
        role = "main" if n.big else _role(n, S, B)
        if role == "?":
            flags.append("ambiguous position: " + (n.label or n.kind))
            role = "main"
        if role == "sub" and n.kind == "frac":
            flags.append("fraction as subscript")
        if role == "main":
            groups.append([n, [], [], 0, False, 0.0])
        else:
            if not groups:
                groups.append([None, [], [], 0, False, 0.0])
            groups[-1][1 if role == "sup" else 2].append(n)
    atom_s = max((n.s for n in core if n.kind == "atom"), default=None)
    for g in groups:
        f = g[0]
        if f is not None and f.kind == "frac" and not f.latex.startswith("\\"):
            # display style only when the numerator is as large as the row's glyphs
            full = f.num_s >= 0.9 * atom_s if atom_s else f.num_s >= 0.97
            f.latex = ("\\dfrac" if full else "\\frac") + f.latex
    for n in nodes:
        if n.kind == "frac" and not n.latex.startswith("\\"):
            n.latex = "\\frac" + n.latex        # fractions inside scripts
    return _emit(groups, S, B, flags, depth), B, S


def _role(n, S, B):
    if n.kind == "frac":
        d = n.axis - (B - AXIS * S)
        return "main" if abs(d) <= 1.5 * S else ("sup" if d < 0 else "sub")
    tol = 1.6 * S
    if (n.kind != "atom" or n.s >= 0.88 * S) and abs(n.base - B) <= tol:
        return "main"
    if n.label in (".", ",") and abs(n.base - B) <= tol:
        return "main"
    if n.label == "." and 0 <= B - n.base <= 3.6 * S:
        return "main"               # \cdot sits on the axis
    if n.base < B - 1.0 * S:
        return "sup"
    if n.base > B + 0.8 * S:
        return "sub"
    return "?"


def _emit(groups, S, B, flags, depth):
    pieces = []
    for base, sups, subs, primes, circ, special_right in groups:
        script = ""
        right = max([n.x1 for n in sups + subs] + [special_right] + [base.x1 if base is not None else 0])
        if subs:
            script += "_{" + _row(subs, flags, depth + 1)[0] + "}"
        if sups or circ:
            t = _row(sups, flags, depth + 1)[0] if sups else ""
            if circ:
                t = (t + " " if t else "") + "\\circ"
            script += "^{" + t + "}"
        script += "'" * primes
        if base is None:
            first = (subs or sups)[0] if subs or sups else None
            x = first.x0 if first else special_right
            pieces.append(dict(kind="ord", tex="{}", x0=x, x1=x, script=script))
            continue
        if base.kind != "atom":
            pieces.append(dict(kind="comp", tex=base.latex, x0=base.x0, x1=max(base.x1, right), script=script))
            continue
        lab = base.label
        kind = ("rm" if lab.startswith("rm:") else "bin" if lab in BIN else "rel" if lab in REL
                else "open" if lab == "(" else "close" if lab == ")" else "bar" if lab == "|"
                else "punct" if lab == "," else "dot" if lab == "." else "ord")
        tex = lab[3:] if kind == "rm" else LATEX_OF.get(lab, lab)
        if kind == "dot" and base.base < B - 1.5 * S:
            tex, kind = "\\cdot", "bin"
        pieces.append(dict(kind=kind, tex=tex, x0=base.x0, x1=max(base.x1, right), script=script, big=base.big))
    return _join(pieces, S, flags)


def _join(pieces, S, flags):
    # merge runs of upright letters into words (\text{...} or \sin etc.)
    merged = []
    for p in pieces:
        if p["kind"] == "rm":
            last = merged[-1] if merged else None
            if (last is not None and last["kind"] == "rmrun" and not last["script"]
                    and p["x0"] - last["x1"] < 0.45 * EM * S):
                sep = " " if p["x0"] - last["x1"] > 0.2 * EM * S else ""
                last["tex"] += sep + p["tex"]
                last["x1"], last["script"] = p["x1"], p["script"]
                continue
            p = dict(p, kind="rmrun")
        merged.append(p)
    _pair_delims(merged, flags)
    out = []
    for i, p in enumerate(merged):
        prev = merged[i - 1] if i else None
        nxt = merged[i + 1] if i + 1 < len(merged) else None
        tex = p["tex"]
        if p["kind"] == "rmrun":
            if tex in FUNCS:
                tex = "\\" + tex
            else:
                lead = (prev is not None and prev["kind"] in ("ord", "close", "comp", "punct", "dot", "rmrun")
                        and p["x0"] - prev["x1"] > 0.17 * EM * S)
                trail = (nxt is not None and nxt["kind"] in ("ord", "open", "comp")
                         and nxt["x0"] - p["x1"] > 0.17 * EM * S)
                tex = "\\text{" + (" " if lead else "") + tex + (" " if trail else "") + "}"
        elif (p["kind"] == "punct" and prev is not None and nxt is not None
              and prev["tex"].isdigit() and nxt["tex"][:1].isdigit() and not prev["script"]
              and nxt["x0"] - p["x1"] < 2.2 * S):     # thousands separator (list commas: ~3pt)
            tex = "{,}"
        elif (prev is not None and p["kind"] in ("ord", "open", "comp")
              and prev["kind"] in ("ord", "close", "comp") and p["x0"] - prev["x1"] > 0.45 * EM * S):
            tex = ("\\quad " if p["x0"] - prev["x1"] > 0.85 * EM * S else "\\ ") + tex
        out.append(tex + p["script"])
    return _concat(out)


def _pair_delims(merged, flags):
    """Pair ( ) and | | left to right; use \\left/\\right when either side is tall."""
    stack = []
    for i, p in enumerate(merged):
        k = p["kind"]
        if k == "open" or (k == "bar" and not (stack and merged[stack[-1]]["kind"] == "bar")):
            stack.append(i)
        elif k in ("close", "bar"):
            want = "bar" if k == "bar" else "open"
            if stack and merged[stack[-1]]["kind"] == want:
                j = stack.pop()
                if merged[j].get("big") or p.get("big"):
                    merged[j]["tex"] = "\\left" + merged[j]["tex"]
                    p["tex"] = "\\right" + p["tex"]
            elif p.get("big"):
                p["tex"] = "\\bigr" + p["tex"]      # partner is on another line
    for j in stack:
        if merged[j].get("big"):
            merged[j]["tex"] = "\\bigl" + merged[j]["tex"]


def _concat(tokens):
    s = ""
    for t in tokens:
        if not t:
            continue
        if s and t[0].isalpha() and _ends_with_ctrl(s):
            s += " "
        s += t
    return s


def _ends_with_ctrl(s):
    i = len(s) - 1
    while i >= 0 and s[i].isalpha():
        i -= 1
    return i >= 0 and i < len(s) - 1 and s[i] == "\\"
