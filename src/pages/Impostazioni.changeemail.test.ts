/**
 * Impostazioni — ChangeEmailCard source code verification tests
 * Story 36.1 — Cambio Email Account
 *
 * ChangeEmailCard è un componente interno non esportato di Impostazioni.tsx.
 * Testiamo tramite source code verification (pattern identico a changepassword.test).
 */

import { describe, it, expect } from "vitest";
import fs from "fs";

const source = fs.readFileSync("src/pages/Impostazioni.tsx", "utf8");

describe("ChangeEmailCard — source code verification", () => {
  it("ChangeEmailCard component is defined", () => {
    expect(source).toContain("function ChangeEmailCard(");
  });

  it("calls supabase.auth.updateUser with email param", () => {
    expect(source).toContain("supabase.auth.updateUser({ email:");
  });

  it("has email validation (format check with min 2-char TLD)", () => {
    // Should validate email format before submitting, with min 2-char TLD
    expect(source).toMatch(/@[^\s@]+\.[^\s@]/);
    expect(source).toContain("{2,}");
  });

  it("has catch block for network errors", () => {
    const changeEmailSection = source.slice(
      source.indexOf("function ChangeEmailCard"),
      source.indexOf("export default function ImpostazioniPage")
    );
    expect(changeEmailSection).toContain("} catch {");
    expect(changeEmailSection).toContain("Impossibile aggiornare");
  });

  it("shows success toast after submit", () => {
    expect(source).toContain("Conferma richiesta");
    expect(source).toContain("Controlla la tua casella email per confermare il cambio");
  });

  it("shows error toast on Supabase failure", () => {
    // Uses destructive variant for error, same pattern as ChangePasswordCard
    expect(source).toContain('variant: "destructive"');
  });

  it("has loading state to prevent double submit", () => {
    // ChangeEmailCard should use disabled={loading} pattern
    const changeEmailSection = source.slice(
      source.indexOf("function ChangeEmailCard"),
      source.indexOf("export default function ImpostazioniPage")
    );
    expect(changeEmailSection).toContain("disabled={loading}");
    expect(changeEmailSection).toContain("setLoading(true)");
    expect(changeEmailSection).toContain("setLoading(false)");
  });

  it("has cancel button to close edit mode", () => {
    expect(source).toContain("Annulla");
    expect(source).toContain("setIsEditing(false)");
  });

  it("resets form on success", () => {
    expect(source).toContain('setNewEmail("")');
  });
});

describe("Profilo tab — OAuth email read-only", () => {
  it("checks app_metadata.provider for Google OAuth detection", () => {
    expect(source).toContain('app_metadata?.provider === "google"');
  });

  it("shows read-only message for Google OAuth users", () => {
    expect(source).toContain("Email gestita dal provider Google");
  });

  it("does NOT show old 'cannot be modified' message", () => {
    expect(source).not.toContain("L'email non può essere modificata da qui");
  });

  it("renders ChangeEmailCard for non-OAuth users", () => {
    expect(source).toContain("<ChangeEmailCard currentEmail={");
  });
});

describe("ChangeEmailCard — accessibility", () => {
  it("has htmlFor/id pairing on email input", () => {
    const changeEmailSection = source.slice(
      source.indexOf("function ChangeEmailCard"),
      source.indexOf("export default function ImpostazioniPage")
    );
    expect(changeEmailSection).toContain('id="change-email-new"');
    expect(changeEmailSection).toContain('htmlFor="change-email-new"');
  });

  it("has aria-describedby for help text", () => {
    expect(source).toContain('aria-describedby="change-email-help"');
    expect(source).toContain('id="change-email-help"');
  });

  it("has aria-invalid for validation errors", () => {
    expect(source).toContain("aria-invalid={!!validationError}");
  });

  it("has role=alert on validation error", () => {
    expect(source).toContain('role="alert"');
  });
});
