// POST /api/office/check: the "Check with Fakes" Outlook add-in for offices on the Fakes office plan.
// The add-in sends the whole email (as an .eml file, the same as "forward as attachment") plus the
// user's Microsoft 365 sign-in token. Only organizations listed in OFFICE_TENANTS are served.
// Nothing from the email is stored: only a per-user monthly count for billing.
import { runCheck } from "../../../lib/checker.js";
import { verifyMsIdToken } from "../../../lib/msauth.js";

const MAX_EML_B64 = 1_400_000;   // about 1 MB of email
const PER_USER_PER_DAY = 50;     // safety net only

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

function tenants(env) {
  try { return JSON.parse(env.OFFICE_TENANTS || "{}"); } catch { return {}; }
}

function headerOf(raw, name) {
  const head = raw.split(/\r?\n\r?\n/)[0].replace(/\r?\n[ \t]+/g, " ");
  const m = head.match(new RegExp("^" + name + ":\\s*(.*)$", "im"));
  return m ? m[1].trim() : "";
}

const OFFICE_NOTE = `

OFFICE ADD-IN: This submission comes from the "Check with Fakes" button in Outlook at a business on the Fakes.com office plan. The <saved_email> is the complete original message taken straight from the employee's mailbox (it was NOT forwarded, unless its own subject or body shows it was), so its headers and authentication results describe the real sender. The reader is an office employee, not necessarily technical. In what_to_do, for a scam or suspicious email: don't click links, open attachments or reply; delete it; and if they already clicked, typed a password or opened an attachment, tell their IT person right away. Their IT person is automatically told when a scam is caught, so they don't need to forward it.`;

async function bump(env, key, ttl) {
  const n = Number((await env.LIMITS.get(key)) || 0) + 1;
  await env.LIMITS.put(key, String(n), { expirationTtl: ttl });
  return n;
}

async function alertAdmin(env, info) {
  if (!env.BREVO_API_KEY || !env.OFFICE_ALERT_EMAIL) return;
  const esc = s => String(s || "").replace(/[<>&"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
  const word = info.verdict === "likely_scam" ? "Likely scam" : "Suspicious email";
  const html = `<p><b>${esc(word)}</b> caught at <b>${esc(info.org)}</b>.</p>
<ul><li>Checked by: ${esc(info.user)}</li><li>Subject: ${esc(info.subject)}</li><li>From: ${esc(info.from)}</li></ul>
<p><b>Fakes.com said:</b> ${esc(info.headline)}</p>
${info.flags.length ? "<p>Red flags:</p><ul>" + info.flags.map(f => `<li>${esc(f)}</li>`).join("") + "</ul>" : ""}
<p style="color:#666">Sent by the Fakes.com office add-in. The email itself is not stored.</p>`;
  try {
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": env.BREVO_API_KEY, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { name: "Fakes.com Office", email: "hello@fakes.com" },
        to: [{ email: env.OFFICE_ALERT_EMAIL }],
        subject: `[Fakes Office] ${word} at ${info.org}: ${info.subject}`.slice(0, 180),
        htmlContent: html,
      }),
    });
    if (!r.ok) console.error("office alert failed", r.status, (await r.text()).slice(0, 300));
  } catch (e) { console.error("office alert error", e && e.message); }
}

async function handle({ request, env, waitUntil }) {
  if (!env.ANTHROPIC_API_KEY || !env.OFFICE_CLIENT_ID || !env.LIMITS) return json({ error: "The office checker isn't switched on yet." }, 503);

  const auth = request.headers.get("authorization") || "";
  let claims;
  try { claims = await verifyMsIdToken(auth.replace(/^Bearer\s+/i, ""), env.OFFICE_CLIENT_ID); }
  catch (e) { console.error("office auth:", e && e.message); return json({ error: "Your Microsoft sign-in couldn't be confirmed. Close this panel and try again.", code: "signin" }, 401); }

  const org = tenants(env)[claims.tid];
  if (!org) return json({ error: "Your organization isn't on the Fakes.com office plan yet. Ask your IT person to set it up. You can still check emails for free at fakes.com/check.", code: "notenrolled" }, 403);

  let body;
  try { body = await request.json(); } catch { return json({ error: "The email couldn't be read. Please try again." }, 400); }
  const b64 = typeof body.eml === "string" ? body.eml : "";
  if (!b64) return json({ error: "The email couldn't be read. Please try again." }, 400);
  if (b64.length > MAX_EML_B64) return json({ error: "This email is too large to check (over about 1 MB). Don't open its attachments; ask your IT person." }, 400);
  let raw;
  try { raw = new TextDecoder("utf-8").decode(Uint8Array.from(atob(b64), c => c.charCodeAt(0))); }
  catch { return json({ error: "The email couldn't be read. Please try again." }, 400); }

  const user = claims.oid || claims.sub;
  const day = new Date().toISOString().slice(0, 10), month = day.slice(0, 7);
  const todayKey = `office:day:${claims.tid}:${user}:${day}`;
  if (Number((await env.LIMITS.get(todayKey)) || 0) >= PER_USER_PER_DAY)
    return json({ error: `You've checked ${PER_USER_PER_DAY} emails today, the daily limit. Please try again tomorrow or ask your IT person.` }, 429);

  const out = await runCheck(env, { mode: "message", text: "", images: [], pdf: "", email: raw, att: null }, OFFICE_NOTE);
  if (out.status !== 200 || out.body.error) return json(out.body, out.status);

  // Counts for billing (per user per month) and the daily safety limit. No email content is kept.
  await bump(env, todayKey, 60 * 60 * 48);
  await bump(env, `office:use:${claims.tid}:${month}:${user}`, 60 * 60 * 24 * 400);

  const v = out.body.verdict;
  if (v === "likely_scam" || v === "suspicious") {
    const p = alertAdmin(env, {
      verdict: v, org, user: `${claims.name || ""} <${claims.preferred_username || claims.email || "unknown"}>`.trim(),
      subject: headerOf(raw, "subject").slice(0, 150) || "(no subject)", from: headerOf(raw, "from").slice(0, 150),
      headline: out.body.headline, flags: (out.body.red_flags || []).slice(0, 3),
    });
    if (waitUntil) waitUntil(p); else await p;
  }
  return json({ ...out.body, org, user: claims.name || "" });
}

export async function onRequestPost(ctx) {
  try { return await handle(ctx); }
  catch (e) {
    console.error("office check failed:", e && (e.stack || e.message));
    return json({ error: "The checker had a problem. Please try again in a minute." }, 500);
  }
}
export function onRequest() { return json({ error: "Use the Check with Fakes button in Outlook." }, 405); }
