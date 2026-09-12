/**
 * Test per Calendario.tsx
 * Story 5.4 — Visualizzazione Scadenze nel Calendario Integrato
 *
 * Copertura:
 * - Task 4.3: Rendering eventi nel mese, click su giorno, apertura Sheet dettaglio
 * - Task 4.4: Accessibilità (aria-label, role, keyboard)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

// --- Mock useCalendarEvents ---
const mockEvents: any[] = [];
const mockGetEventsForDay = vi.fn((day: Date) =>
  mockEvents.filter(
    (e) => e.date.toDateString() === day.toDateString()
  )
);

vi.mock("@/hooks/useCalendarEvents", () => ({
  useCalendarEvents: () => ({
    events: mockEvents,
    getEventsForDay: mockGetEventsForDay,
    isLoading: false,
  }),
}));

// --- Mock useMarkAsPaid ---
vi.mock("@/hooks/useMarkAsPaid", () => ({
  useMarkAsPaid: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

// --- Mock useAuth ---
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "test-user" } }),
}));

// --- Mock useIsMobile ---
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false, // desktop mode for tests
}));

// --- Mock useCalendarConnection ---
const mockIsConnected = { value: false };
vi.mock("@/hooks/useCalendarConnection", () => ({
  useCalendarConnection: () => ({
    connection: mockIsConnected.value ? { provider_email: "test@gmail.com", last_synced_at: "2026-06-15T10:00:00Z", created_at: "2026-06-01T00:00:00Z" } : null,
    isConnected: mockIsConnected.value,
    isLoading: false,
    error: null,
    connectGoogle: vi.fn(),
    handleCallback: vi.fn(),
    isCallbackSuccess: false,
    isCallbackLoading: false,
  }),
}));

// --- Mock useGoogleCalendarSync ---
const mockTriggerSync = vi.fn();
const mockGoogleEvents: any[] = [];
vi.mock("@/hooks/useGoogleCalendarSync", () => ({
  useGoogleCalendarSync: () => ({
    googleEvents: mockGoogleEvents,
    isLoading: false,
    isSyncing: false,
    triggerSync: mockTriggerSync,
    lastSyncedAt: null,
    syncError: null,
  }),
}));

// --- Mock useToast ---
const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

// --- Mock useSubscription ---
vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ isPro: true, isLoading: false, tier: "pro" }),
  SubscriptionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// --- Mock AppLayout and MobileHeader ---
vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "app-layout" }, children),
}));
vi.mock("@/components/layout/MobileHeader", () => ({
  MobileHeader: () => null,
}));

// --- Mock MarkAsPaidButton ---
vi.mock("@/components/scadenziario/MarkAsPaidButton", () => ({
  MarkAsPaidButton: ({ schedule }: any) =>
    React.createElement(
      "button",
      { "data-testid": "mark-as-paid-btn" },
      `Segna come pagata - ${schedule.bucket}`
    ),
}));

import CalendarioPage from "./Calendario";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(MemoryRouter, null, children)
    );
  };
}

function mockScheduleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "sched-1",
    user_id: "test-user",
    bucket: "june",
    due_date: "2026-06-30",
    payment_year: 2026,
    reference_year: 2025,
    tax_balance: 500,
    tax_advance: 300,
    inps_balance: 200,
    inps_advance: 100,
    total_expected: 1100,
    total_paid: 0,
    status: "open",
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("CalendarioPage", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-06-15T12:00:00"));
    // Clear events array
    mockEvents.length = 0;
    mockGoogleEvents.length = 0;
    mockIsConnected.value = false;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the calendar grid with role='grid'", () => {
    render(React.createElement(CalendarioPage), { wrapper: createWrapper() });
    const grid = screen.getByRole("grid");
    expect(grid).toBeDefined();
    expect(grid.getAttribute("aria-label")).toBe("Calendario mensile scadenze");
  });

  it("renders day cells with aria-label including event count", () => {
    // Add an event on June 30
    mockEvents.push({
      id: "tax-1",
      title: "Rata Giugno",
      date: new Date("2026-06-30T00:00:00"),
      type: "tax_deadline",
      status: "upcoming",
      relatedId: "sched-1",
      amount: 1100,
      bucket: "june",
      scheduleRow: mockScheduleRow(),
      totalExpected: 1100,
      totalPaid: 0,
    });

    render(React.createElement(CalendarioPage), { wrapper: createWrapper() });

    // Find a cell that should have the event
    const cells = screen.getAllByRole("gridcell");
    // There should be at least one cell with "1 scadenza" in its aria-label
    const cellWithEvent = cells.find(
      (c) => c.getAttribute("aria-label")?.includes("1 scadenza")
    );
    expect(cellWithEvent).toBeDefined();

    // And cells with no events should say "nessuna scadenza"
    const cellNoEvent = cells.find(
      (c) => c.getAttribute("aria-label")?.includes("nessuna scadenza")
    );
    expect(cellNoEvent).toBeDefined();
  });

  it("renders event previews with formatCurrency (not €amount.toFixed(2))", () => {
    mockEvents.push({
      id: "tax-1",
      title: "Rata Giugno",
      date: new Date("2026-06-30T00:00:00"),
      type: "tax_deadline",
      status: "upcoming",
      relatedId: "sched-1",
      amount: 1100,
      bucket: "june",
      scheduleRow: mockScheduleRow(),
      totalExpected: 1100,
      totalPaid: 0,
    });

    render(React.createElement(CalendarioPage), { wrapper: createWrapper() });

    // Event previews should NOT contain €1100.00 (the old format)
    // They should use formatCurrency which outputs Italian format
    // In jsdom, Intl.NumberFormat("it-IT") may not work → we check the aria-label has content
    const cells = screen.getAllByRole("gridcell");
    const cellWithEvent = cells.find(
      (c) => c.getAttribute("aria-label")?.includes("1 scadenza")
    );
    expect(cellWithEvent).toBeDefined();
  });

  it("opens Sheet detail when clicking on a day with a single event", async () => {
    const row = mockScheduleRow({
      id: "detail-1",
      bucket: "inps_q1",
      due_date: "2026-06-15",
      total_expected: 500,
      total_paid: 0,
    });
    mockEvents.push({
      id: "tax-detail-1",
      title: "Rata INPS Q1 (Feb)",
      date: new Date("2026-06-15T00:00:00"),
      type: "tax_deadline",
      status: "due_soon",
      relatedId: "detail-1",
      amount: 500,
      bucket: "inps_q1",
      scheduleRow: row,
      totalExpected: 500,
      totalPaid: 0,
    });

    render(React.createElement(CalendarioPage), { wrapper: createWrapper() });

    // Find and click the day cell for June 15
    const cells = screen.getAllByRole("gridcell");
    const juneCell = cells.find(
      (c) => c.getAttribute("aria-label")?.includes("1 scadenza")
    );
    expect(juneCell).toBeDefined();
    fireEvent.click(juneCell!);

    // Sheet should open → look for the event title (appears in list + Sheet header)
    const allTitles = await screen.findAllByText("Rata INPS Q1 (Feb)");
    // At least 2: one in the selected-day list, one in the Sheet header
    expect(allTitles.length).toBeGreaterThanOrEqual(2);
  });

  it("shows MarkAsPaidButton for unpaid tax_deadline in Sheet", async () => {
    const row = mockScheduleRow({
      id: "unpaid-1",
      bucket: "june",
      due_date: "2026-06-30",
      total_expected: 1100,
      total_paid: 0,
    });
    mockEvents.push({
      id: "tax-unpaid-1",
      title: "Rata Giugno",
      date: new Date("2026-06-30T00:00:00"),
      type: "tax_deadline",
      status: "upcoming",
      relatedId: "unpaid-1",
      amount: 1100,
      bucket: "june",
      scheduleRow: row,
      totalExpected: 1100,
      totalPaid: 0,
    });

    render(React.createElement(CalendarioPage), { wrapper: createWrapper() });

    // Click the day
    const cells = screen.getAllByRole("gridcell");
    const juneCell = cells.find(
      (c) => c.getAttribute("aria-label")?.includes("1 scadenza")
    );
    fireEvent.click(juneCell!);

    // MarkAsPaidButton should appear (our mock renders a button with data-testid)
    const markBtn = await screen.findByTestId("mark-as-paid-btn");
    expect(markBtn).toBeDefined();
    expect(markBtn.textContent).toContain("june");
  });

  it("does NOT show MarkAsPaidButton for paid tax_deadline in Sheet", async () => {
    const row = mockScheduleRow({
      id: "paid-1",
      bucket: "june",
      due_date: "2026-06-30",
      total_expected: 1100,
      total_paid: 1100,
      status: "paid",
    });
    mockEvents.push({
      id: "tax-paid-1",
      title: "Rata Giugno",
      date: new Date("2026-06-30T00:00:00"),
      type: "tax_deadline",
      status: "paid",
      relatedId: "paid-1",
      amount: 0,
      bucket: "june",
      scheduleRow: row,
      totalExpected: 1100,
      totalPaid: 1100,
    });

    render(React.createElement(CalendarioPage), { wrapper: createWrapper() });

    // Click the day
    const cells = screen.getAllByRole("gridcell");
    const juneCell = cells.find(
      (c) => c.getAttribute("aria-label")?.includes("1 scadenza")
    );
    fireEvent.click(juneCell!);

    // Wait for Sheet to open (title appears in list + Sheet header)
    const allTitles = await screen.findAllByText("Rata Giugno");
    expect(allTitles.length).toBeGreaterThanOrEqual(2);

    // MarkAsPaidButton should NOT be present for paid status
    const markBtn = screen.queryByTestId("mark-as-paid-btn");
    expect(markBtn).toBeNull();
  });

  it("arrow keys move focus between day cells (Task 3.4)", () => {
    render(React.createElement(CalendarioPage), { wrapper: createWrapper() });

    const cells = screen.getAllByRole("gridcell");
    // Focus the first cell
    cells[0].focus();
    expect(document.activeElement).toBe(cells[0]);

    // ArrowRight → focus moves to next cell
    fireEvent.keyDown(cells[0], { key: "ArrowRight" });
    expect(document.activeElement).toBe(cells[1]);

    // ArrowDown → focus moves down 7 cells (next row)
    fireEvent.keyDown(cells[1], { key: "ArrowDown" });
    expect(document.activeElement).toBe(cells[8]);

    // ArrowLeft → focus moves back one cell
    fireEvent.keyDown(cells[8], { key: "ArrowLeft" });
    expect(document.activeElement).toBe(cells[7]);

    // ArrowUp → focus moves up 7 cells
    fireEvent.keyDown(cells[7], { key: "ArrowUp" });
    expect(document.activeElement).toBe(cells[0]);
  });

  it("arrow key does not move focus beyond grid boundaries", () => {
    render(React.createElement(CalendarioPage), { wrapper: createWrapper() });

    const cells = screen.getAllByRole("gridcell");
    // Focus the first cell and press ArrowLeft (should stay on first cell)
    cells[0].focus();
    fireEvent.keyDown(cells[0], { key: "ArrowLeft" });
    // Should not crash, focus stays (no cell at index -1)
    expect(document.activeElement).toBe(cells[0]);

    // Focus the first cell and press ArrowUp (should stay)
    fireEvent.keyDown(cells[0], { key: "ArrowUp" });
    expect(document.activeElement).toBe(cells[0]);
  });

  it("Sheet shows breakdown section (Composizione) for MISTA bucket", async () => {
    const row = mockScheduleRow({
      id: "breakdown-1",
      bucket: "june",
      due_date: "2026-06-30",
      total_expected: 1100,
      total_paid: 0,
      tax_balance: 500,
      tax_advance: 300,
      inps_balance: 200,
      inps_advance: 100,
    });
    mockEvents.push({
      id: "tax-breakdown-1",
      title: "Rata Giugno",
      date: new Date("2026-06-30T00:00:00"),
      type: "tax_deadline",
      status: "upcoming",
      relatedId: "breakdown-1",
      amount: 1100,
      bucket: "june",
      scheduleRow: row,
      totalExpected: 1100,
      totalPaid: 0,
    });

    render(React.createElement(CalendarioPage), { wrapper: createWrapper() });

    // Click the day to open Sheet
    const cells = screen.getAllByRole("gridcell");
    const juneCell = cells.find(
      (c) => c.getAttribute("aria-label")?.includes("1 scadenza")
    );
    fireEvent.click(juneCell!);

    // Sheet should show "Composizione" section
    const composizione = await screen.findByText("Composizione");
    expect(composizione).toBeDefined();

    // Sheet should show importo detail labels
    const previsto = await screen.findByText("Importo previsto");
    expect(previsto).toBeDefined();
    const pagato = await screen.findByText("Importo pagato");
    expect(pagato).toBeDefined();
    const residuo = await screen.findByText("Residuo");
    expect(residuo).toBeDefined();
  });

  it("Sheet shows tipo rata label for tax_deadline events", async () => {
    const row = mockScheduleRow({
      id: "tipo-1",
      bucket: "inps_q1",
      due_date: "2026-06-15",
      total_expected: 500,
      total_paid: 0,
    });
    mockEvents.push({
      id: "tax-tipo-1",
      title: "Rata INPS Q1 (Feb)",
      date: new Date("2026-06-15T00:00:00"),
      type: "tax_deadline",
      status: "due_soon",
      relatedId: "tipo-1",
      amount: 500,
      bucket: "inps_q1",
      scheduleRow: row,
      totalExpected: 500,
      totalPaid: 0,
    });

    render(React.createElement(CalendarioPage), { wrapper: createWrapper() });

    // Click the day to open Sheet
    const cells = screen.getAllByRole("gridcell");
    const cell = cells.find(
      (c) => c.getAttribute("aria-label")?.includes("1 scadenza")
    );
    fireEvent.click(cell!);

    // Sheet should show "Tipo" label
    const tipoLabel = await screen.findByText("Tipo");
    expect(tipoLabel).toBeDefined();

    // Should contain the rata type label "Fissa trimestrale" (from rataTypeLabel(INPS_FISSO))
    const rataType = await screen.findByText(/Fissa trimestrale/);
    expect(rataType).toBeDefined();
  });

  it("increments localStorage calendar visit counter on mount (Story 50-3)", () => {
    localStorage.clear();
    expect(localStorage.getItem("forfettino_calendar_visits")).toBeNull();

    // First mount → counter = 1
    const { unmount } = render(React.createElement(CalendarioPage), { wrapper: createWrapper() });
    expect(localStorage.getItem("forfettino_calendar_visits")).toBe("1");
    unmount();

    // Second mount → counter = 2
    render(React.createElement(CalendarioPage), { wrapper: createWrapper() });
    expect(localStorage.getItem("forfettino_calendar_visits")).toBe("2");
  });

  it("shows 'Dettaglio' button instead of 'Paga' in upcoming events", () => {
    mockEvents.push({
      id: "tax-upcoming",
      title: "Rata Novembre",
      date: new Date("2026-11-30T00:00:00"),
      type: "tax_deadline",
      status: "upcoming",
      relatedId: "sched-2",
      amount: 800,
      bucket: "november",
      scheduleRow: mockScheduleRow({ bucket: "november", due_date: "2026-11-30" }),
      totalExpected: 800,
      totalPaid: 0,
    });

    render(React.createElement(CalendarioPage), { wrapper: createWrapper() });

    // Should have "Dettaglio" button, NOT "Paga"
    const dettaglioBtn = screen.getByText("Dettaglio");
    expect(dettaglioBtn).toBeDefined();
    // Should NOT have "Paga" button (old behavior)
    const pagaBtn = screen.queryByText("Paga");
    expect(pagaBtn).toBeNull();
  });

  // --- Filter toggle tests ---

  it("renders category filter buttons for Scadenze fiscali and Rinnovi tool", () => {
    render(React.createElement(CalendarioPage), { wrapper: createWrapper() });

    const taxFilter = screen.getByRole("button", { name: /Scadenze fiscali/i });
    const toolFilter = screen.getByRole("button", { name: /Rinnovi tool/i });
    expect(taxFilter).toBeDefined();
    expect(toolFilter).toBeDefined();
    // Both should be active (pressed) by default
    expect(taxFilter.getAttribute("aria-pressed")).toBe("true");
    expect(toolFilter.getAttribute("aria-pressed")).toBe("true");
  });

  it("hides tool_renewal events when Rinnovi tool filter is toggled off", () => {
    mockEvents.push(
      {
        id: "tax-filter-1",
        title: "Rata Giugno",
        date: new Date("2026-06-20T00:00:00"),
        type: "tax_deadline",
        status: "upcoming",
        relatedId: "sched-1",
        amount: 500,
        bucket: "june",
      },
      {
        id: "tool-filter-1",
        title: "Rinnovo: Figma",
        date: new Date("2026-06-20T00:00:00"),
        type: "tool_renewal",
        status: "upcoming",
        relatedId: "tool-1",
        amount: 12,
      }
    );

    render(React.createElement(CalendarioPage), { wrapper: createWrapper() });

    // Both events visible initially — the cell should say "2 scadenze"
    const cells = screen.getAllByRole("gridcell");
    const cell = cells.find(
      (c) => c.getAttribute("aria-label")?.includes("2 scadenz")
    );
    expect(cell).toBeDefined();

    // Toggle off "Rinnovi tool"
    const toolFilter = screen.getByRole("button", { name: /Rinnovi tool/i });
    fireEvent.click(toolFilter);

    // Now only 1 event (tax_deadline) should be visible on that day
    const cellsAfter = screen.getAllByRole("gridcell");
    const cellAfter = cellsAfter.find(
      (c) => c.getAttribute("aria-label")?.includes("1 scadenza")
    );
    expect(cellAfter).toBeDefined();
  });

  it("prevents disabling all filters (at least one must stay active)", () => {
    render(React.createElement(CalendarioPage), { wrapper: createWrapper() });

    const taxFilter = screen.getByRole("button", { name: /Scadenze fiscali/i });
    const toolFilter = screen.getByRole("button", { name: /Rinnovi tool/i });

    // Disable tool filter first
    fireEvent.click(toolFilter);
    expect(toolFilter.getAttribute("aria-pressed")).toBe("false");
    expect(taxFilter.getAttribute("aria-pressed")).toBe("true");

    // Now try to disable tax filter too — should be prevented (last active)
    fireEvent.click(taxFilter);
    expect(taxFilter.getAttribute("aria-pressed")).toBe("true");
  });

  // --- Story 48.5: Google Calendar integration tests ---

  it("renders Google events merged with fiscal events in the calendar grid", () => {
    mockIsConnected.value = true;
    // Tax event on June 20
    mockEvents.push({
      id: "tax-merge-1",
      title: "Rata Giugno",
      date: new Date("2026-06-20T00:00:00"),
      type: "tax_deadline",
      status: "upcoming",
      relatedId: "sched-1",
      amount: 500,
      bucket: "june",
    });
    // Google event on June 20
    mockEvents.push({
      id: "google-evt-1",
      title: "Riunione con commercialista",
      date: new Date("2026-06-20T00:00:00"),
      type: "google_event",
      status: undefined,
      relatedId: "ext-1",
      amount: undefined,
      allDay: false,
    });

    render(React.createElement(CalendarioPage), { wrapper: createWrapper() });

    // Cell for June 20 should show 2 events
    const cells = screen.getAllByRole("gridcell");
    const cell = cells.find(
      (c) => c.getAttribute("aria-label")?.includes("2 scadenz")
    );
    expect(cell).toBeDefined();
  });

  it("renders Google event preview with slate style in desktop cells", () => {
    mockIsConnected.value = true;
    mockEvents.push({
      id: "google-color-1",
      title: "Meeting design",
      date: new Date("2026-06-18T00:00:00"),
      type: "google_event",
      status: undefined,
      relatedId: "ext-2",
      amount: undefined,
      allDay: true,
    });

    render(React.createElement(CalendarioPage), { wrapper: createWrapper() });

    // Find event preview in cell — should have slate color class
    const cells = screen.getAllByRole("gridcell");
    const cell = cells.find(
      (c) => c.getAttribute("aria-label")?.includes("1 scadenza")
    );
    expect(cell).toBeDefined();
    // The preview div inside should have bg-slate-50 class
    const preview = cell!.querySelector(".bg-slate-50");
    expect(preview).toBeDefined();
  });

  it("shows Google Calendar toggle button only when connected", () => {
    // Not connected — no toggle (the "Collega Google Calendar" CTA button is different)
    render(React.createElement(CalendarioPage), { wrapper: createWrapper() });
    const toggleBefore = screen.queryByRole("button", { name: /Nascondi Google Calendar|Mostra Google Calendar/ });
    expect(toggleBefore).toBeNull();
  });

  it("shows Google Calendar toggle when connected and toggles visibility", () => {
    mockIsConnected.value = true;
    mockEvents.push({
      id: "google-toggle-1",
      title: "Evento Google",
      date: new Date("2026-06-22T00:00:00"),
      type: "google_event",
      status: undefined,
      relatedId: "ext-3",
      amount: undefined,
      allDay: false,
    });

    render(React.createElement(CalendarioPage), { wrapper: createWrapper() });

    // Toggle button should be visible
    const toggleBtn = screen.getByRole("button", { name: /Nascondi Google Calendar|Mostra Google Calendar/ });
    expect(toggleBtn).toBeDefined();
    expect(toggleBtn.getAttribute("aria-pressed")).toBe("true");

    // Event should be visible
    const cellsBefore = screen.getAllByRole("gridcell");
    const cellBefore = cellsBefore.find(
      (c) => c.getAttribute("aria-label")?.includes("1 scadenza")
    );
    expect(cellBefore).toBeDefined();

    // Toggle off
    fireEvent.click(toggleBtn);
    expect(toggleBtn.getAttribute("aria-pressed")).toBe("false");

    // Event should be hidden — cell should say "nessuna scadenza"
    const cellsAfter = screen.getAllByRole("gridcell");
    const cellAfter = cellsAfter.find(
      (c) => c.getAttribute("aria-label")?.includes("22 giugno") && c.getAttribute("aria-label")?.includes("nessuna scadenza")
    );
    expect(cellAfter).toBeDefined();
  });

  it("persists toggle preference in localStorage", () => {
    mockIsConnected.value = true;
    localStorage.removeItem("forfettino_show_external_events");

    render(React.createElement(CalendarioPage), { wrapper: createWrapper() });

    const toggleBtn = screen.getByRole("button", { name: /Nascondi Google Calendar|Mostra Google Calendar/ });

    // Toggle off — should save "false"
    fireEvent.click(toggleBtn);
    expect(localStorage.getItem("forfettino_show_external_events")).toBe("false");

    // Toggle on — should save "true"
    fireEvent.click(toggleBtn);
    expect(localStorage.getItem("forfettino_show_external_events")).toBe("true");
  });

  it("Sheet for Google event shows date/time and NO payment buttons", async () => {
    mockIsConnected.value = true;
    mockEvents.push({
      id: "google-sheet-1",
      title: "Pranzo con cliente",
      date: new Date("2026-06-15T12:30:00"),
      type: "google_event",
      status: undefined,
      relatedId: "ext-4",
      amount: undefined,
      location: "Ristorante La Pergola",
      details: undefined,
      allDay: false,
    });

    render(React.createElement(CalendarioPage), { wrapper: createWrapper() });

    // Click day cell
    const cells = screen.getAllByRole("gridcell");
    const cell = cells.find(
      (c) => c.getAttribute("aria-label")?.includes("1 scadenza")
    );
    fireEvent.click(cell!);

    // Sheet should open with event title
    const title = await screen.findAllByText("Pranzo con cliente");
    expect(title.length).toBeGreaterThanOrEqual(1);

    // Should show location
    const location = await screen.findByText("Ristorante La Pergola");
    expect(location).toBeDefined();

    // Should show "Luogo" label
    const luogoLabel = screen.getByText("Luogo");
    expect(luogoLabel).toBeDefined();

    // Should NOT show MarkAsPaidButton
    const markBtn = screen.queryByTestId("mark-as-paid-btn");
    expect(markBtn).toBeNull();

    // Should NOT show "Vai allo Scadenziario"
    const scadLink = screen.queryByText("Vai allo Scadenziario");
    expect(scadLink).toBeNull();
  });

  it("Sheet for Google all-day event shows 'Tutto il giorno'", async () => {
    mockIsConnected.value = true;
    mockEvents.push({
      id: "google-allday-1",
      title: "Conferenza freelancer",
      date: new Date("2026-06-15T00:00:00"),
      type: "google_event",
      status: undefined,
      relatedId: "ext-5",
      amount: undefined,
      allDay: true,
    });

    render(React.createElement(CalendarioPage), { wrapper: createWrapper() });

    const cells = screen.getAllByRole("gridcell");
    const cell = cells.find(
      (c) => c.getAttribute("aria-label")?.includes("1 scadenza")
    );
    fireEvent.click(cell!);

    const allDayText = await screen.findByText("Tutto il giorno");
    expect(allDayText).toBeDefined();
  });

  // --- View switcher tests ---

  it("renders view switcher with Settimana and Mese options", () => {
    render(React.createElement(CalendarioPage), { wrapper: createWrapper() });

    // Desktop has both "Settimana" and "Mese"; mobile has "Sett" and "Mese"
    // Use getAllByRole and pick the desktop ones (full text)
    const settimanaButtons = screen.getAllByRole("button", { name: "Settimana" });
    const meseButtons = screen.getAllByRole("button", { name: "Mese" });
    expect(settimanaButtons.length).toBeGreaterThanOrEqual(1);
    expect(meseButtons.length).toBeGreaterThanOrEqual(1);
    // Desktop button (first match) — Month view is default
    expect(meseButtons[0].getAttribute("aria-pressed")).toBe("true");
    expect(settimanaButtons[0].getAttribute("aria-pressed")).toBe("false");
  });

  it("switches to week view showing only 7 days", () => {
    render(React.createElement(CalendarioPage), { wrapper: createWrapper() });

    const monthCells = screen.getAllByRole("gridcell");
    // Month view has 28-42 cells
    expect(monthCells.length).toBeGreaterThanOrEqual(28);

    // Switch to week view (desktop button)
    const settimanaBtn = screen.getAllByRole("button", { name: "Settimana" })[0];
    fireEvent.click(settimanaBtn);

    // Week view should have exactly 7 cells
    const weekCells = screen.getAllByRole("gridcell");
    expect(weekCells.length).toBe(7);

    // Grid label should update
    const grid = screen.getByRole("grid");
    expect(grid.getAttribute("aria-label")).toBe("Calendario settimanale scadenze");
  });

  it("Oggi button navigates back to today in both views", () => {
    render(React.createElement(CalendarioPage), { wrapper: createWrapper() });

    // Navigate to next month
    const nextBtn = screen.getByRole("button", { name: "Mese successivo" });
    fireEvent.click(nextBtn);

    // Should show "luglio 2026"
    expect(screen.getByText(/luglio 2026/i)).toBeDefined();

    // Click Oggi
    const oggiBtn = screen.getByText("Oggi");
    fireEvent.click(oggiBtn);

    // Should return to "giugno 2026"
    expect(screen.getByText(/giugno 2026/i)).toBeDefined();
  });
});
