// Evidence gathering for the checker: links and saved emails.
// Everything here runs on Fakes.com's server (Cloudflare), never on the visitor's computer.

const UA = "FakesComChecker/1.0 (+https://fakes.com/check)";
const SOCIAL = ["facebook.com", "fb.com", "fb.watch", "instagram.com", "tiktok.com", "x.com", "twitter.com", "threads.net", "snapchat.com", "linkedin.com"];
const MULTI_PART_TLDS = ["co.uk", "org.uk", "ac.uk", "gov.uk", "com.au", "net.au", "org.au", "co.nz", "co.jp", "com.br", "com.mx", "co.in", "co.za", "com.cn", "com.hk", "com.sg", "com.tr"];

export function findUrls(text) {
  const out = [];
  const re = /\b((?:https?:\/\/|www\.)[^\s<>"')\]]+|(?:[a-z0-9-]+\.)+(?:com|net|org|info|biz|co|us|io|app|shop|store|online|site|xyz|top|live|click|link|support|help|me|cc|vip|icu)(?:\/[^\s<>"')\]]*)?)/gi;
  let m;
  while ((m = re.exec(text)) && out.length < 2) {
    let u = m[1].replace(/[.,;:!?]+$/, "");
    if (/@/.test(text.slice(Math.max(0, m.index - 1), m.index))) continue; // part of an email address
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    try { const parsed = new URL(u); if (!out.some(x => x.hostname === parsed.hostname)) out.push(parsed); } catch {}
  }
  return out;
}

function registrable(host) {
  const parts = host.toLowerCase().replace(/^www\./, "").split(".");
  const last2 = parts.slice(-2).join(".");
  return MULTI_PART_TLDS.includes(last2) ? parts.slice(-3).join(".") : last2;
}

function isSocial(host) {
  const h = host.toLowerCase();
  return SOCIAL.some(s => h === s || h.endsWith("." + s));
}

async function timed(promise, ms) {
  let t;
  const timeout = new Promise((_, rej) => { t = setTimeout(() => rej(new Error("timeout")), ms); });
  try { return await Promise.race([promise, timeout]); } finally { clearTimeout(t); }
}

async function webRisk(env, url) {
  if (!env.WEB_RISK_API_KEY) return "not checked (Google Web Risk is not set up)";
  const q = new URLSearchParams({ uri: url, key: env.WEB_RISK_API_KEY });
  for (const t of ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE"]) q.append("threatTypes", t);
  try {
    const r = await timed(fetch("https://webrisk.googleapis.com/v1/uris:search?" + q), 4000);
    if (!r.ok) return "check failed";
    const d = await r.json();
    const types = d.threat && d.threat.threatTypes;
    return types && types.length ? "FLAGGED by Google as: " + types.join(", ") : "not on Google's list of known dangerous sites";
  } catch { return "check failed"; }
}

async function domainAge(domain) {
  try {
    const r = await timed(fetch("https://rdap.org/domain/" + domain, { headers: { accept: "application/rdap+json" } }), 4000);
    if (!r.ok) return "unknown";
    const d = await r.json();
    const ev = (d.events || []).find(e => e.eventAction === "registration");
    if (!ev || !ev.eventDate) return "unknown";
    const days = Math.floor((Date.now() - Date.parse(ev.eventDate)) / 86400000);
    return `registered ${ev.eventDate.slice(0, 10)} (${days} days ago)`;
  } catch { return "unknown"; }
}

export function textOf(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
}

async function fetchPage(url) {
  const chain = [url.href];
  let current = url.href, res;
  try {
    for (let hop = 0; hop < 5; hop++) {
      res = await timed(fetch(current, { redirect: "manual", headers: { "user-agent": UA, accept: "text/html,*/*" } }), 5000);
      const loc = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && loc) {
        current = new URL(loc, current).href; chain.push(current); continue;
      }
      break;
    }
  } catch { return { ok: false, chain, note: "the page could not be loaded (it may be down, slow, or blocking automated visits)" }; }
  const type = res.headers.get("content-type") || "";
  if (!type.includes("html")) return { ok: true, chain, status: res.status, note: `not a web page (content type: ${type || "unknown"})` };
  // Read at most ~150 KB of the page.
  const reader = res.body.getReader(); const chunks = []; let size = 0;
  while (size < 150000) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); size += value.length; }
  try { reader.cancel(); } catch {}
  const all = new Uint8Array(size); let off = 0;
  for (const c of chunks) { all.set(c, off); off += c.length; }
  const html = new TextDecoder().decode(all);
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1];
  const desc = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i) || [])[1];
  const asksPassword = /<input[^>]+type=["']?password/i.test(html);
  const asksCard = /(card ?number|cvv|cvc|security code|expir(y|ation) date|cc-number)/i.test(html);
  const asksCode = /(verification code|one[- ]time (pass)?code|otp)/i.test(html);
  return {
    ok: true, chain, status: res.status,
    title: title ? textOf(title).slice(0, 200) : "",
    description: desc ? desc.slice(0, 300) : "",
    asksPassword, asksCard, asksCode,
    text: textOf(html).slice(0, 3000),
  };
}

