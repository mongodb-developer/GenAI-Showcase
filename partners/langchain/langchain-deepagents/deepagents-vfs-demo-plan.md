# Demo Plan — MongoDB Atlas VFS for LangChain Deep Agents

**Deliverable:** sample app + notebook backing the Towards AI post
*"Building a Multi-Agent Pipeline Where Nothing Gets Lost"*
**Also feeds:** GenAI-Showcase demo repo (Mikiko Bazeley, DRI per GTM plan)
**Ship:** GTM release Sep 3, 2026 — article Sep 7

*Rev 5 — framing locked: the research-intern hook. Corpus unchanged from Rev 4
(DOE rulemaking docket EERE-2021-BT-STD-0035). §1 rewritten; nothing downstream moves.*

---

## 1. The framing and the use case

### 1.1 The hook: the intern nobody is testing

In March 2026 OpenAI made an autonomous AI researcher its stated "North Star" and
committed to shipping an **autonomous AI research intern** — a system able to take on a
small number of specific research problems by itself — **by September 2026**, as the
precursor to a fully automated multi-agent research system planned for 2028. As of late
July it had not shipped as a product, and Sam Altman had already said publicly they "may
totally fail" at hitting the milestones.

This article publishes September 7. The whole industry is talking about research interns
this month, and nobody has one.

**The wedge:** the conversation is entirely about capability — can it reason, can it plan,
can it work unattended for hours. Nobody is asking whether the intern's notes survive the
process dying. That is a real gap in the discourse, not a manufactured one, and it is
exactly what this post demonstrates.

**Opening beat — lead with the bug, not the corpus:**

> The industry promised an autonomous research intern this month. They mean the kind that
> reads papers and runs experiments. I built the part nobody demos — the one that reads a
> pile of documents written by people who don't agree on their terms, and writes up what
> it found.
>
> The first version worked about half the time. The other half, the summarizer opened an
> empty directory and confidently wrote a report based on nothing.

Note what that pivot does: it is a mild corrective to the hype rather than an echo of it,
which is a better position to write from and keeps us clear of any claim to be building
OpenAI's system.

**Three constraints on this framing:**

- **Don't position this as competing with or replicating OpenAI's work.** Frame it as
  *the industry is promising X*, never *OpenAI will deliver X* — their own chief scientist
  hedged it.
- **Scope the metaphor to one assignment, interruptible.** "Intern" invites the
  does-it-learn question and this demo does not learn. (The single-backend variant in §4.2
  gives a later run grep access to earlier runs' findings — the closest thing, worth
  mentioning honestly rather than overselling.)
- **Verify the September commitment against OpenAI's own statement** before print. Current
  sourcing is MIT Technology Review plus secondary coverage.

### 1.2 Why the corpus is research work

The obvious objection: OpenAI means *scientific* research — papers, experiments,
hypotheses — and this corpus is a federal rulemaking.

The dispute in that docket is **methodological**. Four organizations measure the same
physical quantity — how much clean air you get per unit of power — four different ways,
and the rule spends pages arguing about which measurement is valid, over what particle
size range, under which test procedure. Reconciling incompatible measurement
methodologies across sources written by different groups is what a research intern does
in a literature review. It is applied metrology rather than machine learning, and the
work is the same shape.

**Why not an actual scientific corpus (arXiv, PubMed):** PDF-only, so Beat 1 loses the
spreadsheets and Word uploads that carry the format argument; it is the most saturated
demo domain in RAG; it collides head-on with LangChain's own `deep_research` example,
which is the tutorial we are differentiating from; and it discards the only *verified*
discrepancy in this project along with the published answer key in Table II.4. That last
point decides it.

### 1.3 The use case, in plain language

A federal agency has just finalized a rule. In our case, the Department of Energy setting
the first-ever efficiency standards for room air cleaners — the things everyone bought
during COVID and buys again every fire season. Twelve organizations filed comments while
it was being written: manufacturers like Daikin and Lennox, California utilities,
efficiency advocates, a trade association. DOE then published a 63-page final rule
explaining what it decided and how it answered each of them. Alongside that sit technical
support documents and four spreadsheets holding the actual math.

**Something unusual happened here.** Manufacturers and environmental advocates — AHAM
sitting with ACEEE, ASAP, CFA and NRDC — did the rare thing and agreed. They filed a joint
consensus proposal with specific numbers. So the question is not "did an agency follow
procedure." It is **did the agency take the deal?**

**The job.** You are the intern, and someone asks: *did DOE adopt what the coalition
proposed, and do the numbers agree?*

That is a real job real people have. Law firms, trade associations and advocacy groups
read the record after every rule drops, precisely to answer that question. It is tedious
and it matters.

**Why it's hard.** Not because any one document is difficult. Because the answer is never
in one document.

The finding the agent surfaces: the Joint Stakeholders proposed specific efficiency levels
— 1.69, 1.90, 2.01 and so on. DOE adopted them as 1.7, 1.9, 2.0. It rounded. Separately,
the stakeholders claimed their proposal would save **1.9 quads** of energy; DOE's own
independent analysis came out at **1.80 quads**. Neither document flags the gap. Nobody is
hiding anything — you only see it if you read both, and they sit in different sections
written by different parties. A quad is enormous; a tenth of one is not a rounding error
in any physical sense, it just looks like one on the page.

**Three things make this hard for software:**

- **Formats.** A long rule, four spreadsheets, comment letters uploaded as Word files and
  PDFs. A folder on a laptop cannot search inside most of those at all.
