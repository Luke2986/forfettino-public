/**
 * Story 36.3 — Quick link "Cambia password" source code verification tests
 * Pattern: source code verification (same as Story 36.1/36.2 tests)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC = fs.readFileSync(
  path.resolve(__dirname, "Impostazioni.tsx"),
  "utf-8"
);

describe("Story 36.3 — Quick link Cambia password", () => {
  // AC #1: Link visibile nel tab Profilo sotto la card Dati Personali
  it("renders 'Cambia password' link text in the source", () => {
    expect(SRC).toContain("Cambia password");
  });

  it("places link between Card closing and ProfileSummaryCard", () => {
    const cardCloseIdx = SRC.indexOf("Story 36.3");
    const profileSummaryIdx = SRC.indexOf("Story 36.2 — Riepilogo");
    expect(cardCloseIdx).toBeGreaterThan(-1);
    expect(profileSummaryIdx).toBeGreaterThan(-1);
    expect(cardCloseIdx).toBeLessThan(profileSummaryIdx);
  });

  // AC #2: onClick naviga al tab sicurezza (scoped al blocco "Cambia password")
  it("calls setActiveTab('sicurezza') in the Cambia password link block", () => {
    // Extract the Story 36.3 block to ensure setActiveTab is in the right context
    const blockStart = SRC.indexOf("Story 36.3");
    const blockEnd = SRC.indexOf("Story 36.2", blockStart);
    const linkBlock = SRC.slice(blockStart, blockEnd);
    expect(linkBlock).toContain('setActiveTab("sicurezza")');
  });

  // AC #3: Nascosto per utenti OAuth
  it("conditionally renders based on isPasswordLogin", () => {
    // The link block must be gated by isPasswordLogin
    expect(SRC).toMatch(/isPasswordLogin\s*&&\s*\(\s*\n?\s*<button/);
  });

  // AC #4: Stile link secondario
  it("uses correct link styling (text-sm text-slate-600 hover:text-slate-900 underline)", () => {
    expect(SRC).toContain("text-sm text-slate-600 hover:text-slate-900 underline");
  });

  // AC #4: Icona ChevronRight (h-4 w-4 per coerenza con ProfileSummaryCard)
  it("includes ChevronRight icon with h-4 w-4", () => {
    const blockStart = SRC.indexOf("Story 36.3");
    const blockEnd = SRC.indexOf("Story 36.2", blockStart);
    const linkBlock = SRC.slice(blockStart, blockEnd);
    expect(linkBlock).toContain("ChevronRight");
    expect(linkBlock).toContain("h-4 w-4");
  });

  // data-testid per future E2E tests
  it("has data-testid attribute", () => {
    expect(SRC).toContain('data-testid="change-password-link"');
  });

  // AC #5: Non duplica ChangePasswordCard
  it("does NOT duplicate ChangePasswordCard in Profilo tab", () => {
    // ChangePasswordCard should only appear in the sicurezza tab, not in profilo tab
    const profiloStart = SRC.indexOf('TabsContent value="profilo"');
    const profiloEnd = SRC.indexOf("</TabsContent>", profiloStart);
    const profiloSection = SRC.slice(profiloStart, profiloEnd);
    expect(profiloSection).not.toContain("<ChangePasswordCard");
  });

  // Uses button element (not anchor)
  it("uses button element with type='button'", () => {
    expect(SRC).toMatch(/type="button"[\s\S]*?Cambia password/);
  });
});
