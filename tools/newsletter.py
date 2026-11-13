"""Build the weekly Fakes.com email (one page, email-safe HTML) from data/alerts.json and data/viral.json.

Usage: python3 tools/newsletter.py [--alerts id1,id2,id3] [--viral id1,id2] [--out path]
Without ids it takes the newest 3 alerts and the 2 newest non-political viral fakes.
UNSUBSCRIBE is replaced by the sending service's unsubscribe link.
"""
import argparse, html, json, datetime, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = "https://fakes.com"
ADDRESS = "FAKES.COM · PO Box 8922 · Calabasas, CA 91372-8922"
e = lambda s: html.escape(str(s), quote=True)
NAVY, INK, INK2, RED, GREEN, PAPER, RULE = "#12365e", "#0f1d30", "#4a5c72", "#b8381c", "#1d6a57", "#f4f8fc", "#c2d4e8"
FONT = "font-family:Arial,Helvetica,sans-serif;"
SERIF = "font-family:Georgia,'Times New Roman',serif;"

def nice_date(d): return datetime.date.fromisoformat(d).strftime("%b %-d")

def alert_block(a):
    return f"""<tr><td style="padding:0 0 18px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid {RULE};border-top:4px solid #1f63a8">
<tr><td style="padding:18px 20px">
<div style="{FONT}font-size:11px;letter-spacing:1px;text-transform:uppercase;color:{RED};font-weight:bold">{e(' · '.join(a['channels'][:2]))} &nbsp;<span style="color:{INK2}">{nice_date(a['date'])}</span></div>
<div style="{FONT}font-size:19px;line-height:1.25;font-weight:bold;color:{INK};margin:6px 0 8px">{e(a['title'])}</div>
<div style="{SERIF}font-size:15px;line-height:1.55;color:{INK}">{e(a['summary'])}</div>
<div style="{SERIF}font-size:15px;line-height:1.5;color:{INK};background:#dcefe7;border-left:3px solid {GREEN};padding:10px 12px;margin-top:10px"><b style="{FONT}color:{GREEN}">What to do:</b> {e(a['what_to_do'])}</div>
<div style="{FONT}font-size:12px;color:{INK2};margin-top:8px">Source: <a href="{e(a['sources'][0]['url'])}" style="color:{INK2}">{e(a['sources'][0]['name'])}</a></div>
</td></tr></table></td></tr>"""

def viral_block(v):
    color = {"Fake": RED, "Misleading": "#9a5b00", "Real": GREEN}.get(v["verdict"], RED)
    return f"""<tr><td style="padding:0 0 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid {RULE}">
<tr><td style="padding:16px 20px">
<span style="{FONT}display:inline-block;font-size:13px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:{color};border:2px solid {color};padding:2px 8px">{e(v['verdict'])}</span>
<span style="{FONT}font-size:11px;letter-spacing:1px;text-transform:uppercase;color:{INK2};margin-left:8px">{e(v['kind'])}</span>
<div style="{FONT}font-size:17px;font-weight:bold;color:{INK};margin:8px 0 6px">{e(v['title'])}</div>
<div style="{SERIF}font-size:15px;line-height:1.55;color:{INK}">{e(v['summary'])} <b style="{FONT}color:{GREEN}">The clue:</b> {e(v['tell'])}</div>
<div style="{FONT}font-size:13px;margin-top:8px"><a href="{e(v['sources'][0]['url'])}" style="color:#1f63a8;font-weight:bold;text-decoration:none">See it at {e(v['sources'][0]['name'].split(' (')[0])} &rarr;</a></div>
</td></tr></table></td></tr>"""