- **Vocabulary.** The states measure *smoke CADR per watt*. DOE measures *PM2.5 CADR per
  watt* via a metric called IEF. ENERGY STAR uses a third framing. All three describe how
  much clean air you get per unit of power. Search for one, miss the other two. The
  efficiency number on the box may not be the number that matters.
- **Volume.** The corpus is far too large for a context window, but you don't need all of
  it — you need the four passages bearing on the question. The agent has to navigate:
  list, narrow, search, open the one file.

**What the agent does.** A coordinator splits the job four ways. One sub-agent finds what
was proposed. One finds what was adopted. One checks the savings math against the
spreadsheets. A fourth reads all three sets of notes and writes the memo naming the
discrepancies. Each sub-agent searches the shared corpus and writes findings to a shared
workspace.

**The part that is actually the article.** The corpus and the workspace need *different
storage guarantees*, and most teams don't notice until something breaks.

The corpus is settled — nobody is editing a published final rule. Agents search it, and if
search runs a few seconds behind, nothing bad happens. That is what Atlas is doing: making
a pile of documents in S3 findable by meaning rather than by exact string.

The workspace is live. Sub-agents are writing notes right now, and the writer needs them
*immediately*. So the workspace is read by exact path and never searched.

Then you kill the process halfway through, restart it, and it resumes — because the notes
survived. **An intern that can't be interrupted isn't an intern.** That is the "nothing
gets lost" in the title, and no other Deep Agents tutorial demonstrates it.

---

## 2. The corpus: DOE docket EERE-2021-BT-STD-0035

**Rulemaking:** Energy Conservation Standards for Air Cleaners
**Final rule:** 88 FR 21752, published 2023-04-11, FR doc 2023-06499, RIN 1904-AF46
**Docket:** EERE-2021-BT-STD-0035

Chosen over the synthetic ACME corpus because the contradiction is real, the answer key is
published, and the whole thing is public domain so readers can legally re-upload it.

### The documents

| Source | Format | Role |
|---|---|---|
| Final rule (88 FR 21752) | PDF / XML / JSON | What DOE adopted, plus its answers to every commenter |
| Simultaneous NOPR (FR doc 2023-06498) | PDF | Proposes identical levels — statutorily required twin |
| Confirmation of dates (FR doc 2023-18860, 2023-08-31) | PDF | What happened after the comment period |
| Technical Support Document (item -0024) | PDF | The underlying analysis |
| Life-Cycle Cost Analysis spreadsheet (-0023) | XLS/XLSX | LCC and payback math |
| National Impact Analysis spreadsheet (-0022) | XLS/XLSX | Where the quads number comes from |
| GRIM — Joint Proposal (-0021) | XLS/XLSX | Manufacturer impact model, stakeholder version |
| GRIM — Direct Final Rule (-0020) | XLS/XLSX | Manufacturer impact model, DOE version |
| Twelve comment submissions | PDF / DOCX | The stakeholder positions |

The two GRIM spreadsheets are the quiet prize: the *same model* run on the stakeholder
proposal and on DOE's adopted rule. If their outputs differ, that is a second findable
discrepancy sitting in two spreadsheets nobody diffs.

### The published answer key

Table II.4 of the final rule lists every commenter with name, abbreviation, **docket item
number**, and type:

| Commenter | Abbrev. | Item | Type |
|---|---|---|---|
| ACEEE, ASAP, AHAM, CFA, NRDC | Joint Commenters | 8 | Efficiency orgs + trade association |
| Blueair IAQ | Blueair | 10 | Manufacturer |
| Electrolux Home Products NA | Electrolux | 6 | Manufacturer |
| Daikin U.S. Corporation | Daikin | 12 | Manufacturer |
| Lennox International | Lennox | 7 | Manufacturer |
| Madison Indoor Air Quality | MIAQ | 5 | Manufacturer |
| Molekule | Molekule | 11 | Manufacturer |
| Northwest Energy Efficiency Alliance | NEEA | 13 | Efficiency organization |
| PG&E, SDG&E, SoCal Edison | CA IOUs | 9 | Utilities |
| Synexis LLC | Synexis | 14 | Manufacturer |
| Trane Technologies | Trane | 3 | Manufacturer |
| AHRI | AHRI | 15 | Trade association |
| *(Joint Stakeholders proposal)* | Joint Stakeholders | 16 | Consensus coalition |

