"""One-time docket fetch — provenance, not workflow.

Downloads the DOE air-cleaner rulemaking docket from regulations.gov
and the Federal Register. Requires a regulations.gov API key.

This script documents how the corpus was assembled and lets a reader
refresh it, but the tutorial never asks anyone to run it. The corpus
is vendored in corpus/.

Usage:
    export REGULATIONS_GOV_API_KEY=your-key
    python tools/fetch_docket.py

Docket: EERE-2021-BT-STD-0035
Final rule: 88 FR 21752 (FR doc 2023-06499)
"""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path
from urllib.parse import urlencode

import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

API_KEY = os.environ.get("REGULATIONS_GOV_API_KEY", "")
BASE_URL = "https://api.regulations.gov/v4"
FR_BASE = "https://www.federalregister.gov"

DOCKET_ID = "EERE-2021-BT-STD-0035"
FR_DOC_ID = "2023-06499"  # Final rule
FR_NOPR_ID = "2023-06498"  # Simultaneous NOPR
FR_CONFIRM_ID = "2023-18860"  # Confirmation of dates

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "corpus"

HEADERS = {"X-Api-Key": API_KEY}


def api_get(endpoint: str, params: dict | None = None) -> dict:
    """GET from regulations.gov with rate-limit backoff."""
    url = f"{BASE_URL}{endpoint}"
    if params:
        url = f"{url}?{urlencode(params)}"
    for attempt in range(3):
        resp = requests.get(url, headers=HEADERS, timeout=30)
        if resp.status_code == 429:
            wait = 2**attempt
            print(f"  Rate limited, waiting {wait}s...")
            time.sleep(wait)
            continue
        resp.raise_for_status()
        return resp.json()
    raise RuntimeError(f"Failed after retries: {url}")


_DOWNLOAD_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
}


