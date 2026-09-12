/**
 * Impostazioni — ChangePasswordCard integration test
 * Story 16.1 — Verifica che il cambio password usi strongPasswordSchema
 * e mostri il PasswordStrengthIndicator.
 *
 * ChangePasswordCard è un componente interno non esportato di Impostazioni.tsx,
 * quindi testiamo l'integrazione dello schema condiviso indirettamente:
 * - Verifica che strongPasswordSchema sia usato (non validazione manuale)
 * - Verifica che il PasswordStrengthIndicator funzioni nel contesto cambio password
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { strongPasswordSchema } from "@/lib/password-validation";

// Since ChangePasswordCard is not exported, we test the shared schema behavior
// to guarantee consistent validation across all 3 forms

describe("ChangePasswordCard integration — strongPasswordSchema", () => {
  it("rejects old-style weak passwords (< 8 chars, no complexity)", () => {
    // This was the OLD behavior: `if (newPassword.length < 6) { ... }`
    // Now strongPasswordSchema must reject these
    const weakPasswords = ["12345", "abcde", "short"];
    weakPasswords.forEach((pw) => {
      const result = strongPasswordSchema.safeParse(pw);
      expect(result.success).toBe(false);
    });
  });

  it("rejects passwords that pass old min(6) but fail new policy", () => {
    // These 6+ char passwords would pass the OLD manual validation
    // but MUST fail the NEW strongPasswordSchema
    const oldValidNewInvalid = ["password", "123456", "abcdefgh"];
    oldValidNewInvalid.forEach((pw) => {
      const result = strongPasswordSchema.safeParse(pw);
      expect(result.success).toBe(false);
    });
  });

  it("accepts passwords meeting all 5 requirements", () => {
    const strongPasswords = ["StrongP1!", "MyP@ss8rd", "Abc12345!"];
    strongPasswords.forEach((pw) => {
      const result = strongPasswordSchema.safeParse(pw);
      expect(result.success).toBe(true);
    });
  });

  it("returns multiple issues for password failing multiple criteria", () => {
    // "abcdefgh" passes length + lowercase, fails uppercase + number + symbol
    const result = strongPasswordSchema.safeParse("abcdefgh");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBe(3); // uppercase + number + symbol
    }
  });

  it("returns first issue message for toast display pattern", () => {
    // Impostazioni uses result.error.issues[0].message for toast
    const result = strongPasswordSchema.safeParse("short");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(typeof result.error.issues[0].message).toBe("string");
      expect(result.error.issues[0].message.length).toBeGreaterThan(0);
    }
  });
});

describe("ChangePasswordCard — source code verification", () => {
  it("Impostazioni.tsx imports strongPasswordSchema (not manual validation)", async () => {
    // Read the source to verify no manual validation remains
    // This is a structural assertion — verify the import exists
    const fs = await import("fs");
    const source = fs.readFileSync("src/pages/Impostazioni.tsx", "utf8");

    // MUST have strongPasswordSchema import
    expect(source).toContain('import { strongPasswordSchema } from "@/lib/password-validation"');

    // MUST have PasswordStrengthIndicator import
    expect(source).toContain('import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator"');

    // MUST NOT have old manual validation pattern
    expect(source).not.toContain("newPassword.length < 6");
    expect(source).not.toContain("newPassword.length > 100");

    // MUST use safeParse
    expect(source).toContain("strongPasswordSchema.safeParse");

    // MUST include the indicator component
    expect(source).toContain("<PasswordStrengthIndicator");

    // Placeholder must be updated
    expect(source).toContain('placeholder="Minimo 8 caratteri"');
    expect(source).not.toMatch(/id="change-new-password"[\s\S]*?placeholder="Minimo 6 caratteri"/);
  });
});
