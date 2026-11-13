# FAKES.COM site

Static site for fakes.com, owned by Tom Shubert (IT consultant). Published by Cloudflare Pages from the `main` branch of this repo; a push goes live in about a minute.

## How it's built
- `python3 build.py` generates every HTML page at the repo root from `data/` and `content/`. Never hand-edit the generated `.html` files at the root or in `guides/`; edit the sources and rebuild.
- `data/alerts.json`: scam alerts, newest first after sorting by `date`. Fields: id, date (YYYY-MM-DD), channels (1-3 short labels), title, summary, what_to_do, sources [{name, url}].
- `data/game.json`: Spot the Fake practice messages.
- `content/guides/*.html`, `content/pages/*.html`: article bodies with a front-matter comment.
- `PREVIEW = True` in build.py keeps `noindex` and the preview banner. Only Tom decides when to set it to False.

## Daily alert update (the scheduled task)
1. Search for scam warnings published in the last 3 days by U.S. government agencies (FTC, FBI/IC3, state attorneys general, CISA, IRS, SSA, USPS) and police departments.
2. Add 1 to 3 new alerts that are genuinely new, relevant to ordinary U.S. consumers or small businesses, and not duplicates of existing alerts (check titles and sources).
3. Sourcing rules (non-negotiable):
   - Open and read each source before using it. Link the agency's own page whenever it exists; use a news story only when it is the only source, and name the agency it quotes in the source name.
   - Every claim in summary and what_to_do must be supported by the source. No invented numbers, dates or quotes. Paraphrase; never copy sentences.
   - Never link to or name a live scam website. Use no web addresses in alert text.
4. Plain English, calm tone, no hype. Title under 60 characters. Summary 2-3 sentences. what_to_do 1-2 concrete sentences.
5. Remove alerts older than 90 days from alerts.json.
6. Run `python3 build.py`; it must succeed. Check the JSON is valid.
7. Commit with a message like "Add scam alerts for YYYY-MM-DD" and push to main.
8. If nothing new and well-sourced turned up, change nothing and say so. A quiet day is better than a weak alert.

## Daily viral fakes update (part of the daily scheduled task)
`data/viral.json` feeds the Viral Fakes page (/viral-fakes) and the homepage. Fields: id, date (YYYY-MM-DD of the fact check), kind (short label such as "AI video", "AI photo", "Old video, new claim", "Real video called fake", "False rumor"), verdict ("Fake", "Misleading" or "Real"), title, summary, tell ("How you can tell": the clue a reader can use), sources [{name, url}], and political: true for anything about elections, parties, politicians or government policy (the homepage features non-political items first).
1. Search for fake photos, AI-made videos and false viral rumors debunked in the last 3 days by established fact-checkers: Lead Stories, PolitiFact, FactCheck.org, AP Fact Check, Reuters Fact Check, AFP Fact Check, USA Today Fact Check. Prefer items that ordinary Americans are likely to see in their feeds.
2. Add 0 to 2 new items, not duplicates. Open and read each fact check; every statement must be supported by it. Paraphrase; never copy sentences. Name the fact-checker and date in the source name.
3. Balance and tone (non-negotiable): apply the same standard to every political side. Over time, election and political items must not lean toward debunking one side. Prefer non-political items (disasters, crashes, celebrities, health, holidays, money). No opinions, no characterizing anyone's motives, no mocking. Calm, plain English.
4. Images: you may set `image` to the fact-checker's own link-preview image (its og:image URL, which WebFetch can report). The site shows it small, blurred, stamped with the verdict, credited and linked to the fact check. Use it only if the preview image is clearly labeled by the fact-checker or shows no identifiable real person; never use a photo of a real, identifiable person, never download images, and never link to or embed the original fake post or video. If in doubt, leave `image` out. Do not name private individuals or the accounts that posted the fake.
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
- Service: Brevo (free plan: 300 emails a day), sending from hello@fakes.com as "Tom at Fakes.com". Sign-ups go to a Brevo list via functions/api/subscribe.js (env BREVO_API_KEY, BREVO_LIST_ID in Cloudflare Pages).
- Fully automated: .github/workflows/newsletter.yml runs tools/send_newsletter.py every Thursday. It builds the email from data/alerts.json and data/viral.json, skips weeks with nothing new, and refuses to send above 300 subscribers (split sending needed then). Nobody sends it by hand.

## Off limits
- Client names, Tom's rates or billing details, and Tom's personal email addresses never appear on the site.
- Never sell, promote or link to counterfeit goods.
