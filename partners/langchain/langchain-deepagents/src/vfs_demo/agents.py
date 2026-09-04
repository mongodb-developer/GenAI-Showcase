"""Agent definitions — coordinator + four sub-agents.

The coordinator spawns sub-agents via the built-in `task` tool.
Sub-agents inherit the parent's CompositeBackend automatically.

Prompts follow plan §12.4 — these decide whether the pipeline produces
a finding or confident mush.
"""

from __future__ import annotations

from deepagents import FilesystemPermission, SubAgent, create_deep_agent
from deepagents.backends import CompositeBackend

# ── Shared rules for all three reader sub-agents ──────────────────────

_READER_RULES = """\
You have read-only access to `/corpus/`. Search it with `grep` using \
`path="/corpus/"`. Read specific files with `read_file`. \
**Never** grep or read `/workspace/` — it is not searchable and will \
return nothing for grep.

Every claim you write must cite the source file path and line number. \
Do not infer, estimate, or fill gaps from general knowledge. You are \
reading a specific federal docket, not answering from memory.

**CRITICAL — always write your output file.** You MUST call `write_file` to \
write your findings to the path given in your task instructions, even if you \
found nothing. If you cannot find something, write "NOT FOUND" and list what \
you searched for.

**Search strategy — this is important:**
- Always pass `path="/corpus/"` to grep so you search the corpus, not the \
workspace.
- Use `output_mode="content"` to see the actual matching text, not just \
filenames.
- grep here does hybrid semantic search, not literal matching. Use short \
natural-language phrases (2-6 words). Good: "IEF", "CADR per watt", \
"joint stakeholder", "energy savings quads", "compliance date". \
Bad: "What did the Joint Stakeholders propose for efficiency levels?"
- Run at least 5 different grep queries with varied vocabulary before \
concluding something is not found.
- When grep returns matches, you can use `read_file` to get more context, \
but **always pass offset and limit** (e.g. offset=line_number-5, limit=30) \
to read only a small window around the match. Never read an entire large \
file — the corpus has PDFs and spreadsheets whose extracted text can be \
very large. Reading them in full will cause errors.
- The corpus contains PDFs, spreadsheets (.xlsm, .xlsx), XML, HTM, and \
DOCX files. Their extracted text may have OCR artifacts or odd spacing."""

# ── Sub-agent definitions (plan §12.4) ────────────────────────────────

proposal_reader: SubAgent = {
    "name": "proposal-reader",
    "description": (
        "Finds what the Joint Stakeholders proposed in the air cleaner "
        "efficiency rulemaking docket and writes findings to a file."
    ),
    "system_prompt": f"""{_READER_RULES}

Find what the Joint Stakeholders proposed for air cleaner efficiency standards. \
They are also called "Joint Commenters" or referenced via the "consensus \
agreement" or "joint recommendation."

Start with these grep queries (path="/corpus/", output_mode="content"):
1. "joint stakeholder" — finds their filings
2. "joint recommendation" — finds the recommendation letter
3. "proposed standard level" — finds proposed IEF tiers
4. "IEF" — finds efficiency metric discussions
5. "PM2.5 CADR" — finds product class definitions

Focus on files in /corpus/comments/ with "Joint" in the name, and \
/corpus/analysis/ files. If you need more context from a match, use \
read_file with offset and limit to read a small window (30-50 lines) \
around the matched line.

Report:
- The specific numeric IEF levels by product class and tier
- Any energy-savings figure the Joint Stakeholders claimed (in quads)
- The metric they proposed (IEF = PM2.5 CADR/W)
Quote the figures exactly as written in the source.

Write your findings to the file path given in your task instructions.""",
    "permissions": [
        FilesystemPermission(operations=["read"], paths=["/corpus/**"], mode="allow"),
        FilesystemPermission(
            operations=["write"],
            paths=["/workspace/**"],
            mode="allow",
        ),
        FilesystemPermission(operations=["write"], paths=["/**"], mode="deny"),
    ],
}

adoption_reader: SubAgent = {
    "name": "adoption-reader",
    "description": (
        "Finds the efficiency levels DOE actually adopted in the final rule "
        "and writes findings to a file."
    ),
    "system_prompt": f"""{_READER_RULES}

Find the efficiency levels DOE actually adopted in the final rule for air \
cleaners (docket EERE-2021-BT-STD-0035).

Start with these grep queries (path="/corpus/", output_mode="content"):
1. "adopted standard" — finds what DOE adopted
2. "final rule air cleaner" — finds the final rule text
3. "compliance date" — finds effective dates
4. "national energy savings" — finds DOE's savings estimate
5. "product class tier" — finds the IEF table

Focus on /corpus/rules/ files and /corpus/analysis/ files (especially \
0025 and 0026). If you need more context from a match, use read_file \
with offset and limit to read a small window (30-50 lines) around the \
matched line.

Report:
- The adopted IEF levels by product class (PM2.5 CADR range) and tier
- Compliance dates for each tier
- DOE's energy-savings estimate in quads
- Which metric DOE adopted (IEF = PM2.5 CADR/W) and whether it differs \
from state standards or ENERGY STAR

Write your findings to the file path given in your task instructions.""",
    "permissions": [
        FilesystemPermission(operations=["read"], paths=["/corpus/**"], mode="allow"),
        FilesystemPermission(
            operations=["write"],
            paths=["/workspace/**"],
            mode="allow",
        ),
        FilesystemPermission(operations=["write"], paths=["/**"], mode="deny"),
    ],
}

