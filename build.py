#!/usr/bin/env python3
"""Builds the static FAKES.COM site from data/ and content/ into HTML files at the repo root.

Run:  python3 build.py
Daily updates only need to edit data/alerts.json and re-run this script.
"""
import html, json, re, datetime, pathlib

ROOT = pathlib.Path(__file__).resolve().parent
SITE = "https://fakes.com"
PREVIEW = True  # True = search engines told not to index + preview banner. Set False at launch.

NAV = [("/check", "Check It"), ("/alerts", "Scam Alerts"), ("/guides/", "Guides"), ("/spot-the-fake", "Spot the Fake"), ("/about", "About")]
FONTS = ("https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900"
         "&family=IBM+Plex+Mono:wght@400;500;600&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap")

e = html.escape

def fmt_date(iso):
    d = datetime.date.fromisoformat(iso)
    return d.strftime("%b %-d, %Y")

def short_date(iso):
    d = datetime.date.fromisoformat(iso)
    return d.strftime("%b %-d")

def load_partial(path):
    text = path.read_text()
    m = re.match(r"\s*<!--(.*?)-->", text, re.S)
    meta = {}
    if m:
        for line in m.group(1).strip().splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                meta[k.strip()] = v.strip()
        text = text[m.end():]
    return meta, text.strip()

def layout(title, description, path, body, active=None, extra_head=""):
    nav = "".join(
        f'<a href="{href}"{" aria-current=\"page\"" if active == href else ""}>{label}</a>' for href, label in NAV)
    robots = '<meta name="robots" content="noindex">' if PREVIEW else ""
    banner = ('<div class="notice"><div class="wrap">PREVIEW · Fakes.com is being built. '
              'Content is real and sourced, but the site is not finished.</div></div>') if PREVIEW else ""
    full_title = title if title.startswith("Fakes.com") else f"{title} | Fakes.com"
    year = datetime.date.today().year
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{e(full_title)}</title>
<meta name="description" content="{e(description)}">
{robots}
<link rel="canonical" href="{SITE}{path}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Fakes.com">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(description)}">
<meta property="og:url" content="{SITE}{path}">
<meta property="og:image" content="{SITE}/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#12365e">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{FONTS}">
<link rel="stylesheet" href="/assets/site.css">
{extra_head}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
{banner}
<header class="top"><div class="wrap">
  <a class="logo" href="/">FAKES<span>.</span>COM</a>
  <nav class="main" aria-label="Main">{nav}</nav>
</div></header>
<main id="main">
{body}
</main>
<footer class="site"><div class="wrap">
  <div><h4>Fakes.com</h4><p>Plain-English warnings about scams, deepfakes and counterfeits, from IT consultant Tom Shubert. Every fact links to its source.</p></div>
  <div><h4>Site</h4><ul>
    <li><a href="/check">Check It</a></li><li><a href="/alerts">Scam Alerts</a></li><li><a href="/guides/">Guides</a></li>
    <li><a href="/spot-the-fake">Spot the Fake</a></li><li><a href="/about">About</a></li><li><a href="/contact">Contact</a></li></ul></div>
  <div><h4>Been scammed?</h4><p>Report it at <a href="https://reportfraud.ftc.gov/">ReportFraud.ftc.gov</a> and <a href="https://www.ic3.gov/">IC3.gov</a>. If you sent money, call your bank right away.</p>
    <ul><li><a href="/standards">Sources &amp; corrections</a></li><li><a href="/privacy">Privacy</a></li><li><a href="/disclosure">Advertising disclosure</a></li></ul></div>
  <div class="fine">© {year} Fakes.com · Fakes.com never sells or links to counterfeit goods.</div>
</div></footer>
</body>
</html>
"""

def alert_card(a, heading="h3"):
    chips = "".join(f'<span class="chip">{e(c)}</span>' for c in a["channels"][:2])
    srcs = " · ".join(f'<a href="{e(s["url"])}">{e(s["name"])}</a>' for s in a["sources"])
    return f"""<article class="alert" id="{e(a['id'])}">
  <div class="tags">{chips}<span class="chip neutral">{short_date(a['date'])}</span></div>
  <{heading}>{e(a['title'])}</{heading}>
  <p>{e(a['summary'])}</p>
  <div class="do"><b>What to do:</b> {e(a['what_to_do'])}</div>
  <div class="src-line">Source: {srcs}</div>
