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

## Weekly brand verification guide (the weekly scheduled task)
Guides live in `content/verify/<brand-product>.html` and are published at /verify/<slug>. Copy the front-matter format of an existing guide (title, brand, description, updated).
1. Pick ONE frequently counterfeited brand or product that has no guide yet (check `content/verify/`). Prefer brands that publish official anti-counterfeit guidance: a serial or code lookup, an authorized-seller list, or a "how to spot fakes" page.
2. The brand's own website is the primary source. Open and read every source. Government sources (CBP, FTC) may supplement. Do not rely on blogs or forums.
3. Only state what the sources say. Do not describe what genuine products look like unless the brand itself documents it. Never claim any check proves a product is genuine.
4. Structure: where to buy (authorized sellers), the brand's official verification steps, warning signs it lists, what to do if you have a fake, and links to /check#listing and /check#item. End with a Sources list.
5. Paraphrase; never copy sentences. Plain English, about 400-700 words. Slug: lowercase-hyphenated.
6. Run `python3 build.py`, commit "Add brand guide: <Brand>" and push to main.
7. If no brand with solid official guidance is left, change nothing and say so.

## Off limits
- Client names, Tom's rates or billing details, and Tom's personal email addresses never appear on the site.
- Never sell, promote or link to counterfeit goods.
