"""Extract one question (a run of pages) into the Question JSON schema."""
import re

from .mathcluster import absorb_text, cluster_expressions
from .mathparse import parse_expression
from .answers import fix_missing_glyphs, image_srcs, latex_to_answer, name_figures, split_rationale
from .media import MATH_ZOOM, Media
from .primitives import extract_page
from .regions import (BBox, detect_bullets, detect_figures, detect_tables,
                      detect_underlines, figure_alt, inside, overlaps)
from .textflow import Item, build_lines, join_paragraph, paragraphs, is_display, RIGHT_MARGIN

HEADER_COLS = [(18, 133, "assessment"), (133, 248, "test"), (248, 363, "domain"),
               (363, 478, "skill"), (478, 600, "difficulty")]
SECTION_LABELS = ("Question", "Answer", "Rationale")
SKILL_FIX = {"Cross-text Connections": "Cross-Text Connections"}


class Region:
    def __init__(self, pages):
        self.chars, self.atoms, self.rules, self.vrules, self.figs, self.images = [], [], [], [], [], []
        self.pages = pages            # [(pno, yoff, top, bottom)] stacked coordinate map

    def take(self, prims, y0, y1):
        mid = lambda it: (it.y0 + it.y1) / 2
        self.chars += [c for c in prims.chars if y0 <= mid(c) < y1]
        self.atoms += [a for a in prims.atoms if y0 <= mid(a) < y1]
        self.rules += [r for r in prims.rules if y0 <= mid(r) < y1]
        self.vrules += [v for v in prims.vrules if y0 <= mid(v) < y1]
        self.figs += [f for f in prims.figs if y0 <= mid(f) < y1]
        self.images += [i for i in prims.images if y0 <= mid(i) < y1]
        return self

    def page_of(self, y):
        for pno, yoff, top, bottom in self.pages:
            if y <= bottom + yoff + 2:
                return pno, yoff
        return self.pages[-1][0], self.pages[-1][1]


class Stacked:
    """All primitives of a question's pages, stacked in one coordinate space."""

    def __init__(self):
        self.chars, self.atoms, self.rules, self.vrules, self.figs, self.images = [], [], [], [], [], []
        self.pages = []

    def add(self, p):
        for k in ("chars", "atoms", "rules", "vrules", "figs", "images"):
            getattr(self, k).extend(getattr(p, k))


