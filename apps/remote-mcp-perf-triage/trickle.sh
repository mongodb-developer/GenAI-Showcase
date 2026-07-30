#!/usr/bin/env bash
#
# The Performance Advisor trickle — generate_load.py, backgrounded.
#
#   ./trickle.sh start   # kills any existing trickle, then starts one fresh
#   ./trickle.sh stop
#   ./trickle.sh status
#
# Separate from setup because it runs on a different clock: the Advisor takes ~15-30 min
# to first surface its recommendation, and only holds it while slow queries keep recurring
# AND the index is still absent. Start it well before showtime and leave it up across demo
# runs. Stop it at end of day.
#
# Watch it with: tail -f load.log
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

PY=${PY:-.venv/bin/python}
[[ -x "$PY" ]] || PY=python3

# pgrep exits 1 with no matches, which would abort the script under `set -e`.
pids() { pgrep -f 'generate_load\.py' | tr '\n' ' ' || true; }

kill_all() {
  local p
  p=$(pids)
  [[ -z "$p" ]] && return 0
  echo "Killing existing trickle: $p"
  kill $p 2>/dev/null || true
  sleep 2
  p=$(pids)
  [[ -n "$p" ]] && kill -9 $p 2>/dev/null || true
  return 0
}

case "${1:-}" in
  start)
    kill_all
    nohup "$PY" generate_load.py >>load.log 2>&1 &
    pid=$!
    sleep 2
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "ERROR: exited immediately — last lines of load.log:" >&2
      tail -5 load.log >&2
      exit 1
    fi
    echo "Started (pid $pid). Allow ~15-30 min, then confirm with"
    echo "atlas-get-performance-advisor: expect { session_id: 1, status: 1 } on ecommerce.payments"
    ;;
  stop)
    [[ -z "$(pids)" ]] && { echo "Not running"; exit 0; }
    kill_all
    echo "Stopped"
    ;;
  status)
    p=$(pids)
    if [[ -z "$p" ]]; then
      echo "NOT running — the Advisor recommendation will go stale. ./trickle.sh start"
      exit 1
    fi
    # Uptime is the thing that matters: the Advisor cares how long this has been
    # running, not that it is alive this second.
    ps -o pid=,lstart=,args= -p $p | sed 's/^ *//'
    # Plain `if`, not a trailing `&&` — as the last command in this branch a false test
    # would become the exit status and report a healthy trickle as a failure.
    if [[ -f load.log ]]; then
      tail -3 load.log | sed 's/^/  /'
    fi
    ;;
  *)
    echo "Usage: ./trickle.sh {start|stop|status}" >&2
    exit 1
    ;;
esac