</article>"""

GAME_BLOCK = """<section class="game" id="game"><div class="wrap">
  <div>
    <div class="label">Daily game</div>
    <h2 style="margin-top:10px">Spot the Fake</h2>
    <p>Three messages a day. Real or fake? Each answer explains the clue, so you get faster at catching the next one.</p>
    <p class="label" style="margin-top:18px">Practice messages written by Fakes.com</p>
  </div>
  <div class="q" aria-live="polite">
    <div class="label" id="qnum">Message 1 of 3</div>
    <div class="msg" id="qmsg">Loading…</div>
    <div class="choices">
      <button type="button" class="r" id="btn-real">REAL</button>
      <button type="button" class="f" id="btn-fake">FAKE</button>
    </div>
    <div class="result" id="qres" hidden></div>
    <div class="qfoot"><span class="score" id="score">Score: 0 / 0</span>
      <button type="button" class="btn ghost" id="next" hidden>Next message</button></div>
  </div>
</div></section>"""

def game_scripts(pool):
    data = json.dumps(pool).replace("</", "<\\/")
    return f'<script>window.FAKES_GAME={data};</script><script src="/assets/game.js" defer></script>'

FIGURES = [
    ("$15.9B", "reported lost to fraud in 2025, up from over $12B in 2024",
     "FTC, Mar 2026", "https://www.ftc.gov/news-events/news/press-releases/2026/03/ftc-testifies-joint-economic-committee-agencys-efforts-combat-fraud"),
    ("$20.9B", "in internet crime losses reported to the FBI in 2025, from just over 1 million complaints",
     "FBI IC3 2025 report", "https://www.ic3.gov/AnnualReport/Reports/2025_IC3Report.pdf"),
    ("$893M", "in losses from complaints involving AI, such as voice cloning and deepfakes",
     "FBI IC3 2025 report, p. 39", "https://www.ic3.gov/AnnualReport/Reports/2025_IC3Report.pdf"),
    ("5×", "increase in fraud losses reported by people 60+, from about $600M in 2020 to about $3B in 2025",
     "FTC, Oct 2026", "https://www.ftc.gov/news-events/news/press-releases/2026/10/ftc-issues-annual-report-congress-agencys-actions-protect-older-adults"),
]

def figures_html():
    cells = "".join(
        f'<div class="fig"><div class="n">{n}</div><p>{e(t)}</p><div class="src"><a href="{u}">{e(s)}</a></div></div>'
        for n, t, s, u in FIGURES)
    return f'<section class="figures" aria-label="Fraud by the numbers"><div class="wrap">{cells}</div></section>'

def guide_cards(guides):
    return "".join(
        f'<a class="gcard" href="/guides/{slug}"><div class="label">{e(m["label"])}</div>'
        f'<h3>{e(m["title"])}</h3><p>{e(m["description"])}</p><span class="more">Read the guide →</span></a>'
        for slug, m, _ in guides)

def main():
    alerts = sorted(json.loads((ROOT / "data/alerts.json").read_text()), key=lambda a: a["date"], reverse=True)
    pool = json.loads((ROOT / "data/game.json").read_text())
    guides = []
    for p in sorted((ROOT / "content/guides").glob("*.html")):
        meta, body = load_partial(p)
        guides.append((p.stem, meta, body))
    order = ["voice-clone-scams", "fake-online-stores", "counterfeit-products"]
    guides.sort(key=lambda g: order.index(g[0]) if g[0] in order else 99)
    newest = alerts[0]["date"] if alerts else datetime.date.today().isoformat()
    out = {}

    # Home
    home = f"""<section class="hero"><div class="wrap">
  <div>
    <div class="label">Scams · Deepfakes · Counterfeits</div>
    <h1>Check if it's <em>fake</em> before you click, pay or believe it.</h1>
    <p class="lede">Plain-English warnings about the scams going around right now, how to spot AI-made voices and videos, and how to tell real products from knockoffs. Every fact links to its source.</p>
    <div class="byline">By <b>Tom Shubert</b> · IT consultant to small businesses and individuals</div>
    <div class="cta"><a class="btn" href="/check">Check a message now</a><a class="btn ghost" href="/alerts">See this week's scams</a></div>
  </div>
  <div class="stamp-card" aria-label="Example of a fake text message">
    <div class="head"><span class="label">Example text message</span><span class="stamp">FAKE</span></div>
    <div class="sample">E-ZPass: You have an unpaid toll balance of $6.99. Pay within 24 hrs to avoid a $50 late fee: ezpass-tolls.example/pay</div>
    <p class="why">How you can tell:</p>
    <ul><li>A short deadline meant to rush you</li><li>A link that isn't your toll agency's real website</li><li>Maine's toll agency, for one, says it doesn't collect tolls by text</li></ul>
    <p class="fine">Sample written by Fakes.com. The web address is deliberately fake.</p>
  </div>