def download_file(url: str, dest: Path) -> None:
    """Download a file, creating parent dirs as needed."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    resp = requests.get(url, headers=_DOWNLOAD_HEADERS, timeout=120)
    resp.raise_for_status()
    dest.write_bytes(resp.content)
    print(f"  Downloaded: {dest.name} ({len(resp.content):,} bytes)")


def fetch_federal_register() -> None:
    """Fetch the final rule and related docs from the Federal Register."""
    rules_dir = OUTPUT_DIR / "rules"
    rules_dir.mkdir(parents=True, exist_ok=True)

    for doc_id, name in [
        (FR_DOC_ID, "88FR21752-final-rule"),
        (FR_NOPR_ID, "nopr"),
        (FR_CONFIRM_ID, "confirmation"),
    ]:
        # JSON metadata
        url = f"{FR_BASE}/api/v1/documents/{doc_id}.json"
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        meta = resp.json()

        # PDF
        pdf_url = meta.get("pdf_url") or meta.get("raw_text_url", "")
        if pdf_url:
            download_file(pdf_url, rules_dir / f"{name}.pdf")

        # Full text XML
        xml_url = f"{FR_BASE}/documents/full_text/xml/2023/04/11/{doc_id}.xml"
        try:
            download_file(xml_url, rules_dir / f"{name}.xml")
        except Exception:
            print(f"  XML not available for {doc_id}")


def fetch_docket_documents() -> None:
    """Fetch docket documents (TSD, spreadsheets) from regulations.gov.

    Files are in attributes.fileFormats (not in included/attachments).
    Each fileFormats entry has: fileUrl, format, size.
    """
    analysis_dir = OUTPUT_DIR / "analysis"
    analysis_dir.mkdir(parents=True, exist_ok=True)

    # Map known document IDs to friendly filenames
    DOC_NAMES = {
        "EERE-2021-BT-STD-0035-0024": "tsd",
        "EERE-2021-BT-STD-0035-0023": "lcc",
        "EERE-2021-BT-STD-0035-0022": "nia",
        "EERE-2021-BT-STD-0035-0021": "grim-joint",
        "EERE-2021-BT-STD-0035-0020": "grim-dfr",
    }

    print(f"\nFetching documents for docket {DOCKET_ID}...")
    data = api_get(
        "/documents",
        {
            "filter[docketId]": DOCKET_ID,
        },
    )

    for doc in data.get("data", []):
        doc_id = doc["id"]
        attrs = doc.get("attributes", {})
        title = attrs.get("title", doc_id)
        print(f"\n  Document: {doc_id}")
        print(f"    Title: {title[:70]}")

        # Fetch individual doc for full attributes including fileFormats
        detail = api_get(f"/documents/{doc_id}")
        detail_attrs = detail.get("data", {}).get("attributes", {})
        file_formats = detail_attrs.get("fileFormats", [])

        if not file_formats:
            print("    No fileFormats found")
            continue

        for ff in file_formats:
            file_url = ff.get("fileUrl", "")
            fmt = ff.get("format", "unknown")
            size = ff.get("size", 0)

            if not file_url:
                continue

            # Use friendly name if we have one, otherwise doc_id
            friendly = DOC_NAMES.get(doc_id, doc_id.split("-")[-1])
            dest = analysis_dir / f"{friendly}.{fmt}"
            download_file(file_url, dest)
            print(f"    Format: {fmt}, Size: {size:,} bytes")


def fetch_comments() -> None:
    """Fetch comment submissions and their attachments.

    Comment files are in attributes.fileFormats on each comment, plus
    any additional attachments in the included array.
    """
    comments_dir = OUTPUT_DIR / "comments"
    comments_dir.mkdir(parents=True, exist_ok=True)

    print(f"\nFetching comments for docket {DOCKET_ID}...")

    # First get documents to find the commentOnId
    docs = api_get("/documents", {"filter[docketId]": DOCKET_ID})
    object_ids = [
        d["attributes"]["objectId"]
        for d in docs.get("data", [])
        if "objectId" in d.get("attributes", {})
    ]

    seen_comments: set[str] = set()

    for obj_id in object_ids:
        comments = api_get(
            "/comments",
            {
                "filter[commentOnId]": obj_id,
            },
        )

        for comment in comments.get("data", []):
            comment_id = comment["id"]
            if comment_id in seen_comments:
                continue
            seen_comments.add(comment_id)

            attrs = comment.get("attributes", {})
            title = attrs.get("title", comment_id)
            # Extract item number from the comment ID
            item_num = comment_id.split("-")[-1] if "-" in comment_id else "unknown"

            print(f"\n  Comment {item_num}: {title[:70]}")

            # Fetch individual comment for fileFormats + attachments
            detail = api_get(f"/comments/{comment_id}", {"include": "attachments"})
            detail_attrs = detail.get("data", {}).get("attributes", {})
            file_formats = detail_attrs.get("fileFormats") or []

            # Download main file(s)
            for ff in file_formats:
                file_url = ff.get("fileUrl", "")
                fmt = ff.get("format", "unknown")
                if file_url:
                    dest = comments_dir / f"{item_num}-comment.{fmt}"
                    download_file(file_url, dest)

            # Download any attachments (included array)
            for i, attachment in enumerate(detail.get("included", [])):
                if attachment.get("type") != "attachments":
                    continue
                a_attrs = attachment.get("attributes", {})
                a_formats = a_attrs.get("fileFormats") or []
                a_title = a_attrs.get("title", f"attachment-{i}")

                for ff in a_formats:
                    file_url = ff.get("fileUrl", "")
                    fmt = ff.get("format", "unknown")
                    if file_url:
                        safe_title = a_title.replace(" ", "_").replace("/", "_")[:50]
                        dest = comments_dir / f"{item_num}-{safe_title}.{fmt}"
                        download_file(file_url, dest)


def main() -> None:
    if not API_KEY:
        print("ERROR: REGULATIONS_GOV_API_KEY not set")
        print("Get a key at https://open.gsa.gov/api/regulationsgov/")
        sys.exit(1)

    print("Fetching DOE air-cleaner rulemaking docket")
    print(f"Docket: {DOCKET_ID}")
    print(f"Output: {OUTPUT_DIR}")
    print()

    print("1. Federal Register documents...")
    fetch_federal_register()

    print("\n2. Docket documents (TSD, spreadsheets)...")
    fetch_docket_documents()

    print("\n3. Comment submissions...")
    fetch_comments()

    print("\n" + "=" * 64)
    print("Corpus fetch complete.")
    print(f"Files saved to: {OUTPUT_DIR}")
    print("Run 00_seed_corpus.py to upload to S3.")


if __name__ == "__main__":
    main()
