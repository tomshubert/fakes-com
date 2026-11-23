// office.fakes.com/office/admin : usage report for Tom (sign in with the Fakes.com admin account).
import { PublicClientApplication } from "@azure/msal-browser";
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[<>&"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
let pca, token = "";

async function init() {
  const cfg = await (await fetch("/api/office/config", { cache: "no-store" })).json();
  pca = new PublicClientApplication({ auth: { clientId: cfg.clientId, authority: "https://login.microsoftonline.com/organizations", redirectUri: location.origin + "/office/admin" }, cache: { cacheLocation: "sessionStorage" } });
  await pca.initialize();
  const r = await pca.handleRedirectPromise().catch(() => null);
  const acct = (r && r.account) || pca.getAllAccounts()[0];
  if (acct) { try { token = (await pca.acquireTokenSilent({ scopes: ["User.Read"], account: acct })).idToken; } catch {} }
  $("month").value = new Date().toISOString().slice(0, 7);
  if (token) load(); else { $("signin").hidden = false; $("status").textContent = "Sign in with the Fakes.com admin account to see usage."; }
}

async function signIn() {
  try { const r = await pca.loginPopup({ scopes: ["User.Read"], prompt: "select_account" }); token = r.idToken; $("signin").hidden = true; load(); }
  catch (e) { $("status").textContent = "Sign-in didn't finish: " + (e.errorCode || e.message); }
}

async function load() {
  $("status").textContent = "Loading…";
  const r = await fetch("/api/office/usage?month=" + encodeURIComponent($("month").value), { headers: { authorization: "Bearer " + token } });
  const d = await r.json();
  if (d.error) { $("status").textContent = d.error; $("signin").hidden = false; return; }
  $("status").textContent = `${d.month}: ${d.total_users} user${d.total_users === 1 ? "" : "s"}, ${d.total_checks} check${d.total_checks === 1 ? "" : "s"} across ${d.organizations.length} organization${d.organizations.length === 1 ? "" : "s"}.`;
  $("report").innerHTML = d.organizations.map(o => `
    <section class="org"><h2>${esc(o.org)} <span>${o.users} user${o.users === 1 ? "" : "s"} · ${o.checks} checks</span></h2>
    ${o.people.length ? `<table><thead><tr><th>Person</th><th>Checks</th></tr></thead><tbody>${o.people.map(p => `<tr><td>${esc(p.who)}</td><td>${p.checks}</td></tr>`).join("")}</tbody></table>` : `<p class="none">No use this month.</p>`}
    </section>`).join("");
}

$("signin").addEventListener("click", signIn);
$("month").addEventListener("change", () => token && load());
init().catch(e => { $("status").textContent = "Couldn't start: " + e.message; });
