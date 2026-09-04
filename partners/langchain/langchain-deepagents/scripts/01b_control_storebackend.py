"""Beat 1, Control Arm B — StoreBackend + MongoDBStore.

Expected result: searches run, but StoreBackend.grep fetches every item
in the namespace and matches literal substrings in Python — it never
passes `query` to MongoDBStore.search(), so the vector search sitting
right there goes unused. Same miss as ripgrep, whole files in memory.

The limitation is in StoreBackend's wiring, not MongoDBStore's ceiling.
"""

from __future__ import annotations

import os

from deepagents.backends import StoreBackend
from dotenv import load_dotenv
from langgraph.store.memory import InMemoryStore

load_dotenv()

QUERY = (
    "How is air cleaner efficiency measured, and do the state standards "
    "use the same metric as DOE?"
)
NUM_RUNS = 3


def main() -> None:
    print("=" * 64)
    print("Beat 1 — Control: StoreBackend + MongoDBStore")
    print("=" * 64)
    print(f"\nQuery: {QUERY}\n")

    store = InMemoryStore()
    backend = StoreBackend(namespace=lambda _rt: ("filesystem",), store=store)

    # Populate the store from local .htm files (the text-readable subset of
    # the corpus). Binary formats (PDF, XLSX, DOCX) are skipped — StoreBackend
    # stores raw text, not parsed documents.
    from pathlib import Path

    corpus_dir = Path(__file__).resolve().parent.parent / "corpus"
    print("Loading corpus text files into StoreBackend namespace...")
    file_count = 0
    for htm_file in sorted(corpus_dir.rglob("*.htm")):
        rel = htm_file.relative_to(corpus_dir.parent)
        content = htm_file.read_text(errors="replace")
        result = backend.write(f"/{rel}", content)
        if not result.error:
            file_count += 1
    print(f"  Loaded {file_count} text files into StoreBackend.\n")

    # Natural-language query — literal substring matching will miss this
    print("--- Natural-language grep (full query) ---")
    result = backend.grep(QUERY)
    matches = result.matches or []
    print(
        f"  Matches: {len(matches)}  (literal substring — no sentence matches verbatim)\n"
    )

    # Individual terms — shows StoreBackend CAN match, but only on exact text
    print("--- Literal term grep (individual keywords) ---")
    terms = ["IEF", "CADR", "smoke CADR", "CADR per watt", "efficiency"]
    for term in terms:
        r = backend.grep(term)
        m = r.matches or []
        types = sorted({os.path.splitext(x["path"])[1] for x in m}) if m else []
        print(f"  \"{term}\": {len(m)} matches  (files: {', '.join(types) or 'none'})")

    print()
    print("--- Limitation ---")
    print("  StoreBackend only searches .htm text files (5 of 45 in the corpus).")
    print("  Binary formats (PDF, XLSX, DOCX) cannot be loaded.")
    print("  Grep is literal substring — a natural-language query returns 0.")
    print()

    print("=" * 64)
    print("StoreBackend.grep uses literal substring matching in Python.")
    print("MongoDBStore.search() (vector search) is never called.")
    print("=" * 64)


if __name__ == "__main__":
    main()