And DOE's citations are machine-readable pointers back into the docket: `(Daikin, No. 12
at p. 3)`, `(MIAQ, No. 5 at p. 2)`, `(Joint Stakeholders, No. 16 at p. 6)`. Commenter,
item number, page. **The rule tells you which document and which page it is
characterizing**, so the agent can be asked to go verify the characterization against the
source — and you can score whether it did.

### The verified discrepancies

Confirmed by reading the final rule directly, not inferred:

1. **1.9 quads vs 1.80 quads.** Joint Stakeholders' claim vs DOE's independent analysis.
   Different sections, different parties, no cross-reference.
2. **Rounding.** Proposed 1.69 / 1.89 / 1.90 / 2.39 / 2.01 / 2.91 → adopted 1.7 / 1.9 /
   1.9 / 2.4 / 2.0 / 2.9.
3. **Scope floor.** State standards apply from CADR 30; DOE's Product Class 1 starts at
   10, capturing tabletop units per the Joint Commenters' request.
4. **Metric mismatch.** State and ENERGY STAR standards are smoke-CADR/W; DOE's is
   PM2.5-CADR/W via IEF. The rule spends pages reconciling them and explicitly notes they
   are different metrics.
5. **Tier-1 test-procedure carve-out.** Compliance with Tier 1 may use the wider AHAM
   AC-1-2020 particle range; Tier 2 must use the narrower appendix FF range. A conditional
   buried in a test-procedure discussion.

### The question the agent is asked

> **"Did DOE adopt what the Joint Stakeholders proposed, and do the energy-savings
> numbers agree?"**

Answerable, verifiable, and not present in any single file.

### Register note

Report what the documents say. Do not editorialize about DOE, about efficiency
regulation, or about any commenter. The finding is *these numbers differ*, not *someone
was wrong*. Appliance efficiency was chosen precisely because nobody holds a tribal
position on air-cleaner test procedures — keep it that way.

---

## 3. Getting the data

**API key:** already obtained from https://open.gsa.gov/api/regulationsgov/ (api.data.gov).
Read access only; the commenting-API activation path is irrelevant here. Pass as
`X-Api-Key` header or `api_key=` query param. Never `DEMO_KEY`, never the key embedded in
regulations.gov's own page source.

**Federal Register needs no key.** JSON at
`federalregister.gov/api/v1/documents/2023-06499`, full-text XML at
`federalregister.gov/documents/full_text/xml/2023/04/11/2023-06499.xml`. Both fetch
cleanly.

**Docket pull sequence:**

```
GET /v4/documents?filter[docketId]=EERE-2021-BT-STD-0035
    → document list; capture objectId for the rule

GET /v4/documents/{documentId}?include=attachments
    → the four spreadsheets and the TSD

GET /v4/comments?filter[commentOnId]={objectId}
    → the twelve commenters

GET /v4/comments/{commentId}?include=attachments
    → DOCX/PDF uploads behind "see attached" comments
```

`?include=attachments` is required on both endpoints. Attachments are not returned by
default, and omitting it is exactly the mistake that makes you conclude the spreadsheets
aren't there.

**Vendor the corpus.** regulations.gov is an Ember SPA — a plain fetch returns only JS
config, no content. So pull the docket once, commit the files to `corpus/`, and let
`00_seed_corpus.py` upload rather than download. Consequences, all good: readers need no
API key, the corpus is deterministic, and the seed step needs no network beyond S3.
Reader account count stays at three.

---

## 4. Architecture

### 4.1 Two planes, two guarantees

The package README states the constraint plainly: *budget for `write` → `grep` lag on the
order of the watcher interval plus Atlas indexing time, and don't rely on a file being
greppable immediately after writing it.* A `write` lands in S3 immediately; the
PollingWatcher notices on a **10-second** interval, chunks, embeds, upserts; `mongot` then
indexes asynchronously.

So if sub-agent A writes a finding and sub-agent B greps for it in the same run, B finds
nothing. That is the documented contract, not a bug.

| Plane | Path | Operations | Guarantee | Why |
|---|---|---|---|---|
| **Corpus** — discovery | `corpus/` | `grep`, `glob`, `ls` | eventually consistent | Settled, mixed-format, searched by meaning |
| **Workspace** — coordination | `workspace/<run_id>/` | `write`, `read`, `edit` | read-after-write | Live, written now, read by exact path |

Agents **discover** through the corpus and **coordinate** through the workspace by
deterministic path, never by grep.

### 4.2 Backend wiring

```python
CompositeBackend(
    default=MongoFilesystemBackend(s3_prefix="workspace/", debug=True, ...),
    routes={"corpus/": MongoFilesystemBackend(s3_prefix="corpus/", debug=True, ...)},
)
```

`CompositeBackend(default=..., routes={...})` routes by path prefix and is documented in
LangChain's own Backends page. Any `BackendProtocol` implementation slots in.

`StateBackend` **cannot** be the default here. It is in-process, so the kill test would
wipe the workspace and Beat 3 would be meaningless. LangChain's canonical example uses
`StateBackend` as default with `/memories/` routed to something persistent — the inverse
of what this demo needs.

**Cost:** two watcher threads, two initial syncs.

**Simpler fallback:** one `MongoFilesystemBackend` with `corpus/` and `workspace/` as
directories under a single prefix. Halves the cost. Tradeoff: agent-written findings also
get chunked and embedded, spending embedding calls and mixing agent output into the corpus
index. Upside worth naming honestly — a *later* run can then grep across *earlier* runs'
findings. Cross-session recall for free, just not within a run.

**Recommendation:** build the CompositeBackend version. The routing config is three lines
and it makes the thesis visible in the code. Mention the single-backend option in the
article as the cheaper path.

### 4.3 The pipeline

```
coordinator
├── writes  workspace/<run_id>/plan.md
├── writes  workspace/<run_id>/manifest.json          ← run receipt
├── task → proposal-reader  → findings/proposal.md    what did the Joint Stakeholders propose?
├── task → adoption-reader  → findings/adopted.md     what did DOE actually adopt?
├── task → numbers-reader   → findings/numbers.md     do the savings figures agree?
└── task → writer           → reads three by path → memo.md
```

Each reader greps `corpus/` and writes only its own namespaced file. The writer reads by
known path — immediate, deterministic, no watcher in the coordination path.

**Concurrency rule:** only the coordinator writes `manifest.json`. Readers write only
their own file, so there are no collisions. If parallel writers ever need to share a file,
`edit` is an ETag-verified read-modify-write — optimistic concurrency, not a mutex. Worth
one sentence in the article.

### 4.4 The run receipt

Fields follow the "run receipt" audit from Govindarajan's AIEWF talk (§7): what woke it
up, what state it inherited, what authority it used, what executed, what evidence
survived.

```json
{
  "run_id": "aircleaners-001",
  "woke_up_by": "cli:03_pipeline.py --run-id aircleaners-001",
  "inherited_state": "workspace/aircleaners-001/ (2 findings present at start)",
  "authority": {"corpus": "read-only", "workspace": "read-write"},
  "question": "Did DOE adopt what the Joint Stakeholders proposed, and do the energy-savings numbers agree?",
  "stages": [
    {"name": "proposal", "status": "complete", "output": "findings/proposal.md",
     "tokens": 4210, "usd": 0.031, "completed_at": "2026-09-01T18:04:11Z"},
    {"name": "adopted",  "status": "complete", "output": "findings/adopted.md", "...": "..."},
    {"name": "numbers",  "status": "pending"},
    {"name": "writer",   "status": "pending"}
  ],
  "evidence": ["findings/proposal.md", "findings/adopted.md"]
}
```

The receipt is the artifact readers will copy out of the post. `inherited_state` and
`evidence` are what make the resume auditable rather than merely functional.

### 4.5 Data flow

```
regulations.gov + federalregister.gov
        │  (one-time pull, vendored into repo)
        ▼
   corpus/ files ──upload──► S3 (prefix: corpus/)
                                │
                    watcher ────┤ chunk → embed → upsert
                                ▼
                          MongoDB Atlas
                     (chunks, embeddings, path metadata)
                          text + vector + $rankFusion
                                │
   agent grep/glob/ls ──────────┘
   agent read ──────────────────► S3 directly (source bytes)

   agent write/read ───────────► S3 (prefix: workspace/)  ← read-after-write
