// Shared storage for "Was this helpful?" feedback. Counts per day (kept 90 days) and short notes
// (kept 60 days). Never stores the message that was checked.
export const VOTES = ["up", "down", "wrong"];

export async function saveFeedback(env, { vote, verdict, mode, note, source, org }) {
  const day = new Date().toISOString().slice(0, 10);
  const cnt = `stats:fb-${source}-${vote}:${day}`;
  const n = Number((await env.LIMITS.get(cnt)) || 0) + 1;
  await env.LIMITS.put(cnt, String(n), { expirationTtl: 60 * 60 * 24 * 90 });
  const clean = String(note || "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 300);
  if (vote === "wrong" || clean) {
    const id = crypto.randomUUID().slice(0, 8);
    await env.LIMITS.put(`fbnote:${day}:${id}`, JSON.stringify({ day, source, vote, verdict: String(verdict || "").slice(0, 40), mode: String(mode || "").slice(0, 20), note: clean, org: org || "" }),
      { expirationTtl: 60 * 60 * 24 * 60 });
  }
}
