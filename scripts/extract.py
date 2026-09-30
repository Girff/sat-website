#!/usr/bin/env python3
"""PDF question banks -> public/data/ (index, question chunks, figures, taxonomy).

Usage:
  python scripts/extract.py                 # full run, all PDFs in source-pdfs/
  python scripts/extract.py --only ac472881,3f5a3602 --out /tmp/sample
  python scripts/extract.py --limit 50 --workers 4
"""
import argparse
import json
import os
import re
import shutil
import sys
import time
from collections import Counter, defaultdict
from multiprocessing import Pool

import pymupdf

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib.primitives import FaceResolver  # noqa: E402
from lib.question import QuestionExtractor  # noqa: E402
from lib.plaintext import plain  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF_DIR = os.path.join(ROOT, "source-pdfs")
SECTIONS = {"math": "math", "reading": "reading"}   # filename keyword -> section
CHUNK_SIZE = 100
QA_ZOOM = 1.5


def section_of(pdf_name):
    for key, sec in SECTIONS.items():
        if key in pdf_name.lower():
            return sec
    raise SystemExit("cannot tell section (math/reading) from file name: " + pdf_name)


def question_ranges(doc):
    """[(qid, [pages])] from 'Question ID:' headers."""
    starts = []
    for pno in range(doc.page_count):
        m = re.search(r"Question ID:\s*(\w+)", doc[pno].get_text("text", clip=pymupdf.Rect(0, 0, 612, 60)))
        if m:
            starts.append((m.group(1), pno))
    out = []
    for i, (qid, s) in enumerate(starts):
        e = starts[i + 1][1] if i + 1 < len(starts) else doc.page_count
        out.append((qid, list(range(s, e))))
    return out


# ----------------------------------------------------------------- workers
_W = {}


def _init(pdf_path, section, media_dir, qa_dir):
    doc = pymupdf.open(pdf_path)
    _W.update(doc=doc, ex=QuestionExtractor(doc, FaceResolver(doc), section, os.path.basename(pdf_path), media_dir),
              qa_dir=qa_dir)


def _work(job):
    qid, pages = job
    ex = _W["ex"]
    try:
        q = ex.extract(pages)
    except Exception as e:  # never drop a question: emit a low-confidence stub
        q = dict(id=qid, section=ex.section, domain="", skill="", difficulty="", type="mcq",
                 stem=[], correct=[], rationale=dict(overall=[]), figures=[], sourcePdf=ex.pdf_name,
                 sourcePage=pages[0] + 1, parseConfidence="low", issues=["extraction error: %r" % e])
    if q["parseConfidence"] == "low":
        q["originalImages"] = _qa_crops(_W["doc"], pages, qid, _W["qa_dir"])
    return q


def _qa_crops(doc, pages, qid, qa_dir):
    from PIL import Image
    out = []
    for k, pno in enumerate(pages):
        page = doc[pno]
        pix = page.get_pixmap(matrix=pymupdf.Matrix(QA_ZOOM, QA_ZOOM), clip=pymupdf.Rect(0, 0, 612, 792))
        img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        name = "%s-p%d.webp" % (qid, k + 1)
        img.save(os.path.join(qa_dir, name), "WEBP", quality=70, method=4)
        out.append("qa/" + name)
    return out


# ----------------------------------------------------------------- output
def preview_of(q):
    blocks = (q.get("passage") or []) + q.get("stem", [])
    txt = " ".join(plain(b) for b in blocks if b["kind"] in ("text", "math"))
    txt = re.sub(r"\s+", " ", txt).strip()
    return txt[:110] + ("…" if len(txt) > 110 else "")


def search_text(q):
    blocks = (q.get("passage") or []) + q.get("stem", []) + [b for c in q.get("choices", []) for b in c["content"]]
    return re.sub(r"\s+", " ", " ".join(plain(b) for b in blocks)).strip().lower()


