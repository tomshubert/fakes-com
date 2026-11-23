// GET /api/office/usage?month=YYYY-MM : office plan usage per client organization (users and checks),
// for billing. Only for Tom: a Microsoft sign-in from an organization in OFFICE_ADMIN_TENANTS
// (the Fakes.com tenant), or the report key used by the Monday report (OFFICE_REPORT_KEY).
import { verifyMsIdToken } from "../../../lib/msauth.js";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

async function allowed(request, env, url) {
  const key = url.searchParams.get("key") || request.headers.get("x-report-key") || "";
  if (env.OFFICE_REPORT_KEY && key && key.length >= 24 && key === env.OFFICE_REPORT_KEY) return "report";
  const auth = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!auth) return null;
  try {
    const c = await verifyMsIdToken(auth, env.OFFICE_CLIENT_ID);
    const admins = String(env.OFFICE_ADMIN_TENANTS || "").split(",").map(s => s.trim()).filter(Boolean);
    return admins.includes(c.tid) ? (c.name || "admin") : null;
  } catch { return null; }
}

async function listAll(kv, prefix) {
  const out = []; let cursor;
  do { const r = await kv.list({ prefix, cursor }); out.push(...r.keys.map(k => k.name)); cursor = r.list_complete ? null : r.cursor; } while (cursor);
  return out;
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (!env.LIMITS) return json({ error: "not configured" }, 503);
  if (!(await allowed(request, env, url))) return json({ error: "Sign in with the Fakes.com admin account." }, 401);
  const month = /^\d{4}-\d{2}$/.test(url.searchParams.get("month") || "") ? url.searchParams.get("month") : new Date().toISOString().slice(0, 7);
  let names = {};
  try { names = JSON.parse(env.OFFICE_TENANTS || "{}"); } catch {}
  const orgs = {};
  for (const tid of Object.keys(names)) orgs[tid] = { org: names[tid], users: 0, checks: 0, people: [] };
  const keys = await listAll(env.LIMITS, "office:use:");
  for (const k of keys) {
    const [, , tid, m, user] = k.split(":");
    if (m !== month) continue;
    const n = Number((await env.LIMITS.get(k)) || 0);
    const who = (await env.LIMITS.get(`office:name:${tid}:${user}`)) || user;
    const o = orgs[tid] || (orgs[tid] = { org: names[tid] || "(no longer enrolled)", users: 0, checks: 0, people: [] });
    o.users += 1; o.checks += n; o.people.push({ who, checks: n });
  }
  const list = Object.entries(orgs).map(([tenantId, o]) => ({ tenantId, ...o, people: o.people.sort((a, b) => b.checks - a.checks) }))
    .sort((a, b) => a.org.localeCompare(b.org));
  return json({ month, organizations: list, total_users: list.reduce((a, o) => a + o.users, 0), total_checks: list.reduce((a, o) => a + o.checks, 0) });
}
