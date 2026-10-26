"""Which math questions are good practice for Desmos regression (the ~ operator).

Prep guides agree on five situations where regression is the fastest route to the
answer (Learn Desmos, Aniko, PrepMaven, 1600.io, The Test Advantage):

  table     A table of x and y values: fit y1 ~ m x1 + b, y1 ~ a x1^2 + b x1 + c or
            y1 ~ a b^x1, then read the constants or evaluate the fitted model.
  points    A function with unknown constants plus points it passes through or values
            it takes (f(3) = 7, intercepts, zeros): put the points in a table and fit
            the given form.
  identity  Two expressions equal "for all x" or "equivalent", with unknown constants:
            x1 = [1...10], then left side ~ right side.
  infinite  An equation or system with infinitely many solutions (the two sides are the
            same graph): the identity trick again. Never for no or one solution, where
            regression has nothing to fit.
  fit       A scatterplot and a question about the line or curve of best fit: enter
            the points and fit the model.

Rules find the candidates; OVERRIDES holds the result of reviewing them by hand
(questions whose math is an image the rules cannot read, and false positives).
"""
import re

from .plaintext import plain

PATTERNS = ("table", "points", "identity", "infinite", "fit")

TABLE_SKILLS = {"Linear functions", "Linear equations in two variables", "Nonlinear functions",
                "Ratios, rates, proportional relationships, and units"}
POINT_SKILLS = {"Linear functions", "Linear equations in two variables", "Nonlinear functions"}

# Reviewed by hand. None: not regression practice even though a rule matches.
OVERRIDES = {
    # math shown as images, so the rules cannot see the points or the form
    "12983c1e": "table", "41fdc0b8": "table", "868fc236": "table", "c651cc56": "table",
    "8a6de407": "points", "a1696f3e": "points", "4fe4fd7c": "points", "9f2ecade": "points",
    "3cdbf026": "points", "09d21d79": "points", "16de54c7": "identity", "137cc6fd": "identity",
    "565428e1": "identity",
    # two data points in a word problem: a model through two points
    "752055d1": "points", "3122fc7b": "points", "16889ef3": "points",
    # answer is read straight off the stem, or the table is the answer choices
    "99269e03": None, "b39d74a0": None, "0121a235": None, "a03b7e02": None,
    "dd3b1e1a": None, "0d5495a6": None, "5907e072": None, "a4989860": None, "63d03c0b": None,
    "ce508fb0": None,
    # the constants are intercept coordinates of a fully known line: just graph it
    "548a4929": None, "94b48cbf": None,
    # constants that regression cannot pin down (inequalities, "could be", factors)
    "95eeeb5b": None, "92f812bb": None, "d41cf4d3": None, "4dd4efcf": None, "d8789a4c": None,
    "a45ffacb": None, "b8f13a3a": None, "1a722d7d": None, "0b0fa68b": None,
}

_LETTERS = re.compile(r"[a-zA-Z]")


def _text(blocks):
    return re.sub(r"\s+", " ", " ".join(plain(b) for b in blocks if b["kind"] in ("text", "math"))).strip()


def _cell(v):
    """A table cell without markup, images and LaTeX commands ('' for an image)."""
    v = re.sub(r"<img[^>]*/>", "", v)
    v = re.sub(r"</?\w+/?>", "", v)
    v = re.sub(r"\\[a-zA-Z]+", "", v)
    return v.replace("$", "").strip()


def _numeric_table(t):
    """At least two data points and no unknowns in the data (x and y labels aside)."""
    head, rows = [_cell(c) for c in t["headers"]], [[_cell(c) for c in r] for r in t["rows"]]
    labels_down = bool(rows) and all(_LETTERS.search(r[0] or "?") for r in [head] + rows)
    if labels_down and len(head) > 2:            # x and f(x) as row labels, values across
        data = head[1:] + [c for r in rows for c in r[1:]]
        points = len(head) - 1
    else:
        data = [c for r in rows for c in r]
        points = len(rows)
    return points >= 2 and len(head) >= 2 and not any(_LETTERS.search(c) for c in data)


def _table(q, stem):
    if q["skill"] not in TABLE_SKILLS or re.search(r"which (of the following )?tables?\b", stem, re.I):
        return False
    tables = [b for b in (q.get("passage") or []) + q["stem"] if b["kind"] == "table"]
    return any(_numeric_table(t) for t in tables)


def _points(q, stem):
    if q["skill"] not in POINT_SKILLS or not re.search(r"\bconstants?\b", stem):
        return False
    if re.search(r"\btable\b|how many|which of the following (equivalent|equations displays)|displays|must be true", stem, re.I):
        return False
    given = re.search(r"pass(es)? through the points?|contains the points?|intercepts? at|has a y-intercept|"
                      r"\b[a-z]\(-?\d+(\.\d+)?\)=", stem)
    # the form must have an unknown constant to solve for: "f(x)=ax+b, where a and b are constants"
    unknown = re.search(r"\b[a-z](, [a-z])*,? (and [a-z] )?(is|are) (a |an )?(positive |negative |integer )*constants?", stem)
    return bool(given and unknown)


def _identity(q, stem):
    if q["skill"] != "Equivalent expressions" or not re.search(r"\bconstants?\b", stem):
        return False
    if re.search(r"\bfactor|must be|could be|which of the following", stem, re.I):
        return False
    return bool(re.search(r"equivalent|rewritten|written in the form|true for all|for all values|"
                          r"\b[a-z]\(x\)\s*·\s*[a-z]\(x\)", stem, re.I))


def _infinite(q, stem):
    if not re.search(r"infinite(ly many| number of) solutions", stem, re.I):
        return False
    return not re.search(r"which (of the following )?(equation|could)", stem, re.I)


def _fit(q, stem):
    if not q["skill"].startswith("Two-variable data") or "scatterplot" not in stem.lower():
        return False
    if re.search(r"closest to the (slope|y-value|difference)|predict|how many|which of the following graphs|"
                 r"interpret|data set|according to", stem, re.I):
        return False
    return bool(re.search(r"most appropriate (linear )?model|best model|best models|most closely fits|"
                          r"equation (for|of) (a|the) (line of best fit|exponential model)|"
                          r"best represents the line of best fit|exponential model shown", stem, re.I))


RULES = (("infinite", _infinite), ("identity", _identity), ("table", _table), ("points", _points), ("fit", _fit))


def regression_pattern(q):
    """The Desmos regression pattern a question practises, or None."""
    if q["section"] != "math":
        return None
    if q["id"] in OVERRIDES:
        return OVERRIDES[q["id"]]
    stem = _text((q.get("passage") or []) + q["stem"])
    for name, rule in RULES:
        if rule(q, stem):
            return name
    return None
