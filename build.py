#!/usr/bin/env python3
"""Builds the static FAKES.COM site from data/ and content/ into HTML files at the repo root.

Run:  python3 build.py
Daily updates only need to edit data/alerts.json and re-run this script.
"""
import html, json, re, datetime, pathlib, hashlib

ROOT = pathlib.Path(__file__).resolve().parent
SITE = "https://fakes.com"
PREVIEW = False  # True = search engines told not to index + preview banner. Set False at launch.

NAV = [("/check", "Check It"), ("/alerts", "Scam Alerts"), ("/guides/", "Guides"), ("/verify/", "Real or Fake?"), ("/spot-the-fake", "Spot the Fake"), ("/about", "About")]
FONTS = ("https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900"
         "&family=IBM+Plex+Mono:wght@400;500;600&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap")

e = html.escape

def asset(path):
    """URL for a file in assets/ with a version tag, so browsers fetch the new copy after every change."""
    digest = hashlib.sha256((ROOT / path.lstrip("/")).read_bytes()).hexdigest()[:10]
    return f"{path}?v={digest}"

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
<link rel="stylesheet" href="{asset("/assets/site.css")}">
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
    <li><a href="/check">Check It</a></li><li><a href="/verify/">Real or Fake? brand guides</a></li><li><a href="/alerts">Scam Alerts</a></li><li><a href="/guides/">Guides</a></li>
    <li><a href="/spot-the-fake">Spot the Fake</a></li><li><a href="/about">About</a></li><li><a href="/contact">Contact</a></li></ul></div>
  <div><h4>Been scammed?</h4><p>Report it at <a href="https://reportfraud.ftc.gov/">ReportFraud.ftc.gov</a> and <a href="https://www.ic3.gov/">IC3.gov</a>. If you sent money, call your bank right away.</p>
    <ul><li><a href="/standards">Sources &amp; corrections</a></li><li><a href="/terms">Terms of Use</a></li><li><a href="/privacy">Privacy</a></li><li><a href="/disclosure">Advertising disclosure</a></li></ul></div>
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
    return f'<script>window.FAKES_GAME={data};</script><script src="{asset("/assets/game.js")}" defer></script>'

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

def verify_cards(brands):
    return "".join(
        f'<a class="gcard" href="/verify/{slug}"><div class="label">{e(m["brand"])}</div>'
        f'<h3>{e(m["title"])}</h3><p>{e(m["description"])}</p><span class="more">Read the guide →</span></a>'
        for slug, m, _ in brands)

PRODUCT_CHECK = """<section class="block tint"><div class="wrap">
  <div class="sec-head"><h2>Is your product real?</h2><a href="/verify/">Brand guides →</a></div>
  <div class="cards3">
    <a class="gcard" href="/check#listing"><div class="label">Before you buy</div><h3>Check a listing</h3><p>Paste the item, price and seller. We'll point out the signs of a counterfeit or a scam seller before you spend anything.</p><span class="more">Check a listing →</span></a>
    <a class="gcard" href="/check#item"><div class="label">Already bought it</div><h3>Check your item</h3><p>Upload up to three photos. We'll point out what looks off and tell you how to confirm with the brand.</p><span class="more">Check an item →</span></a>
    <a class="gcard" href="/verify/"><div class="label">Brand by brand</div><h3>Official ways to verify</h3><p>Serial number lookups, authorized seller lists and the giveaways each brand says to look for.</p><span class="more">See the brands →</span></a>
  </div>
</div></section>"""

