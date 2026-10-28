"""Golden answer acceptance test — §12.3 of the demo plan.

Validates that memo.md contains the required findings.
Uses substring and regex checks, NOT an LLM judge.
The point is a deterministic gate.

Usage:
    python tests/golden_answer.py workspace/<run_id>/memo.md
    # or pass memo content via stdin
"""

from __future__ import annotations

import re
import sys
from pathlib import Path


def load_memo(path: str | None = None) -> str:
    """Load memo from file path or stdin."""
    if path:
        return Path(path).read_text()
    return sys.stdin.read()


def check_a1_adoption(memo: str) -> tuple[bool, str]:
    """A1: States that DOE did substantially adopt the Joint Stakeholders' proposal."""
    adopt_patterns = [
        r"(?i)DOE\s+(did\s+)?adopt",
        r"(?i)DOE\s+.*substanti",
        r"(?i)adopted\s+.*joint\s+stakeholders",
        r"(?i)adopted\s+.*proposal",
        r"(?i)joint\s+stakeholders.*adopted",
        r"(?i)consistent\s+with.*joint\s+stakeholders",
        r"(?i)aligned\s+with.*joint\s+stakeholders",
    ]
    for pattern in adopt_patterns:
        if re.search(pattern, memo):
            return True, f"Matched: {pattern}"
    return False, "No adoption statement found"


def check_a2_both_figures(memo: str) -> tuple[bool, str]:
    """A2: Names BOTH figures: 1.9 quads and 1.80 quads."""
    has_1_9 = bool(re.search(r"1\.9\s*quad", memo, re.IGNORECASE))
    has_1_80 = bool(
        re.search(r"1\.80?\s*quad", memo, re.IGNORECASE)
        or re.search(r"1\.8\s*quad", memo, re.IGNORECASE)
    )

    if has_1_9 and has_1_80:
        return True, "Both 1.9 and 1.80 quads found"
    missing = []
    if not has_1_9:
        missing.append("1.9 quads")
    if not has_1_80:
        missing.append("1.80 quads")
    return False, f"Missing: {', '.join(missing)}"


def check_a3_attribution(memo: str) -> tuple[bool, str]:
    """A3: Attributes 1.9 to Joint Stakeholders and 1.80 to DOE — not reversed."""
    # 1.9 should be near Joint Stakeholders/commenters
    stakeholder_1_9 = bool(
        re.search(
            r"(?i)(joint\s+(stakeholders?|commenters?).*1\.9|1\.9.*joint\s+(stakeholders?|commenters?))",
            memo,
        )
    )
    # 1.80 should be near DOE
    doe_1_80 = bool(
        re.search(
            r"(?i)(DOE.*1\.80?|1\.80?.*DOE)",
            memo,
        )
    )

    # Check for reversal (automatic fail)
    reversed_stakeholder = bool(
        re.search(
            r"(?i)(joint\s+(stakeholders?|commenters?).*1\.80?\s*quad)",
            memo,
        )
    )
    reversed_doe = bool(re.search(r"(?i)(DOE.*1\.9\s*quad)", memo))

    if reversed_stakeholder and reversed_doe:
        return False, "REVERSED: figures attributed to wrong parties"

    if stakeholder_1_9 and doe_1_80:
        return True, "Correct attribution: 1.9→Stakeholders, 1.80→DOE"
    return (
        False,
        f"Attribution unclear (stakeholder_1.9={stakeholder_1_9}, doe_1.80={doe_1_80})",
    )


def check_a4_source_paths(memo: str) -> tuple[bool, str]:
    """A4: Cites at least two distinct source files by path."""
    # Look for file paths (corpus/..., *.pdf, *.xlsx, etc.)
    path_patterns = [
        r"corpus/\S+",
        r"\S+\.(pdf|xlsx?|docx?|csv|txt)",
        r"/\S+\.\S+",
    ]
    paths_found: set[str] = set()
    for pattern in path_patterns:
        for match in re.finditer(pattern, memo, re.IGNORECASE):
            paths_found.add(match.group(0))

    if len(paths_found) >= 2:
        return (
            True,
            f"Found {len(paths_found)} distinct paths: {sorted(paths_found)[:5]}",
        )
    return False, f"Found only {len(paths_found)} source paths"


def check_must_not_reject(memo: str) -> tuple[bool, str]:
    """MUST NOT: claim DOE rejected or ignored the proposal."""
    reject_patterns = [
        r"(?i)DOE\s+(rejected|ignored|dismissed|refused|declined)\s+.*proposal",
        r"(?i)DOE\s+did\s+not\s+adopt",
        r"(?i)DOE\s+chose\s+not\s+to",
    ]
    for pattern in reject_patterns:
        if re.search(pattern, memo):
            return False, f"FAIL: claims DOE rejected the proposal ({pattern})"
    return True, "No rejection claim found"


def check_must_not_empty_findings(memo: str) -> tuple[bool, str]:
    """MUST NOT: produce a confident finding when findings were empty."""
    if re.search(r"(?i)INCOMPLETE:", memo):
        return False, "FAIL: memo says INCOMPLETE — findings were missing"
    return True, "No INCOMPLETE marker"


def main() -> None:
    path = sys.argv[1] if len(sys.argv) > 1 else None
    memo = load_memo(path)

    if not memo.strip():
        print("FAIL: memo is empty")
        sys.exit(1)

    print("=" * 64)
    print("Golden Answer Acceptance Test (§12.3)")
    print("=" * 64)

    # MUST contain (all four)
    must_checks = [
        ("A1", "DOE adopted the proposal", check_a1_adoption),
        ("A2", "Both figures (1.9 and 1.80 quads)", check_a2_both_figures),
        ("A3", "Correct attribution (not reversed)", check_a3_attribution),
        ("A4", "Two+ distinct source file paths", check_a4_source_paths),
    ]

    # MUST NOT contain
    must_not_checks = [
        ("N1", "No rejection claim", check_must_not_reject),
        ("N2", "No empty-findings output", check_must_not_empty_findings),
    ]

    passed = 0
    failed = 0

    print("\nMUST contain:")
    for code, label, check_fn in must_checks:
        ok, detail = check_fn(memo)
        status = "PASS" if ok else "FAIL"
        print(f"  [{status}] {code}: {label}")
        print(f"         {detail}")
        if ok:
            passed += 1
        else:
            failed += 1

    print("\nMUST NOT contain:")
    for code, label, check_fn in must_not_checks:
        ok, detail = check_fn(memo)
        status = "PASS" if ok else "FAIL"
        print(f"  [{status}] {code}: {label}")
        print(f"         {detail}")
        if ok:
            passed += 1
        else:
            failed += 1

    # SHOULD contain (quality signal, not pass/fail)
    print("\nSHOULD contain (quality signal):")
    should_checks = [
        ("rounding", r"1\.69|1\.89|2\.39|2\.01|2\.91"),
        ("metric distinction (IEF)", r"(?i)IEF"),
        ("metric distinction (smoke CADR)", r"(?i)smoke\s+CADR"),
        ("scope floor (CADR 30 vs 10)", r"(?i)CADR\s*(30|10)"),
    ]
    for label, pattern in should_checks:
        found = bool(re.search(pattern, memo))
        status = "FOUND" if found else "ABSENT"
        print(f"  [{status}] {label}")

    total = passed + failed
    print(f"\nResult: {passed}/{total} required checks passed")

    if failed > 0:
        print("GATE: FAILED")
        sys.exit(1)
    else:
        print("GATE: PASSED")
        sys.exit(0)


if __name__ == "__main__":
    main()
