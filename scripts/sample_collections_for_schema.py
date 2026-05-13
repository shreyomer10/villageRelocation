"""
One-time helper. Not deployed.

Samples 2-3 random docs per allowed Mongo collection and writes them to
`schema_samples.json` next to this file. The output is then read manually
(or fed back to Claude) to rewrite SCHEMA_TERSE / SCHEMA_VERBOSE in
routes/ai_agent/schema.py.

Run from inside the villageRelocation/ directory:

    python scripts/sample_collections_for_schema.py
"""

import json
import os
import sys


HERE = os.path.dirname(os.path.abspath(__file__))
PARENT = os.path.dirname(HERE)
if PARENT not in sys.path:
    sys.path.insert(0, PARENT)

from config import db
from routes.ai_agent.schema import ALLOWED_COLLECTIONS


SAMPLE_SIZE = 3
OUTPUT_PATH = os.path.join(HERE, "schema_samples.json")


def sample_collection(name: str) -> dict:
    try:
        count = db[name].estimated_document_count()
    except Exception as exc:
        return {"count": None, "samples": [], "error": f"{type(exc).__name__}: {exc}"}

    if count == 0:
        return {"count": 0, "samples": [], "note": "empty"}

    try:
        docs = list(db[name].aggregate([{"$sample": {"size": SAMPLE_SIZE}}]))
    except Exception as exc:
        return {"count": count, "samples": [], "error": f"{type(exc).__name__}: {exc}"}

    return {"count": count, "samples": docs}


def main():
    existing = set(db.list_collection_names())
    report = {}

    for name in sorted(ALLOWED_COLLECTIONS):
        if name not in existing:
            report[name] = {"count": None, "samples": [], "error": "CollectionDoesNotExist"}
            print(f"[skip] {name}: not in database")
            continue
        report[name] = sample_collection(name)
        entry = report[name]
        if "error" in entry:
            print(f"[err]  {name}: {entry['error']}")
        else:
            print(f"[ok]   {name}: count={entry['count']}, sampled={len(entry['samples'])}")

    with open(OUTPUT_PATH, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2, default=str, ensure_ascii=False)

    print(f"\nWrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
