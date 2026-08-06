#!/usr/bin/env bash
#
# Reset, then run the checkout page on :8000. Ctrl+C stops it.
#
#   ./setup_demo.sh          # drop the index, keep the 300k docs (usual case)
#   ./setup_demo.sh --drop   # full reseed: fresh 300k, several minutes
#
# Dropping the index the agent created is what restores the slow COLLSCAN. The documents
# stay because nothing in the demo mutates them.
#
# The Advisor trickle is separate: ./trickle.sh start, well before showtime.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

PY=${PY:-.venv/bin/python}
[[ -x "$PY" ]] || PY=python3

# Sized so the collection stays ~2x the WiredTiger cache, which is what keeps scans
# disk-bound and therefore slow. Correct for a 2 GB host (~537 MB cache); override on
# a roomier cluster or checkout will silently SUCCEED. See the README sizing table.
BLOB_BYTES=${BLOB_BYTES:-3149}

case "${1:-}" in
  "")     echo "==> Dropping the demo index (restores the slow COLLSCAN)"
          "$PY" seed_payments.py --drop-index ;;
  --drop) echo "==> Full reseed at --blob-bytes $BLOB_BYTES — several minutes"
          "$PY" seed_payments.py --drop --blob-bytes "$BLOB_BYTES"
          echo "!   Cache is cold and the Advisor recommendation reset; allow ~15-30 min of trickle" ;;
  *)      echo "ERROR: unknown option '$1' (only --drop)" >&2; exit 1 ;;
esac

pgrep -f 'generate_load\.py' >/dev/null \
  || echo "!   Advisor trickle NOT running — ./trickle.sh start (allow ~15-30 min)"

echo "==> Checkout page: http://127.0.0.1:8000  (Ctrl+C to stop)"
exec "$PY" checkout_app.py
