/**
 * Story 36.2 — ProfileSummaryCard source code verification tests
 * Pattern: source code verification (same as Story 36.1 tests)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC = fs.readFileSync(
  path.resolve(__dirname, "Impostazioni.tsx"),
  "utf-8"
);

describe("Story 36.2 — ProfileSummaryCard", () => {
  // AC #1: Sezione "I tuoi dati" con layout card conforme al design system
  it("defines ProfileSummaryCard component inline", () => {
    expect(SRC).toContain("function ProfileSummaryCard(");
  });

  it("renders card with title 'I tuoi dati'", () => {
    expect(SRC).toContain("I tuoi dati");
  });

  it("uses design system rounded-2xl for card", () => {
    // Card must use rounded-2xl per design system
    expect(SRC).toMatch(/ProfileSummaryCard[\s\S]*?rounded-2xl/);
  });

  it("uses design system shadow for card (ring shadow pattern)", () => {
    expect(SRC).toContain("shadow-[0_1px_2px_rgba(0,0,0,0.05),0_0_0_1px_rgba(23,23,23,0.05)]");
  });

  // AC #1: Dati personali section with badge
  it("renders 'Dati personali' section heading", () => {
    expect(SRC).toContain("Dati personali");
  });

  it("renders SummaryField helper for name, cognome, email", () => {
    expect(SRC).toContain("function SummaryField(");
    expect(SRC).toContain('label="Nome"');
    expect(SRC).toContain('label="Cognome"');
    expect(SRC).toContain('label="Email"');
  });

  // AC #1: Badge tipo login (Password/Google)
  it("shows login type badge (Password or Google)", () => {
    expect(SRC).toContain('badge={isGoogleOAuth ? "Google" : "Password"}');
  });

  it("detects OAuth via app_metadata.provider", () => {
    expect(SRC).toContain('app_metadata?.provider === "google"');
  });

  // AC #1: Dati fiscali section
  it("renders 'Dati fiscali' section heading", () => {
    expect(SRC).toContain("Dati fiscali");
  });

  it("renders all fiscal summary fields", () => {
    expect(SRC).toContain('label="Anno apertura P.IVA"');
    expect(SRC).toContain('label="Codice ATECO"');
    expect(SRC).toContain('label="Gestione INPS"');
    expect(SRC).toContain('label="Aliquota sostitutiva"');
    expect(SRC).toContain('label="Coefficiente di redditivita\'"');
    expect(SRC).toContain('label="Riduzioni attive"');
  });

  // AC #2: Link "Modifica parametri fiscali" cambia tab
  it("has link to switch to fiscale tab", () => {
    expect(SRC).toContain("Modifica parametri fiscali");
    expect(SRC).toContain('setActiveTab("fiscale")');
  });

  it("link uses teal-700 color", () => {
    expect(SRC).toContain("text-teal-700");
  });

  it("link has ChevronRight icon", () => {
    expect(SRC).toContain("ChevronRight");
  });

  // AC #3: Campo P.IVA
  it("has Partita IVA input field with id", () => {
    expect(SRC).toContain('id="partita-iva"');
    expect(SRC).toContain('htmlFor="partita-iva"');
  });

  // AC #4: P.IVA validation (11 digits)
  it("validates P.IVA with 11-digit regex", () => {
    expect(SRC).toMatch(/\\d\{11\}/);
  });

  it("strips non-digit characters from P.IVA input", () => {
    expect(SRC).toContain('.replace(/\\D/g, "")');
  });

  it("saves P.IVA via useUpdateProfile", () => {
    expect(SRC).toMatch(/updateProfile\.mutateAsync\(\{[\s\S]*?partita_iva/);
  });

  it("shows validation error for invalid P.IVA", () => {
    expect(SRC).toContain("La Partita IVA deve essere composta da 11 cifre");
  });

  it("P.IVA error uses aria-invalid and role=alert", () => {
    expect(SRC).toContain("aria-invalid={!!pivaError}");
    expect(SRC).toMatch(/role="alert"[\s\S]*?pivaError/);
  });

  // AC #5: Campi non compilati mostrano "Non specificato"
  it("shows 'Non specificato' for empty values in text-slate-500", () => {
    expect(SRC).toContain("Non specificato");
    expect(SRC).toMatch(/text-slate-500[\s\S]*?Non specificato/);
  });

  // AC #6: Layout responsive grid-cols-1 sm:grid-cols-2
  it("uses responsive grid layout", () => {
    expect(SRC).toContain("grid-cols-1 sm:grid-cols-2");
  });

  // Gestione INPS labels
  it("defines GESTIONE_LABELS mapping", () => {
    expect(SRC).toContain("GESTIONE_LABELS");
    expect(SRC).toContain('"Gestione Separata"');
    expect(SRC).toContain('"Artigiani"');
    expect(SRC).toContain('"Commercianti"');
  });

  // ATECO description lookup — catalogo statico (findAtecoByCode)
  it("looks up ATECO description from static catalog", () => {
    expect(SRC).toContain("findAtecoByCode");
    expect(SRC).toContain("atecoCode");
  });

  // Riduzioni formatting
  it("formats riduzioni attive correctly", () => {
    expect(SRC).toContain("Riduzione 35%");
    expect(SRC).toContain("Riduzione 50%");
    expect(SRC).toContain('"Nessuna"');
  });

  // Skeleton loading state
  it("shows Skeleton loading state", () => {
    expect(SRC).toMatch(/ProfileSummaryCard[\s\S]*?Skeleton/);
  });

  // Integration: ProfileSummaryCard is rendered in Profilo tab
  it("renders ProfileSummaryCard in the profilo tab", () => {
    expect(SRC).toContain("<ProfileSummaryCard");
  });

  // P.IVA hint text
  it("shows P.IVA format hint", () => {
    expect(SRC).toContain("11 cifre numeriche");
  });

  // Save button appears only when P.IVA changed
  it("shows save button only when P.IVA has changed", () => {
    expect(SRC).toContain("pivaHasChanged");
  });

  // Separator between sections
  it("uses Separator between dati personali and dati fiscali", () => {
    expect(SRC).toContain("<Separator />");
  });

  // Semantic HTML: dl/dt/dd
  it("uses semantic dl element for summary list", () => {
    expect(SRC).toMatch(/<dl[\s\S]*?grid/);
    expect(SRC).toContain("<dt");
    expect(SRC).toContain("<dd");
  });

  // --- Review fixes ---

  // Fix #1: ref-based init prevents P.IVA reset on profile refetch
  it("uses pivaInitialized ref for one-time sync (prevents reset bug)", () => {
    expect(SRC).toContain("pivaInitialized");
    expect(SRC).toContain("pivaInitialized.current");
    expect(SRC).toMatch(/useRef.*false/);
  });

  // Fix #2: no unsafe 'as any' cast on profile prop
  it("does NOT cast profile as any at call site", () => {
    expect(SRC).not.toMatch(/profile\s+as\s+any/);
  });

  // Fix #3: no 'as any' on mutation payload
  it("does NOT use 'as any' on partita_iva mutation payload", () => {
    // The mutateAsync call should NOT have 'as any'
    const mutateBlock = SRC.match(/mutateAsync\(\{[\s\S]*?\}\)/)?.[0] ?? "";
    expect(mutateBlock).not.toContain("as any");
  });

  // Fix #4: Enter key saves P.IVA
  it("handles Enter keydown to save P.IVA", () => {
    expect(SRC).toMatch(/onKeyDown[\s\S]*?Enter[\s\S]*?handleSavePiva/);
  });
});
