// POST /api/check — "Is it fake?" checker.
// Sends the visitor's submission to Claude and returns a structured verdict.
// Nothing is stored. Links are inspected from Fakes.com's server (never the visitor's
// computer): Google Web Risk, domain age, and a read-only look at the page.
import { runCheck } from "../../lib/checker.js";

const MAX_TEXT = 6000;            // characters
const MAX_IMAGE_B64 = 2_000_000;  // ~1.5 MB per image
const MAX_IMAGES = 3;
const MAX_PDF_B64 = 4_500_000;    // ~3.3 MB PDF
const MAX_EMAIL = 1_000_000;      // characters of a saved .eml file
const MODES = ["message", "listing", "item", "claim"];
const CLAIM_PER_VISITOR_PER_DAY = 3;
const CLAIM_SITE_PER_DAY = 30;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const PER_VISITOR_PER_DAY = 10;
const SITE_PER_DAY = 500;

async function verifyHuman(env, token, ip) {
  if (!env.TURNSTILE_SECRET_KEY) return true; // not configured yet
  if (!token) return false;
  const form = new FormData();
  form.append("secret", env.TURNSTILE_SECRET_KEY);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
    const d = await r.json();
    return d.success === true;
  } catch { return false; }
}

// Returns an error message if over a limit, otherwise counts this check and returns null.
// Fact-checks (mode "claim") cost more, so they have their own, much smaller limits.
async function checkLimits(env, ip, mode) {
  if (!env.LIMITS) return null; // not configured yet
  const day = new Date().toISOString().slice(0, 10);
  const claim = mode === "claim";
  const prefix = claim ? "claim:" : "";
  const siteMax = claim ? CLAIM_SITE_PER_DAY : SITE_PER_DAY;
  const mineMax = claim ? CLAIM_PER_VISITOR_PER_DAY : PER_VISITOR_PER_DAY;
  const siteKey = `${prefix}site:${day}`, ipKey = `${prefix}ip:${day}:${ip || "unknown"}`;
  const [site, mine] = await Promise.all([env.LIMITS.get(siteKey), env.LIMITS.get(ipKey)]);
  if (Number(site || 0) >= siteMax) {
    await recordStat(env, `hit:${claim ? "claim-site" : "site"}`, day);
    return claim
      ? "Today's free fact-checks are used up. Please try again tomorrow. Our other checks are still available."
      : "The checker has reached its limit for today. Please try again tomorrow.";
  }
  if (Number(mine || 0) >= mineMax) {
    await recordStat(env, `hit:${claim ? "claim-visitor" : "visitor"}`, day);
    return claim
      ? `You've used today's ${CLAIM_PER_VISITOR_PER_DAY} free fact-checks. Please come back tomorrow. You can still use our other checks.`
      : `You've used today's ${PER_VISITOR_PER_DAY} free checks. Please come back tomorrow.`;
  }
  return null;
}

// Daily counts kept for 90 days, so we can see how the checker is used and how often
// anyone runs into a limit. Counts only: no IP addresses or content. Read by /api/stats.
async function recordStat(env, name, day) {
  if (!env.LIMITS) return;
  try {
    const key = `stats:${name}:${day}`;
    const n = await env.LIMITS.get(key);
    await env.LIMITS.put(key, String(Number(n || 0) + 1), { expirationTtl: 60 * 60 * 24 * 90 });
  } catch (e) { console.error("stats: KV write failed", e && e.message); }
}

// Count a check against the limits only once it has actually produced an answer,
// so visitors aren't charged for checks that failed on our side.
async function countCheck(env, ip, mode) {
  if (!env.LIMITS) return;
  const day = new Date().toISOString().slice(0, 10);
  const prefix = mode === "claim" ? "claim:" : "";
  const siteKey = `${prefix}site:${day}`, ipKey = `${prefix}ip:${day}:${ip || "unknown"}`;
  const ttl = { expirationTtl: 60 * 60 * 48 };
  try {
    const [site, mine] = await Promise.all([env.LIMITS.get(siteKey), env.LIMITS.get(ipKey)]);
    await Promise.all([env.LIMITS.put(siteKey, String(Number(site || 0) + 1), ttl), env.LIMITS.put(ipKey, String(Number(mine || 0) + 1), ttl)]);
    await recordStat(env, mode === "claim" ? "factchecks" : "checks", day);
  } catch (e) { console.error("limits: KV write failed", e && e.message); }
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

async function handleCheck({ request, env }) {
  if (!env.ANTHROPIC_API_KEY) return json({ error: "The checker isn't switched on yet. Please try again later." }, 503);

  let body;
  try { body = await request.json(); } catch { return json({ error: "Something went wrong reading your submission. Please try again." }, 400); }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const mode = MODES.includes(body.mode) ? body.mode : "message";
  let images = Array.isArray(body.images) ? body.images : (body.image ? [body.image] : []);
  images = images.filter(i => i && typeof i.data === "string");
  const pdf = mode !== "item" && body.pdf && typeof body.pdf.data === "string" ? body.pdf.data : "";
  const email = mode === "message" && typeof body.email === "string" ? body.email : "";
  const att = mode === "message" && body.attachment && typeof body.attachment.text === "string" && ["html", "docx", "xlsx"].includes(body.attachment.kind)
    ? { kind: body.attachment.kind, name: String(body.attachment.name || "attachment").slice(0, 120), text: body.attachment.text.slice(0, 1000000), macros: !!body.attachment.macros }
    : null;
  if (pdf.length > MAX_PDF_B64) return json({ error: "That PDF is too large. Please use one under 3 MB." }, 400);
  if (email.length > MAX_EMAIL) return json({ error: "That email file is too large. Please use one under 1 MB." }, 400);

  if (!text && !images.length && !pdf && !email && !att) return json({ error: mode === "item" ? "Add at least one photo of the item first." : "Paste the details or add a screenshot first." }, 400);
  if (text.length > MAX_TEXT) return json({ error: `That's too long. Please paste ${MAX_TEXT.toLocaleString()} characters or fewer.` }, 400);
  if (images.length > MAX_IMAGES) return json({ error: `Please add no more than ${MAX_IMAGES} photos.` }, 400);
  if (images.some(i => !IMAGE_TYPES.includes(i.media_type) || i.data.length > MAX_IMAGE_B64))
    return json({ error: "One of those images is too large or not a supported type. Try smaller JPG or PNG photos." }, 400);

  const ip = request.headers.get("CF-Connecting-IP") || "";
  if (!(await verifyHuman(env, body.turnstile, ip)))
    return json({ error: "Please complete the \"verify you're human\" check above the button, then try again." }, 403);
  const limited = await checkLimits(env, ip, mode);
  if (limited) return json({ error: limited }, 429);

  const out = await runCheck(env, { mode, text, images, pdf, email, att });
  if (out.status === 200 && !out.body.error) await countCheck(env, ip, mode);
  return json(out.body, out.status);
}

export function onRequest() {
  return json({ error: "Use the form at fakes.com/check." }, 405);
}

// Wrapper: whatever goes wrong, the visitor gets a plain message (with a short code), never a raw error page.
export async function onRequestPost(ctx) {
  try {
    return await handleCheck(ctx);
  } catch (e) {
    const msg = String((e && (e.message || e)) || "unknown");
    console.error("check failed:", msg, e && e.stack);
    const code = /KV|limit/i.test(msg) ? "K" : /JSON/i.test(msg) ? "J" : /fetch|network/i.test(msg) ? "N" : "X";
    return json({ error: `The checker had a problem (code ${code}). Please try again in a minute.` }, 500);
  }
}
