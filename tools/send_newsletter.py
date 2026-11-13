"""Weekly newsletter sender. Runs from GitHub Actions (.github/workflows/newsletter.yml).

Builds the email with tools/newsletter.py and sends it as a Brevo campaign to the
Fakes.com list. Brevo adds the one-click unsubscribe link and List-Unsubscribe header.

Environment:
  BREVO_API_KEY   (GitHub secret)
  BREVO_LIST_ID   (GitHub secret or variable): the Brevo list that sign-ups go to
  MODE            "send" (default) sends now; "draft" only creates the campaign in Brevo
"""
import datetime, json, os, sys, urllib.request, urllib.error, pathlib

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import newsletter

API = "https://api.brevo.com/v3"
SENDER = {"name": "Tom at Fakes.com", "email": "hello@fakes.com"}
FREE_DAILY_LIMIT = 300


def call(method, path, body=None):
    req = urllib.request.Request(
        API + path, method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"api-key": os.environ["BREVO_API_KEY"], "accept": "application/json", "content-type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        sys.exit(f"Brevo {method} {path} failed: {e.code} {e.read().decode(errors='replace')[:500]}")


def main():
    mode = os.environ.get("MODE", "send")
    list_id = int(os.environ["BREVO_LIST_ID"])
    today = datetime.date.today()

    # Skip a week with nothing new rather than resend old news.
    root = pathlib.Path(__file__).resolve().parent.parent
    dates = [x["date"] for f in ("alerts", "viral") for x in json.loads((root / f"data/{f}.json").read_text())]
    if mode == "send" and not any(d >= (today - datetime.timedelta(days=8)).isoformat() for d in dates):
        print("Nothing new in the last 8 days; not sending.")
        return

    info = call("GET", f"/contacts/lists/{list_id}")
    count = info.get("uniqueSubscribers", info.get("totalSubscribers", 0))
    print(f"List {list_id}: {count} subscribers")
    if count == 0 and mode == "send":
        print("No subscribers yet; not sending.")
        return
    if count > FREE_DAILY_LIMIT:
        sys.exit(f"The list has {count} subscribers, above Brevo's free limit of {FREE_DAILY_LIMIT} emails a day. "
                 "Not sending until the sender is updated to split the list across days.")

    html = newsletter.build(today=today).replace('href="UNSUBSCRIBE"', 'href="{{ unsubscribe }}"')
    camp = call("POST", "/emailCampaigns", {
        "name": f"Weekly scams & fakes {today.isoformat()}",
        "subject": f"This week's scams & fakes ({today.strftime('%b %-d')})",
        "previewText": "The scams and fakes worth knowing about this week, and what to do.",
        "sender": SENDER,
        "replyTo": SENDER["email"],
        "htmlContent": html,
        "recipients": {"listIds": [list_id]},
    })
    cid = camp["id"]
    print(f"Created campaign {cid}")
    if mode == "send":
        call("POST", f"/emailCampaigns/{cid}/sendNow")
        print("Sent.")
    else:
        print("Draft only; open it in Brevo > Campaigns to preview.")


if __name__ == "__main__":
    main()
