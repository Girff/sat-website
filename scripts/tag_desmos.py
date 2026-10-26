#!/usr/bin/env python3
"""Mark the questions that are good Desmos regression practice in an existing index.json.

extract.py tags questions as it writes the index; this re-tags the extracted bank
without the source PDFs (after editing scripts/lib/desmos.py, for example).

Usage: python scripts/tag_desmos.py [--data public/data] [--list]
"""
import argparse
import json
import os
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib.desmos import PATTERNS, regression_pattern  # noqa: E402
from lib.plaintext import plain  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default=os.path.join(ROOT, "public", "data"))
    ap.add_argument("--list", action="store_true", help="print every tagged question, for review")
    args = ap.parse_args()
    qdir = os.path.join(args.data, "questions")
    questions = {}
    for name in sorted(os.listdir(qdir)):
        for q in json.load(open(os.path.join(qdir, name))):
            questions[q["id"]] = q
    path = os.path.join(args.data, "index.json")
    index = json.load(open(path))
    tags = Counter()
    for row in index:
        row.pop("desmos", None)
        pattern = regression_pattern(questions[row["id"]])
        if pattern:
            row["desmos"] = pattern
            tags[pattern] += 1
            if args.list:
                q = questions[row["id"]]
                stem = " ".join(plain(b) for b in q["stem"] if b["kind"] in ("text", "math"))
                print("%-8s %s  %-6s %-30.30s %s" % (pattern, q["id"], q["difficulty"], q["skill"], stem[:110]))
    with open(path, "w") as f:
        json.dump(index, f, ensure_ascii=False, separators=(",", ":"))
    print("Desmos regression: %d questions (%s)" % (sum(tags.values()), ", ".join("%s %d" % (p, tags[p]) for p in PATTERNS)))


if __name__ == "__main__":
    main()
