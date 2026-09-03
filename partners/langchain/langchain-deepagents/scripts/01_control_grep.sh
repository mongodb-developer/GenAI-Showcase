#!/usr/bin/env bash
# Beat 1, Control Arm A — ripgrep over local corpus files.
#
# Expected result: cannot read XLS(X), DOCX, or PDF content.
# Post-extraction, literal grep "IEF" misses "smoke CADR/W" and "CADR per watt".
#
# This arm exists to show the extraction gap, not the ranking gap.

set -euo pipefail

CORPUS_DIR="$(cd "$(dirname "$0")/../corpus" && pwd)"

echo "================================================================"
echo "Beat 1 — Control: ripgrep over local corpus/"
echo "================================================================"
echo ""
echo "Query: 'How is air cleaner efficiency measured?'"
echo "Searching for: IEF, CADR, efficiency, smoke CADR"
echo ""

for term in "IEF" "CADR" "smoke CADR" "CADR per watt" "efficiency"; do
    echo "--- grep for '$term' ---"
    count=$(rg --count-matches "$term" "$CORPUS_DIR" 2>/dev/null | wc -l || true)
    echo "  Files with matches: $count"
    if [ "$count" -gt 0 ]; then
        rg -l "$term" "$CORPUS_DIR" 2>/dev/null | while read -r f; do
            ext="${f##*.}"
            echo "    $ext: $(basename "$f")"
        done
    fi
    echo ""
done

echo "================================================================"
echo "Summary: ripgrep can only search plain-text content."
echo "Binary formats (PDF, XLSX, DOCX) are opaque to literal search."
echo "Even in text, 'IEF' misses 'smoke CADR/W' and 'CADR per watt'."
echo "================================================================"
