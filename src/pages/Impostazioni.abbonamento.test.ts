/**
 * Impostazioni — Tab Abbonamento Free-Only verification
 * Story 13.15 — Pricing Page Free-Only Redesign
 *
 * Verifica: card Free-only, assenza Pro/Studio, banner community futuro,
 * backward compat Stripe portal per utenti Pro esistenti.
 */

import { describe, it, expect, beforeAll } from "vitest";

// Story 13.15 (Pricing Free-only) è stata superata da Epic 64/72/73
// (Banner Contestuali PRO, Waitlist Growth, PRO Launch Window).
// Questi test verificano un'assunzione di prodotto non più attuale.
describe.skip("Impostazioni Abbonamento — Free-only strategy (Story 13.15)", () => {
  let source: string;

  beforeAll(async () => {
    const fs = await import("fs");
    source = fs.readFileSync("src/pages/Impostazioni.tsx", "utf8");
  });

  it("shows Free plan card with €0/sempre", () => {
    expect(source).toContain("€0");
    expect(source).toContain("/sempre");
  });

  it("shows 'Piano attuale' badge on Free card", () => {
    expect(source).toContain("Piano attuale");
  });

  it("shows Free-only section title and description", () => {
    expect(source).toContain("Forfettino è gratuito");
  });

  it("does NOT contain Pro/Studio card references", () => {
    // PRO_FEATURES and STUDIO_FEATURES were removed
    expect(source).toContain("PRO_FEATURES and STUDIO_FEATURES removed");
    // No "Piano Pro" or "Piano Studio" card titles
    expect(source).not.toMatch(/<CardTitle[^>]*>Pro<\/CardTitle>/);
    expect(source).not.toMatch(/<CardTitle[^>]*>Studio<\/CardTitle>/);
  });

  it("does NOT contain billing toggle (isAnnual state)", () => {
    // The isAnnual state and Switch toggle for billing were removed
    expect(source).not.toContain("isAnnual");
    expect(source).not.toContain("Mensile");
    // "Annuale" may appear in other contexts but not as a billing toggle
  });

  it("shows community future banner", () => {
    expect(source).toContain("community dei Forfettini");
  });

  it("renders all FREE_FEATURES items", () => {
    expect(source).toContain("Dashboard fiscale completa");
    expect(source).toContain("Incassi manuali (max 10/anno)");
    expect(source).toContain("Import XML FatturaPA (max 10/anno)");
    expect(source).toContain("Scadenziario fiscale");
    expect(source).toContain("Calendario scadenze");
    expect(source).toContain("Costi e strumenti");
    expect(source).toContain("Impostazioni fiscali");
  });

  it("keeps Stripe portal access for existing Pro users (backward compat)", () => {
    // isPro conditional for portal access must still exist
    expect(source).toContain("Gestisci abbonamento");
    expect(source).toContain("openPortal");
  });

  it("does not reference 'Forfettino Pro' in success toast", () => {
    // The old toast said "Forfettino Pro" — now just generic
    expect(source).not.toContain("Forfettino Pro");
  });
});
