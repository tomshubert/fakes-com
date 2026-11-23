// Public settings the Outlook add-in needs before signing in (nothing secret).
export function onRequestGet({ env }) {
  return Response.json({ clientId: env.OFFICE_CLIENT_ID || "" }, { headers: { "cache-control": "no-store" } });
}