def build(alert_ids=None, viral_ids=None, today=None):
    alerts = sorted(json.loads((ROOT / "data/alerts.json").read_text()), key=lambda a: a["date"], reverse=True)
    viral = sorted(json.loads((ROOT / "data/viral.json").read_text()), key=lambda a: a["date"], reverse=True)
    pick_a = [a for i in alert_ids for a in alerts if a["id"] == i] if alert_ids else alerts[:3]
    pick_v = [v for i in viral_ids for v in viral if v["id"] == i] if viral_ids else [v for v in viral if not v.get("political")][:2]
    also = [a for a in alerts if a not in pick_a][:3]
    today = today or datetime.date.today()
    also_html = "".join(f'<li style="margin:0 0 6px"><a href="{SITE}/alerts#{e(a["id"])}" style="color:{INK}">{e(a["title"])}</a></li>' for a in also)
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>This week's scams and fakes</title></head>
<body style="margin:0;padding:0;background:{PAPER}">
<div style="display:none;max-height:0;overflow:hidden">The scams and fakes worth knowing about this week, and what to do.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{PAPER}"><tr><td align="center" style="padding:20px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px">
<tr><td style="background:{NAVY};padding:22px 24px">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
  <td style="padding-right:10px"><img src="{SITE}/apple-touch-icon.png" width="40" height="40" alt="" style="display:block;border-radius:8px"></td>
  <td><div style="{FONT}font-size:24px;font-weight:900;letter-spacing:.5px;color:#ffffff">FAKES<span style="color:#ff8a66">.</span>COM</div>
  <div style="{FONT}font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#bcd2e8">Look closer. Stay safe.</div></td></tr></table>
  <div style="{FONT}font-size:26px;line-height:1.2;font-weight:bold;color:#ffffff;margin-top:18px">This week's scams &amp; fakes</div>
  <div style="{FONT}font-size:13px;color:#cfe0f2;margin-top:6px">{today.strftime('%B %-d, %Y')} · A 2-minute read</div>
</td></tr>
<tr><td style="padding:22px 4px 6px">
  <div style="{SERIF}font-size:16px;line-height:1.55;color:{INK}">Hi there. Here are the scams police and government agencies warned about this week, plus the fake photos and videos making the rounds. Each one comes with what to do. <span style="color:{INK2}">— Tom</span></div>
</td></tr>
<tr><td style="padding:14px 0 10px"><div style="{FONT}font-size:13px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:{RED}">Top scam alerts</div></td></tr>
{''.join(alert_block(a) for a in pick_a)}
<tr><td style="padding:6px 0 10px"><div style="{FONT}font-size:13px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:{RED}">Fake photos &amp; videos going around</div></td></tr>
{''.join(viral_block(v) for v in pick_v)}
<tr><td style="padding:8px 0 4px">
  <div style="{FONT}font-size:13px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:{INK2}">Also this week</div>
  <ul style="{SERIF}font-size:15px;line-height:1.5;padding-left:20px;margin:8px 0 0">{also_html}</ul>
</td></tr>
<tr><td align="center" style="padding:22px 0 26px">
  <a href="{SITE}/check" style="{FONT}display:inline-block;background:#1f63a8;color:#ffffff;font-weight:bold;font-size:16px;text-decoration:none;padding:14px 26px">Got something suspicious? Check it free &rarr;</a>
</td></tr>
<tr><td style="border-top:1px solid {RULE};padding:18px 4px 30px">
  <div style="{FONT}font-size:12px;line-height:1.6;color:{INK2}">You're getting this because you signed up at fakes.com. Every alert links to its original source. Fakes.com will never ask for your passwords, card numbers or payment.<br><br>
  <a href="UNSUBSCRIBE" style="color:{INK2}">Unsubscribe with one click</a> · <a href="{SITE}" style="color:{INK2}">fakes.com</a><br>{e(ADDRESS)}</div>
</td></tr>
</table></td></tr></table></body></html>"""

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--alerts"); ap.add_argument("--viral"); ap.add_argument("--out")
    a = ap.parse_args()
    out = build(a.alerts.split(",") if a.alerts else None, a.viral.split(",") if a.viral else None)
    if a.out: pathlib.Path(a.out).write_text(out)
    else: print(out)
