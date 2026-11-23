// Daily checker counts for the last 30 days: checks and fact-checks answered, and how often
// visitors or the whole site ran into a daily limit. Counts only; nothing about who checked what.
const NAMES = ["checks", "factchecks", "hit:visitor", "hit:site", "hit:claim-visitor", "hit:claim-site"];

export async function onRequestGet({ env }) {
  if (!env.LIMITS) return Response.json({ error: "not configured" }, { status: 503 });
  const days = [];
  const now = Date.now();
  for (let i = 0; i < 30; i++) days.push(new Date(now - i * 86400000).toISOString().slice(0, 10));
  const rows = await Promise.all(days.map(async (day) => {
    const vals = await Promise.all(NAMES.map((n) => env.LIMITS.get(`stats:${n}:${day}`)));
    const row = { date: day };
    NAMES.forEach((n, i) => { row[n.replace("hit:", "limit_") ] = Number(vals[i] || 0); });
    return row;
  }));
  const totals = {};
  for (const r of rows) for (const [k, v] of Object.entries(r)) if (k !== "date") totals[k] = (totals[k] || 0) + v;
  return Response.json({ since: "2026-11-23", days: rows, totals_30_days: totals },
    { headers: { "cache-control": "public, max-age=300" } });
}