// Builds a plain-text evidence report about up to two links found in the text.
// "priority" links (for example where a login form sends passwords) are checked first.
export async function inspectLinks(env, text, priority = []) {
  const urls = [];
  for (const p of priority) { try { const u = new URL(p); if (/^https?:$/.test(u.protocol) && !urls.some(x => x.hostname === u.hostname)) urls.push(u); } catch {} }
  for (const u of findUrls(text || "")) if (urls.length < 2 && !urls.some(x => x.hostname === u.hostname)) urls.push(u);
  urls.splice(2);
  if (!urls.length) return "";
  const reports = await Promise.all(urls.map(async (u) => {
    const host = u.hostname;
    if (isSocial(host)) return `LINK: ${u.href}\n- This is a social media link (${host}). Fakes.com cannot open social media pages; judge only what the person pasted or screenshotted.`;
    const domain = registrable(host);
    const [risk, age, page] = await Promise.all([webRisk(env, u.href), domainAge(domain), fetchPage(u)]);
    const lines = [`LINK: ${u.href}`, `- Google Web Risk: ${risk}`, `- Domain ${domain}: ${age}`];
    if (page.chain.length > 1) lines.push(`- Redirects: ${page.chain.join(" -> ")}`);
    if (!page.ok || page.note) lines.push(`- Page: ${page.note}`);
    if (page.ok && !page.note) {
      lines.push(`- Page status: ${page.status}`);
      if (page.title) lines.push(`- Page title: ${page.title}`);
      if (page.description) lines.push(`- Page description: ${page.description}`);
      lines.push(`- Asks for a password: ${page.asksPassword ? "yes" : "no"}; mentions card details: ${page.asksCard ? "yes" : "no"}; mentions one-time codes: ${page.asksCode ? "yes" : "no"}`);
      if (page.text) lines.push(`- Visible page text (start): ${page.text}`);
    }
    return lines.join("\n");
  }));
  return reports.join("\n\n");
}

// ---------- Saved emails (.eml) ----------

function decodeQP(s) {
  return s.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}
function decodeB64(s) {
  try { const bin = atob(s.replace(/\s+/g, "")); return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))); } catch { return ""; }
}
function splitHeaders(raw) {
  const i = raw.search(/\r?\n\r?\n/);
  const head = i === -1 ? raw : raw.slice(0, i);
  const body = i === -1 ? "" : raw.slice(i).replace(/^\r?\n\r?\n/, "");
  const headers = [];
  for (const line of head.split(/\r?\n/)) {
    if (/^[ \t]/.test(line) && headers.length) headers[headers.length - 1][1] += " " + line.trim();
    else { const k = line.indexOf(":"); if (k > 0) headers.push([line.slice(0, k).trim(), line.slice(k + 1).trim()]); }
  }
  return { headers, body };
}
function header(headers, name) { const h = headers.find(([k]) => k.toLowerCase() === name); return h ? h[1] : ""; }
function bodyText(headers, body, depth = 0) {
  const type = header(headers, "content-type").toLowerCase();
  const enc = header(headers, "content-transfer-encoding").toLowerCase();
  const boundary = (type.match(/boundary="?([^";]+)"?/) || [])[1];
  if (boundary && depth < 3) {
    const parts = body.split("--" + boundary).slice(1).filter(p => !p.startsWith("--"));
    let plain = "", html = "";
    for (const p of parts) {
      const sub = splitHeaders(p.replace(/^\r?\n/, ""));
      const t = bodyText(sub.headers, sub.body, depth + 1);
      const st = header(sub.headers, "content-type").toLowerCase();
      if (st.startsWith("text/plain") && !plain) plain = t;
      else if (!html && t) html = t;
    }
    return plain || html;
  }
  let text = enc.includes("base64") ? decodeB64(body) : enc.includes("quoted-printable") ? decodeQP(body) : body;
  if (type.includes("text/html")) text = textOf(text);
  return type.startsWith("text/") || !type ? text : "";
}