</div></section>
{figures_html()}
<section class="block"><div class="wrap">
  <div class="sec-head"><h2>Scam Alerts</h2><a href="/alerts">All alerts →</a></div>
  <div class="alerts">{''.join(alert_card(a) for a in alerts[:4])}</div>
</div></section>
<section class="block tint"><div class="wrap">
  <div class="sec-head"><h2>Learn to Spot Fakes</h2><a href="/guides/">All guides →</a></div>
  <div class="cards3">{guide_cards(guides)}</div>
</div></section>
{GAME_BLOCK}
<section class="block"><div class="wrap split">
  <div><div class="label">From the field</div>
    <blockquote class="story">Someone in Germany signed into the email account of an employee at a law firm I support. The 24/7 security monitoring service I use flagged the login right away, and I locked the account down before any sensitive firm or client data was compromised.</blockquote>
    <div class="who">Tom Shubert · real case, client name withheld</div></div>
  <div><h3 style="font-size:26px;margin-bottom:10px">Why I built Fakes.com</h3>
    <p>I've worked with computers since I was 13 and have done IT consulting for small businesses since the early 1990s. Part of that job is helping careful people avoid losing money to an email, a call or a website that looked real.</p>
    <p>This site is the advice I give my clients, written for everyone. <a href="/about">More about me →</a></p></div>
</div></section>
<section class="signup"><div class="wrap">
  <div><h2>Get the weekly scam alert</h2><p>The scams going around this week and how to avoid them. One short email every Monday. Free.</p></div>
  <form id="signup" novalidate>
    <label for="email" class="label" style="flex-basis:100%">Email address</label>
    <input id="email" type="email" placeholder="you@example.com" autocomplete="email">
    <button class="btn" type="submit">Sign up</button>
    <div class="note" id="signup-note" aria-live="polite"></div>
  </form>
</div></section>
<script>document.getElementById('signup').addEventListener('submit',function(ev){{ev.preventDefault();document.getElementById('signup-note').textContent='The weekly email launches soon. Thanks for your interest!';}});</script>"""
    out["index.html"] = layout("Fakes.com: Check if it's fake before you click, pay or believe it",
        "Plain-English scam alerts, deepfake guides and real-vs-fake product advice from IT consultant Tom Shubert. Every fact linked to its source.",
        "/", home, extra_head=game_scripts(pool))

    # Alerts
    body = f"""<section class="page-head"><div class="wrap">
  <div class="label">Updated {fmt_date(newest)}</div><h1>Scam Alerts</h1>
  <p class="lede">Scams going around right now, based on warnings from government agencies and police. Each alert says what to do and links to the original warning.</p>
</div></section>
<section class="block"><div class="wrap"><div class="alerts">{''.join(alert_card(a, 'h2') for a in alerts)}</div></div></section>"""
    out["alerts.html"] = layout("Scam Alerts", "Current scam warnings from government agencies and police, with what to do about each one.", "/alerts", body, "/alerts")

    # Guides index + guides
    body = f"""<section class="page-head"><div class="wrap"><div class="label">Guides</div><h1>Learn to Spot Fakes</h1>
  <p class="lede">How the most common scams work, the signs to look for, and exactly what to do.</p></div></section>
<section class="block"><div class="wrap"><div class="cards3">{guide_cards(guides)}</div></div></section>"""
    out["guides/index.html"] = layout("Guides", "Plain-English guides to spotting voice-clone scams, fake online stores and counterfeit products.", "/guides/", body, "/guides/")
    for slug, meta, content in guides:
        body = f"""<section class="page-head"><div class="wrap narrow"><div class="label">{e(meta['label'])}</div>
  <h1>{e(meta['title'])}</h1><p class="lede">{e(meta['description'])}</p>
  <div class="byline">By <b>Tom Shubert</b> · Updated {fmt_date(meta['updated'])}</div></div></section>
