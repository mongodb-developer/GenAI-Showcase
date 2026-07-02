# AGENTS.md

Guidance for coding assistants working in this repository.

## Project Structure

- notebooks/: Jupyter notebook examples (agents, rag, evals)
- apps/: application-style demos
- workshops/: self-paced workshop content
- partners/: partner-contributed examples
- .github/workflows/tests.yml: CI checks via pre-commit

## Build and Test Commands

Repository-level checks:

```bash
python -m pip install pre-commit
pre-commit run --all-files
```

Notebook workflow (typical):

```bash
python -m venv .venv
source .venv/bin/activate
pip install -U notebook
jupyter notebook
```

## Environment Variables and Configuration

Common variables used in notebooks:
- MONGODB_URI (or equivalent MongoDB Atlas URI variable)
- Provider keys as required by notebook (for example OPENAI_API_KEY, ANTHROPIC_API_KEY)

Always read notebook setup cells before running and export required variables in your shell/kernel.

## MongoDB Skills

Use the official MongoDB agent skills from https://github.com/mongodb/agent-skills whenever the task is MongoDB-specific and a matching skill exists.

## When To Use EDD.md

Use EDD.md as a schema source of truth when a notebook/app evolves into a larger multi-file project with stable entities and indexes.

For small, self-contained notebook examples, EDD.md is optional.

## appName Guidance

When updating MongoDB client initialization, keep or add appName for observability.
Accepted project formats include both:
- hyphen style: devrel-medium-primary-secondary-optional
- dot style: devrel.showcase.notebook.agent.example
