// POST /api/office/feedback: "Was this helpful?" from the Outlook add-in (Microsoft sign-in required).
// If someone says an email we cleared ("no red flags") was actually wrong, Tom gets a [Fakes Office] alert.
import { saveFeedback, VOTES } from "../../../lib/feedback.js";
import { verifyMsIdToken } from "../../../lib/msauth.js";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function onRequestPost({ request, env, waitUntil }) {
  if (!env.LIMITS || !env.OFFICE_CLIENT_ID) return json({ ok: false }, 503);
  let claims;
  try { claims = await verifyMsIdToken((request.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""), env.OFFICE_CLIENT_ID); }
  catch { return json({ ok: false }, 401); }
  let tenants = {}; try { tenants = JSON.parse(env.OFFICE_TENANTS || "{}"); } catch {}
  const org = tenants[claims.tid];
  if (!org) return json({ ok: false }, 403);
  let b; try { b = await request.json(); } catch { return json({ ok: false }, 400); }
  if (!VOTES.includes(b.vote)) return json({ ok: false }, 400);
  await saveFeedback(env, { vote: b.vote, verdict: b.verdict, mode: "office", note: b.note, source: "office", org });

  if (b.vote === "wrong" && b.verdict === "no_red_flags_found" && env.BREVO_API_KEY && env.OFFICE_ALERT_EMAIL) {
    const esc = s => String(s || "").replace(/[<>&"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
    const subject = String(b.subject || "(no subject)").slice(0, 150);
    const p = fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST", headers: { "api-key": env.BREVO_API_KEY, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { name: "Fakes.com Office", email: "hello@fakes.com" }, to: [{ email: env.OFFICE_ALERT_EMAIL }],
        subject: `[Fakes Office] Possible missed scam at ${org}: ${subject}`.slice(0, 180),
        htmlContent: `<p><b>${esc(claims.name || "A user")}</b> at <b>${esc(org)}</b> says an email Fakes.com cleared ("no red flags found") was wrong.</p>
<ul><li>Subject: ${esc(subject)}</li><li>Their note: ${esc(String(b.note || "").slice(0, 300)) || "(none)"}</li></ul>
<p>Worth a look: it may have slipped past both the email filter and Fakes.com.</p>`,
      }),
    }).catch(() => {});
    if (waitUntil) waitUntil(p); else await p;
  }
  return json({ ok: true });
}
