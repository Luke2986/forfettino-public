/**
 * Impostazioni — Sezione Sicurezza MFA toggle test
 * Story 16.3 — Verifica badge stato MFA, toggle attiva/disattiva,
 * AlertDialog conferma disattivazione, visibilità per OAuth.
 */

import { describe, it, expect, beforeAll } from "vitest";

describe("Impostazioni Sicurezza — source code verification (Story 16.3)", () => {
  let source: string;

  beforeAll(async () => {
    const fs = await import("fs");
    source = fs.readFileSync("src/pages/Impostazioni.tsx", "utf8");
  });

  it("has MFA status badge — shows Attivo when enrolled", () => {
    expect(source).toContain('data-testid="mfa-badge-active"');
    expect(source).toContain(">Attivo</Badge>");
  });

  it("has MFA status badge — shows Disattivo when not enrolled", () => {
    expect(source).toContain('data-testid="mfa-badge-inactive"');
    expect(source).toContain(">Disattivo</Badge>");
  });

  it("shows 'Attiva autenticazione a due fattori' button when MFA is off", () => {
    expect(source).toContain("Attiva autenticazione a due fattori");
    // Button navigates to /mfa/setup
    expect(source).toContain('navigate("/mfa/setup")');
  });

  it("shows 'Disattiva autenticazione a due fattori' button when MFA is on", () => {
    expect(source).toContain("Disattiva autenticazione a due fattori");
  });

  it("has AlertDialog for MFA disable confirmation", () => {
    // AlertDialog with title and destructive action
    expect(source).toContain("Disattivare il 2FA?");
    expect(source).toContain("Rimuovendo la verifica in due passaggi");
    expect(source).toContain("handleDisableMfa");
  });

  it("uses unenrollFactor from useMfa hook", () => {
    expect(source).toContain("unenrollFactor");
    // Ensure it's in the destructuring
    expect(source).toMatch(/const\s*\{[^}]*unenrollFactor[^}]*\}\s*=\s*useMfa\(\)/);
  });

  it("tracks mfaEnrolled and mfaFactorId state", () => {
    expect(source).toContain("const [mfaEnrolled, setMfaEnrolled] = useState(false)");
    expect(source).toContain("const [mfaFactorId, setMfaFactorId] = useState");
  });

  it("loads MFA enrollment status in useEffect", () => {
    expect(source).toContain("setMfaEnrolled(state.hasEnrolledFactor)");
    expect(source).toContain("setMfaFactorId(state.factorId)");
  });

  it("conditionally shows backup codes card only when MFA is enrolled", () => {
    // Backup codes card wrapped in {mfaEnrolled && (...)}
    expect(source).toContain("{mfaEnrolled && (");
    // The card must contain KeyRound and "Codici di backup"
    expect(source).toContain("Codici di backup");
  });

  it("hides Sicurezza tab for OAuth users", () => {
    // TabsTrigger conditionally rendered
    expect(source).toMatch(/\{isPasswordLogin && \(\s*<TabsTrigger value="sicurezza"/);
    // TabsContent conditionally rendered
    expect(source).toMatch(/\{isPasswordLogin && \(\s*<TabsContent value="sicurezza"/);
  });

  it("includes informative suggestion in CardDescription", () => {
    expect(source).toContain("Aggiungi un ulteriore livello di sicurezza al tuo account");
  });

  it("handleDisableMfa shows success toast on unenroll", () => {
    expect(source).toContain('title: "2FA disattivato"');
    expect(source).toContain("La verifica in due passaggi è stata rimossa");
  });

  it("handleDisableMfa shows error toast on failure", () => {
    expect(source).toContain("Impossibile disattivare il 2FA");
  });

  it("resets state after successful MFA disable", () => {
    expect(source).toContain("setMfaEnrolled(false)");
    expect(source).toContain("setMfaFactorId(null)");
    expect(source).toContain("setNewBackupCodes(null)");
  });
});
