"""Send a simulated PagerDuty incident to a ChatGPT Workspace Agent.

The input mirrors a PagerDuty incident resource created from a Datadog monitor. It
includes only application symptoms, never the database namespace, query shape,
root cause, or remediation.

Usage:
    export AGENT_ACCESS_TOKEN="..."
    export WORKSPACE_AGENT_TRIGGER_ID="agtch_..."
    python trigger_chatgpt.py
"""

import argparse
import hashlib
import json
import os
import secrets
import string
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

try:
    from dotenv import load_dotenv
except ImportError:
    sys.exit("python-dotenv not installed. Run: pip install -r requirements.txt")

load_dotenv()

API_ROOT = "https://api.chatgpt.com/v1/workspace_agents"
BETA_HEADER = "workspace_agent_runs=v1"
WAIT_STOP_STATUSES = {"completed", "failed", "suspended"}

# The trigger POST has been measured at ~5.5 s, but tail latency is much worse: a
# live run once died on a 30 s read timeout, then succeeded three times in a row.
# Generous timeout + retries, because failing this call on stage is the one error
# the audience actually sees.
REQUEST_TIMEOUT_S = 90
MAX_ATTEMPTS = 3
RETRY_BACKOFF_S = 2.0

# Retrying a POST is only safe because we always send Idempotency-Key: the server
# dedupes, so a retry after a timeout resumes the original request rather than
# creating a second conversation. Never retry a mutating call without that key.
RETRY_STATUS = {408, 429, 500, 502, 503, 504}


def request_json(url, token, method="GET", payload=None, idempotency_key=None):
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "OpenAI-Beta": BETA_HEADER,
    }
    if idempotency_key:
        headers["Idempotency-Key"] = idempotency_key

    request = urllib.request.Request(
        url,
        data=data,
        headers=headers,
        method=method,
    )

    last_error = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_S) as response:
                body = response.read().decode("utf-8")
                return response.status, json.loads(body)
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            # 4xx other than 408/429 is our bug (bad token, bad trigger id) —
            # retrying just delays the error message.
            if exc.code not in RETRY_STATUS:
                raise RuntimeError(
                    f"ChatGPT API returned HTTP {exc.code}: {body}"
                ) from exc
            last_error = RuntimeError(f"ChatGPT API returned HTTP {exc.code}: {body}")
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            reason = getattr(exc, "reason", exc)
            last_error = RuntimeError(f"Could not reach the ChatGPT API: {reason}")

        if attempt < MAX_ATTEMPTS:
            delay = RETRY_BACKOFF_S * attempt
            print(
                f"  request failed ({last_error}); retrying in {delay:.0f}s "
                f"[attempt {attempt + 1}/{MAX_ATTEMPTS}]",
                file=sys.stderr,
                flush=True,
            )
            time.sleep(delay)

    raise last_error


def pagerduty_id(prefix="P", length=7):
    alphabet = string.ascii_uppercase + string.digits
    return prefix + "".join(secrets.choice(alphabet) for _ in range(length - 1))


def build_pagerduty_incident(args, incident_id):
    created_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    account_url = f"https://{args.account_subdomain}.pagerduty.com"

    return {
        "id": incident_id,
        "type": "incident",
        "self": f"https://api.pagerduty.com/incidents/{incident_id}",
        "html_url": f"{account_url}/incidents/{incident_id}",
        "number": args.incident_number,
        "status": "triggered",
        "incident_key": hashlib.sha256(incident_id.encode("utf-8")).hexdigest()[:32],
        "created_at": created_at,
        "reopened_at": None,
        "title": (
            f"[Datadog] {args.service} payment confirmation timeout rate is "
            f"{args.timeout_rate:g}% in {args.environment}/{args.region}"
        ),
        "incident_type": {"name": "major"},
        "service": {
            "html_url": f"{account_url}/services/{args.service_id}",
            "id": args.service_id,
            "self": f"https://api.pagerduty.com/services/{args.service_id}",
            "summary": args.service,
            "type": "service_reference",
        },
        "assignees": [
            {
                "html_url": f"{account_url}/users/{args.assignee_id}",
                "id": args.assignee_id,
                "self": f"https://api.pagerduty.com/users/{args.assignee_id}",
                "summary": args.assignee,
                "type": "user_reference",
            }
        ],
        "escalation_policy": {
            "html_url": f"{account_url}/escalation_policies/{args.policy_id}",
            "id": args.policy_id,
            "self": f"https://api.pagerduty.com/escalation_policies/{args.policy_id}",
            "summary": args.escalation_policy,
            "type": "escalation_policy_reference",
        },
        "teams": [
            {
                "html_url": f"{account_url}/teams/{args.team_id}",
                "id": args.team_id,
                "self": f"https://api.pagerduty.com/teams/{args.team_id}",
                "summary": args.team,
                "type": "team_reference",
            }
        ],
        "priority": {
            "html_url": f"{account_url}/account/incident_priorities",
            "id": args.priority_id,
            "self": f"https://api.pagerduty.com/priorities/{args.priority_id}",
            "summary": "P2",
            "type": "priority_reference",
        },
        "urgency": "high",
        "conference_bridge": None,
        "resolve_reason": None,
    }


def build_trigger_payload(incident, conversation_key):
    return {
        "conversation_key": conversation_key,
        "input": "PagerDuty incident:\n```json\n"
        + json.dumps(incident, indent=2)
        + "\n```",
    }