<article class="wrap narrow article">{content}</article>"""
        out[f"guides/{slug}.html"] = layout(meta["title"], meta["description"], f"/guides/{slug}", body, "/guides/")

    # Game page
    body = f"""<section class="page-head"><div class="wrap"><div class="label">Daily game</div><h1>Spot the Fake</h1>
  <p class="lede">Three new practice messages every day. Decide if each one is real or fake, then see the clue that gives it away.</p></div></section>
{GAME_BLOCK}"""
    out["spot-the-fake.html"] = layout("Spot the Fake", "A daily game: decide whether each message is real or a scam, and learn the clue that gives it away.", "/spot-the-fake", body, "/spot-the-fake", extra_head=game_scripts(pool))


    # Checker
    body = """<section class="page-head"><div class="wrap narrow"><div class="label">Free tool</div><h1>Is it fake? Check it here.</h1>
  <p class="lede">Paste a suspicious text, email, web address or ad, or add a screenshot. You'll get the red flags and exactly how to check for sure.</p></div></section>
<section class="block"><div class="wrap narrow">
  <form id="checker" class="checker" novalidate>
    <label for="msg" class="label">Paste the message, email, link or phone number</label>
    <textarea id="msg" rows="8" maxlength="6000" placeholder="Example: USPS: Your package is on hold. Update your address within 12 hours: ..."></textarea>
    <div class="row">
      <label class="btn ghost file" for="shot">Add a screenshot</label>
      <input id="shot" type="file" accept="image/*">
      <span id="shot-name" class="label"></span>
    </div>
    <p class="privacy-note">Don't include passwords, full card or account numbers, or Social Security numbers. We don't store what you submit. It's sent to Anthropic's Claude AI to analyze. <a href="/privacy">Privacy policy</a></p>
    <div id="human"></div>
    <button class="btn" id="go" type="submit">Check it</button>
    <p id="err" class="err" aria-live="polite"></p>
  </form>
  <div id="result" class="check-result" hidden aria-live="polite"></div>
  <div class="callout"><h3>Already sent money or shared a password?</h3>
    <p>Call your bank or card company now using the number on your card or statement, change the password, and report it at <a href="https://reportfraud.ftc.gov/">ReportFraud.ftc.gov</a> and <a href="https://www.ic3.gov/">IC3.gov</a>.</p></div>
</div></section>"""
    out["check.html"] = layout("Is It Fake? Free Scam Checker", "Paste a suspicious text, email, link or screenshot and get the red flags and how to verify it.", "/check", body, "/check",
        extra_head='<script src="/assets/check.js" defer></script>')

    # Simple pages
    for name, active in [("about", "/about"), ("contact", None), ("standards", None), ("privacy", None), ("disclosure", None)]:
        meta, content = load_partial(ROOT / f"content/pages/{name}.html")
        body = f"""<section class="page-head"><div class="wrap narrow"><div class="label">{e(meta['label'])}</div><h1>{e(meta['title'])}</h1>
  <p class="lede">{e(meta['description'])}</p></div></section>
<article class="wrap narrow article">{content}</article>"""
        out[f"{name}.html"] = layout(meta["title"], meta["description"], f"/{name}", body, active)

    body = """<section class="page-head"><div class="wrap narrow"><div class="label">404</div><h1>This page doesn't exist</h1>
  <p class="lede">If a link brought you here unexpectedly, check the web address carefully. That's good practice anywhere online.</p>
  <div class="cta"><a class="btn" href="/">Go to the homepage</a></div></div></section>"""
    out["404.html"] = layout("Page not found", "This page doesn't exist.", "/404", body)

    for rel, text in out.items():
        p = ROOT / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text)

    urls = ["/", "/check", "/alerts", "/guides/", "/spot-the-fake", "/about", "/contact", "/standards", "/privacy", "/disclosure"] + [f"/guides/{s}" for s, _, _ in guides]
    (ROOT / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        "".join(f"  <url><loc>{SITE}{u}</loc><lastmod>{newest}</lastmod></url>\n" for u in urls) + "</urlset>\n")
    (ROOT / "robots.txt").write_text(f"User-agent: *\nAllow: /\n\nSitemap: {SITE}/sitemap.xml\n")
    print(f"Built {len(out)} pages, {len(alerts)} alerts, {len(guides)} guides. PREVIEW={PREVIEW}")

if __name__ == "__main__":
    main()
