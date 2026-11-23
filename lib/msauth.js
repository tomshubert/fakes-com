// Verifies a Microsoft Entra ID (Microsoft 365 work account) ID token sent by the Outlook add-in.
// Checks the signature against Microsoft's published keys, the audience (our app), the issuer
// (the user's own organization) and the expiry. Returns the token's claims or throws.
const KEYS_URL = "https://login.microsoftonline.com/common/discovery/v2.0/keys";
let cache = { at: 0, keys: [] };

const b64url = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), c => c.charCodeAt(0));
const decodeJson = s => JSON.parse(new TextDecoder().decode(b64url(s)));

async function getKeys(force) {
  if (!force && cache.keys.length && Date.now() - cache.at < 6 * 3600 * 1000) return cache.keys;
  const r = await fetch(KEYS_URL);
  if (!r.ok) throw new Error("ms keys " + r.status);
  cache = { at: Date.now(), keys: (await r.json()).keys || [] };
  return cache.keys;
}

export async function verifyMsIdToken(token, clientId) {
  if (!token || !clientId) throw new Error("missing token");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("bad token");
  const head = decodeJson(parts[0]), claims = decodeJson(parts[1]);
  if (head.alg !== "RS256") throw new Error("bad alg");
  let jwk = (await getKeys(false)).find(k => k.kid === head.kid);
  if (!jwk) jwk = (await getKeys(true)).find(k => k.kid === head.kid);
  if (!jwk) throw new Error("unknown key");
  const key = await crypto.subtle.importKey("jwk", { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const good = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64url(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1]));
  if (!good) throw new Error("bad signature");
  const now = Math.floor(Date.now() / 1000);
  if (claims.aud !== clientId) throw new Error("wrong audience");
  if (!claims.tid || claims.iss !== `https://login.microsoftonline.com/${claims.tid}/v2.0`) throw new Error("wrong issuer");
  if (typeof claims.exp !== "number" || claims.exp < now - 60) throw new Error("expired");
  if (typeof claims.nbf === "number" && claims.nbf > now + 300) throw new Error("not yet valid");
  return claims;
}