def trigger_agent(trigger_id, token, incident, conversation_key, event_id):
    payload = build_trigger_payload(incident, conversation_key)
    url = f"{API_ROOT}/{trigger_id}/trigger"
    status, response = request_json(
        url,
        token,
        method="POST",
        payload=payload,
        idempotency_key=event_id,
    )
    if status != 202:
        raise RuntimeError(f"Expected HTTP 202, received {status}: {response}")
    return response


def wait_for_run(trigger_id, run_id, token, poll_interval, timeout):
    url = f"{API_ROOT}/{trigger_id}/runs/{run_id}"
    deadline = time.monotonic() + timeout
    last_status = None

    while time.monotonic() < deadline:
        _, run = request_json(url, token)
        status = run.get("status", "unknown")
        if status != last_status:
            print(f"Agent run: {status}")
            last_status = status
        if status in WAIT_STOP_STATUSES:
            return run
        time.sleep(poll_interval)

    raise RuntimeError(f"Agent run did not settle within {timeout:.0f} seconds")


def build_parser():
    parser = argparse.ArgumentParser(description=__doc__)
    # Leafy Electronics is an invented company (MongoDB's leaf, and a sibling to the
    # Leafy Roasters demo), so a public repo never puts a real organization's name on
    # a fabricated incident.
    parser.add_argument("--account-subdomain", default="leafyelectronics")
    parser.add_argument("--service", default="Checkout API")
    parser.add_argument("--service-id", default="PF9KMXH")
    parser.add_argument("--environment", default="production")
    parser.add_argument("--region", default="us-west-1")
    parser.add_argument("--timeout-rate", type=float, default=18.6)
    parser.add_argument("--assignee", default="Dana Whitfield")
    parser.add_argument("--team", default="Payments Platform")
    parser.add_argument(
        "--escalation-policy",
        default="Checkout — Production",
        help="PagerDuty escalation policy name shown on the incident",
    )
    parser.add_argument("--assignee-id", default="PTUXL6G")
    parser.add_argument("--policy-id", default="PUS0KTE")
    parser.add_argument("--team-id", default="PFCVPS0")
    parser.add_argument("--priority-id", default="PSO75BM")
    parser.add_argument("--incident-number", type=int, default=4821)
    parser.add_argument(
        "--incident-id",
        help="PagerDuty-style P... ID; shared by all events for one incident",
    )
    parser.add_argument(
        "--event-id",
        help="unique webhook event ID; reuse only when retrying the same event",
    )
    parser.add_argument(
        "--wait",
        action="store_true",
        help="poll until the run completes, fails, or is suspended for human action",
    )
    parser.add_argument("--poll-interval", type=float, default=2.0)
    parser.add_argument("--timeout", type=float, default=180.0)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="print the Workspace Agents API request without sending it",
    )
    return parser


def main_defaults():
    """The incident defaults as a namespace, with no CLI parsing.

    Lets checkout_app.py build the exact same PagerDuty resource this CLI sends,
    so the two entry points can never drift apart.
    """
    return build_parser().parse_args([])


def main():
    parser = build_parser()
    args = parser.parse_args()

    incident_id = args.incident_id or pagerduty_id()
    event_id = args.event_id or secrets.token_hex(16)
    conversation_key = f"pagerduty-{incident_id}"
    incident = build_pagerduty_incident(args, incident_id)

    if args.dry_run:
        preview = {
            "method": "POST",
            "url": f"{API_ROOT}/agtch_.../trigger",
            "headers": {
                "Authorization": "Bearer <redacted>",
                "Content-Type": "application/json",
                "OpenAI-Beta": BETA_HEADER,
                "Idempotency-Key": event_id,
            },
            "body": build_trigger_payload(incident, conversation_key),
        }
        print(json.dumps(preview, indent=2))
        return 0

    token = os.environ.get("AGENT_ACCESS_TOKEN")
    trigger_id = os.environ.get("WORKSPACE_AGENT_TRIGGER_ID")
    if not token:
        sys.exit("ERROR: set AGENT_ACCESS_TOKEN")
    if not trigger_id:
        sys.exit(
            "ERROR: set WORKSPACE_AGENT_TRIGGER_ID to the agtch_... API channel ID"
        )
    if not trigger_id.startswith("agtch_"):
        sys.exit("ERROR: WORKSPACE_AGENT_TRIGGER_ID must begin with agtch_")

    try:
        response = trigger_agent(
            trigger_id,
            token,
            incident,
            conversation_key,
            event_id,
        )
        print(f"PagerDuty incident: {incident_id}")
        print(f"Webhook event: {event_id}")
        print(f"Conversation: {response['conversation_url']}")

        run_id = response.get("agent_trigger_run_id")
        if run_id:
            print(f"Run ID: {run_id}")
        if args.wait and run_id:
            run = wait_for_run(
                trigger_id,
                run_id,
                token,
                args.poll_interval,
                args.timeout,
            )
            if run.get("error"):
                print(f"Run error: {json.dumps(run['error'])}")
            return 1 if run.get("status") == "failed" else 0
        return 0
    except (RuntimeError, KeyError) as exc:
        sys.exit(f"ERROR: {exc}")


if __name__ == "__main__":
    raise SystemExit(main())
