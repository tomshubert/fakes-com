// "Check with Fakes" Outlook add-in task pane.
// Signs the user in with their Microsoft 365 work account (nested app authentication: no extra
// sign-in screen inside Outlook), takes a full copy of the open email (like "forward as attachment"),
// sends it to office.fakes.com and shows the verdict.
import { createNestablePublicClientApplication } from "@azure/msal-browser";

const $ = id => document.getElementById(id);
const esc = s => String(s || "").replace(/[<>&"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
const VERDICTS = {
  likely_scam: ["Likely a scam", "bad", "Don't click anything in this email."],
  suspicious: ["Suspicious", "warn", "Be careful with this email."],
  no_red_flags_found: ["No red flags found", "good", "Nothing obviously wrong, but stay alert."],
  cant_tell: ["Can't tell", "warn", "We couldn't decide. Check with the sender another way."],
};

function show(state, html) {
  $("status").hidden = state !== "status";
  $("result").hidden = state !== "result";
  if (state === "status") $("status").innerHTML = html;
  if (state === "result") $("result").innerHTML = html;
}

let pca = null;
async function signIn(clientId) {
  if (!pca) pca = await createNestablePublicClientApplication({ auth: { clientId, authority: "https://login.microsoftonline.com/common" } });
  const req = { scopes: ["User.Read"] };
  try { return await pca.acquireTokenSilent(req); }
  catch { return await pca.acquireTokenPopup(req); }
}

function getEml() {
  return new Promise((resolve, reject) => {
    Office.context.mailbox.item.getAsFileAsync(r => r.status === Office.AsyncResultStatus.Succeeded ? resolve(r.value) : reject(r.error));
  });
}

function render(d) {
  const [label, tone, sub] = VERDICTS[d.verdict] || VERDICTS.cant_tell;
  const list = (title, items) => items && items.length ? `<h3>${title}</h3><ul>${items.map(i => `<li>${esc(i)}</li>`).join("")}</ul>` : "";
  show("result", `
    <div class="verdict ${tone}"><div class="label">${label}</div><div class="sub">${sub}</div></div>
    <p class="headline">${esc(d.headline)}</p>
    ${list("Red flags", d.red_flags)}
    ${list("Reassuring signs", d.reassuring_signs)}
    ${list("What to do", d.what_to_do)}
    ${d.how_to_verify ? `<h3>How to check for sure</h3><p>${esc(d.how_to_verify)}</p>` : ""}
    <p class="who">${d.cached ? "Already checked (saved result). " : ""}${(d.verdict === "likely_scam" || d.verdict === "suspicious") && !d.cached ? "Your IT person has been notified. " : ""}${esc(d.org || "")}</p>`);
}

async function run() {
  $("again").disabled = true;
  try {
    const req = Office.context.requirements;
    if (!req.isSetSupported("Mailbox", "1.14") || !req.isSetSupported("NestedAppAuth", "1.1")) {
      show("status", "This version of Outlook can't run the checker yet. Please update Outlook, or save the email and check it at <b>fakes.com/check</b>.");
      return;
    }
    show("status", '<span class="spin"></span>Signing you in…');
    const cfg = await (await fetch("/api/office/config", { cache: "no-store" })).json();
    if (!cfg.clientId) { show("status", "The office checker isn't switched on yet. Please ask your IT person."); return; }
    const auth = await signIn(cfg.clientId);
    show("status", '<span class="spin"></span>Checking this email… this takes about 20 seconds.');
    const eml = await getEml();
    const r = await fetch("/api/office/check", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + auth.idToken },
      body: JSON.stringify({ eml }),
    });
    const d = await r.json().catch(() => ({ error: "The checker had a problem. Please try again in a minute." }));
    if (d.error) { show("status", `<p class="err">${esc(d.error)}</p>`); return; }
    render(d);
  } catch (e) {
    console.error(e);
    show("status", `<p class="err">Something went wrong (${esc(e && (e.errorCode || e.code || e.message) || "unknown")}). Close this panel and try again.</p>`);
  } finally { $("again").disabled = false; }
}

// When the panel is pinned and the person moves to another email, don't check it automatically:
// show a button instead, so checks only happen on purpose.
function ready() {
  $("again").textContent = "Check this email";
  show("status", "Click <b>Check this email</b> to check the email that's open now.");
}

Office.onReady(() => {
  $("again").addEventListener("click", () => { $("again").textContent = "Check again"; run(); });
  if (Office.context.mailbox.addHandlerAsync && Office.EventType.ItemChanged)
    Office.context.mailbox.addHandlerAsync(Office.EventType.ItemChanged, () => { if (Office.context.mailbox.item) ready(); });
  run();
});
