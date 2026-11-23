# FAKES.COM site

Static site for fakes.com, owned by Tom Shubert (IT consultant). Published by Cloudflare Pages from the `main` branch of this repo; a push goes live in about a minute.

## How it's built
- `python3 build.py` generates every HTML page at the repo root from `data/` and `content/`. Never hand-edit the generated `.html` files at the root or in `guides/`; edit the sources and rebuild.
- `data/alerts.json`: scam alerts, newest first after sorting by `date`. Fields: id, date (YYYY-MM-DD), channels (1-3 short labels), title, summary, what_to_do, sources [{name, url}].
- `data/game.json`: Spot the Fake practice messages.
- `content/guides/*.html`, `content/pages/*.html`: article bodies with a front-matter comment.
- The site is live: `PREVIEW = False` in build.py (no `noindex`, no preview banner). Leave it False; only Tom changes it.

## Daily alert update (the scheduled task)
1. Search for scam warnings published in the last 3 days by U.S. government agencies (FTC, FBI/IC3, state attorneys general, CISA, IRS, SSA, USPS) and police departments.
   - Leads from Google Trends: also open https://trends.google.com/trending?geo=US&hours=24 (the explore pages are blocked to us) and look for scam-related searches: anything with scam, fraud, text, phishing or hack, or an event scammers tend to exploit (a bank or app outage, data breach, recall, disaster, deadline). A trend is only a lead: search for an agency or police warning about it, and add nothing on the strength of a trend alone.
2. Add 1 to 3 new alerts that are genuinely new, relevant to ordinary U.S. consumers or small businesses, and not duplicates of existing alerts (check titles and sources).
   - Surge check: when a new warning is about the same scam as an alert from the last 14 days, don't add a duplicate. Instead, if it comes from a different agency or place, open and read it, then add it to that alert's `sources` (the source name says who warned and the date). Three or more separate agencies in different places on one alert means the scam is out in force: it qualifies for the breaking swap in step 6, and that alert's summary may say how many places have warned, for example "Police in Texas, Ohio and Oregon have warned about this", counting only sources listed on the alert.
3. Sourcing rules (non-negotiable):
   - Open and read each source before using it. Link the agency's own page whenever it exists; use a news story only when it is the only source, and name the agency it quotes in the source name.
   - Every claim in summary and what_to_do must be supported by the source. No invented numbers, dates or quotes. Paraphrase; never copy sentences.
   - Never link to or name a live scam website. Use no web addresses in alert text.
4. Plain English, calm tone, no hype. Title under 60 characters. Summary 2-3 sentences. what_to_do 1-2 concrete sentences.
5. Remove alerts older than 90 days from alerts.json.
6. Homepage "Going around now" card (about once a week). An alert may carry an optional `featured` block, and the homepage shows the one with the newest `featured.since` for 8 days, then falls back to the built-in toll-text example. Check it every day:
   - Weekly refresh: if no alert has a `featured.since` in the last 6 days, pick the most useful alert from the last 7 days (prefer an agency source and a scam ordinary people are likely to get).
   - Breaking swap: replace the current feature early only when an alert added today or yesterday is clearly bigger news, meaning a national agency (FTC, FBI/IC3, IRS, SSA, USPS, CISA, FCC) or it passes the surge check in step 2 (three or more agencies in different places), or it is tied to something happening now (a disaster, a major data breach, a deadline or holiday). Leave a feature up at least 2 days before swapping, and don't swap for a single local police warning.
   - To feature an alert, add this block to it (remove nothing from the old one; the newest `since` wins):
   `"featured": {"since": "<today YYYY-MM-DD>", "format": "<text message | email | phone call | voicemail | pop-up | social media message | social media ad | website | letter>", "agency": "<who issued the warning, e.g. the FTC, Norman (Okla.) police>", "sample": "<short invented example message>", "tells": ["<2-3 clues>"]}`
   - The sample is written by Fakes.com and is never copied from a real scam. Under 240 characters. Any web address must end in `.example`, any phone number must be 555-0100 to 555-0199, and use no real person's name. The build refuses anything else.
   - Each tell must be supported by the alert's source, like the alert text itself. Short phrases, no ending period.
   - Never present it as "the worst" or "top" scam; it is just one that is going around now. If nothing is strong enough, add nothing and the toll example returns.
7. Run `python3 build.py`; it must succeed. Check the JSON is valid.
8. Commit with a message like "Add scam alerts for YYYY-MM-DD" and push to main.
9. If nothing new and well-sourced turned up, change nothing and say so. A quiet day is better than a weak alert.

