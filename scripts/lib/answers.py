"""Post-processing of an extracted question: answers, per-choice rationales,
figure alt-text types, and the list of referenced image files."""
import re

from .plaintext import plain


_FIG_KINDS = [("scatterplot", "Scatterplot"), ("bar graph", "Bar graph"), ("histogram", "Histogram"),
              ("dot plot", "Dot plot"), ("box plot", "Box plot"), ("line graph", "Line graph"),
              ("frequency table", "Table"), ("table", "Table"), ("number line", "Number line"),
              ("graph", "Graph"), ("circle", "Diagram"), ("triangle", "Diagram"), ("figure", "Figure")]


def name_figures(q):
    """Give figures a type from the question wording (e.g. 'the scatterplot shows')."""
    text = " ".join(plain(b) for part in ("passage", "stem") for b in q.get(part) or []).lower()
    kind = next((name for key, name in _FIG_KINDS if key in text), "Figure")
    for part in ("passage", "stem"):
        for b in q.get(part) or []:
            if b["kind"] == "image" and b["alt"].startswith("Figure"):
                b["alt"] = kind + b["alt"][len("Figure"):]
    for c in q.get("choices") or []:
        for b in c["content"]:
            if b["kind"] == "image" and not b.get("inline"):
                label = kind if b["alt"].startswith("Figure") else "Image"
                b["alt"] = "Choice %s: %s" % (c["label"], label.lower() if label != "Graph in the xy-plane" else label)


def latex_to_answer(s):
    s = s.strip().strip("$")
    s = re.sub(r"\\d?frac\{([^{}]+)\}\{([^{}]+)\}", r"\1/\2", s)
    s = s.replace("{,}", "").replace("\\,", "").replace(" ", "").rstrip(".,;")
    return re.sub(r"(?<=\d),(?=\d{3})", "", s)


_CHOICE_RE = re.compile(r"(?:^|(?<=[.!?] )|(?<=[.!?][\u201d\u2019\")] )|(?<=<br/>))Choices? ([ABCD])((?:(?:,| and|, and) [ABCD])*)(?= )")


def split_rationale(blocks, correct):
    """Split rationale blocks into per-choice explanations."""
    segs = []            # [letters, blocks]
    intro = []
    for b in blocks:
        if b["kind"] != "text":
            (segs[-1][1] if segs else intro).append(b)
            continue
        v = b["value"]
        ms = list(_CHOICE_RE.finditer(v))
        if not ms:
            (segs[-1][1] if segs else intro).append(b)
            continue
        if ms[0].start() > 0:
            pre = v[:ms[0].start()].strip()
            if pre:
                (segs[-1][1] if segs else intro).append(dict(b, value=pre))
        for i, m in enumerate(ms):
            end = ms[i + 1].start() if i + 1 < len(ms) else len(v)
            letters = [m.group(1)] + re.findall(r"[ABCD]", m.group(2))
            segs.append([letters, [dict(kind="text", value=v[m.start():end].strip())]])
    per = {}
    for letters, bl in segs:
        for L in letters:
            per.setdefault(L, []).extend(bl)
    if intro and correct and correct[0] in per:
        per[correct[0]] = intro + per[correct[0]]
    return per


def image_srcs(obj):
    if isinstance(obj, dict):
        if obj.get("kind") == "image":
            yield obj["src"]
        for v in obj.values():
            yield from image_srcs(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from image_srcs(v)
    elif isinstance(obj, str) and "<img" in obj:
        yield from re.findall(r'src="([^"]+)"', obj)


_OKINA = re.compile("(?<=Hawai)\ufffd(?=i)|(?<=\\s)\ufffd(?=[aeiouāēīōū])")


def fix_missing_glyphs(obj, issues):
    """The PDFs draw a few characters their fonts lack as empty boxes (U+FFFD in
    the text layer). Recover the unambiguous ones; show the rest as a box."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == "alt" and isinstance(v, str):
                obj[k] = re.sub("\ufffd(?=\\d)", "\u2212", v).replace("\ufffd", "")
            elif k == "value" and isinstance(v, str) and "\ufffd" in v:
                fixed = _OKINA.sub("\u02bb", v)
                if fixed != v:
                    issues.append("source shows missing-glyph boxes; rendered as the Hawaiian \u02bbokina")
                if "\ufffd" in fixed:
                    issues.append("source shows a missing-glyph box (kept as \u25a1)")
                obj[k] = fixed.replace("\ufffd", "\u25a1")
            else:
                fix_missing_glyphs(v, issues)
    elif isinstance(obj, list):
        for v in obj:
            fix_missing_glyphs(v, issues)
