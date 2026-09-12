/**
 * unsubscribe-token.ts — Token di disiscrizione firmato HMAC, stateless (Story 84-3, AC#11).
 *
 * Formato: `base64url(user_id) + "." + base64url(HMAC_SHA256(user_id, secret))`.
 * - Stateless: nessuna tabella token, nessuna PII in chiaro nel link (UUID base64url + firma).
 * - Verificabile server-side: senza il secret non è forgiabile un token valido per un altro utente.
 * - Idempotente lato consumo: il flip dell'opt-out è idempotente (vedi RPC unsubscribe_scadenze).
 *
 * VINCOLI cross-runtime: usa SOLO Web Crypto (`crypto.subtle`), disponibile in Deno e in Node 18+
 * (vitest/jsdom). NO import esm.sh, NO `Deno.*`. Funzioni async (HMAC è async via SubtleCrypto).
 */

const enc = new TextEncoder();

function base64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacSha256(message: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return new Uint8Array(sig);
}

/** Confronto a tempo costante (evita timing oracle sulla firma). */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Firma un token di disiscrizione per `userId`. */
export async function signUnsubscribeToken(userId: string, secret: string): Promise<string> {
  if (!userId || !secret) throw new Error("userId and secret are required");
  const payload = base64urlEncode(enc.encode(userId));
  const sig = base64urlEncode(await hmacSha256(userId, secret));
  return `${payload}.${sig}`;
}

/**
 * Verifica un token e ritorna lo `userId` se valido, altrimenti `null`.
 * Mai lanciare: input malformato → null (la EF risponde con pagina/HTTP di errore).
 */
export async function verifyUnsubscribeToken(
  token: string,
  secret: string,
): Promise<string | null> {
  if (!token || !secret || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  if (!payload || !sig) return null;

  let userId: string;
  try {
    userId = new TextDecoder().decode(base64urlDecode(payload));
  } catch {
    return null;
  }
  if (!userId) return null;

  const expected = await hmacSha256(userId, secret);
  let provided: Uint8Array;
  try {
    provided = base64urlDecode(sig);
  } catch {
    return null;
  }
  return timingSafeEqual(expected, provided) ? userId : null;
}
