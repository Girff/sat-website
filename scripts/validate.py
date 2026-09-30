#!/usr/bin/env python3
"""Check the extracted question bank and print a report.

Usage: python scripts/validate.py [--data public/data] [--json report.json]
"""
import argparse
import json
import os
import re
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load(data_dir):
    index = json.load(open(os.path.join(data_dir, "index.json")))
    questions = []
    for name in sorted(os.listdir(os.path.join(data_dir, "questions"))):
        questions += json.load(open(os.path.join(data_dir, "questions", name)))
    return index, questions


def srcs(obj):
    if isinstance(obj, dict):
        if obj.get("kind") == "image":
            yield obj["src"]
        for v in obj.values():
            yield from srcs(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from srcs(v)
    elif isinstance(obj, str) and "<img" in obj:
        yield from re.findall(r'src="([^"]+)"', obj)


def unbalanced_math(obj):
    """Text values with an odd number of unescaped $ delimiters."""
    if isinstance(obj, dict):
        if obj.get("kind") == "text" and len(re.findall(r"(?<!\\)\$", obj["value"])) % 2:
            yield obj["value"][:80]
        for v in obj.values():
            yield from unbalanced_math(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from unbalanced_math(v)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default=os.path.join(ROOT, "public", "data"))
    ap.add_argument("--json", help="also write the report as JSON")
    args = ap.parse_args()
    index, qs = load(args.data)
    rep = {}
    p = print

    p("=" * 70)
    p("SAT QUESTION BANK: EXTRACTION REPORT")
    p("=" * 70)
    p("Total questions: %d  (index entries: %d)" % (len(qs), len(index)))
    by_sec = Counter(q["section"] for q in qs)
    p("By section: " + ", ".join("%s %d" % kv for kv in sorted(by_sec.items())))
    rep["total"], rep["bySection"] = len(qs), dict(by_sec)

    p("\n-- Domains / skills / difficulty --")
    tree = defaultdict(lambda: defaultdict(Counter))
    for q in qs:
        tree[(q["section"], q["domain"])][q["skill"]][q["difficulty"]] += 1
    for (sec, dom), skills in sorted(tree.items()):
        tot = sum(sum(c.values()) for c in skills.values())
        p("%-8s %-40s %5d" % (sec, dom, tot))
        for sk, c in sorted(skills.items()):
            p("           %-55s %4d  (E %d / M %d / H %d)" % (sk, sum(c.values()), c["Easy"], c["Medium"], c["Hard"]))
    diff = Counter((q["section"], q["difficulty"]) for q in qs)
    p("Difficulty: " + ", ".join("%s/%s %d" % (s, d, n) for (s, d), n in sorted(diff.items())))
    types = Counter((q["section"], q["type"]) for q in qs)
    p("Types: " + ", ".join("%s/%s %d" % (s, t, n) for (s, t), n in sorted(types.items())))

    p("\n-- Integrity --")
    ids = Counter(q["id"] for q in qs)
    dups = [i for i, n in ids.items() if n > 1]
    p("Duplicate IDs: %d %s" % (len(dups), dups[:20]))
    problems = defaultdict(list)
    for q in qs:
        if q["type"] == "mcq":
            if len(q.get("choices", [])) != 4:
                problems["MCQ without 4 choices"].append(q["id"])
            elif any(not c["content"] for c in q["choices"]):
                problems["MCQ with an empty choice"].append(q["id"])
            if not q["correct"] or any(c not in "ABCD" for c in q["correct"]):
                problems["MCQ correct answer not in A-D"].append(q["id"])
            per = q["rationale"].get("perChoice") or {}
            if len(per) < 4:
                problems["MCQ per-choice rationale incomplete (falls back to overall)"].append(q["id"])
        else:
            if not q["correct"]:
                problems["Grid-in without correct answer"].append(q["id"])
            elif any(not re.fullmatch(r"-?\d*\.?\d+(?:/\d+)?", a) for a in q["correct"]):
                problems["Grid-in answer not numeric/fraction"].append("%s %s" % (q["id"], q["correct"]))
        if not q["rationale"]["overall"]:
            problems["Missing rationale"].append(q["id"])
        if not q["stem"]:
            problems["Missing stem"].append(q["id"])
        if not q["domain"] or not q["skill"] or q["difficulty"] not in ("Easy", "Medium", "Hard"):
            problems["Incomplete metadata"].append(q["id"])
        if list(unbalanced_math(q)):
            problems["Unbalanced $ in text"].append(q["id"])
        if "\ufffd" in json.dumps(q, ensure_ascii=False):
            problems["Unmapped character (U+FFFD) in content"].append(q["id"])
    for k in sorted(problems):
        v = problems[k]
        p("%-62s %4d  %s" % (k, len(v), " ".join(v[:12]) + (" ..." if len(v) > 12 else "")))
    if not problems:
        p("No integrity problems.")
    rep["problems"] = {k: v for k, v in problems.items()}

    p("\n-- Figures --")
    missing, total = [], 0
    for q in qs:
        for s in set(srcs(q)) | set(q.get("originalImages", [])):
            total += 1
            if not os.path.exists(os.path.join(args.data, s)):
                missing.append((q["id"], s))
    p("Referenced image files: %d   missing: %d %s" % (total, len(missing), missing[:10]))
    rep["missingFigures"] = missing

    p("\n-- Low-confidence questions --")
    low = [q for q in qs if q["parseConfidence"] == "low"]
    p("Count: %d" % len(low))
    reasons = Counter(re.sub(r":.*", "", i) for q in low for i in q.get("issues", []))
    for r, n in reasons.most_common():
        p("   %-50s %d" % (r, n))
    for q in sorted(low, key=lambda q: (q["sourcePdf"], q["sourcePage"])):
        p("   %s  %-22s p.%-5d %s" % (q["id"], q["sourcePdf"], q["sourcePage"], "; ".join(q.get("issues", []))[:90]))
    rep["low"] = [dict(id=q["id"], pdf=q["sourcePdf"], page=q["sourcePage"], issues=q.get("issues", [])) for q in low]

    p("\n-- Content features --")
    feats = Counter()
    for q in qs:
        s = json.dumps(q)
        feats["with tables"] += '"kind": "table"' in s or '"kind":"table"' in s
        feats["with figure images"] += bool(re.search(r'"src":\s*"figures/[^"]+-f\d+\.webp"', s))
        feats["with raster (image) math"] += "-r" in s and bool(re.search(r'figures/[^"]+-r\d+\.webp', s))
        feats["with LaTeX math"] += "$" in s or '"kind": "math"' in s or '"kind":"math"' in s
    for k, v in sorted(feats.items()):
        p("   %-30s %d" % (k, v))
    if args.json:
        json.dump(rep, open(args.json, "w"), indent=1)
    p("=" * 70)


if __name__ == "__main__":
    main()