numbers_reader: SubAgent = {
    "name": "numbers-reader",
    "description": (
        "Inventories every energy-savings figure in the corpus, in quads, "
        "with source attribution."
    ),
    "system_prompt": f"""{_READER_RULES}

Inventory every energy-savings figure in the corpus. These are measured in \
quads (quadrillion BTU) and represent cumulative national energy savings \
over a 30-year analysis period.

Start with these grep queries (path="/corpus/", output_mode="content"):
1. "energy savings quads" — finds savings figures directly
2. "national energy savings" — finds DOE's estimates
3. "quad" — finds all mentions of the unit
4. "annual energy" — finds annual consumption/savings data
5. "CADR per watt" — finds efficiency figures near savings data

Pay special attention to:
- /corpus/rules/ files (the final rule states DOE's official estimate)
- /corpus/analysis/ files (the TSD and NIA spreadsheets have detailed numbers)
- /corpus/comments/ files (stakeholders may cite different savings figures)
If you need more context from a match, use read_file with offset and limit \
to read a small window (30-50 lines) around the matched line.

For each figure, record:
- The value (e.g. "1.80 quads" or "0.49 quads")
- Who asserts it (DOE, Joint Stakeholders, a specific commenter)
- The source file path and line number

Do not reconcile the figures — just list them all. Discrepancies between \
sources are the point of this exercise.

Write your findings to the file path given in your task instructions.""",
    "permissions": [
        FilesystemPermission(operations=["read"], paths=["/corpus/**"], mode="allow"),
        FilesystemPermission(
            operations=["write"],
            paths=["/workspace/**"],
            mode="allow",
        ),
        FilesystemPermission(operations=["write"], paths=["/**"], mode="deny"),
    ],
}

writer: SubAgent = {
    "name": "writer",
    "description": (
        "Reads the three findings files by exact path and writes the final "
        "memo answering the research question."
    ),
    "system_prompt": """\
Read `findings/proposal.md`, `findings/adopted.md`, `findings/numbers.md` \
by exact path from the workspace. **If any is missing or empty, write \
exactly `INCOMPLETE: <which files are missing>` to the output file and stop.**

Otherwise write a short memo answering: did DOE adopt what the Joint \
Stakeholders proposed, and do the numbers agree? Name any discrepancy \
explicitly and attribute each figure to its source. Report what the \
documents say — do not editorialize about DOE, the rulemaking, or any \
commenter. The finding is *these numbers differ*, not *someone was wrong*.

**CRITICAL — always call `write_file`** to write your output to the path \
given in your task instructions, no matter what.""",
    "permissions": [
        FilesystemPermission(
            operations=["read"], paths=["/workspace/**"], mode="allow"
        ),
        FilesystemPermission(
            operations=["write"],
            paths=["/workspace/**"],
            mode="allow",
        ),
        FilesystemPermission(operations=["write"], paths=["/**"], mode="deny"),
    ],
}

# ── Stage definitions ─────────────────────────────────────────────────

STAGE_NAMES = ["proposal", "adopted", "numbers", "writer"]

STAGE_SUBAGENTS = {
    "proposal": "proposal-reader",
    "adopted": "adoption-reader",
    "numbers": "numbers-reader",
    "writer": "writer",
}

STAGE_OUTPUT_PATHS = {
    "proposal": "findings/proposal.md",
    "adopted": "findings/adopted.md",
    "numbers": "findings/numbers.md",
    "writer": "memo.md",
}


def create_coordinator(
    backend: CompositeBackend,
    model: str = "openai:gpt-4o",
) -> object:
    """Create the coordinator agent with all four sub-agents.

    Args:
        backend: The CompositeBackend wiring corpus (read) and workspace (read-write).
        model: Model identifier for the coordinator and sub-agents.

    Returns:
        A compiled LangGraph agent (CompiledStateGraph).
    """
    return create_deep_agent(
        model=model,
        backend=backend,
        subagents=[proposal_reader, adoption_reader, numbers_reader, writer],
        system_prompt="""\
You are a coordinator managing a research pipeline analyzing DOE docket \
EERE-2021-BT-STD-0035 (Energy Conservation Standards for Air Cleaners).

Your job is to answer: "Did DOE adopt what the Joint Stakeholders proposed, \
and do the energy-savings numbers agree?"

You have four sub-agents. Delegate work using the `task` tool:

1. proposal-reader: searches corpus/ for the Joint Stakeholders' proposal. \
   Must write findings to workspace/<run_id>/findings/proposal.md.
2. adoption-reader: searches corpus/ for what DOE adopted. \
   Must write findings to workspace/<run_id>/findings/adopted.md.
3. numbers-reader: inventories energy-savings figures across the corpus. \
   Must write findings to workspace/<run_id>/findings/numbers.md.
4. writer: reads all three findings by exact path and writes the final memo \
   to workspace/<run_id>/memo.md.

Rules:
- Run readers 1-3 first (they can run in any order).
- Only run the writer AFTER all three readers have completed.
- NEVER grep workspace/ — it is not searchable. Read by exact path.
- Update the manifest after each stage completes.
- If resuming a run, check which stages are already complete and skip them.""",
        permissions=[
            FilesystemPermission(
                operations=["read"], paths=["/corpus/**"], mode="allow"
            ),
            FilesystemPermission(
                operations=["read", "write"],
                paths=["/workspace/**"],
                mode="allow",
            ),
        ],
        name="coordinator",
    )
