/**
 * Test ClientRankedBars — Ranked bar chart pill-shaped, gradiente teal, free tier, dormenti.
 * Stories: 58.2 (base), 58.4 (trend/accordion), 59.1 (bugfix), 59.3 (chevron/hover/tipografia).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ClientRankedBars } from "./ClientRankedBars";
import type { ClientRevenue } from "@/lib/client-analytics";

// Mock useIsMobile
let mockIsMobile = false;
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mockIsMobile,
}));

// Mock UpgradeCTA
vi.mock("@/components/subscription/UpgradeCTA", () => ({
  UpgradeCTA: ({ feature }: { feature: string }) => (
    <div data-testid="upgrade-cta">{feature}</div>
  ),
}));

// Mock ClientMonthlyTrendChart
vi.mock("./ClientMonthlyTrendChart", () => ({
  ClientMonthlyTrendChart: (props: { clientId: string | null; clientName: string; fiscalYear: number }) => (
    <div data-testid="trend-chart" data-client-id={props.clientId} data-fiscal-year={props.fiscalYear}>
      {props.clientName} trend
    </div>
  ),
}));

// Mock formatCurrency (jsdom Intl limitation)
vi.mock("@/lib/money", () => ({
  formatCurrency: (v: number) => `€ ${v.toFixed(2)}`,
}));

// Mock formatDateIT
vi.mock("@/lib/schedule-helpers", () => ({
  formatDateIT: (d: string) => d,
}));

function makeClient(overrides: Partial<ClientRevenue> & { clientId: string | null; clientName: string; totalGross: number }): ClientRevenue {
  return {
    totalNet: overrides.totalGross * 0.8,
    receiptCount: 2,
    firstReceiptDate: "2026-01-01",
    lastReceiptDate: "2026-03-01",
    percentage: 0,
    ...overrides,
  };
}

const twoClients: ClientRevenue[] = [
  makeClient({ clientId: "c1", clientName: "Alpha", totalGross: 7000, percentage: 70 }),
  makeClient({ clientId: "c2", clientName: "Beta", totalGross: 3000, percentage: 30 }),
];

const fiveClients: ClientRevenue[] = [
  makeClient({ clientId: "c1", clientName: "Alpha", totalGross: 5000, percentage: 50 }),
  makeClient({ clientId: "c2", clientName: "Beta", totalGross: 2000, percentage: 20 }),
  makeClient({ clientId: "c3", clientName: "Gamma", totalGross: 1500, percentage: 15 }),
  makeClient({ clientId: "c4", clientName: "Delta", totalGross: 1000, percentage: 10 }),
  makeClient({ clientId: "c5", clientName: "Epsilon", totalGross: 500, percentage: 5 }),
];

const tenClients: ClientRevenue[] = Array.from({ length: 10 }, (_, i) => {
  const gross = 10000 - i * 900;
  return makeClient({
    clientId: `c${i + 1}`,
    clientName: `Client${i + 1}`,
    totalGross: gross,
    percentage: Math.round((gross / 55500) * 100),
  });
});

describe("ClientRankedBars", () => {
  beforeEach(() => {
    mockIsMobile = false;
  });

  // === AC #1: Ordine decrescente ===

  it("renderizza barre in ordine decrescente di fatturato (2 clienti)", () => {
    render(<ClientRankedBars data={twoClients} hasFullAccess={true} dormantClientIds={new Set()} selectedPeriod={2026} />);
    const rows = screen.getAllByTestId(/^bar-row-/);
    expect(rows).toHaveLength(2);
    expect(screen.getByTestId("bar-row-0")).toHaveTextContent("Alpha");
    expect(screen.getByTestId("bar-row-1")).toHaveTextContent("Beta");
  });

  it("renderizza barre in ordine decrescente (5 clienti)", () => {
    render(<ClientRankedBars data={fiveClients} hasFullAccess={true} dormantClientIds={new Set()} selectedPeriod={2026} />);
    const rows = screen.getAllByTestId(/^bar-row-/);
    expect(rows).toHaveLength(5);
    expect(rows[0]).toHaveTextContent("Alpha");
    expect(rows[4]).toHaveTextContent("Epsilon");
  });

  it("renderizza barre in ordine decrescente (10 clienti, top 7 visibili)", () => {
    render(<ClientRankedBars data={tenClients} hasFullAccess={true} dormantClientIds={new Set()} selectedPeriod={2026} />);
    const rows = screen.getAllByTestId(/^bar-row-/);
    expect(rows).toHaveLength(7);
    expect(rows[0]).toHaveTextContent("Client1");
    expect(rows[6]).toHaveTextContent("Client7");
  });

  // === AC #4: Label sopra la barra ===

  it("label sopra la barra (nome e importo nel bar-row)", () => {
    render(<ClientRankedBars data={twoClients} hasFullAccess={true} dormantClientIds={new Set()} selectedPeriod={2026} />);
    const row0 = screen.getByTestId("bar-row-0");
    expect(row0).toHaveTextContent("Alpha");
    expect(row0).toHaveTextContent("€ 7000.00");
    // La barra gradiente non contiene testo
    const bar0 = screen.getByTestId("bar-0");
    expect(bar0).toHaveTextContent("");
  });

  it("label sopra la barra anche per barra piccola", () => {
    const data = [
      makeClient({ clientId: "c1", clientName: "Big", totalGross: 10000, percentage: 90 }),
      makeClient({ clientId: "c2", clientName: "Tiny", totalGross: 100, percentage: 1 }),
    ];
    render(<ClientRankedBars data={data} hasFullAccess={true} dormantClientIds={new Set()} selectedPeriod={2026} />);
    const row1 = screen.getByTestId("bar-row-1");
    expect(row1).toHaveTextContent("Tiny");
    expect(row1).toHaveTextContent("€ 100.00");
  });

  // === AC #5: Badge dormiente ===

  it("mostra badge Dormiente per clienti nel set dormantClientIds", () => {
    const dormant = new Set<string | null>(["c2"]);
    render(<ClientRankedBars data={twoClients} hasFullAccess={true} dormantClientIds={dormant} selectedPeriod={2026} />);
    expect(screen.getByText("Dormiente")).toBeTruthy();
    const row0 = screen.getByTestId("bar-row-0");
    expect(row0.textContent).not.toContain("Dormiente");
  });

  // === AC #5: Riga secondaria ===

  it("mostra percentuale, incassi e ultimo incasso nella riga secondaria", () => {
    render(<ClientRankedBars data={twoClients} hasFullAccess={true} dormantClientIds={new Set()} selectedPeriod={2026} />);
    // Percentuale in span separato (story 59.3)
    expect(screen.getByText("70.0%")).toBeTruthy();
    expect(screen.getAllByText(/incassi · ultimo 2026-03-01/).length).toBeGreaterThan(0);
  });

  // === AC #6: "Senza cliente" sempre ultima barra ===

  it('"Senza cliente" è sempre l\'ultima barra con palette slate', () => {
    const dataWithNull = [
      makeClient({ clientId: null, clientName: "Senza cliente", totalGross: 5000, percentage: 50 }),
      makeClient({ clientId: "c1", clientName: "Alpha", totalGross: 3000, percentage: 30 }),
      makeClient({ clientId: "c2", clientName: "Beta", totalGross: 2000, percentage: 20 }),
    ];
    render(<ClientRankedBars data={dataWithNull} hasFullAccess={true} dormantClientIds={new Set()} selectedPeriod={2026} />);
    const rows = screen.getAllByTestId(/^bar-row-/);
    const lastRow = rows[rows.length - 1];
    expect(lastRow).toHaveTextContent("Senza cliente");
    expect(rows[0]).toHaveTextContent("Alpha");
  });

  // === [REGRESSION] H1: "Senza cliente" con fatturato massimo non causa overflow ===

  it('"Senza cliente" con fatturato massimo: maxGross calcolato da tutti i dati', () => {
    const dataWithHighNull = [
      makeClient({ clientId: null, clientName: "Senza cliente", totalGross: 8000, percentage: 80 }),
      makeClient({ clientId: "c1", clientName: "Alpha", totalGross: 2000, percentage: 20 }),
    ];
    render(<ClientRankedBars data={dataWithHighNull} hasFullAccess={true} dormantClientIds={new Set()} selectedPeriod={2026} />);
    const rows = screen.getAllByTestId(/^bar-row-/);
    expect(rows[0]).toHaveTextContent("Alpha");
    expect(rows[1]).toHaveTextContent("Senza cliente");
    expect(rows).toHaveLength(2);
  });

  // === [REGRESSION] H2: maxGross usa il max globale (null-client incluso) per evitare barre > 100% ===

  it("maxGross è il max globale: barra client reale non supera 100% anche se null-client ha gross superiore", () => {
    const dataWithHighNull = [
      makeClient({ clientId: null, clientName: "Senza cliente", totalGross: 8000, percentage: 80 }),
      makeClient({ clientId: "c1", clientName: "Alpha", totalGross: 2000, percentage: 20 }),
    ];
    render(<ClientRankedBars data={dataWithHighNull} hasFullAccess={true} dormantClientIds={new Set()} selectedPeriod={2026} />);
    // Alpha è sorted[0] (null forzato in fondo), maxGross deve essere 8000 (dal null-client)
    // Quindi Alpha (2000/8000 = 25%) NON deve avere width 100%
    const bar0 = screen.getByTestId("bar-0");
    const widthStr = bar0.style.width;
    const widthPct = parseFloat(widthStr);
    // Se maxGross fosse sorted[0].totalGross (2000), width sarebbe 100%
    // Con Math.max corretto, deve essere ~25% (con minimo 15% per label inside)
    expect(widthPct).toBeLessThan(50);
  });

  it("maxGross con tutti i totalGross a 0: nessun division error, barre a 0%", () => {
    const zeroData = [
      makeClient({ clientId: "c1", clientName: "Alpha", totalGross: 0, percentage: 0 }),
      makeClient({ clientId: "c2", clientName: "Beta", totalGross: 0, percentage: 0 }),
    ];
    render(<ClientRankedBars data={zeroData} hasFullAccess={true} dormantClientIds={new Set()} selectedPeriod={2026} />);
    const rows = screen.getAllByTestId(/^bar-row-/);
    expect(rows).toHaveLength(2);
    // No crash = pass
  });

  // === AC #6: Free tier blur ===

  it("Free tier: barre dalla 4a in poi con blur e UpgradeCTA", () => {
    render(<ClientRankedBars data={fiveClients} hasFullAccess={false} dormantClientIds={new Set()} selectedPeriod={2026} />);
    const rows = screen.getAllByTestId(/^bar-row-/);
    expect(rows).toHaveLength(5);
    expect(rows[0].className).not.toContain("blur");
    expect(rows[1].className).not.toContain("blur");
    expect(rows[2].className).not.toContain("blur");
    expect(rows[3].className).toContain("blur");
    expect(rows[4].className).toContain("blur");
    expect(screen.getByTestId("upgrade-cta")).toBeTruthy();
  });

  // === AC #6: "Mostra tutti" ===

  it('"Mostra tutti" visibile con >7 clienti, espande al click', () => {
    render(<ClientRankedBars data={tenClients} hasFullAccess={true} dormantClientIds={new Set()} selectedPeriod={2026} />);
    expect(screen.getAllByTestId(/^bar-row-/)).toHaveLength(7);
    const link = screen.getByText(/mostra tutti/i);
    expect(link).toHaveTextContent("Mostra tutti (10)");
    fireEvent.click(link);
    expect(screen.getAllByTestId(/^bar-row-/)).toHaveLength(10);
  });

  it('"Mostra tutti" NON visibile con ≤7 clienti', () => {
    render(<ClientRankedBars data={fiveClients} hasFullAccess={true} dormantClientIds={new Set()} selectedPeriod={2026} />);
    expect(screen.queryByText(/mostra tutti/i)).toBeNull();
  });

  // === AC #8: Responsive mobile ===

  it("su mobile l'importo appare nella riga secondaria", () => {
    mockIsMobile = true;
    render(<ClientRankedBars data={twoClients} hasFullAccess={true} dormantClientIds={new Set()} selectedPeriod={2026} />);
    const bar0 = screen.getByTestId("bar-0");
    expect(bar0.textContent).not.toContain("€ 7000.00");
    const row0 = screen.getByTestId("bar-row-0");
    expect(row0).toHaveTextContent("€ 7000.00");
  });
});

// === Story 58.4: Espansione trend mensile ===

describe("ClientRankedBars — Espansione Trend (Story 58.4)", () => {
  beforeEach(() => {
    mockIsMobile = false;
  });

  it("click su barra Pro → espansione visibile con ClientMonthlyTrendChart", () => {
    render(<ClientRankedBars data={twoClients} hasFullAccess={true} dormantClientIds={new Set()} selectedPeriod={2026} />);
    // Nessun trend chart inizialmente
    expect(screen.queryByTestId("trend-chart")).toBeNull();
    // Click sulla prima barra (Alpha)
    const barWrapper = screen.getByTestId("bar-row-0").querySelector('[role="button"]')!;
    fireEvent.click(barWrapper);
    // Trend chart visibile
    const chart = screen.getByTestId("trend-chart");
    expect(chart).toBeTruthy();
    expect(chart.getAttribute("data-client-id")).toBe("c1");
    expect(chart.getAttribute("data-fiscal-year")).toBe("2026");
  });

  it("accordion: click su seconda barra chiude la prima e apre la seconda", () => {
    render(<ClientRankedBars data={twoClients} hasFullAccess={true} dormantClientIds={new Set()} selectedPeriod={2026} />);
    // Espandi prima barra (Alpha)
    const bar0 = screen.getByTestId("bar-row-0").querySelector('[role="button"]')!;
    fireEvent.click(bar0);
    expect(screen.getByTestId("trend-expansion-c1")).toBeTruthy();
    // Click su seconda barra (Beta) → Alpha si chiude, Beta si apre
    const bar1 = screen.getByTestId("bar-row-1").querySelector('[role="button"]')!;
    fireEvent.click(bar1);
    expect(screen.queryByTestId("trend-expansion-c1")).toBeNull();
    expect(screen.getByTestId("trend-expansion-c2")).toBeTruthy();
  });

  it("click sulla stessa barra espansa → chiude l'espansione", () => {
    render(<ClientRankedBars data={twoClients} hasFullAccess={true} dormantClientIds={new Set()} selectedPeriod={2026} />);
    const bar0 = screen.getByTestId("bar-row-0").querySelector('[role="button"]')!;
    // Apri
    fireEvent.click(bar0);
    expect(screen.getByTestId("trend-expansion-c1")).toBeTruthy();
    // Chiudi
    fireEvent.click(bar0);
    expect(screen.queryByTestId("trend-expansion-c1")).toBeNull();
  });

  it("Free tier: click su barra NON espande (nessun role=button)", () => {
    render(<ClientRankedBars data={twoClients} hasFullAccess={false} dormantClientIds={new Set()} selectedPeriod={2026} />);
    // Nessun role=button sulle barre Free
    const row0 = screen.getByTestId("bar-row-0");
    expect(row0.querySelector('[role="button"]')).toBeNull();
    // Nessun trend chart
    expect(screen.queryByTestId("trend-chart")).toBeNull();
  });

  it("selectedPeriod === null (Totale): barre NON cliccabili", () => {
    render(<ClientRankedBars data={twoClients} hasFullAccess={true} dormantClientIds={new Set()} selectedPeriod={null} />);
    // Nessun role=button (canExpand = false)
    const row0 = screen.getByTestId("bar-row-0");
    expect(row0.querySelector('[role="button"]')).toBeNull();
    expect(screen.queryByTestId("trend-chart")).toBeNull();
  });

  it("barre Pro hanno cursor-pointer, Free no", () => {
    render(<ClientRankedBars data={twoClients} hasFullAccess={true} dormantClientIds={new Set()} selectedPeriod={2026} />);
    const barWrapper = screen.getByTestId("bar-row-0").querySelector('[role="button"]')!;
    expect(barWrapper.className).toContain("cursor-pointer");
  });

  it("barre con selectedPeriod=null non hanno cursor-pointer", () => {
    render(<ClientRankedBars data={twoClients} hasFullAccess={true} dormantClientIds={new Set()} selectedPeriod={null} />);
    // Nessun role=button → nessun cursor-pointer
    const row0 = screen.getByTestId("bar-row-0");
    const relativeDiv = row0.querySelector(".relative.cursor-pointer");
    expect(relativeDiv).toBeNull();
  });

  it('"Senza cliente" (clientId=null) si espande correttamente al click', () => {
    const dataWithNull = [
      makeClient({ clientId: "c1", clientName: "Alpha", totalGross: 5000, percentage: 50 }),
      makeClient({ clientId: null, clientName: "Senza cliente", totalGross: 3000, percentage: 30 }),
    ];
    render(<ClientRankedBars data={dataWithNull} hasFullAccess={true} dormantClientIds={new Set()} selectedPeriod={2026} />);
    // "Senza cliente" è l'ultima barra (sorted last)
    const rows = screen.getAllByTestId(/^bar-row-/);
    const nullRow = rows[rows.length - 1];
    const btn = nullRow.querySelector('[role="button"]')!;
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(screen.getByTestId("trend-expansion-__null__")).toBeTruthy();
    const chart = screen.getByTestId("trend-chart");
    expect(chart.getAttribute("data-client-id")).toBeNull();
    expect(chart.getAttribute("data-fiscal-year")).toBe("2026");
  });

  it("keyboard Enter espande la barra Pro", () => {
    render(<ClientRankedBars data={twoClients} hasFullAccess={true} dormantClientIds={new Set()} selectedPeriod={2026} />);
    const barBtn = screen.getByTestId("bar-row-0").querySelector('[role="button"]')!;
    fireEvent.keyDown(barBtn, { key: "Enter" });
    expect(screen.getByTestId("trend-expansion-c1")).toBeTruthy();
  });

  it("keyboard Space espande la barra Pro", () => {
    render(<ClientRankedBars data={twoClients} hasFullAccess={true} dormantClientIds={new Set()} selectedPeriod={2026} />);
    const barBtn = screen.getByTestId("bar-row-0").querySelector('[role="button"]')!;
    fireEvent.keyDown(barBtn, { key: " " });
    expect(screen.getByTestId("trend-expansion-c1")).toBeTruthy();
  });

  it("aria-expanded riflette lo stato dell'espansione", () => {
    render(<ClientRankedBars data={twoClients} hasFullAccess={true} dormantClientIds={new Set()} selectedPeriod={2026} />);
    const barBtn = screen.getByTestId("bar-row-0").querySelector('[role="button"]')!;
    expect(barBtn.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(barBtn);
    expect(barBtn.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(barBtn);
    expect(barBtn.getAttribute("aria-expanded")).toBe("false");
  });
});

// === Story 59.1: Bug Fix Critici e Cleanup Tecnico ===

describe("ClientRankedBars — Bug Fix 59.1", () => {
  beforeEach(() => {
    mockIsMobile = false;
  });

  // AC #1: Plurale singolare "1 incasso"
  it('singolare "1 incasso" quando receiptCount === 1', () => {
    const singleReceipt = [
      makeClient({ clientId: "c1", clientName: "alpha", totalGross: 5000, percentage: 100, receiptCount: 1 }),
    ];
    render(<ClientRankedBars data={singleReceipt} hasFullAccess={true} dormantClientIds={new Set()} selectedPeriod={2026} />);
    expect(screen.getByText(/1 incasso/)).toBeTruthy();
    expect(screen.queryByText(/1 incassi/)).toBeNull();
  });

  it('plurale "N incassi" quando receiptCount > 1', () => {
    render(<ClientRankedBars data={twoClients} hasFullAccess={true} dormantClientIds={new Set()} selectedPeriod={2026} />);
    expect(screen.getAllByText(/2 incassi/).length).toBeGreaterThan(0);
  });

  // AC #4: aria-label sulle barre cliccabili (usa nome lowercase per verificare capitalize)
  it("barre Pro hanno aria-label descrittivo con nome capitalizzato", () => {
    const lowerData = [
      makeClient({ clientId: "c1", clientName: "alpha", totalGross: 7000, percentage: 70 }),
      makeClient({ clientId: "c2", clientName: "beta", totalGross: 3000, percentage: 30 }),
    ];
    render(<ClientRankedBars data={lowerData} hasFullAccess={true} dormantClientIds={new Set()} selectedPeriod={2026} />);
    const barBtn = screen.getByTestId("bar-row-0").querySelector('[role="button"]')!;
    expect(barBtn.getAttribute("aria-label")).toBe("Espandi trend mensile per Alpha");
  });

  it("barre Free non hanno aria-label (nessun role=button)", () => {
    render(<ClientRankedBars data={twoClients} hasFullAccess={false} dormantClientIds={new Set()} selectedPeriod={2026} />);
    const row0 = screen.getByTestId("bar-row-0");
    expect(row0.querySelector('[aria-label]')).toBeNull();
  });

  // AC #3: Reset espansione al cambio di selectedPeriod (non solo null)
  it("expandedClientId si resetta al cambio di selectedPeriod (anno→anno)", () => {
    const { rerender } = render(
      <ClientRankedBars data={twoClients} hasFullAccess={true} dormantClientIds={new Set()} selectedPeriod={2026} />
    );
    // Espandi prima barra
    const barBtn = screen.getByTestId("bar-row-0").querySelector('[role="button"]')!;
    fireEvent.click(barBtn);
    expect(screen.getByTestId("trend-expansion-c1")).toBeTruthy();
    // Cambio anno → espansione si chiude
    rerender(<ClientRankedBars data={twoClients} hasFullAccess={true} dormantClientIds={new Set()} selectedPeriod={2025} />);
    expect(screen.queryByTestId("trend-expansion-c1")).toBeNull();
  });

  // AC #7: Capitalizzazione nomi clienti
  it("nomi clienti capitalizzati nella visualizzazione", () => {
    const lowerCase = [
      makeClient({ clientId: "c1", clientName: "alpha corp", totalGross: 5000, percentage: 100 }),
    ];
    render(<ClientRankedBars data={lowerCase} hasFullAccess={true} dormantClientIds={new Set()} selectedPeriod={2026} />);
    expect(screen.getByText("Alpha corp")).toBeTruthy();
  });

  it('"Senza cliente" resta invariato (non doppia capitalizzazione)', () => {
    const withNull = [
      makeClient({ clientId: null, clientName: "Senza cliente", totalGross: 3000, percentage: 100 }),
    ];
    render(<ClientRankedBars data={withNull} hasFullAccess={true} dormantClientIds={new Set()} selectedPeriod={2026} />);
    expect(screen.getByText("Senza cliente")).toBeTruthy();
  });
});

// === Story 59.3: Chevron, Hover, Tipografia ===

describe("ClientRankedBars — Chevron e Tipografia (Story 59.3)", () => {
  beforeEach(() => {
    mockIsMobile = false;
  });

  // AC #1: Chevron visibile per barre Pro con anno selezionato
  it("chevron visibile per barre Pro con anno selezionato", () => {
    render(<ClientRankedBars data={twoClients} hasFullAccess={true} dormantClientIds={new Set()} selectedPeriod={2026} />);
    // Ogni barra Pro ha un SVG chevron (aria-hidden)
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
    const chevrons = buttons[0].querySelectorAll('svg[aria-hidden="true"]');
    expect(chevrons.length).toBe(1);
    expect(chevrons[0].classList.contains("h-4")).toBe(true);
  });

  // AC #1: Chevron assente per Free
  it("chevron assente per barre Free", () => {
    render(<ClientRankedBars data={twoClients} hasFullAccess={false} dormantClientIds={new Set()} selectedPeriod={2026} />);
    // Free: nessun role=button, nessun chevron
    const row0 = screen.getByTestId("bar-row-0");
    expect(row0.querySelector('svg[aria-hidden="true"]')).toBeNull();
  });

  // AC #1: Chevron assente per Pro con selectedPeriod=null (Totale)
  it("chevron assente per Pro con selectedPeriod=null (Totale)", () => {
    render(<ClientRankedBars data={twoClients} hasFullAccess={true} dormantClientIds={new Set()} selectedPeriod={null} />);
    const row0 = screen.getByTestId("bar-row-0");
    expect(row0.querySelector('svg[aria-hidden="true"]')).toBeNull();
  });

  // AC #1: Chevron ruotato quando barra espansa
  it("chevron ruotato (rotate-180) quando barra espansa", () => {
    render(<ClientRankedBars data={twoClients} hasFullAccess={true} dormantClientIds={new Set()} selectedPeriod={2026} />);
    const barBtn = screen.getByTestId("bar-row-0").querySelector('[role="button"]')!;
    const chevron = barBtn.querySelector('svg[aria-hidden="true"]')!;
    // Prima del click: non ruotato
    expect(chevron.classList.contains("rotate-180")).toBe(false);
    // Click → espandi
    fireEvent.click(barBtn);
    expect(chevron.classList.contains("rotate-180")).toBe(true);
    // Click → chiudi
    fireEvent.click(barBtn);
    expect(chevron.classList.contains("rotate-180")).toBe(false);
  });

  // AC #4: Chevron nascosto su mobile
  it("chevron nascosto su mobile anche per barre Pro con anno", () => {
    mockIsMobile = true;
    render(<ClientRankedBars data={twoClients} hasFullAccess={true} dormantClientIds={new Set()} selectedPeriod={2026} />);
    const buttons = screen.getAllByRole("button");
    const chevrons = buttons[0].querySelectorAll('svg[aria-hidden="true"]');
    expect(chevrons.length).toBe(0);
  });

  // AC #3: Percentuale nella riga secondaria ha font-medium
  it("percentuale nella riga secondaria ha classe font-medium text-slate-600", () => {
    render(<ClientRankedBars data={twoClients} hasFullAccess={true} dormantClientIds={new Set()} selectedPeriod={2026} />);
    const pctSpan = screen.getByText("70.0%");
    expect(pctSpan.classList.contains("font-medium")).toBe(true);
    expect(pctSpan.classList.contains("text-slate-600")).toBe(true);
  });
});