## Daily viral fakes update (part of the daily scheduled task)
`data/viral.json` feeds the Viral Fakes page (/viral-fakes) and the homepage. Fields: id, date (YYYY-MM-DD of the fact check), kind (short label such as "AI video", "AI photo", "Old video, new claim", "Real video called fake", "False rumor"), verdict ("Fake", "Misleading" or "Real"), title, summary, tell ("How you can tell": the clue a reader can use), sources [{name, url}], and political: true for anything about elections, parties, politicians or government policy (the homepage features non-political items first).
1. Search for fake photos, AI-made videos and false viral rumors debunked in the last 3 days by established fact-checkers: Lead Stories, PolitiFact, FactCheck.org, AP Fact Check, Reuters Fact Check, AFP Fact Check, USA Today Fact Check. Prefer items that ordinary Americans are likely to see in their feeds.
2. Add 0 to 2 new items, not duplicates. Open and read each fact check; every statement must be supported by it. Paraphrase; never copy sentences. Name the fact-checker and date in the source name.
3. Balance and tone (non-negotiable): apply the same standard to every political side. Over time, election and political items must not lean toward debunking one side. Prefer non-political items (disasters, crashes, celebrities, health, holidays, money). No opinions, no characterizing anyone's motives, no mocking. Calm, plain English.
4. Images: you may set `image` to the fact-checker's own link-preview image (its og:image URL, which WebFetch can report). The site shows it small, blurred, stamped with the verdict, credited and linked to the fact check. Use it only if the preview image is clearly labeled by the fact-checker or shows no identifiable real person; never use a photo of a real, identifiable person, never download images, and never link to or embed the original fake post or video. If in doubt, leave `image` out. When the image belongs to someone else (for example an AP photo the fact-checker uses), set `image_credit` such as "AP via PolitiFact". Do not name private individuals or the accounts that posted the fake.
5. Keep at most 12 items; remove the oldest beyond that and anything older than 60 days.
6. Keep it short: summary is two short sentences (what was claimed, what the fact-checker found); tell is one short sentence. Cards link to the fact check, where readers see the fake in full, safely labeled.
7. If nothing qualifies, change nothing. A quiet day is better than a weak item.

## Weekly brand verification guide (the weekly scheduled task)
Guides live in `content/verify/<brand-product>.html` and are published at /verify/<slug>. Copy the front-matter format of an existing guide (title, brand, description, updated).
1. Pick ONE frequently counterfeited brand or product that has no guide yet (check `content/verify/`). Prefer brands that publish official anti-counterfeit guidance: a serial or code lookup, an authorized-seller list, or a "how to spot fakes" page.
2. The brand's own website is the primary source. Open and read every source. Government sources (CBP, FTC) may supplement. Do not rely on blogs or forums.
3. Only state what the sources say. Do not describe what genuine products look like unless the brand itself documents it. Never claim any check proves a product is genuine.
4. Structure: where to buy (authorized sellers), the brand's official verification steps, warning signs it lists, what to do if you have a fake, and links to /check#listing and /check#item. End with a Sources list.
5. Paraphrase; never copy sentences. Plain English, about 400-700 words. Slug: lowercase-hyphenated.
6. Run `python3 build.py`, commit "Add brand guide: <Brand>" and push to main.
7. If no brand with solid official guidance is left, change nothing and say so.

## Weekly newsletter
- Mailing address for the footer of every newsletter email (required by CAN-SPAM): FAKES.COM, PO Box 8922, Calabasas, CA 91372-8922
- Service: Brevo (free plan: 300 emails a day), sending from hello@fakes.com as "Tom at Fakes.com". Sign-ups go to a Brevo list via functions/api/subscribe.js (Brevo list #2; secret BREVO_API_KEY in Cloudflare Pages and GitHub Actions).
- Fully automated: .github/workflows/newsletter.yml runs tools/send_newsletter.py every Monday morning (7:17 AM Pacific), after the daily alerts task. It builds the email from data/alerts.json and data/viral.json, skips weeks with nothing new, and refuses to send above 300 subscribers (split sending needed then). Nobody sends it by hand.

## Affiliates
- /protect (content/pages/protect.html) recommends NordPass, Aura and Optery after the free steps. NordPass approved Nov 18, 2026 (Nord affiliate ID 161109; tracking link https://go.nordpass.io/aff_c?offer_id=488&aff_id=161109&url_id=9356, marked "Affiliate link", rel="sponsored nofollow"). Aura (Impact, ADID 1320868) accepted Nov 18, 2026; its contract requires Aura's written approval of any content mentioning Aura (affiliates@aura.com). Aura approved the /protect content in writing Nov 19, 2026 (Ashleigh Rojanavongse, Affiliate Marketing Manager); tracking link https://aurainc.sjv.io/c/8250386/1320868/12398, marked "Affiliate link", rel="sponsored nofollow". Any new or changed Aura content needs fresh written approval. Aura's guidelines ban paid search, texts, email promotion and guarantee/credit-repair wording. The credit-freeze step naming Equifax, Experian and TransUnion stays: Tom's call is to drop Aura rather than remove it. Optery approved Nov 22, 2026 (PartnerStack, 30% for 12 months, payout via PayPal); referral link https://get.optery.com/igea8n4bwy0d, marked "Affiliate link"; its terms forbid bidding on Optery brand keywords, spam texts/emails and using Optery logos not supplied by Optery. The free do-it-yourself opt-out step (and California's DROP) stays ahead of Optery. Nord's rules forbid bidding on Nord brand keywords in paid search.
- Money: Tom puts all Fakes.com earnings back into running the site. Income and costs are tracked in the "Fakes.com Money Ledger" Sheet (https://claude.ai/artifact/JEpW5e2MWpNDYpZvJY8NKg); the Monday inbox check logs commissions, payouts and renewals there. Only fakes.com costs go in it (the PO Box belongs to Tom's IT consulting and is not a Fakes cost).
- Affiliate links never go in alerts, viral fakes or checker results. The `impact-site-verification` meta tag in build.py proves site ownership to Impact; don't remove it.

## Off limits
- Client names, Tom's rates or billing details, and Tom's personal email addresses never appear on the site.
- Never sell, promote or link to counterfeit goods.
