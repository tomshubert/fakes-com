// POST /api/subscribe — adds an email address to the weekly scam-alert list.
// Addresses are kept in Fakes.com's own Cloudflare storage (the LIMITS namespace, keys
// starting with "sub:") and added to the Brevo list that the weekly email goes to.

const PER_IP_PER_DAY = 5;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Something went wrong. Please try again." }, 400); }

  // Hidden "website" field: real people leave it empty; simple bots fill it in.
  if (body.website) return json({ ok: true });

  const email = String(body.email || "").trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email))
    return json({ error: "Please enter a valid email address." }, 400);
  if (!env.LIMITS) return json({ error: "Sign-ups aren't open yet. Please try again soon." }, 503);

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const day = new Date().toISOString().slice(0, 10);
  const ipKey = `subip:${day}:${ip}`;
  const count = Number((await env.LIMITS.get(ipKey)) || 0);
  if (count >= PER_IP_PER_DAY) return json({ error: "Too many sign-ups from this connection today. Please try again tomorrow." }, 429);
  await env.LIMITS.put(ipKey, String(count + 1), { expirationTtl: 60 * 60 * 48 });

  const key = `sub:${email}`;
  if (!(await env.LIMITS.get(key))) {
    await env.LIMITS.put(key, JSON.stringify({ email, signed_up: new Date().toISOString(), source: String(body.source || "site").slice(0, 40) }));
  }

  // Add to the Brevo list that receives the weekly email (when configured).
  // Someone who unsubscribed earlier stays unsubscribed in Brevo.
  if (env.BREVO_API_KEY && env.BREVO_LIST_ID) {
    try {
      const r = await fetch("https://api.brevo.com/v3/contacts", {
        method: "POST",
        headers: { "api-key": env.BREVO_API_KEY, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ email, listIds: [Number(env.BREVO_LIST_ID)], updateEnabled: true }),
      });
      if (!r.ok) console.log("brevo contact", r.status, (await r.text()).slice(0, 300));
    } catch (e) {
      console.log("brevo contact error", String(e));
    }
  }
  return json({ ok: true });
}

export function onRequest() {
  return json({ error: "Use the sign-up form on fakes.com." }, 405);
}
