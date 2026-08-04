#!/usr/bin/env bash
#
# Reseed, then run the app on :8008. Ctrl+C stops it.
#
#   ./setup_demo.sh
#
# Reseeding every run is required: approving the order writes a purchase_orders doc for
# the shared component, and the next sweep skips the alert because an order is already
# inbound. Pressing "Run sweep" in the UI does not reseed.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

PY=${PY:-.venv/bin/python}
[[ -x "$PY" ]] || PY=python3

[[ -n "${1:-}" ]] && { echo "ERROR: unknown option '$1' (takes none)" >&2; exit 1; }

echo "==> Reseeding the demo database"
"$PY" seed_demo.py --reset

echo "==> App: http://localhost:8008/  (wait for '[mcp] connected'; Ctrl+C to stop)"
exec "$PY" -m uvicorn app.main:app --port 8008