def write_outputs(questions, out):
    qdir = os.path.join(out, "questions")
    os.makedirs(qdir, exist_ok=True)
    order = {"Easy": 0, "Medium": 1, "Hard": 2}
    questions.sort(key=lambda q: (q["section"], q["domain"], q["skill"], order.get(q["difficulty"], 3), q["id"]))
    groups = defaultdict(list)
    for q in questions:
        groups[(q["section"], q["domain"])].append(q)
    index, search = [], {}
    for (sec, dom), qs in groups.items():
        slug = re.sub(r"[^a-z0-9]+", "-", (sec + "-" + dom).lower()).strip("-")
        for n in range(0, len(qs), CHUNK_SIZE):
            name = "%s-%d" % (slug, n // CHUNK_SIZE + 1)
            chunk = qs[n:n + CHUNK_SIZE]
            with open(os.path.join(qdir, name + ".json"), "w") as f:
                json.dump(chunk, f, ensure_ascii=False, separators=(",", ":"))
            for q in chunk:
                index.append(dict(id=q["id"], section=q["section"], domain=q["domain"], skill=q["skill"],
                                  difficulty=q["difficulty"], type=q["type"], preview=preview_of(q),
                                  chunk=name, low=q["parseConfidence"] == "low"))
                search[q["id"]] = search_text(q)
    with open(os.path.join(out, "index.json"), "w") as f:
        json.dump(index, f, ensure_ascii=False, separators=(",", ":"))
    with open(os.path.join(out, "search.json"), "w") as f:
        json.dump(search, f, ensure_ascii=False, separators=(",", ":"))
    tax = {}
    for q in questions:
        s = tax.setdefault(q["section"], {"count": 0, "domains": {}})
        s["count"] += 1
        d = s["domains"].setdefault(q["domain"], {"count": 0, "skills": {}})
        d["count"] += 1
        d["skills"][q["skill"]] = d["skills"].get(q["skill"], 0) + 1
    with open(os.path.join(out, "taxonomy.json"), "w") as f:
        json.dump(tax, f, ensure_ascii=False, indent=1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(ROOT, "public", "data"))
    ap.add_argument("--only", help="comma-separated question ids")
    ap.add_argument("--limit", type=int)
    ap.add_argument("--workers", type=int, default=max(1, (os.cpu_count() or 2) - 1))
    args = ap.parse_args()

    pdfs = sorted(f for f in os.listdir(PDF_DIR) if f.lower().endswith(".pdf"))
    if not pdfs:
        raise SystemExit("no PDFs in " + PDF_DIR)
    out = args.out
    media_dir, qa_dir = os.path.join(out, "figures"), os.path.join(out, "qa")
    for d in (media_dir, qa_dir, os.path.join(out, "questions")):
        if not args.only:
            shutil.rmtree(d, ignore_errors=True)
        os.makedirs(d, exist_ok=True)
    only = set(args.only.split(",")) if args.only else None
    questions, seen = [], set()
    t0 = time.time()
    for pdf in pdfs:
        path = os.path.join(PDF_DIR, pdf)
        section = section_of(pdf)
        jobs = question_ranges(pymupdf.open(path))
        if only:
            jobs = [j for j in jobs if j[0] in only]
        if args.limit:
            jobs = jobs[:args.limit]
        print("%s: %d questions (%s)" % (pdf, len(jobs), section), flush=True)
        with Pool(args.workers, initializer=_init, initargs=(path, section, media_dir, qa_dir)) as pool:
            for i, q in enumerate(pool.imap(_work, jobs, chunksize=4)):
                if q["id"] in seen:
                    continue      # duplicate across PDFs: keep the first
                seen.add(q["id"])
                questions.append(q)
                if (i + 1) % 200 == 0:
                    print("  %d/%d  %.0fs" % (i + 1, len(jobs), time.time() - t0), flush=True)
    write_outputs(questions, out)
    conf = Counter(q["parseConfidence"] for q in questions)
    print("done: %d questions in %.0fs  confidence=%s" % (len(questions), time.time() - t0, dict(conf)))


if __name__ == "__main__":
    main()
