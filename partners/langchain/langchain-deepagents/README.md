# MongoDB Atlas VFS for LangChain Deep Agents

**Building a Multi-Agent Pipeline Where Nothing Gets Lost**

A multi-agent research pipeline that reads a real federal rulemaking docket
(DOE air-cleaner efficiency standards), finds cross-document discrepancies no
single file contains, and survives being killed mid-run.

Demonstrates [langchain-mongodb-deepagents-vfs](https://github.com/langchain-ai/langchain-mongodb) —
a MongoDB Atlas-backed virtual filesystem adapter for
[LangChain Deep Agents](https://github.com/langchain-ai/deepagents).

## What this demo shows

1. **Discovery across formats** — hybrid search (`$rankFusion`) finds the same
   concept across PDFs, XLSX spreadsheets, and DOCX uploads where `ripgrep` and
   literal-substring search cannot.

2. **Multi-agent coordination via shared workspace** — four sub-agents search a
   read-only corpus and write findings to a durable workspace. A writer reads
   those findings by exact path and produces a final memo.

3. **The kill test** — `SIGKILL` the pipeline after 2 of 4 stages. Resume with
   the same `run_id`. It picks up where it left off because the workspace survived.

## Prerequisites

**Three accounts required:**

| Service | What for | Tier |
|---------|----------|------|
| MongoDB Atlas | Chunk storage + hybrid search | M0 (dev) / M10+ (production) |
| AWS | S3 bucket + optional Bedrock embeddings | Free tier works for S3 |
| OpenAI | LLM for agents + embeddings (with `EMBEDDING_PROVIDER=openai`) | Pay-as-you-go |

> **Region gotcha:** `AWS_REGION` governs S3, SQS, **and** Bedrock together —
> they cannot be split. If using Bedrock embeddings, Titan Text Embeddings v2
> must be enabled in that region or you'll get `NoRegionError`.

## Setup

```bash
# Clone and install
cd partners/langchain/langchain-deepagents
pip install -e ".[openai,dev]"

# Configure
cp .env.example .env
# Edit .env with your credentials

# Seed the corpus into S3 + MongoDB
python scripts/00_seed_corpus.py
```

## Running the demo

### Beat 1 — Discovery across formats

```bash
# Control: ripgrep over local files
bash scripts/01_control_grep.sh

# Control: StoreBackend + MongoDBStore (literal substring only)
python scripts/01b_control_storebackend.py

# MongoFilesystemBackend — hybrid $rankFusion search
python scripts/02_discovery.py
```

### Beat 2 — Multi-agent pipeline

```bash
python scripts/03_pipeline.py --run-id aircleaners-001
```

### Beat 3 — The kill test

```bash
# Kill after 2 of 4 stages
python scripts/03_pipeline.py --run-id aircleaners-002 --kill-after 2

# Resume — reads the manifest, skips completed stages
python scripts/04_resume.py --run-id aircleaners-002
```

## Architecture

```
coordinator
├── writes  workspace/<run_id>/plan.md
├── writes  workspace/<run_id>/manifest.json       ← run receipt
├── task → proposal-reader  → findings/proposal.md
├── task → adoption-reader  → findings/adopted.md
├── task → numbers-reader   → findings/numbers.md
└── task → writer           → reads three by path → memo.md
```

**Two planes, two guarantees:**

| Plane | Path | Operations | Guarantee |
|-------|------|-----------|-----------|
| Corpus (discovery) | `corpus/` | `grep`, `glob`, `ls` | Eventually consistent |
| Workspace (coordination) | `workspace/<run_id>/` | `write`, `read`, `edit` | Read-after-write |

Agents **discover** through the corpus and **coordinate** through the workspace.

## The corpus

DOE docket EERE-2021-BT-STD-0035: Energy Conservation Standards for Air Cleaners.
Public domain. Vendored in `corpus/` — no API key needed to run the demo.

**The question:** *Did DOE adopt what the Joint Stakeholders proposed, and do the
energy-savings numbers agree?*

## Cost

Approximate cost per full pipeline run (4 stages, gpt-4o):

| Run type | Tokens | Cost |
|----------|--------|------|
| Cold | ~15K–25K | ~$0.05–0.15 |
| Resumed (after kill at stage 2) | ~8K–12K | ~$0.03–0.07 |

## License

Apache-2.0. Corpus documents are US federal government publications (public domain).