def main():
    alerts = sorted(json.loads((ROOT / "data/alerts.json").read_text()), key=lambda a: a["date"], reverse=True)
    pool = json.loads((ROOT / "data/game.json").read_text())
    guides = []
    for p in sorted((ROOT / "content/guides").glob("*.html")):
        meta, body = load_partial(p)
        guides.append((p.stem, meta, body))
    order = ["business-email-compromise", "voice-clone-scams", "fake-online-stores", "counterfeit-products"]
    guides.sort(key=lambda g: order.index(g[0]) if g[0] in order else 99)
    brands = []
    vdir = ROOT / "content/verify"
    if vdir.exists():
        for p in sorted(vdir.glob("*.html")):
            meta, body = load_partial(p)
            brands.append((p.stem, meta, body))
    brands.sort(key=lambda b: b[1]["brand"].lower())
    newest = alerts[0]["date"] if alerts else datetime.date.today().isoformat()
    out = {}

    # Home
    home = f"""<section class="hero"><div class="wrap">
  <div>
    <div class="label">Scams · Deepfakes · Counterfeits</div>
    <h1>Check if it's <em>fake</em> before you click, pay or believe it.</h1>
    <p class="lede">Plain-English warnings about the scams going around right now, how to spot AI-made voices and videos, and how to tell real products from knockoffs. Every fact links to its source.</p>
    <div class="byline">By <b>Tom Shubert</b> · IT consultant to small businesses and individuals</div>
    <div class="cta"><a class="btn" href="/check">Check something now</a><a class="btn ghost" href="/alerts">See this week's scams</a></div>
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
{PRODUCT_CHECK}
{GAME_BLOCK}
<section class="block"><div class="wrap split">
  <div><div class="label">From the field</div>
    <blockquote class="story">Someone in Germany signed into the email account of an employee at a law firm I support. The 24/7 security monitoring service I use flagged the login right away, and I locked the account down before any sensitive firm or client data was compromised.</blockquote>
    <div class="who">Tom Shubert · real case, client name withheld</div></div>
  <div><h3 style="font-size:26px;margin-bottom:10px">Why I built Fakes.com</h3>
    <p>I've worked with computers since I was 13 and have done IT consulting for small businesses since the early 1990s. Along the way I've seen careful people lose real money to phishing emails and to fake \"urgent\" wire-transfer requests that appeared to come from their own boss.</p>
    <p>This site is the advice I give my clients, written for everyone. <a href="/about">More about me →</a></p></div>
</div></section>
<section class="signup"><div class="wrap">
  <div><h2>Get the weekly scam alert</h2><p>The scams going around this week and how to avoid them. One short email every Monday. Free.</p></div>
  <form id="signup" novalidate>
    <label for="email" class="label" style="flex-basis:100%">Email address</label>
    <input id="email" type="email" placeholder="you@example.com" autocomplete="email">
    <input id="website" name="website" type="text" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px">
    <button class="btn" type="submit">Sign up</button>
    <div class="note" id="signup-note" aria-live="polite"></div>
  </form>
</div></section>
<script>
document.getElementById('signup').addEventListener('submit',function(ev){{
  ev.preventDefault();
  var note=document.getElementById('signup-note'), btn=this.querySelector('button');
  var email=document.getElementById('email').value.trim();
  if(!email){{note.textContent='Please enter your email address.';return;}}
  btn.disabled=true; note.textContent='Signing you up…';
  fetch('/api/subscribe',{{method:'POST',headers:{{'content-type':'application/json'}},body:JSON.stringify({{email:email,website:document.getElementById('website').value,source:'home'}})}})
    .then(function(r){{return r.json().then(function(d){{return {{ok:r.ok,d:d}};}});}})
    .then(function(x){{ if(!x.ok) throw new Error(x.d.error||'Something went wrong.'); note.textContent="You're on the list. Watch your inbox for the weekly scam alert."; document.getElementById('email').value=''; }})
    .catch(function(e){{ note.textContent=e.message||'Something went wrong. Please try again.'; }})
    .finally(function(){{ btn.disabled=false; }});
}});
</script>"""
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

    # Brand verification guides
    body = f"""<section class="page-head"><div class="wrap"><div class="label">Brand guides</div><h1>Real or Fake? Check by Brand</h1>
  <p class="lede">Official ways to confirm a product is genuine, from the brands themselves: serial number lookups, authorized sellers and the giveaways they say to look for.</p></div></section>
<section class="block"><div class="wrap"><div class="cards3">{verify_cards(brands)}</div>
  <div class="callout" style="margin-top:32px"><h3>Don't see your brand?</h3><p>Use our <a href="/check#listing">listing checker</a> before you buy, or our <a href="/check#item">item checker</a> on photos of something you received. New brand guides are added every week.</p></div>
</div></section>"""
    out["verify/index.html"] = layout("Real or Fake? Check by Brand", "Official ways to confirm a product is genuine, brand by brand: serial lookups, authorized sellers and what to look for.", "/verify/", body, "/verify/")
    for slug, meta, content in brands:
        body = f"""<section class="page-head"><div class="wrap narrow"><div class="label">Real or fake? · {e(meta['brand'])}</div>
  <h1>{e(meta['title'])}</h1><p class="lede">{e(meta['description'])}</p>
  <div class="byline">By <b>Tom Shubert</b> · Updated {fmt_date(meta['updated'])}</div></div></section>
<article class="wrap narrow article">{content}</article>"""
        out[f"verify/{slug}.html"] = layout(meta["title"], meta["description"], f"/verify/{slug}", body, "/verify/")

    # Game page
    body = f"""<section class="page-head"><div class="wrap"><div class="label">Daily game</div><h1>Spot the Fake</h1>
  <p class="lede">Three new practice messages every day. Decide if each one is real or fake, then see the clue that gives it away.</p></div></section>
{GAME_BLOCK}"""
    out["spot-the-fake.html"] = layout("Spot the Fake", "A daily game: decide whether each message is real or a scam, and learn the clue that gives it away.", "/spot-the-fake", body, "/spot-the-fake", extra_head=game_scripts(pool))


    # Checker
    body = """<section class="page-head"><div class="wrap narrow"><div class="label">Free tool</div><h1>Is it fake? Check it here.</h1>
  <p class="lede">Check a suspicious message, link, email, PDF, product, or a post or news story that might not be true. You'll get the warning signs and exactly how to check for sure.</p></div></section>
<section class="block"><div class="wrap narrow">
  <form id="checker" class="checker" novalidate>
    <fieldset class="mode-tabs">
      <legend class="label">What do you want to check?</legend>
      <label><input type="radio" name="mode" value="message" checked><span>A message, email or website</span></label>
      <label><input type="radio" name="mode" value="listing"><span>A product before I buy it</span></label>
      <label><input type="radio" name="mode" value="item"><span>An item I already received</span></label>
      <label><input type="radio" name="mode" value="claim"><span>A post, claim or news story</span></label>
    </fieldset>
    <p id="mode-note" class="mode-note" hidden></p>
    <label for="msg" class="label" id="msg-label">Paste the message, email, link or phone number</label>
    <textarea id="msg" rows="7" maxlength="6000"></textarea>
    <div class="row">
      <label class="btn ghost file" for="shot" id="shot-label">Add a screenshot</label>
      <input id="shot" type="file" accept="image/*">
      <span class="drop-hint">or drag a file here</span>
      <span id="shot-name" class="label"></span>
    </div>
    <details id="email-help" class="help">
      <summary>How to save a suspicious email as a file</summary>
      <p>A saved email (.eml file) includes hidden details that show whether it really came from the company it claims. Don't click anything inside the email.</p>
      <ul>
        <li><b>Gmail (on a computer):</b> open the email, click the three dots at the top right, then <b>Download message</b>.</li>
        <li><b>Outlook (on a computer):</b> drag the email from your inbox onto your desktop, or open it and choose <b>File → Save As</b>.</li>
        <li><b>Apple Mail:</b> select the email, then <b>File → Save As</b>, and choose <b>Raw Message Source</b>.</li>
      </ul>
      <p>Then drag the file onto this form.</p>
    </details>
    <p class="privacy-note">Don't include passwords, full card or account numbers, or Social Security numbers. We don't store what you submit. It's sent to Anthropic's Claude AI to analyze. Results are automated and can be wrong. By using the checker you agree to our <a href="/terms">Terms of Use</a> and <a href="/privacy">Privacy Policy</a>.</p>
    <div id="human"></div>
    <button class="btn" id="go" type="submit">Check it</button>
    <p id="err" class="err" aria-live="polite"></p>
  </form>
  <div id="danger" class="check-result danger" hidden aria-live="polite"></div>
  <div id="result" class="check-result" hidden aria-live="polite"></div>
  <div class="callout"><h3>Got an email attachment you're not sure about?</h3>
    <p>Add it above without opening it. We read PDFs, Word and Excel files, and HTML attachments (a common trick that opens a fake login page). Programs, compressed files and other risky types are never uploaded; we warn you right away based on the file's name.</p>
    <p>Fakes.com doesn't scan files for viruses. For that, the free service <a href="https://www.virustotal.com/">VirusTotal</a> checks a file with dozens of antivirus programs. Files uploaded there can be seen by security researchers, so don't upload private documents.</p></div>
  <div class="callout"><h3>Already sent money or shared a password?</h3>
    <p>Call your bank or card company now using the number on your card or statement, change the password, and report it at <a href="https://reportfraud.ftc.gov/">ReportFraud.ftc.gov</a> and <a href="https://www.ic3.gov/">IC3.gov</a>.</p></div>
</div></section>"""
    out["check.html"] = layout("Is It Fake? Free Scam Checker", "Check a suspicious message, a product listing before you buy, or an item you received for signs it's fake.", "/check", body, "/check",
        extra_head=f'<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js" defer></script><script src="{asset("/assets/check.js")}" defer></script>')

    # Simple pages
    for name, active in [("about", "/about"), ("contact", None), ("standards", None), ("privacy", None), ("disclosure", None), ("terms", None)]:
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

    urls = ["/", "/check", "/alerts", "/guides/", "/spot-the-fake", "/about", "/contact", "/standards", "/privacy", "/disclosure", "/terms"] + [f"/guides/{s}" for s, _, _ in guides] + ["/verify/"] + [f"/verify/{s}" for s, _, _ in brands]
    (ROOT / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        "".join(f"  <url><loc>{SITE}{u}</loc><lastmod>{newest}</lastmod></url>\n" for u in urls) + "</urlset>\n")
    (ROOT / "robots.txt").write_text(f"User-agent: *\nAllow: /\n\nSitemap: {SITE}/sitemap.xml\n")
    print(f"Built {len(out)} pages, {len(alerts)} alerts, {len(guides)} guides. PREVIEW={PREVIEW}")

if __name__ == "__main__":
    main()