class QuestionExtractor:
    def __init__(self, doc, faces, section, pdf_name, media_dir):
        self.doc, self.faces, self.section, self.pdf_name = doc, faces, section, pdf_name
        self.media = Media(doc, media_dir)
        self.issues = []

    # ------------------------------------------------------------ entry
    def extract(self, pages):
        self.issues = []
        self.fig_n = 0
        st = self._stack(pages)
        meta, qid = self._header(pages[0])
        self.qid = qid
        if not meta["domain"] or not meta["skill"] or meta["difficulty"] not in ("Easy", "Medium", "Hard"):
            self.issues.append("incomplete metadata")
        labels = self._section_labels(st)
        if "Question" not in labels:
            raise ValueError("no Question label")
        order = sorted(labels.items(), key=lambda kv: kv[1][0])
        bounds = {}
        for i, (name, (y0, y1, text, base)) in enumerate(order):
            end = order[i + 1][1][0] if i + 1 < len(order) else 1e9
            bounds[name] = (y1 + 0.5, end - 0.5)
        label_bases = [lab[3] for lab in labels.values()]
        st.chars = [c for c in st.chars if not (c.face in ("b", "bi") and c.x0 < 300
                                                and any(abs(round(c.base) - b) < 0.6 for b in label_bases))]

        q = dict(id=qid, section=self.section, domain=meta["domain"], skill=meta["skill"],
                 difficulty=meta["difficulty"], sourcePdf=self.pdf_name, sourcePage=pages[0] + 1)
        qblocks = self._blocks(Region(st.pages).take(st, *bounds["Question"]))
        choices = None
        if "Answer" in bounds:
            choices = self._choices(Region(st.pages).take(st, *bounds["Answer"]))
        rblocks = self._blocks(Region(st.pages).take(st, *bounds["Rationale"])) if "Rationale" in bounds else []
        q["type"] = "mcq" if choices else "spr"
        if self.section == "reading":
            idx = max((i for i, b in enumerate(qblocks) if b["kind"] == "text"), default=None)
            if idx is not None and idx > 0:
                q["passage"] = qblocks[:idx] + qblocks[idx + 1:]
                q["stem"] = [qblocks[idx]]
            else:
                q["stem"] = qblocks
        else:
            q["stem"] = qblocks
        if choices:
            q["choices"] = [dict(label=k, content=v) for k, v in choices]
        answer_text = labels.get("Correct Answer", (0, 0, "", 0))[2]
        q["correct"] = self._correct(answer_text, q["type"], rblocks)
        q["rationale"] = dict(overall=rblocks)
        per = split_rationale(rblocks, q["correct"] if q["type"] == "mcq" else [])
        if per and q["type"] == "mcq":
            q["rationale"]["perChoice"] = per
        name_figures(q)
        fix_missing_glyphs(q, self.issues)
        q["figures"] = sorted(set(image_srcs(q)))
        if "Math output error" in repr(q):
            self.issues.append("source PDF shows 'Math output error' (math missing in the original)")
        self._check(q)
        q["parseConfidence"] = "low" if self.issues else "high"
        q["issues"] = list(dict.fromkeys(self.issues))
        return q

    # ------------------------------------------------------------ pages
    def _stack(self, pages):
        st = Stacked()
        prev_bottom, prev_full = None, True
        for k, pno in enumerate(pages):
            p = extract_page(self.doc, pno, self.faces)
            if k == 0:
                qlab = [c for c in p.chars if c.face == "b" and c.x0 < 22 and c.c == "Q" and c.y0 > 60]
                self.header_bottom = min(c.y0 for c in qlab) - 2 if qlab else 125
                p.drop_above(self.header_bottom)
            items = p.all()
            if not items:
                continue
            top, bottom = min(i.y0 for i in items), max(i.y1 for i in items)
            yoff = 0.0 if prev_bottom is None else prev_bottom - top + (4.0 if prev_full else 20.0)
            p.shift(yoff)
            st.add(p)
            st.pages.append((pno, yoff, top, bottom))
            prev_bottom = bottom + yoff
            if p.chars:
                lastb = max(c.base for c in p.chars)
                prev_full = max(c.x1 for c in p.chars if abs(c.base - lastb) < 1) > RIGHT_MARGIN - 45
        return st

    def _header(self, pno):
        page = self.doc[pno]
        txt = page.get_text("rawdict")
        qid = None
        cells = {k: [] for *_, k in HEADER_COLS}
        for b in txt["blocks"]:
            for ln in b.get("lines", []):
                # skip the near-zero-width spaces the PDF puts inside "rt" ("propor tional")
                s = "".join(c["c"] for sp in ln["spans"] for c in sp["chars"]
                            if not (c["c"] == " " and c["bbox"][2] - c["bbox"][0] < 0.08 * sp["size"] * 10)).strip()
                x0, y0 = ln["bbox"][0], ln["bbox"][1]
                m = re.match(r"Question ID:\s*(\w+)", s)
                if m:
                    qid = m.group(1)
                if 80 <= y0 < self.header_bottom - 1:
                    for a, bb, k in HEADER_COLS:
                        if a <= x0 < bb:
                            cells[k].append((y0, s))
        meta = {k: re.sub(r"\s+", " ", " ".join(t for _, t in sorted(v))).strip() for k, v in cells.items()}
        meta["skill"] = SKILL_FIX.get(meta["skill"], meta["skill"])
        meta["difficulty"] = meta["difficulty"].split()[0] if meta["difficulty"] else ""
        if not qid:
            raise ValueError("no question id on page %d" % pno)
        return meta, qid

    def _section_labels(self, st):
        """Bold labels at the left margin: Question / Answer / Correct Answer: x / Rationale."""
        rows = {}
        for c in st.chars:
            if c.face in ("b", "bi") and c.x0 < 300:
                rows.setdefault(round(c.base, 0), []).append(c)
        labels = {}
        for base, cs in sorted(rows.items()):
            cs.sort(key=lambda c: c.x0)
            if cs[0].x0 > 22:
                continue
            text = "".join(c.c for c in cs).strip()
            y0, y1 = min(c.y0 for c in cs), max(c.y1 for c in cs)
            if text in SECTION_LABELS and text not in labels:
                labels[text] = (y0, y1, text, base)
            elif text.startswith("Correct Answer:") and "Correct Answer" not in labels:
                labels["Correct Answer"] = (y0, y1, text.split(":", 1)[1].strip(), base)
        return labels

    # ------------------------------------------------------------ blocks
    def _blocks(self, region, right=RIGHT_MARGIN):
        detect_underlines(region)
        tables = detect_tables(region)
        bullets = detect_bullets(region)
        figures = detect_figures(region)
        placed = []      # (y0, block)
        for fig in figures:
            claimed = [im for im in region.images if overlaps(im, fig.box, 1)]
            region.images = [im for im in region.images if im not in claimed]
            for im in claimed:
                fig.box.add(im)
            pno, yoff = region.page_of(fig.y0)
            m = self._crop(pno, fig.box, yoff)
            placed.append((fig.y0, dict(kind="image", src=m["src"], alt=figure_alt(fig), width=m["w"], height=m["h"])))
        for t in tables:
            placed.append((t.y0, self._table(t, region)))
        items, inline_imgs = self._math_items(region), []
        for im in region.images:
            w, h = im.x1 - im.x0, im.y1 - im.y0
            m = self.media.raster(im.data["xref"], (im.x0, im.y0, im.x1, im.y1), self._name("r"))
            line_bases = [c.base for c in region.chars if im.y0 + 0.25 * h <= c.base <= im.y1 + 1
                          and (abs(c.x0 - im.x1) < 60 or abs(im.x0 - c.x1) < 60)]
            if h > 60 or w > 330 or not line_bases:
                # the older questions set these images at the left margin, like equations
                placed.append((im.y0, dict(kind="image", src=m["src"], alt="Image from the question (equation, table, or figure)",
                                           width=m["w"], height=m["h"], inline=True)))
            else:
                base = min(line_bases, key=lambda b: abs(b - (im.y0 + 0.72 * h)))
                inline_imgs.append(Item("img", im.x0, im.y0, im.x1, im.y1, base, img=dict(m, alt="math expression")))
        lines, body = build_lines(region.chars, items, inline_imgs)
        paras = paragraphs(lines, right=right)
        paras = _split_at_bullets(paras, bullets)
        for para in paras:
            y0 = min(ln.top for ln in para)
            if len(para) == 1 and is_display(para[0]):
                it = para[0].items[0]
                if it.kind == "math":
                    placed.append((y0, dict(kind="math", latex=it.latex)))
                else:
                    placed.append((y0, dict(kind="image", src=it.img["src"], alt=it.img.get("alt", "math expression"),
                                            width=it.img["w"], height=it.img["h"], inline=True)))
                continue
            block = dict(kind="text", value=join_paragraph(para, right))
            if any(b.y0 - 2 < (para[0].top + para[0].bottom) / 2 < b.y1 + 6 for b in bullets):
                block["style"] = "bullet"
            elif right == RIGHT_MARGIN and all(ln.x0 > 60 and abs((ln.x0 + ln.x1) / 2 - 306) < 12 for ln in para):
                block["style"] = "center"
            placed.append((y0, block))
        placed.sort(key=lambda t: t[0])
        return [b for _, b in placed if not (b["kind"] == "text" and not b["value"].strip())]

    def _math_items(self, region):
        items = []
        for atoms, rules in cluster_expressions(region.atoms, region.rules, region.chars):
            if not atoms:
                box = BBox.of(rules)
                if box.w > 15:
                    items.append(Item("math", box.x0, box.y0 - 6, box.x1, box.y1, box.y1 - 1,
                                      latex="\\underline{\\hspace{%.1fem}}" % (box.w / 9.0)))
                continue
            latex, base, flags = parse_expression(atoms, rules)
            took = absorb_text(atoms, base, region.chars)
            if took:
                ids = {id(c) for c, _ in took}
                region.chars = [c for c in region.chars if id(c) not in ids]
                atoms = list(atoms) + [n for _, n in took]
                latex, base, flags = parse_expression(atoms, rules)
            box = BBox.of(list(atoms) + list(rules))
            # position in the line by the glyphs: overline rules overhang their letters
            gx0, gx1 = min(a.x0 for a in atoms), max(a.x1 for a in atoms)
            if flags or not latex:
                self.issues.append("math fallback: " + "; ".join(sorted(set(flags))))
                pno, yoff = region.page_of(box.y0)
                m = self._crop(pno, box, yoff, zoom=MATH_ZOOM, pad=1.0)
                items.append(Item("img", box.x0, box.y0, box.x1, box.y1, base, img=dict(m, alt="math expression")))
            else:
                items.append(Item("math", gx0, box.y0, gx1, box.y1, base, latex=latex))
        return items

    def _crop(self, pno, box, yoff, zoom=None, pad=3.0):
        kw = dict(pad=pad)
        if zoom:
            kw["zoom"] = zoom
        return self.media.crop(pno, (box.x0, box.y0 - yoff, box.x1, box.y1 - yoff), self._name("f"), **kw)

    def _name(self, kind):
        self.fig_n += 1
        return "%s-%s%d" % (self.qid, kind, self.fig_n)

    def _table(self, t, region):
        grid = {}
        for r, c, rs, cs, box in t.cells:
            sub = Region(region.pages)
            inb = lambda it: inside(BBox((it.x0 + it.x1) / 2, (it.y0 + it.y1) / 2, (it.x0 + it.x1) / 2,
                                         (it.y0 + it.y1) / 2), box, 0.5)
            for k in ("chars", "atoms", "rules", "images"):
                got = [it for it in getattr(region, k) if inb(it)]
                setattr(sub, k, got)
                ids = set(map(id, got))
                setattr(region, k, [it for it in getattr(region, k) if id(it) not in ids])
            blocks = self._blocks(sub, right=box.x1 - 2)
            parts = []
            for b in blocks:
                if b["kind"] == "text":
                    parts.append(b["value"])
                elif b["kind"] == "math":
                    parts.append("$" + b["latex"] + "$")
                elif b["kind"] == "image":
                    parts.append('<img src="%s" w="%d" h="%d" alt="%s"/>' % (b["src"], b["width"], b["height"], b["alt"]))
                else:
                    self.issues.append("nested table")
            grid[(r, c)] = ("<br/>".join(parts), rs, cs)
        nr, nc = len(t.rows) - 1, len(t.cols) - 1
        rows = [["" for _ in range(nc)] for _ in range(nr)]
        merged = []
        for (r, c), (v, rs, cs) in grid.items():
            rows[r][c] = v
            if rs > 1 or cs > 1:
                merged.append([r, c, rs, cs])
        block = dict(kind="table", headers=rows[0], rows=rows[1:])
        if merged:
            block["merged"] = merged
        return block

    # ------------------------------------------------------------ choices
    def _choices(self, region):
        starts = []
        for c in sorted(region.chars, key=lambda c: (c.base, c.x0)):
            if c.x0 < 24 and c.c in "ABCD":
                nxt = [d for d in region.chars if abs(d.base - c.base) < 1 and -0.6 <= d.x0 - c.x1 < 1.5]
                if nxt and nxt[0].c == ".":
                    starts.append((c, nxt[0]))
        letters = [s[0].c for s in starts]
        missing_d = letters == ["A", "B", "C"]      # a source defect seen once
        if missing_d:
            # the unlabeled D starts at the first line after C that is spaced like
            # a new choice (~23pt, not ~14pt) or indented unlike a wrapped line
            prev, first_d = starts[2][0].base, None
            for b in sorted({round(c.base, 1) for c in region.chars if c.base > starts[2][0].base + 2}):
                lead = min((c for c in region.chars if abs(c.base - b) < 0.2 and c.c.strip()), key=lambda c: c.x0)
                if b - prev >= 18 or lead.x0 > 40:
                    first_d = lead
                    break
                prev = b
            if first_d is None:
                self.issues.append("choice labels found: ABC")
                return None
            starts.append((first_d, None))
        if letters != ["A", "B", "C", "D"] and not missing_d:
            if starts:
                self.issues.append("choice labels found: " + "".join(letters))
            return None
        n = len(starts)
        labeled = starts[:3] if missing_d else starts
        drop = {id(c) for pair in labeled for c in pair}
        for a, dot in labeled:
            sp = [d for d in region.chars if abs(d.base - a.base) < 1 and d.c == " " and -0.6 <= d.x0 - dot.x1 < 3]
            drop |= {id(d) for d in sp}
        region.chars = [c for c in region.chars if id(c) not in drop]
        # Graph choices: the letter sits on the baseline of an inline image, i.e.
        # *below* its graph. Detect drawings above the "A." line.
        first = starts[0][0]
        above = [f for f in region.figs + region.images if f.y1 < first.y0 - 5]
        if above:
            bounds = [min(f.y0 for f in above) - 3] + [s[0].y1 + 3 for s in starts]
        else:
            # cut in the empty band just above each label: math (fraction
            # numerators) can rise above the label's own line
            bounds = [_gap_above(region, first.y0, region_top(region))]
            for k in range(1, n):
                bounds.append(_gap_above(region, starts[k][0].y0, starts[k - 1][0].y1))
            bounds.append(1e9)
        out = []
        for k in range(n):
            sub = Region(region.pages).take(region, bounds[k], bounds[k + 1])
            out.append(("ABCD"[k], self._blocks(sub)))
        if missing_d:
            self.issues.append("choice D label missing in source; D inferred from the unlabeled last line")
        return out

    # ------------------------------------------------------------ answers
    def _correct(self, text, qtype, rblocks):
        text = text.strip()
        if qtype == "mcq":
            if re.fullmatch(r"[ABCD]", text):
                return [text]
            for b in rblocks:
                if b["kind"] == "text":
                    m = re.search(r"Choice ([ABCD]) is (?:correct|the best answer)", b["value"])
                    if m:
                        return [m.group(1)]
            self.issues.append("no correct answer")
            return []
        if text:
            return [v.strip() for v in text.split(",") if v.strip()]
        found = []
        for b in rblocks:
            if b["kind"] != "text":
                continue
            v = b["value"]
            m = re.search(r"The correct answer is (\$[^$]+\$|-?\d[\d.,/]*)(?=[.,;]?(?:\s|$|<))", v)
            if m and not found:
                found.append(latex_to_answer(m.group(1)))
            m = re.search(r"Note that (.+?) (?:are|is) (?:examples?|an example) of ways? to enter a correct answer", v)
            if m:
                for part in re.split(r",\s*|\s+and\s+|\s+or\s+", m.group(1)):
                    part = latex_to_answer(part.strip())
                    if part and part not in found:
                        found.append(part)
        found = [f for f in found if f and re.fullmatch(r"-?[\d.]+(?:/\d+)?", f)]
        if not found:
            self.issues.append("no correct answer")
        return found

    def _check(self, q):
        if q["type"] == "mcq":
            if len(q.get("choices", [])) != 4 or any(not c["content"] for c in q["choices"]):
                self.issues.append("missing choice content")
            if not q["correct"] or q["correct"][0] not in "ABCD":
                self.issues.append("bad correct answer")
        if not q["rationale"]["overall"]:
            self.issues.append("missing rationale")
        if not q["stem"]:
            self.issues.append("missing stem")


def _all_items(region):
    return region.chars + region.atoms + region.rules + region.vrules + region.figs + region.images


def region_top(region):
    return min((i.y0 for i in _all_items(region)), default=0) - 1


def _gap_above(region, y, floor):
    """y-coordinate of the empty horizontal band closest above y (not below floor).
    Vertical table lines count as content, so a table is never cut in two."""
    spans = sorted((i.y0, i.y1) for i in _all_items(region) if i.y1 > floor and i.y0 < y + 0.5)
    cur = y
    for y0, y1 in sorted(spans, key=lambda t: -t[1]):
        if y1 < cur - 1.0:
            return (y1 + cur) / 2
        cur = min(cur, y0)
    return max(floor, cur - 1.0)


def _split_at_bullets(paras, bullets):
    if not bullets:
        return paras
    out = []
    for para in paras:
        cur = []
        for ln in para:
            mid = (ln.top + ln.bottom) / 2
            if cur and any(b.y0 - 2 < mid < b.y1 + 6 for b in bullets):
                out.append(cur)
                cur = []
            cur.append(ln)
        out.append(cur)
    return out


# A sentence that opens with "Choice X" / "Choices X and Y" starts that choice's explanation.
