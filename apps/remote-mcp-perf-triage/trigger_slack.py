"""Post the SAME PagerDuty incident that goes to ChatGPT into a Slack channel.

The point is the fan-out: one incident, two surfaces. It shows the agent isn't
bolted to one chat client — the same webhook event that opens a ChatGPT
conversation can just as easily land in Slack, where the on-call engineer already
lives. Pair it with trigger_chatgpt.py in the demo:

    python trigger_chatgpt.py --incident-id PY1Z69L    # opens the agent conversation
    python trigger_slack.py   --incident-id PY1Z69L    # same incident, in Slack

Passing the same --incident-id to both makes the two views obviously the same
incident on screen. Omit it and each call invents its own.

The incident payload comes from trigger_chatgpt.build_pagerduty_incident(), so
the two channels can never drift apart: same title, service, assignee, team,
escalation policy, priority. Only the rendering differs.

This is the staged part of the demo. A real deployment would have PagerDuty POST
its webhook to an adapter that fans out to both the Workspace Agents API and
Slack; this script stands in for that adapter's Slack leg. Nothing here reads the
Slack message back — it's a delivery surface, not a second trigger path.

Like the ChatGPT payload, this carries application symptoms only — no database
namespace, query shape, root cause, or index recommendation. The agent still has to
discover those itself.

Usage:
    # Add to the git-ignored .env (or export it):
    #   SLACK_WEBHOOK_URL="https://hooks.slack.com/services/XXX/YYY/ZZZ"

    python trigger_slack.py                        # post the incident
    python trigger_slack.py --dry-run              # print the payload, send nothing
    python trigger_slack.py --incident-id PY1Z69L  # match a ChatGPT trigger
    python trigger_slack.py --conversation-url https://chatgpt.com/c/...
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

try:
    from dotenv import load_dotenv
except ImportError:
    sys.exit("python-dotenv not installed. Run: pip install -r requirements.txt")

# Reuse the incident builder so Slack and ChatGPT get identical incidents.
import trigger_chatgpt

load_dotenv()

# PagerDuty's accent red for a triggered, high-urgency incident.
PAGERDUTY_ALERT_COLOR = "#CD3B48"

# Rendered as the Slack sender avatar so the message reads as "from PagerDuty".
PAGERDUTY_ICON_URL = "https://avatars.slack-edge.com/2019-11-19/822144368room_72.png"


def build_slack_payload(incident, conversation_url=None):
    """Render a PagerDuty incident resource as a Slack message.

    Mirrors the shape of PagerDuty's own Slack integration: title as the header,
    a field grid of the routing metadata, and a button through to the incident.
    """
    # created_at is ISO-8601 with microseconds; trim to whole seconds for display.
    created = (
        datetime.fromisoformat(incident["created_at"].replace("Z", "+00:00"))
        .strftime("%Y-%m-%d %H:%M:%S UTC")
    )
    service = incident["service"]["summary"]
    assignee = incident["assignees"][0]["summary"]
    team = incident["teams"][0]["summary"]
    policy = incident["escalation_policy"]["summary"]
    priority = incident["priority"]["summary"]

    blocks = [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": f"🚨 Triggered: {priority} incident",
                "emoji": True,
            },
        },
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": f"*{incident['title']}*"},
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f"*Incident*\n#{incident['number']} · {incident['id']}"},
                {"type": "mrkdwn", "text": f"*Service*\n{service}"},
                {"type": "mrkdwn", "text": f"*Assigned to*\n{assignee}"},
                {"type": "mrkdwn", "text": f"*Team*\n{team}"},
                {"type": "mrkdwn", "text": f"*Escalation policy*\n{policy}"},
                {"type": "mrkdwn", "text": f"*Urgency*\n{incident['urgency'].title()}"},
            ],
        },
        {
            "type": "context",
            "elements": [
                {"type": "mrkdwn", "text": f"Triggered {created} · status *{incident['status']}*"}
            ],
        },
    ]

    elements = [
        {
            "type": "button",
            "text": {"type": "plain_text", "text": "View in PagerDuty"},
            "url": incident["html_url"],
            "style": "danger",
        }
    ]
    # When the ChatGPT trigger has already run, link the two surfaces together so
    # the audience can see it is one incident rather than two.
    if conversation_url:
        elements.append(
            {
                "type": "button",
                "text": {"type": "plain_text", "text": "Open agent triage"},
                "url": conversation_url,
            }
        )
    blocks.append({"type": "actions", "elements": elements})

    return {
        "username": "PagerDuty",
        "icon_url": PAGERDUTY_ICON_URL,
        "attachments": [
            {
                "color": PAGERDUTY_ALERT_COLOR,
                "blocks": blocks,
                "fallback": f"[{priority}] {incident['title']} ({incident['id']})",
            }
        ],
    }


def post(webhook_url, payload):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        webhook_url, data=data, headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, resp.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Slack returned HTTP {exc.code}: {body}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Could not reach Slack: {exc.reason}") from exc


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--incident-id",
        help="PagerDuty-style incident ID. Pass the same value you gave "
             "trigger_chatgpt.py so both surfaces show one incident.",
    )
    parser.add_argument(
        "--conversation-url",
        help="ChatGPT conversation URL from trigger_chatgpt.py; adds an "
             "'Open agent triage' button linking the two surfaces.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="print the Slack payload without sending it",
    )
    args, _ = parser.parse_known_args()

    # Same defaults as the ChatGPT trigger: Leafy Electronics, Checkout API,
    # Dana Whitfield.
    incident_args = trigger_chatgpt.main_defaults()
    incident_id = args.incident_id or trigger_chatgpt.pagerduty_id()
    incident = trigger_chatgpt.build_pagerduty_incident(incident_args, incident_id)
    payload = build_slack_payload(incident, args.conversation_url)

    if args.dry_run:
        print(json.dumps(payload, indent=2))
        return 0

    webhook_url = os.environ.get("SLACK_WEBHOOK_URL")
    if not webhook_url:
        sys.exit(
            "ERROR: SLACK_WEBHOOK_URL is not set. Add it to .env (git-ignored):\n"
            '  SLACK_WEBHOOK_URL="https://hooks.slack.com/services/XXX/YYY/ZZZ"\n'
            "Create one at https://api.slack.com/apps → your app → Incoming Webhooks."
        )
    if not webhook_url.startswith("https://hooks.slack.com/services/"):
        sys.exit(
            f"ERROR: SLACK_WEBHOOK_URL does not look like an incoming webhook:\n"
            f"  {webhook_url[:40]}...\n"
            "Expected https://hooks.slack.com/services/T.../B.../..."
        )

    try:
        status, body = post(webhook_url, payload)
    except RuntimeError as exc:
        sys.exit(f"ERROR: {exc}")

    if status == 200:
        print(f"Incident {incident_id} posted to Slack.")
        return 0
    sys.exit(f"Slack returned {status}: {body}")


if __name__ == "__main__":
    raise SystemExit(main())
