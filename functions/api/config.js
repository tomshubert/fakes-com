// GET /api/config — public settings the checker page needs (the Turnstile site key is public by design).
export function onRequestGet({ env }) {
  return new Response(JSON.stringify({ turnstileSiteKey: env.TURNSTILE_SITE_KEY || "" }), {
    headers: { "content-type": "application/json", "cache-control": "public, max-age=300" },
  });
}
