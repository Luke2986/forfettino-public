import { describe, it, expect } from "vitest";
import {
  signUnsubscribeToken,
  verifyUnsubscribeToken,
} from "../../../../supabase/functions/_shared/unsubscribe-token.ts";

const SECRET = "test-secret-please-change";
const USER = "11111111-2222-3333-4444-555555555555";

describe("unsubscribe-token — HMAC firmato (AC#11)", () => {
  it("sign → verify ritorna lo stesso user_id", async () => {
    const token = await signUnsubscribeToken(USER, SECRET);
    expect(token).toContain(".");
    expect(await verifyUnsubscribeToken(token, SECRET)).toBe(USER);
  });

  it("token deterministico per (user, secret) → idempotente nei link", async () => {
    const a = await signUnsubscribeToken(USER, SECRET);
    const b = await signUnsubscribeToken(USER, SECRET);
    expect(a).toBe(b);
  });

  it("non contiene l'UUID in chiaro (payload base64url)", async () => {
    const token = await signUnsubscribeToken(USER, SECRET);
    expect(token).not.toContain(USER);
  });

  it("secret sbagliato → null (non forgiabile)", async () => {
    const token = await signUnsubscribeToken(USER, SECRET);
    expect(await verifyUnsubscribeToken(token, "wrong-secret")).toBeNull();
  });

  it("firma manomessa → null", async () => {
    const token = await signUnsubscribeToken(USER, SECRET);
    const [payload] = token.split(".");
    const tampered = `${payload}.AAAA`;
    expect(await verifyUnsubscribeToken(tampered, SECRET)).toBeNull();
  });

  it("payload manomesso (altro utente) → null", async () => {
    const token = await signUnsubscribeToken(USER, SECRET);
    const sig = token.split(".")[1];
    const otherPayload = btoa("99999999-0000-0000-0000-000000000000")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(await verifyUnsubscribeToken(`${otherPayload}.${sig}`, SECRET)).toBeNull();
  });

  it("token malformato / vuoto → null (mai throw)", async () => {
    expect(await verifyUnsubscribeToken("", SECRET)).toBeNull();
    expect(await verifyUnsubscribeToken("nodot", SECRET)).toBeNull();
    expect(await verifyUnsubscribeToken("a.b.c", SECRET)).toBeNull();
  });
});
