"""
Post a MongoDB Atlas-styled alert to a Slack channel via an incoming webhook.

This mimics the appearance of a real Atlas "Query Targeting: Scanned Objects /
Returned" alert notification without configuring or triggering Atlas alerting.
It is a demo prop: the substance of the demo (the agent's live triage against a
real slow query + Performance Advisor) is genuine; only the alert delivery is staged.

Usage:
    export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/XXX/YYY/ZZZ"
    python post_alert.py

    # Optional overrides:
    python post_alert.py --project "Apoorva Test" --cluster "payments-prod" \
        --ratio 2847 --atlas-url "https://cloud-dev.mongodb.com/v2/<projectId>#/alerts"
"""

import argparse
import json
import os
import sys
import urllib.request
from datetime import datetime, timezone

# MongoDB leaf logo (used as the Slack sender icon so the message reads as "from Atlas")
MONGODB_ICON_URL = "https://www.mongodb.com/assets/images/global/favicon.ico"

# Atlas alert accent color for a triggered alert (Atlas uses a red/amber bar)
ATLAS_ALERT_COLOR = "#B71C1C"


def build_payload(project, cluster, ratio, threshold, atlas_url):
    """Construct a Slack message that mirrors an Atlas Query Targeting alert."""
    fired_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    # Block Kit body rendered inside a colored attachment so we get the accent bar.
    blocks = [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": "🔴 Alert: Query Targeting",
                "emoji": True,
            },
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": (
                    "*Query Targeting: Scanned Objects / Returned has gone above "
                    f"{threshold}*\n"
                    "Queries are scanning far more documents than they return, "
                    "indicating a missing or ineffective index."
                ),
            },
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f"*Project*\n{project}"},
                {"type": "mrkdwn", "text": f"*Cluster*\n{cluster}"},
                {"type": "mrkdwn", "text": f"*Metric*\nScanned / Returned"},
                {"type": "mrkdwn", "text": f"*Current Value*\n{ratio:,} : 1"},
                {"type": "mrkdwn", "text": f"*Condition*\n> {threshold} : 1"},
                {"type": "mrkdwn", "text": f"*Fired At*\n{fired_at}"},
            ],
        },
        {
            "type": "actions",
            "elements": [
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "View Alert in Atlas"},
                    "url": atlas_url,
                    "style": "danger",
                }
            ],
        },
    ]

    return {
        "username": "MongoDB Atlas",
        "icon_url": MONGODB_ICON_URL,
        "attachments": [
            {
                "color": ATLAS_ALERT_COLOR,
                "blocks": blocks,
                "fallback": (
                    f"[{project}/{cluster}] Query Targeting: Scanned Objects / "
                    f"Returned has gone above {threshold} (current {ratio}:1)"
                ),
            }
        ],
    }


def post(webhook_url, payload):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        webhook_url, data=data, headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        return resp.status, resp.read().decode("utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", default="Apoorva Test", help="Atlas project name")
    parser.add_argument(
        "--cluster", default="payments-prod", help="Atlas cluster name shown in alert"
    )
    parser.add_argument(
        "--ratio",
        type=int,
        default=2847,
        help="Current scanned:returned ratio to display",
    )
    parser.add_argument(
        "--threshold",
        type=int,
        default=1000,
        help="Alert threshold (scanned:returned) to display",
    )
    parser.add_argument(
        "--atlas-url",
        default="https://cloud-dev.mongodb.com/v2#/alerts",
        help="URL the 'View Alert in Atlas' button links to",
    )
    args = parser.parse_args()

    webhook_url = os.environ.get("SLACK_WEBHOOK_URL")
    if not webhook_url:
        sys.exit(
            "ERROR: set SLACK_WEBHOOK_URL, e.g.\n"
            '  export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/XXX/YYY/ZZZ"'
        )

    payload = build_payload(
        args.project, args.cluster, args.ratio, args.threshold, args.atlas_url
    )
    status, body = post(webhook_url, payload)
    if status == 200:
        print("Alert posted to Slack.")
    else:
        sys.exit(f"Slack returned {status}: {body}")


if __name__ == "__main__":
    main()