// Returns a plain-text summary of a raw .eml file: key headers, authentication results and the body.
export function summarizeEmail(raw) {
  const { headers, body } = splitHeaders(raw.slice(0, 400000));
  const pick = ["from", "reply-to", "return-path", "to", "subject", "date", "message-id"];
  const lines = ["SAVED EMAIL (from the .eml file)"];
  for (const k of pick) { const v = header(headers, k); if (v) lines.push(`- ${k}: ${v.slice(0, 300)}`); }
  const auth = headers.filter(([k]) => /^(authentication-results|arc-authentication-results|received-spf)$/i.test(k)).slice(0, 3);
  for (const [k, v] of auth) lines.push(`- ${k}: ${v.slice(0, 600)}`);
  const dkim = headers.filter(([k]) => k.toLowerCase() === "dkim-signature").map(([, v]) => (v.match(/\bd=([^;\s]+)/) || [])[1]).filter(Boolean);
  if (dkim.length) lines.push(`- DKIM signed by: ${dkim.join(", ")}`);
  const received = headers.filter(([k]) => k.toLowerCase() === "received").length;
  lines.push(`- Number of servers it passed through: ${received}`);
  if (!auth.length) lines.push("- No authentication results were found in this file.");
  const names = [...raw.matchAll(/(?:filename|name)\*?=(?:UTF-8'')?"?([^";\r\n]+)/gi)].map(m => decodeURIComponent(m[1].trim())).filter(n => /\.[a-z0-9]{2,5}$/i.test(n));
  const uniq = [...new Set(names)].slice(0, 10);
  if (uniq.length) {
    const risky = uniq.filter(n => DANGEROUS_EXT.includes(n.split(".").pop().toLowerCase()) || /\.(pdf|docx?|xlsx?|jpe?g|png)\.[a-z0-9]{2,4}$/i.test(n));
    lines.push(`- Attachments: ${uniq.join(", ")}`);
    if (risky.length) lines.push(`- DANGEROUS attachment types (can run programs or hide malware): ${risky.join(", ")}`);
  }
  lines.push(`- Body (start): ${bodyText(headers, body).replace(/\s+/g, " ").trim().slice(0, 5000)}`);
  return lines.join("\n");
}

// ---------- HTML attachments ----------
// Many phishing emails attach an .html file that opens a fake login page locally.
// We never run it; we read it as text and pull out where it sends data.
export function analyzeHtmlAttachment(name, html) {
  const src = html.slice(0, 1000000);
  const abs = (u) => { try { return new URL(u).href; } catch { return ""; } };
  const formTargets = [...src.matchAll(/<form[^>]*\saction=["']?([^"'\s>]+)/gi)].map(m => abs(m[1])).filter(Boolean);
  const scriptTargets = [...src.matchAll(/(?:fetch|open|\.post|\.ajax|action\s*=|location(?:\.href)?\s*=)\s*\(?\s*["'`](https?:\/\/[^"'`\s]+)/gi)].map(m => abs(m[1])).filter(Boolean);
  const links = [...src.matchAll(/href=["'](https?:\/\/[^"']+)/gi)].map(m => m[1]);
  const asksPassword = /<input[^>]+type=["']?password/i.test(src);
  const obfuscated = /(atob\(|unescape\(|eval\(|String\.fromCharCode|document\.write\()/i.test(src);
  const title = (src.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1];
  const targets = [...new Set([...formTargets, ...scriptTargets])].slice(0, 5);
  const lines = [`HTML ATTACHMENT: ${name}`];
  if (title) lines.push(`- Title: ${textOf(title).slice(0, 200)}`);
  lines.push(`- Asks for a password: ${asksPassword ? "yes" : "no"}`);
  lines.push(`- Sends form data to: ${targets.length ? targets.join(", ") : "no outside address found"}`);
  lines.push(`- Uses hidden or scrambled code: ${obfuscated ? "yes" : "no"}`);
  if (links.length) lines.push(`- Links to: ${[...new Set(links.map(l => { try { return new URL(l).hostname; } catch { return l; } }))].slice(0, 8).join(", ")}`);
  lines.push(`- Visible text (start): ${textOf(src).slice(0, 2500)}`);
  return { summary: lines.join("\n"), targets, linksText: links.slice(0, 10).join(" ") };
}

export const DANGEROUS_EXT = ["exe","msi","bat","cmd","com","scr","pif","js","jse","vbs","vbe","wsf","wsh","ps1","jar","lnk","iso","img","vhd","vhdx","zip","rar","7z","gz","tar","cab","hta","reg","dll","apk","dmg","pkg","app","xll","docm","xlsm","pptm","dotm","xltm","one","svg"];