```

Two rules hold the whole design together: **search goes to Atlas, bytes go to S3**, and
**the workspace is never searched**.

---

## 5. Gate status

**Resolved from the package README:**

| # | Answer |
|---|---|
| G1 | `pip install langchain-mongodb-deepagents-vfs`; extras `[bedrock]` (default) / `[openai]`. Import `from langchain_mongodb_deepagents_vfs import MongoFilesystemBackend`. **Publication unconfirmed — §5a.** |
| G4 | **No MinIO/LocalStack.** No `endpoint_url` parameter. Real AWS S3 required. |
| G5 | Atlas M0+ works; M10+ for production Search/Vector Search. Atlas Local works for dev. **Caveat in §5b.** |
| G6 | PollingWatcher 10s ETag diff. SQSWatcher 20s long-poll, needs S3→SQS notifications. Atlas index time on top. |
| G8 | `write` → S3 → watcher chunks + embeds + upserts. Confirmed. |

**Resolved from LangChain docs:**

| # | Answer |
|---|---|
| G2 | `CompositeBackend(default=..., routes={...})` routes by path prefix. Documented, own tutorial page. |
| G7 | Declarative `permissions` exist to control which paths an agent can read or write. Use to enforce `corpus/` read-only; `s3_prefix` + system prompt is the fallback. |

**Resolved by fetching the corpus (this session):**

| # | Answer |
|---|---|
| G9 | Federal Register: fetchable, clean text, JSON + XML APIs, no key. |
| G10 | regulations.gov: Ember SPA, plain fetch returns nothing. API key required → vendor the corpus. |
| G11 | Real cross-document discrepancy exists and is verified (§2). |
| G12 | Published answer key exists (Table II.4 + inline docket citations). |

**Still open:**

- **G3** — do sub-agents spawned via `task` inherit the parent's backend? Load-bearing for
  the shared-workspace claim. Docs imply yes; implication is not verification. Test first.
- **G13** — are the four spreadsheets `.xlsx` (openpyxl) or `.xls` (xlrd)? Both supported,
  different parsers. Settled by one download.
- **G14** — do any of the twelve comments include DOCX uploads? Determines whether the
  five-format claim holds. Settled by the same download.

### 5a. Publication status

The README documents `pip install langchain-mongodb-deepagents-vfs`, so the name is
settled. As of Sep 1 it is not in the monorepo root README, has no
`libs/langchain-mongodb-deepagents-vfs/v*` release tag, and did not surface on PyPI.
Confirm the release date with Alex; pin to a commit SHA either way.

### 5b. The silent-degradation trap

Three documented modes that produce **no error** and quietly destroy what the demo exists
to show:

1. **Non-Atlas MongoDB → `grep` falls back to regex.** Every semantic result stops working
   and nothing says why.
2. **Embedding API unavailable at query time → `grep` falls back to full-text only.**
   Degraded relevance, no error.
3. **Partial initial sync.** The README's words: it leaves a collection that "looks
   healthy and is quietly incomplete, which is otherwise easy to mistake for a search bug."

The seed script must assert on both instruments and refuse to continue:

```python
backend.grep("warmup")                 # blocks until index + sync complete
assert not backend.init_errors, backend.init_errors
report = backend.initial_sync_report
assert report and report.failed == 0, f"{report.failed}/{report.seen} objects not searchable"
```

**Error shape:** every method returns a DTO with a stable `[EXXXX]` code in `result.error`;
nothing raises by default. Demo code checks `result.error` — a `try/except` passes silently
over real failures. Run with `debug=True` so exceptions surface with tracebacks.

---

## 6. Three beats

### Beat 1 — Discovery across formats (three-way comparison)

**The thesis is parsing and vocabulary, not "vector beats grep."** Bergum's AIEWF talk
(§7) argues BM25 is underrated for agentic search and that default parameters make lexical
retrieval look artificially weak. He is right, and a sharp reader will raise it. The two
claims that survive his critique:

- BM25 cannot read the spreadsheets or the DOCX uploads at all. Extraction, not ranking.
- Four parties using four names for one metric is not a tuning problem.

`$rankFusion` runs lexical **and** vector at 0.5/0.5. This is an argument for fusion, not
against lexical. State that plainly.

| Arm | Script | Expected result |
|---|---|---|
| Local folder + `ripgrep` | `01_control_grep.sh` | Cannot read XLS(X), DOCX, or PDF. Post-extraction, literal `grep "IEF"` still misses "smoke CADR/W" and "CADR per watt". |
| `StoreBackend` + `MongoDBStore` | `01b_control_storebackend.py` | Runs. But per the README, `StoreBackend.grep` fetches every item in the namespace and matches literal substrings in Python — it never passes `query` to `MongoDBStore.search()`, so the vector search sitting right there goes unused. Same miss, whole files in memory. |
| `MongoFilesystemBackend` | `02_discovery.py` | Hybrid `$rankFusion`, chunk-level, `line_start` → real `GrepMatch.line`. Surfaces the metric discussion across all four vocabularies. |

Query: *"How is air cleaner efficiency measured, and do the state standards use the same
metric as DOE?"*

**Measurement:** report hits **and tokens consumed** per arm, and run each arm three times.
A single run is not evidence, and token cost is the number this audience reads.

The middle arm is what makes this a review rather than a puff piece. Reproduce the
README's nuance precisely: the limitation is in `StoreBackend`'s wiring, not
`MongoDBStore`'s ceiling.

### Beat 2 — Multi-agent pipeline with a shared workspace

Architecture in §4.3. The demo question from §2. `manifest.json` earns a paragraph: it is
a run receipt, and it is the difference between a pipeline that resumes and one that can
only restart.

Worth verifying and, if true, mentioning: Deep Agents' `FilesystemMiddleware` auto-offloads
tool results over ~20K tokens to files. With a durable backend those offloads survive the
run instead of evaporating — relevant here because the TSD and spreadsheets are large.

### Beat 3 — The kill test

```bash
python scripts/03_pipeline.py --run-id aircleaners-001 --kill-after 2   # SIGKILL after 2 of 4
python scripts/04_resume.py   --run-id aircleaners-001                  # same run_id
```

On resume the coordinator `ls`es the workspace, reads `manifest.json`, sees two stages
complete, skips them, runs the rest. In story terms: the analyst reads their own notes and
picks up mid-review instead of re-reading the docket.

**Instrument it.** Tokens, wall-clock, and **USD cost** for cold / killed / resumed. Cost
per task is the unit the ecosystem currently reports. `resumed + killed ≈ cold` is the
honest result; the number to lead with is what the resume avoided re-spending.

Draw the parallel to ETag idempotency at the sync layer — per the README, restarting after
a partial failure "resumes cheaply without re-embedding unchanged files." Same principle
one layer down. That parallel is the most quotable idea in the piece.

This beat is why it cannot be a single notebook. A kernel cannot honestly demonstrate
`kill -9`.

---

## 7. Positioning research (carried forward)

### 7.1 What already exists

Nearly every published Deep Agents tutorial is a web-research agent using Tavily —
LangChain's own `deep_research` example, DataCamp's job-application assistant, Krish
Naik's research agent, CopilotKit's Next.js assistant, mkassaf's seven-example repo. A
private, mixed-format, pre-existing corpus is unoccupied ground.

**Don't teach what's already taught.** LangChain's Backends doc uses `class
S3Backend(BackendProtocol)` as its skeleton example, and `CompositeBackend` has a
dedicated tutorial page. Link both, use them, move on. The angle is what changes when the
backend is a *search plane* rather than storage.

**Every published tutorial is happy-path.** None demo crash recovery, none demo the
eventual-consistency tradeoff, none run a comparison arm. That is the gap.

### 7.2 Current discourse (AINews, Aug 29–31 2026)

Verify each against the primary source before citing; AINews is an aggregator.

- **Google's WikiSkill / SKILL.state** replaces growing conversation histories with
  explicit mutable state plus persistent skill knowledge, reporting better long-horizon
  accuracy at lower cumulative token use. `manifest.json` *is* explicit mutable state.
  This reframes the post from "look, persistence" to "here is the infrastructure the
  current research direction implies." Tencent's **ContextPilot** landed alongside it.
- **Meta's Muse Code** exited beta with an SDK whose headline features include *resuming
  sessions*. The kill test is a product category, not a contrived beat.
- **Hermes Agent v0.21.0** shipped agent-to-agent comms and cut default context usage by
  roughly half.
- A Claude Code practitioner described running an orchestrator at ~500K tokens while
  delegating to sub-agents with fresh contexts, to keep context pollution out of the
  execution path. That is Beat 2, arrived at from pain.
- **Cost per task is the unit.** Agent Arena reported GLM-5.3-Flash at $0.12 median cost
  per task. Sonar Vortex claims a semantic code graph cuts task cost 5–36% versus
  text-search-heavy workflows (vendor claim via aggregator — directional only).
- **Harrison Chase** argued for trace-level cost reconciliation over coarse spend totals.
- **DeepSeek Harness** shipped breaking plugin-contract changes; the takeaway was that
  plugin-heavy agent platforms are still defining their public boundaries. That is the
  SHA-pinning argument from someone other than us.

### 7.3 AI Engineer World's Fair 2026 (Jun 29 – Jul 2, Moscone West)

**Harness Engineering was the Day 4 keynote track.** Day 3 ran **Memory & Continual
Learning** and **Context Engineering** as separate tracks — the same state/memory split the
S3 glossary freezes. The post can use "harness" without defining it.

- **Vinoth Govindarajan, "Your Agent Didn't Fail. Your Harness Did."** — the model
  proposes, the harness commits, the receipt proves it. Source of the run-receipt schema
  in §4.4.
- **Jo Kristian Bergum, "The unreasonable effectiveness of BM25 for agentic search"** —
  the counter-argument Beat 1 must engage rather than ignore.
- **Jeff Vestal (Elastic), "Vector Isn't Enough"** — a workshop with Beat 1's exact
  three-arm structure. Differentiate: he does retrieval; we do retrieval inside an agent
  filesystem protocol where `read` deliberately goes elsewhere.
- **Jerry Liu, "Building the Document Context Layer for AI Agents"** — ~90% of enterprise
  context lives in document containers. A category name the audience already holds;
  position the demo as a Document Context Layer for Deep Agents.
- **Benjamin Clavié, "Knowledge Agents"** — argues against forcing every knowledge task
  into the shape that worked for coding, using legal clerking as the example. Backing for
  the analyst framing.
- **Measurement precedents:** Owen Halpert compares quality *and* token consumption across
  retrieval modes; Jess Wang stresses a single eval run is never enough; **Towards AI's own
  workshop** measured tokens, cost, latency and memory probes rather than vibe-checks.
  That last one is the publication we're writing for — match their instrument set.
- **Tereza Tížková, "Rise of the Software Factory"** asks Beat 3's question verbatim: how
  do you recover from partial failure mid-task without discarding completed work.
- **Anthropic, "Evolution of agentic surfaces"** lists *sessions that survive interruption*
  among production requirements.

---

## 8. Repo shape

```
langchain-deepagents-mongodb-vfs/
├── README.md                       # 3 accounts, cost, runtime, Atlas-tier warning
├── .env.example                    # MONGODB_URI, AWS_*, EMBEDDING_PROVIDER, OPENAI_API_KEY
├── pyproject.toml                  # SHA-pinned until the PyPI release lands
├── corpus/                         # vendored from the docket; public domain
│   ├── rules/          88FR21752-final-rule.pdf, nopr.pdf, confirmation.pdf
│   ├── analysis/       tsd.pdf, lcc.xlsx, nia.xlsx, grim-joint.xlsx, grim-dfr.xlsx
│   └── comments/       0003-trane.pdf … 0016-joint-stakeholders.pdf
├── scripts/
│   ├── 00_seed_corpus.py           # upload → block on grep → assert init/sync health
│   ├── 01_control_grep.sh          # ripgrep arm
│   ├── 01b_control_storebackend.py # StoreBackend + MongoDBStore arm
│   ├── 02_discovery.py             # Beat 1
│   ├── 03_pipeline.py              # Beat 2  (--run-id, --kill-after)
│   └── 04_resume.py                # Beat 3
├── src/vfs_demo/
│   ├── backend.py                  # CompositeBackend wiring, prefixes, debug, ctx manager
│   ├── agents.py                   # coordinator + 4 readers
│   ├── manifest.py                 # run receipt read/write/resume
│   └── metrics.py                  # tokens, latency, USD cost per run
├── tools/
│   └── fetch_docket.py             # one-time, needs API key; NOT in the reader path
└── notebook/walkthrough.ipynb      # setup + Beat 1 inline; 03/04 via subprocess
```

`tools/fetch_docket.py` is provenance, not workflow. It documents how the corpus was
assembled and lets a reader refresh it, but the tutorial never asks them to run it.

**Notebook and app, split by what each can honestly show.** The notebook carries setup,
seeding and Beat 1 — genuinely notebook-shaped, and it gives GenAI-Showcase the artifact it
expects. Beats 2 and 3 shell out, because a background watcher thread, sub-agent fan-out
and a process kill are not notebook-shaped.

### Reader friction, stated up front

Three accounts: MongoDB Atlas, AWS (S3 **and** Bedrock unless using `[openai]`), plus an
LLM provider. No MinIO escape hatch. No regulations.gov key.

**Region gotcha:** `aws_region` governs S3, SQS **and** Bedrock together — they cannot be
split. If Titan v2 isn't enabled in the reader's region, embeddings fail. The README notes
there is no hardcoded fallback, so it surfaces as an explicit `NoRegionError`. Most likely
setup failure; say so plainly.

`[openai]` is probably the lower-friction default for a Towards AI audience — drops the
Bedrock enablement step at the cost of a second API key.

---

## 9. Article mapping (800–2,500 words)

| § | Content | Beat | ~Words |
|---|---|---|---|
| 1 | The intern nobody is testing — open on the bug, then the assignment | — | 250 |
| 2 | Setup, honestly: 3 accounts, the region gotcha, what took longest | — | 250 |
| 3 | Parsing and vocabulary: the grep a folder can't do — and why this isn't an anti-BM25 argument | 1 | 550 |
| 4 | Two planes, two guarantees — discovery vs. coordination | — | 300 |
| 5 | Four readers, one desk — and the receipt that makes it resumable | 2 | 400 |
| 6 | An intern that can't be interrupted isn't an intern: the kill test, with numbers | 3 | 350 |
| 7 | What I'd want before production | — | 300 |

§7 writes itself from §5b: three silent-degradation modes, the 64 MiB read cap (oversized
objects skipped, counted in `SyncReport.failed` during initial sync but only *logged* by
the watchers), write→grep lag, hard AWS coupling, and access control being the
application's job.

**Do not spend words on:** implementing `BackendProtocol` (LangChain's doc uses an S3
backend as its skeleton) or `CompositeBackend` mechanics (dedicated tutorial page).

---

## 10. Register notes

**This post is first person.** Tony's brief asks for a developer's *experience* — install
it, run it, report. That is the opposite of the S3 series register. Do not apply S3 voice
rules here; the de-AI smell audit still applies, the third-person rule does not.

**The Towards AI AI-Slop Guide is attached to the Wrike ticket and I don't have it.**
Needed before drafting prose.

**Neutrality:** report what the documents say. The finding is *these numbers differ*, not
*someone was wrong*.

---

## 11. Open items

1. **Download the docket** with the new API key. Settles G13 (xlsx vs xls) and G14 (DOCX
   comment uploads) — together they decide how strong the format argument in Beat 1 is.
2. **G3: sub-agent backend inheritance** — first thing to test once the package installs.
   If sub-agents don't inherit, Beat 2 restructures into sequential agents sharing an
   explicit backend instance.
3. **PyPI release date** — Alex. Determines `pip install` vs a git URL.
4. **AI-Slop Guide** — pull from Wrike.
5. **Budget** — Atlas tier + embeddings + LLM across ~4 pipeline runs. Real number needed
   for the README.
6. **Third-party collision** — `deepagents-backends` (DiTo97) on PyPI ships its own MongoDB
   and S3 backends. One clause distinguishing it is enough.

---

# 12. Build guide for Claude Code

Everything above is the *what*. This section is the *how*, and it exists because the
failure modes here are specific and expensive.

## 12.1 Prime directive: do not invent the package API

`langchain-mongodb-deepagents-vfs` is newer than any model's training data. **Read the
source before writing a line against it.** Clone or vendor
`libs/langchain-mongodb-deepagents-vfs/` from the `langchain-ai/langchain-mongodb`
monorepo into the working tree first.

Specifically, do not guess at:

- the constructor signature of `MongoFilesystemBackend`
- the shape of `GrepResult` / `GlobResult` / `LsResult` / `FileInfo` / `GrepMatch`
- the `ErrorCode` enum values
- whether `init_errors` is a list, and what `SyncReport` fields are called
- how `CompositeBackend` routes are keyed (leading slash? trailing slash?)

If a signature can't be confirmed from source, **stop and ask** rather than writing
plausible code. A wrong-but-plausible call here costs more to debug than to prevent,
because errors return as DTOs rather than raising.

## 12.2 Build order

Do not scaffold the whole repo up front. Each phase has a gate; do not pass it until the
gate is green.

**Phase 0 — Verify (write no product code)**
1. Vendor the package source. Read `backends/base.py` and the public `__init__`.
2. Confirm Atlas cluster is 8.1+ (`$rankFusion` requirement) and S3 bucket exists.
3. **Test G3** with a ten-line script: does a sub-agent spawned via `task` inherit the
   parent's backend? Write a file as the parent, read it by path from the sub-agent.
   *Gate: G3 answered. If NO, §4.3 restructures into sequential agents sharing an explicit
   backend instance — flag it and stop.*

**Phase 1 — Corpus**
4. `corpus/` populated (vendored; `tools/fetch_docket.py` already exists).
5. `00_seed_corpus.py`: upload → block on `grep("warmup")` → assert `init_errors` empty and
   `initial_sync_report.failed == 0`.
   *Gate: a `grep` for "CADR" returns hits from at least three distinct file types.*

**Phase 2 — Beat 1**
6. `02_discovery.py`, then the two control arms.
   *Gate: the three arms return measurably different results, and the difference is
   reproducible across three runs.*

**Phase 3 — Beat 2**
7. `manifest.py` first (it's the contract), then `agents.py`, then `03_pipeline.py`.
   *Gate: the memo names the 1.9 vs 1.80 discrepancy — see §12.3.*

**Phase 4 — Beat 3**
8. `--kill-after` flag, then `04_resume.py`.
   *Gate: resumed run skips completed stages and produces the same memo.*

**Phase 5 — Presentation**
9. `metrics.py` (tokens, latency, USD), then the notebook.

## 12.3 Golden answer — the acceptance test

Without this there is no way to know the demo works. Put it in
`tests/golden_answer.py` and run it against `memo.md`.

**Question:** *Did DOE adopt what the Joint Stakeholders proposed, and do the
energy-savings numbers agree?*

**MUST contain (all four — otherwise the demo has failed):**

| # | Assertion |
|---|---|
| A1 | States that DOE **did** substantially adopt the Joint Stakeholders' proposed levels |
| A2 | Names **both** figures: 1.9 quads and 1.80 quads |
| A3 | Attributes 1.9 to the Joint Stakeholders / commenters, and 1.80 to DOE's own analysis — **not reversed** |
| A4 | Cites at least two distinct source files by path |

**SHOULD contain (quality signal, not pass/fail):**

- The rounding: proposed 1.69 / 1.89 / 1.90 / 2.39 / 2.01 / 2.91 → adopted 1.7 / 1.9 /
  1.9 / 2.4 / 2.0 / 2.9
- The metric distinction: smoke CADR/W (states, ENERGY STAR) vs PM2.5 CADR/W via IEF (DOE)
- The scope floor: state standards from CADR 30; DOE Product Class 1 from 10

**MUST NOT contain (automatic fail):**

- A claim that DOE rejected or ignored the proposal
- Any energy-savings figure not present in the corpus
- The two figures attributed to the wrong parties
- A confident finding when `findings/` was empty — this is the exact bug the article opens
  on, and it must fail loudly rather than produce prose

Grade A1–A4 with substring and regex checks, not an LLM judge. The point is a
deterministic gate.

## 12.4 Sub-agent prompts

Draft these by hand; they decide whether the pipeline produces a finding or confident
mush. Shared rules for all three readers:

> You have read-only access to `corpus/`. Search it with `grep`. Read specific files with
> `read`. **Never** grep `workspace/` — it is not searchable and will return nothing.
> Every claim you write must cite the source file path and, where the tool gives you one,
> the line number. If you cannot find something, write "NOT FOUND" and say what you
> searched for. Do not infer, estimate, or fill gaps from general knowledge. You are
> reading a specific federal docket, not answering from memory.

**proposal-reader** → `workspace/<run_id>/findings/proposal.md`
> Find what the Joint Stakeholders (also called the Joint Commenters, or the consensus
> agreement) proposed. Report the specific numeric efficiency levels by product class and
> tier, and any energy-savings figure they claimed. Quote the figures exactly as written.

**adoption-reader** → `findings/adopted.md`
> Find the efficiency levels DOE actually adopted in the final rule, by product class and
> tier, plus the compliance dates. Report DOE's own energy-savings estimate. Also report
> which metric DOE adopted and whether it differs from the metric used in state standards
> or ENERGY STAR.

**numbers-reader** → `findings/numbers.md`
> Locate every energy-savings figure in the corpus, in quads. For each, record the value,
> who is asserting it, and the source file. Do not reconcile them — just inventory them.
> Check the spreadsheets as well as the rule text.

**writer** → `memo.md`
> Read `findings/proposal.md`, `findings/adopted.md`, `findings/numbers.md` by exact path.
> **If any is missing or empty, write exactly `INCOMPLETE: <which files are missing>` and
> stop.** Otherwise write a short memo answering: did DOE adopt what the Joint
> Stakeholders proposed, and do the numbers agree? Name any discrepancy explicitly and
> attribute each figure to its source. Report what the documents say — do not editorialize
> about DOE, the rulemaking, or any commenter. The finding is *these numbers differ*, not
> *someone was wrong*.

That `INCOMPLETE` rule is load-bearing. It is what turns the article's opening bug from an
anecdote into a guardrail.

## 12.5 `CLAUDE.md` — drop this in the repo root

```markdown
# Build constraints

