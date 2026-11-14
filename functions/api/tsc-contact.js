// POST /api/tsc-contact — contact form for tomshubert.com (Tom's IT consulting site).
// That site is static, so its form posts here and this function emails the message to
// info@tomshubert.com through the same Brevo account Fakes.com already uses.
// Visitors' messages are not stored. Replies go straight to the visitor (reply-to).

const TO = "info@tomshubert.com";
const ALLOWED_ORIGINS = ["https://tomshubert.com", "https://www.tomshubert.com", "https://tomshubert-com.pages.dev"];
const PER_IP_PER_DAY = 5;

function cors(origin) {
  const ok = ALLOWED_ORIGINS.includes(origin) || /^https:\/\/[a-z0-9-]+\.tomshubert-com\.pages\.dev$/.test(origin || "");
  return ok ? { "access-control-allow-origin": origin, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type", vary: "origin" } : {};
}
const json = (obj, status, origin) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...cors(origin) } });
const clean = (v, max) => String(v || "").replace(/\r/g, "").trim().slice(0, max);
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: cors(request.headers.get("origin")) });
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get("origin");
  if (!Object.keys(cors(origin)).length) return json({ error: "Not allowed." }, 403, origin);

  let b;
  try { b = await request.json(); } catch { return json({ error: "Something went wrong. Please try again." }, 400, origin); }
  if (b.website) return json({ ok: true }, 200, origin); // honeypot: bots fill the hidden field

  const name = clean(b.name, 100), email = clean(b.email, 254).toLowerCase(), phone = clean(b.phone, 40),
    company = clean(b.company, 120), message = clean(b.message, 5000);
  if (!name) return json({ error: "Please enter your name." }, 400, origin);
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) return json({ error: "Please enter a valid email address." }, 400, origin);
  if (message.length < 5) return json({ error: "Please tell me a little about what you need." }, 400, origin);

  if (env.LIMITS) {
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const key = `tscip:${new Date().toISOString().slice(0, 10)}:${ip}`;
    const n = Number((await env.LIMITS.get(key)) || 0);
    if (n >= PER_IP_PER_DAY) return json({ error: "Too many messages from this connection today. Please call 818.635.6777." }, 429, origin);
    await env.LIMITS.put(key, String(n + 1), { expirationTtl: 60 * 60 * 48 });
  }
  if (!env.BREVO_API_KEY) return json({ error: "The form isn't working right now. Please call 818.635.6777." }, 503, origin);

  const rows = [["Name", name], ["Email", email], ["Phone", phone], ["Company", company]].filter(([, v]) => v);
  const html = `<p><b>New message from the tomshubert.com contact form</b></p>` +
    rows.map(([k, v]) => `<p><b>${k}:</b> ${esc(v)}</p>`).join("") +
    `<p><b>Message:</b></p><p style="white-space:pre-wrap">${esc(message)}</p>`;
  const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n") + `\n\n${message}`;

  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": env.BREVO_API_KEY, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { email: "hello@fakes.com", name: "tomshubert.com contact form" },
      to: [{ email: TO, name: "Tom Shubert" }],
      replyTo: { email, name },
      subject: `Website inquiry from ${name}${company ? ` (${company})` : ""}`,
      htmlContent: html,
      textContent: text,
    }),
  });
  if (!r.ok) {
    console.log("brevo send", r.status, (await r.text()).slice(0, 300));
    return json({ error: "Sorry, your message didn't go through. Please call 818.635.6777 or email info@tomshubert.com." }, 502, origin);
  }
  return json({ ok: true }, 200, origin);
}

export function onRequest({ request }) {
  return json({ error: "Use the contact form on tomshubert.com." }, 405, request.headers.get("origin"));
}
