"""Plain-text rendering of RichContent blocks (for table previews and search)."""
import re

_LATEX_WORDS = {"\\le": "≤", "\\ge": "≥", "\\pm": "±", "\\times": "×", "\\div": "÷", "\\cdot": "·",
                "\\pi": "π", "\\angle": "∠", "\\triangle": "△", "\\Delta": "Δ",
                "\\ell": "ℓ", "\\approx": "≈", "\\%": "%", "\\$": "$", "\\quad": " ", "\\ ": " "}
_SUP = str.maketrans("0123456789+-=()ni", "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱ")
_SUB = str.maketrans("0123456789+-=()", "₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎")
_GROUP = r"\{((?:[^{}]|\{[^{}]*\})*)\}"          # one level of nested braces


def _script(content, table, mark):
    if content and all(c in "0123456789+-=()ni" for c in content) and (table is _SUP or "n" not in content and "i" not in content):
        return content.translate(table)
    return "%s(%s)" % (mark, content)


def _frac(a, b):
    simple = lambda t: re.fullmatch(r"[\w.]+", t) is not None
    return "%s/%s" % (a if simple(a) else "(%s)" % a, b if simple(b) else "(%s)" % b)


def latex_plain(s):
    s = s.replace("^{\\circ}", "°").replace("\\circ", "°")
    s = re.sub(r"\\text\{([^{}]*)\}", r"\1", s)
    s = re.sub(r"\\(?:left|right|bigl|bigr|overline|underline)", "", s)
    s = re.sub(r"\\hspace\{[^}]*\}", "____", s)
    for _ in range(3):   # innermost first, so nested fractions and roots unwind
        s = re.sub(r"\\d?frac\{([^{}]*)\}\{([^{}]*)\}", lambda m: _frac(m.group(1), m.group(2)), s)
        s = re.sub(r"\\sqrt\[([^\]]*)\]\{([^{}]*)\}", lambda m: "%s√(%s)" % (_script(m.group(1), _SUP, ""), m.group(2)), s)
        s = re.sub(r"\\sqrt\{([^{}]*)\}", lambda m: "√" + (m.group(1) if re.fullmatch(r"\w+", m.group(1)) else "(%s)" % m.group(1)), s)
    for k, v in _LATEX_WORDS.items():
        s = s.replace(k, v)
    s = s.replace("{,}", ",")
    s = re.sub(r"\^" + _GROUP, lambda m: _script(m.group(1), _SUP, "^"), s)
    s = re.sub(r"\^(\w)", lambda m: _script(m.group(1), _SUP, "^"), s)
    s = re.sub(r"_" + _GROUP, lambda m: _script(m.group(1), _SUB, "_"), s)
    s = re.sub(r"_(\w)", lambda m: _script(m.group(1), _SUB, "_"), s)
    s = re.sub(r"[{}]", "", s)
    return s.replace("\\", "")


def markup_plain(v):
    v = re.sub(r"(?<!\\)\$(.+?)(?<!\\)\$", lambda m: latex_plain(m.group(1)), v)
    v = re.sub(r"\s*<img[^>]*/>\s*", " [math] ", v)
    v = v.replace("<br/>", " ")
    v = re.sub(r"<sup>(.*?)</sup>", lambda m: _script(m.group(1), _SUP, "^"), v)
    v = re.sub(r"<sub>(.*?)</sub>", lambda m: _script(m.group(1), _SUB, "_"), v)
    v = re.sub(r"</?(?:b|i|u)>", "", v)
    v = v.replace("\\$", "$").replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")
    v = re.sub(r"\s+([?.,;:!)])", r"\1", v)
    return re.sub(r"\s+", " ", v)


def plain(block):
    k = block["kind"]
    if k == "text":
        return markup_plain(block["value"])
    if k == "math":
        return latex_plain(block["latex"])
    if k == "table":
        cells = block["headers"] + [c for r in block["rows"] for c in r]
        return " ".join(markup_plain(c) for c in cells)
    return ""