## Architecture invariants — violating these breaks the demo's thesis
- NEVER grep, glob or ls `workspace/`. It is eventually consistent and will return
  nothing for recent writes. Coordinate by exact path with `read`.
- NEVER use `StateBackend` as the CompositeBackend default. It is in-process; the kill
  test would wipe the workspace.
- `corpus/` is read-only to agents. Enforce via backend permissions if available,
  otherwise assert it in code.

## API usage
- Every backend method returns a DTO. Check `result.error` — do NOT wrap in try/except,
  which passes silently over real failures.
- Pass `debug=True` everywhere in this demo so exceptions raise with tracebacks.
- Use the context-manager form so watchers stop cleanly.
- `outputFileType`/output paths: PNG-equivalent rule does not apply here; ignore.

## Health checks are mandatory
After the first `grep`, assert `backend.init_errors` is empty and
`initial_sync_report.failed == 0`. Three documented failure modes are SILENT:
non-Atlas MongoDB falls back to regex, an unavailable embedding API falls back to
full-text, and a partial sync looks healthy while being incomplete.

## Do not
- Do not invent the `langchain-mongodb-deepagents-vfs` API. Read the vendored source.
- Do not scaffold phases ahead of their gate (see plan §12.2).
- Do not fetch the docket at runtime. The corpus is vendored.
- Do not add a companion lab, extra CLI flags, or a web UI. Not in scope.
```

## 12.6 Definition of done, per script

| Script | Done when |
|---|---|
| `00_seed_corpus.py` | Uploads, blocks until searchable, asserts both health instruments, prints observed sync lag |
| `01_control_grep.sh` | Runs ripgrep over `corpus/`, prints hit count, exits 0 even with zero hits |
| `01b_control_storebackend.py` | Same query via `StoreBackend` + `MongoDBStore`, prints hits and tokens |
| `02_discovery.py` | Prints hits, file types, and tokens; runs 3× and reports spread |
| `03_pipeline.py` | Writes plan, manifest, three findings, memo; `--kill-after N` SIGKILLs after N stages |
| `04_resume.py` | Reads manifest, skips complete stages, finishes run, passes §12.3 |
| `metrics.py` | Reports tokens, wall-clock and USD for cold / killed / resumed |

## 12.7 Traps worth knowing before you hit them

- **The first `grep` blocks.** The constructor is non-blocking; index provisioning, initial
  sync and the watcher run in a background daemon thread, and search blocks internally
  until the first sync completes. The first call is slow. This is not a hang.
- **`?include=attachments`** is required on both regulations.gov endpoints. Omitting it
  returns metadata only and makes it look like the spreadsheets don't exist.
- **64 MiB read cap** applies to `read`, `edit`, `download_files`, initial sync and the
  watchers. Oversized objects are skipped, not fatal — counted in `SyncReport.failed`
  during initial sync, but only *logged* by the watchers.
- **Region coupling:** `aws_region` governs S3, SQS **and** Bedrock together. They cannot
  be split. If Titan v2 isn't enabled in that region, embeddings fail with an explicit
  `NoRegionError` (there is no hardcoded fallback).
- **Manifest writes:** only the coordinator writes `manifest.json`. Sub-agents write only
  their own namespaced finding file. If shared-file writes ever become necessary, `edit`
  is an ETag-verified read-modify-write, not a mutex.
