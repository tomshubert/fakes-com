// POST /api/feedback: the "Was this helpful?" line under public checker results.
// GET /api/feedback?key=...: recent notes for Tom's Monday report (report key only).
import { saveFeedback, VOTES } from "../../lib/feedback.js";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function onRequestPost({ request, env }) {
  if (!env.LIMITS) return json({ ok: false }, 503);
  let b; try { b = await request.json(); } catch { return json({ ok: false }, 400); }
  if (!VOTES.includes(b.vote)) return json({ ok: false }, 400);
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const day = new Date().toISOString().slice(0, 10);
  const rk = `fbip:${ip}:${day}`;
  const used = Number((await env.LIMITS.get(rk)) || 0);
  if (used >= 20) return json({ ok: true });            // quietly ignore floods
  await env.LIMITS.put(rk, String(used + 1), { expirationTtl: 60 * 60 * 48 });
  await saveFeedback(env, { vote: b.vote, verdict: b.verdict, mode: b.mode, note: b.note, source: "web" });
  return json({ ok: true });
}

export async function onRequestGet({ request, env }) {
  const key = new URL(request.url).searchParams.get("key") || "";
  if (!env.OFFICE_REPORT_KEY || key.length < 24 || key !== env.OFFICE_REPORT_KEY) return json({ error: "not allowed" }, 401);
  const notes = [];
  for (let i = 0; i < 8; i++) {
    const day = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const r = await env.LIMITS.list({ prefix: `fbnote:${day}:` });
    for (const k of r.keys) { try { notes.push(JSON.parse(await env.LIMITS.get(k.name))); } catch {} }
  }
  return json({ notes });
}
