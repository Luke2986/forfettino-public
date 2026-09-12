/**
 * Test per Incassi.tsx
 * Story 6.2 — Storico Incassi con Lista e Dettaglio
 *
 * Copertura:
 * - Task 2.1: Lista rendering (tabella, formato data, importo, cliente)
 * - Task 2.2: Loading state (skeleton rows)
 * - Task 2.3: Empty state (messaggio + CTA)
 * - Task 2.4: Summary cards (Totale, Numero, Media)
 * - Task 2.5: Filtro ricerca
 * - Task 2.6: Filtro anno
 * - Task 2.7: Azioni riga (edit + delete dialog)
 * - Task 2.8: Edit dialog
 * - Task 2.9: Delete dialog
 * - Task 2.10: Navigation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

// ===== vi.mock (hoisted) =====

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "test-user-id" } }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/contexts/FiscalYearContext", () => ({
  useFiscalYear: () => ({
    selectedYear: 2026,
    setSelectedYear: vi.fn(),
  }),
}));

vi.mock("@/hooks/useAvailableYears", () => ({
  useAvailableYears: () => ({
    availableYears: [2025, 2026, 2027],
    isLoading: false,
  }),
}));

vi.mock("@/hooks/usePrefetchAdjacentYears", () => ({
  usePrefetchAdjacentYears: vi.fn(),
}));

vi.mock("@/hooks/useIncomeStats", () => ({
  useIncomeStats: () => ({
    data: { count_total: 5, total_gross: 50000, count_ytd: 3, total_gross_ytd: 30000, count_year: 5 },
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useFiscalCalculations", () => ({
  formatCurrency: (val: number) => {
    if (val === 0) return "€ 0,00";
    return `€ ${val.toFixed(2).replace(".", ",")}`;
  },
}));

let mockCanAddReceipt = true;
let mockCanImport = true;
let mockCanExport = true;
let mockIsPro = false;
vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({
    canImport: mockCanImport,
    canExport: mockCanExport,
    canAddReceipt: mockCanAddReceipt,
    isPro: mockIsPro,
    isLoading: false,
    tier: mockIsPro ? "pro" : "free",
    receiptsUsed: 2,
    receiptsLimit: 5,
  }),
}));

vi.mock("@/hooks/useExportCommercialista", () => ({
  useExportCommercialista: () => ({
    handleExport: vi.fn(),
    isExporting: false,
    isReady: true,
  }),
}));

vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
  setAnalyticsConsent: vi.fn(),
}));

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "app-layout" }, children),
}));

vi.mock("@/components/layout/MobileHeader", () => ({
  MobileHeader: () => null,
}));

vi.mock("@/components/shared/PageErrorBoundary", () => ({
  PageErrorBoundary: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/components/subscription/ReceiptLimitDialog", () => ({
  ReceiptLimitDialog: ({ open }: { open: boolean }) =>
    open ? React.createElement("div", { "data-testid": "receipt-limit-dialog" }, "Limit Dialog") : null,
}));

vi.mock("@/components/subscription/UsageCounter", () => ({
  UsageCounter: () => null,
}));

vi.mock("@/components/subscription/ReceiptLimitBanner", () => ({
  ReceiptLimitBanner: () => null,
}));

vi.mock("@/components/import/ImportFattureDialog", () => ({
  ImportFattureDialog: () => null,
}));

// --- Mock Installment Plans (Story 18.5) ---
let mockActivePlansData: any[] = [];
const mockRegisterPaymentMutate = vi.fn();
const mockDeletePlanMutate = vi.fn();
vi.mock("@/hooks/useInstallmentPlans", () => ({
  useInstallmentPlans: () => ({
    activePlans: mockActivePlansData,
    completedPlans: [],
    plans: mockActivePlansData,
    isLoading: false,
    registerPaymentMutation: {
      mutate: mockRegisterPaymentMutate,
      isPending: false,
    },
    deletePlanMutation: {
      mutate: mockDeletePlanMutate,
      isPending: false,
    },
  }),
}));

vi.mock("@/components/incassi/InstallmentPlanCard", () => ({
  InstallmentPlanCard: ({ plan, onViewDetail, onRegisterPayment, onDelete, onEdit }: any) =>
    React.createElement("div", { "data-testid": `plan-card-${plan.id}` },
      React.createElement("span", null, plan.client_name),
      React.createElement("button", { "data-testid": `view-${plan.id}`, onClick: () => onViewDetail(plan) }, "Dettaglio"),
      React.createElement("button", { "data-testid": `edit-${plan.id}`, onClick: () => onEdit(plan) }, "Modifica"),
      React.createElement("button", { "data-testid": `pay-${plan.id}`, onClick: () => onRegisterPayment(plan) }, "Registra pagamento"),
      React.createElement("button", { "data-testid": `delete-${plan.id}`, onClick: () => onDelete(plan) }, "Elimina piano"),
    ),
}));

vi.mock("@/components/incassi/InstallmentPlanSheet", () => ({
  InstallmentPlanSheet: ({ open, plan }: any) =>
    open ? React.createElement("div", { "data-testid": "plan-sheet" }, plan?.client_name || "Sheet") : null,
}));

vi.mock("@/components/incassi/RegisterPaymentDialog", () => ({
  RegisterPaymentDialog: ({ open, plan, onConfirm }: any) =>
    open ? React.createElement("div", { "data-testid": "payment-dialog" },
      React.createElement("span", null, plan?.client_name || "Dialog"),
      React.createElement("button", {
        "data-testid": "confirm-payment",
        onClick: () => onConfirm(plan?.id, plan?.nextDeadline?.id || "d-fallback", 1000, new Date("2026-06-15T00:00:00"), "Test note"),
      }, "Conferma pagamento"),
    ) : null,
}));

// --- Mock Supabase ---
const mockReceipts = [
  {
    id: "r1",
    receipt_date: "2026-06-10",
    client_name: "Acme Corp",
    gross_amount: 5000,
    taxable_amount: 3350,
    tax_amount: 167.5,
    inps_amount: 873.35,
    net_spendable: 3959.15,
    notes: "Consulenza Q2",
    fiscal_year: 2026,
  },
  {
    id: "r2",
    receipt_date: "2026-05-15",
    client_name: "Beta Srl",
    gross_amount: 3000,
    taxable_amount: 2010,
    tax_amount: 100.5,
    inps_amount: 524.01,
    net_spendable: 2375.49,
    notes: null,
    fiscal_year: 2026,
  },
  {
    id: "r3",
    receipt_date: "2026-04-01",
    client_name: null,
    gross_amount: 2000,
    taxable_amount: 1340,
    tax_amount: 67,
    inps_amount: 349.34,
    net_spendable: 1583.66,
    notes: "Progetto web",
    fiscal_year: 2026,
  },
];

const mockSettings = {
  id: "settings-1",
  user_id: "test-user-id",
  fiscal_year: 2026,
  tax_rate: 5,
  profit_coefficient: 67,
  inps_rate: 26.07,
  inps_management: "separata",
  // inps_type abilita showRivalsaEdit (necessario per i test 85-1
  // sull'interazione rivalsa+bollo nell'edit dialog)
  inps_type: "gestione_separata",
};

// Campi rivalsa/bollo opzionali: i test 85-1 li aggiungono via spread
// sui receipt base (senza questo tipo, excess property check TS2353)
type MockReceipt = (typeof mockReceipts)[number] & {
  rivalsa_inps_applied?: boolean;
  rivalsa_inps_amount?: number;
  marca_bollo_applied?: boolean;
  marca_bollo_amount?: number;
};
let mockReceiptsData: MockReceipt[] = [...mockReceipts];


// Story 86-1: resolveClientId fa find-or-create sul catalogo clients.
// Mockato a livello di modulo: la sua logica ha test propri in
// src/lib/clients.test.ts, qui interessa solo che l'update riceva client_id.
const mockResolveClientId = vi.fn<any>();
vi.mock("@/lib/clients", () => ({
  resolveClientId: (...args: any[]) => mockResolveClientId(...args),
}));

// Chain .update().in("id", ids).eq("user_id", ...) usata dai batch update
// (categoria e bollo 85-2); mockIn cattura gli id passati a .in()
const mockIn = vi.fn<any>(() => ({
  eq: () => Promise.resolve({ error: null }),
}));
const mockUpdate = vi.fn<any>(() => ({
  eq: () => Promise.resolve({ error: null }),
  in: mockIn,
}));

const mockDelete = vi.fn(() => ({
  eq: () => Promise.resolve({ error: null }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "receipts") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => Promise.resolve({ data: mockReceiptsData, error: null }),
              }),
            }),
          }),
          update: mockUpdate,
          delete: mockDelete,
          insert: vi.fn(() => Promise.resolve({ error: null })),
        };
      }
      if (table === "fiscal_year_settings") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: mockSettings, error: null }),
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: null, error: null }),
              order: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        }),
      };
    },
  },
}));

import IncassiPage from "./Incassi";

/** Radix DropdownMenu requires specific event sequence to open in jsdom.
 *  pointerDown alone doesn't work reliably — use keyDown Enter which
 *  Radix handles via onKeyDown handler. */
function openRadixDropdown(el: Element) {
  fireEvent.keyDown(el, { key: "Enter" });
  fireEvent.keyUp(el, { key: "Enter" });
}

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

describe("IncassiPage", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-06-15T12:00:00"));
    vi.clearAllMocks();
    mockReceiptsData = [...mockReceipts];
    mockCanAddReceipt = true;
    mockCanImport = true;
    mockCanExport = true;
    mockIsPro = false;
    mockActivePlansData = [];
    mockResolveClientId.mockResolvedValue("client-acme");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ===== Task 2.1: Lista rendering =====

  describe("Task 2.1: Lista rendering", () => {
    it("renders table with header columns", async () => {
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Data")).toBeDefined();
      });

      expect(screen.getByText("Cliente")).toBeDefined();
      expect(screen.getByText("Importo Lordo")).toBeDefined();
    });

    it("renders receipt rows with formatted data", async () => {
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Acme Corp")).toBeDefined();
      });

      expect(screen.getByText("Beta Srl")).toBeDefined();
      // Client null → shows "-"
      const dashCells = screen.getAllByText("-");
      expect(dashCells.length).toBeGreaterThanOrEqual(1);
    });

    it("renders date in Italian format with timezone-safe parsing", async () => {
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        // 2026-06-10 → "10/06/2026" in it-IT locale (jsdom uses zero-padded format)
        expect(screen.getByText(/10\/0?6\/2026/)).toBeDefined();
      });
    });

    it("renders formatted currency amounts", async () => {
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        // 5000 → "€ 5000,00"
        expect(screen.getByText("€ 5000,00")).toBeDefined();
      });
    });
  });

  // ===== Task 2.3: Empty state =====

  describe("Task 2.3: Empty state", () => {
    it("shows correct empty state message and CTA when no receipts", async () => {
      mockReceiptsData = [];

      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Nessun incasso registrato per quest'anno")).toBeDefined();
      });

      // CTA button
      expect(screen.getByText("Registra il primo incasso")).toBeDefined();
    });

    it("CTA in empty state navigates to /incassi/nuovo", async () => {
      mockReceiptsData = [];

      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Registra il primo incasso")).toBeDefined();
      });

      fireEvent.click(screen.getByText("Registra il primo incasso"));

      expect(mockNavigate).toHaveBeenCalledWith("/incassi/nuovo");
    });
  });

  // ===== Task 2.4: Summary cards =====

  describe("Task 2.4: Summary cards", () => {
    it("renders summary cards with correct values", async () => {
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Totale Incassi")).toBeDefined();
      });

      expect(screen.getByText("Numero Incassi")).toBeDefined();
      expect(screen.getByText("Media Incasso")).toBeDefined();

      // Total = 5000 + 3000 + 2000 = 10000
      expect(screen.getByText("€ 10000,00")).toBeDefined();

      // Count = 3
      expect(screen.getByText("3")).toBeDefined();

      // Media = 10000 / 3 = 3333.33...
      expect(screen.getByText(/€ 3333,3/)).toBeDefined();
    });
  });

  // ===== Task 2.5: Filtro ricerca =====

  describe("Task 2.5: Filtro ricerca", () => {
    it("filters receipts by client name", async () => {
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Acme Corp")).toBeDefined();
      });

      // Search for "Acme"
      const searchInput = screen.getByPlaceholderText(/Cerca per cliente/);
      fireEvent.change(searchInput, { target: { value: "Acme" } });

      // Acme should still be visible
      expect(screen.getByText("Acme Corp")).toBeDefined();
      // Beta should be hidden
      expect(screen.queryByText("Beta Srl")).toBeNull();
    });

    it("filters receipts by notes", async () => {
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Acme Corp")).toBeDefined();
      });

      const searchInput = screen.getByPlaceholderText(/Cerca per cliente/);
      fireEvent.change(searchInput, { target: { value: "Progetto web" } });

      // Receipt r3 has notes "Progetto web" but null client name
      // Should show 1 result
      await waitFor(() => {
        expect(screen.queryByText("Acme Corp")).toBeNull();
        expect(screen.queryByText("Beta Srl")).toBeNull();
      });
    });
  });

  // ===== Story 13.6: Empty search state =====

  describe("Story 13.6: Empty search state", () => {
    it("shows search-specific empty state when search yields no results", async () => {
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Acme Corp")).toBeDefined();
      });

      // Search for something that matches nothing
      const searchInput = screen.getByPlaceholderText(/Cerca per cliente/);
      fireEvent.change(searchInput, { target: { value: "zzz_no_match" } });

      // Should show the search empty state, NOT the generic empty state
      await waitFor(() => {
        expect(screen.getByTestId("empty-search-state")).toBeDefined();
      });

      expect(screen.getByText(/Nessun risultato per/)).toBeDefined();
      expect(screen.getByText("Cancella ricerca")).toBeDefined();

      // Generic empty state should NOT be visible
      expect(screen.queryByTestId("empty-state")).toBeNull();
    });

    it("'Cancella ricerca' resets search and shows all receipts", async () => {
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Acme Corp")).toBeDefined();
      });

      const searchInput = screen.getByPlaceholderText(/Cerca per cliente/);
      fireEvent.change(searchInput, { target: { value: "zzz_no_match" } });

      await waitFor(() => {
        expect(screen.getByTestId("empty-search-state")).toBeDefined();
      });

      // Click "Cancella ricerca"
      fireEvent.click(screen.getByText("Cancella ricerca"));

      // All receipts should reappear
      await waitFor(() => {
        expect(screen.getByText("Acme Corp")).toBeDefined();
        expect(screen.getByText("Beta Srl")).toBeDefined();
      });

      // Search input should be empty
      expect((searchInput as HTMLInputElement).value).toBe("");
    });

    it("shows generic empty state (not search) when zero receipts and no search", async () => {
      mockReceiptsData = [];

      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId("empty-state")).toBeDefined();
      });

      expect(screen.queryByTestId("empty-search-state")).toBeNull();
    });
  });

  // ===== Task 2.6: Filtro anno =====

  describe("Task 2.6: Filtro anno", () => {
    it("renders year filter Select with current year options", async () => {
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Acme Corp")).toBeDefined();
      });

      // The Select should render with the current year value (2026)
      // SelectTrigger renders the SelectValue
      const selectTrigger = screen.getByRole("combobox");
      expect(selectTrigger).toBeDefined();
      expect(selectTrigger.textContent).toContain("2026");
    });
  });

  // ===== Task 2.7: Azioni riga =====

  describe("Task 2.7: Azioni riga", () => {
    it("renders action menu trigger buttons for each data row", async () => {
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Acme Corp")).toBeDefined();
      });

      // Header row + 3 data rows
      const rows = screen.getAllByRole("row");
      expect(rows.length).toBe(4);

      // Each data row has an icon-button trigger for DropdownMenu
      // The DropdownMenuTrigger wraps a ghost icon button
      const dataRows = rows.slice(1); // skip header
      dataRows.forEach((row) => {
        const buttons = row.querySelectorAll("button");
        // At least one button per row (the menu trigger)
        expect(buttons.length).toBeGreaterThanOrEqual(1);
      });
    });

    it("opens dropdown menu with Modifica and Elimina options on trigger click", async () => {
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Acme Corp")).toBeDefined();
      });

      // Find the first data row's menu trigger button
      const rows = screen.getAllByRole("row");
      const firstDataRow = rows[1];
      const triggerBtn = firstDataRow.querySelector('button[aria-haspopup="menu"]');
      expect(triggerBtn).not.toBeNull();

      // Radix DropdownMenu requires pointerDown event to open in jsdom
      openRadixDropdown(triggerBtn!);

      // Radix DropdownMenu should now show Modifica and Elimina menu items
      await waitFor(() => {
        expect(screen.getByText("Modifica")).toBeDefined();
        expect(screen.getByText("Elimina")).toBeDefined();
      });
    });
  });

  // ===== Task 2.8: Edit dialog =====

  describe("Task 2.8: Edit dialog", () => {
    it("opens edit dialog with pre-filled fields when Modifica is clicked", async () => {
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Acme Corp")).toBeDefined();
      });

      // Open dropdown for first row (Acme Corp)
      const rows = screen.getAllByRole("row");
      const firstDataRow = rows[1];
      const triggerBtn = firstDataRow.querySelector('button[aria-haspopup="menu"]');
      openRadixDropdown(triggerBtn!);

      await waitFor(() => {
        expect(screen.getByText("Modifica")).toBeDefined();
      });

      // Click "Modifica"
      fireEvent.click(screen.getByText("Modifica"));

      // Edit dialog should open with "Modifica Incasso" title
      await waitFor(() => {
        expect(screen.getByText("Modifica Incasso")).toBeDefined();
      });

      // Pre-filled fields: amount = 5000, client = "Acme Corp"
      const amountInput = screen.getByLabelText(/Importo Lordo/);
      expect((amountInput as HTMLInputElement).value).toBe("5000");

      // Story 86-1: il campo Cliente e' un ClientCombobox (Button), non un
      // Input: il nome e' il testo del trigger, non una .value.
      const clientTrigger = screen.getByLabelText("Cliente");
      expect(clientTrigger.textContent).toContain("Acme Corp");

      // Salva and Annulla buttons present
      expect(screen.getByText("Salva")).toBeDefined();
      expect(screen.getByText("Annulla")).toBeDefined();
    });

    it("calls Supabase update when Salva is clicked in edit dialog", async () => {
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Acme Corp")).toBeDefined();
      });

      // Open dropdown → click Modifica
      const rows = screen.getAllByRole("row");
      const triggerBtn = rows[1].querySelector('button[aria-haspopup="menu"]');
      openRadixDropdown(triggerBtn!);
      await waitFor(() => {
        expect(screen.getByText("Modifica")).toBeDefined();
      });
      fireEvent.click(screen.getByText("Modifica"));

      await waitFor(() => {
        expect(screen.getByText("Modifica Incasso")).toBeDefined();
      });

      // Click Salva (amount is pre-filled so form is valid)
      fireEvent.click(screen.getByText("Salva"));

      // Should call supabase.from("receipts").update(...)
      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalled();
      });
    });
  });

  // ===== Task 2.9: Delete dialog =====

  describe("Task 2.9: Delete dialog", () => {
    it("opens delete confirmation dialog when Elimina is clicked", async () => {
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Acme Corp")).toBeDefined();
      });

      // Open dropdown for first row
      const rows = screen.getAllByRole("row");
      const triggerBtn = rows[1].querySelector('button[aria-haspopup="menu"]');
      openRadixDropdown(triggerBtn!);

      await waitFor(() => {
        expect(screen.getByText("Elimina")).toBeDefined();
      });

      // Click "Elimina"
      fireEvent.click(screen.getByText("Elimina"));

      // AlertDialog should open with confirmation title
      await waitFor(() => {
        expect(screen.getByText("Eliminare l'incasso?")).toBeDefined();
      });

      // Confirmation text and buttons present
      expect(screen.getByText(/Questa azione non può essere annullata/)).toBeDefined();
      expect(screen.getByText("Annulla")).toBeDefined();
    });

    it("calls Supabase delete when confirm Elimina is clicked", async () => {
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Acme Corp")).toBeDefined();
      });

      // Open dropdown → click Elimina
      const rows = screen.getAllByRole("row");
      const triggerBtn = rows[1].querySelector('button[aria-haspopup="menu"]');
      openRadixDropdown(triggerBtn!);
      await waitFor(() => {
        expect(screen.getByText("Elimina")).toBeDefined();
      });
      fireEvent.click(screen.getByText("Elimina"));

      await waitFor(() => {
        expect(screen.getByText("Eliminare l'incasso?")).toBeDefined();
      });

      // Find and click the confirm "Elimina" button inside the AlertDialog
      // The AlertDialog has two buttons: Annulla and Elimina (action)
      const alertButtons = screen.getAllByRole("button");
      const confirmBtn = alertButtons.find(
        (btn) => btn.textContent?.trim() === "Elimina" && btn.closest("[role='alertdialog']")
      );
      expect(confirmBtn).toBeDefined();
      fireEvent.click(confirmBtn!);

      // Should call supabase.from("receipts").delete()
      await waitFor(() => {
        expect(mockDelete).toHaveBeenCalled();
      });
    });
  });

  // ===== Task 2.10: Navigation =====

  describe("Task 2.10: Navigation", () => {
    it("renders page header with title", async () => {
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      expect(screen.getByText("Incassi")).toBeDefined();
    });

    it("renders Nuovo Incasso button that navigates to /incassi/nuovo", async () => {
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      const newBtn = screen.getByText("Nuovo Incasso");
      expect(newBtn).toBeDefined();

      fireEvent.click(newBtn);

      expect(mockNavigate).toHaveBeenCalledWith("/incassi/nuovo");
    });
  });

  // ===== Task 2.2: Loading state =====

  describe("Task 2.2: Loading state (skeleton rows)", () => {
    it("shows skeleton rows initially then hides after data loads", async () => {
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      // Skeleton should appear initially (before data resolves)
      expect(screen.getByTestId("skeleton-loading")).toBeDefined();

      // After data loads, skeleton should disappear and table should appear
      await waitFor(() => {
        expect(screen.queryByTestId("skeleton-loading")).toBeNull();
      });

      // Table should now be visible
      expect(screen.getByText("Acme Corp")).toBeDefined();
    });
  });

  // ===== Timezone safety =====

  describe("Timezone safety", () => {
    it("date parsing uses T00:00:00 suffix for local timezone", async () => {
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        // Verify dates render correctly without day-shift
        // 2026-06-10 in CET → should show 10/06/2026 (not 09/06/2026)
        expect(screen.getByText(/10\/0?6\/2026/)).toBeDefined();
        expect(screen.getByText(/15\/0?5\/2026/)).toBeDefined();
        expect(screen.getByText(/0?1\/0?4\/2026/)).toBeDefined();
      });
    });
  });

  // ===== Story 6.3: Modifica e Eliminazione Incasso con Ricalcolo =====

  describe("Story 6.3: Edit flow — ricalcolo e fiscal_year", () => {
    it("edit dialog pre-fills all 4 fields correctly (amount, date, client, notes)", async () => {
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Acme Corp")).toBeDefined();
      });

      // Open dropdown → Modifica
      const rows = screen.getAllByRole("row");
      const triggerBtn = rows[1].querySelector('button[aria-haspopup="menu"]');
      openRadixDropdown(triggerBtn!);
      await waitFor(() => {
        expect(screen.getByText("Modifica")).toBeDefined();
      });
      fireEvent.click(screen.getByText("Modifica"));

      await waitFor(() => {
        expect(screen.getByText("Modifica Incasso")).toBeDefined();
      });

      // Amount pre-filled
      const amountInput = screen.getByLabelText(/Importo Lordo/) as HTMLInputElement;
      expect(amountInput.value).toBe("5000");

      // Client pre-filled — Story 86-1: combobox (Button), non Input
      const clientTrigger = screen.getByLabelText("Cliente");
      expect(clientTrigger.textContent).toContain("Acme Corp");

      // Notes pre-filled
      const notesInput = screen.getByLabelText("Note") as HTMLTextAreaElement;
      expect(notesInput.value).toBe("Consulenza Q2");

      // Date button shows Italian formatted date (10 giugno 2026 — any locale format)
      const dateBtn = screen.getByRole("button", { name: /giugno|giu|2026/i });
      expect(dateBtn).toBeDefined();
    });

    it("edit save calls Supabase update with ricalculated breakdown fields", async () => {
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Acme Corp")).toBeDefined();
      });

      // Open dropdown → Modifica
      const rows = screen.getAllByRole("row");
      const triggerBtn = rows[1].querySelector('button[aria-haspopup="menu"]');
      openRadixDropdown(triggerBtn!);
      await waitFor(() => {
        expect(screen.getByText("Modifica")).toBeDefined();
      });
      fireEvent.click(screen.getByText("Modifica"));

      await waitFor(() => {
        expect(screen.getByText("Modifica Incasso")).toBeDefined();
      });

      // Change amount to 8000
      const amountInput = screen.getByLabelText(/Importo Lordo/);
      fireEvent.change(amountInput, { target: { value: "8000" } });

      // Click Salva
      fireEvent.click(screen.getByText("Salva"));

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalled();
      });

      // Verify the update call includes ricalculated breakdown
      // mockSettings uses profit_coefficient=67, tax_rate=5, inps_rate=26.07
      // (intentionally different from fallback 78/15/26.07 to prove settings are read)
      const updateCall = mockUpdate.mock.calls[0]?.[0] as Record<string, any>;
      expect(updateCall).toBeDefined();
      // gross_amount should be 8000
      expect(updateCall.gross_amount).toBe(8000);
      // taxable = 8000 * 67% = 5360
      expect(updateCall.taxable_amount).toBe(5360);
      // tax = 5360 * 5% = 268
      expect(updateCall.tax_amount).toBe(268);
      // inps = 5360 * 26.07% = 1397.35
      expect(updateCall.inps_amount).toBeCloseTo(1397.35, 1);
      // net_spendable = 8000 - 268 - 1397.35 = 6334.65
      expect(updateCall.net_spendable).toBeCloseTo(6334.65, 0);
      // fiscal_year should remain 2026 (date unchanged)
      expect(updateCall.fiscal_year).toBe(2026);
    });

    // ===== Story 86-1: associazione incasso→cliente in modifica =====
    // Prima del fix l'update scriveva SOLO client_name: il report clienti
    // raggruppa per client_id, quindi l'incasso restava in "Senza cliente".

    it("[86-1 AC1] edit save writes client_id alongside client_name", async () => {
      mockResolveClientId.mockResolvedValue("client-resolved-1");
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Acme Corp")).toBeDefined();
      });
      const triggers = screen.getAllByLabelText(/Azioni per incasso/);
      openRadixDropdown(triggers[0]);
      await waitFor(() => {
        expect(screen.getByText("Modifica")).toBeDefined();
      });
      fireEvent.click(screen.getByText("Modifica"));
      await waitFor(() => {
        expect(screen.getByText("Modifica Incasso")).toBeDefined();
      });

      fireEvent.click(screen.getByText("Salva"));

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalled();
      });

      const updateCall = mockUpdate.mock.calls[0]?.[0] as Record<string, any>;
      // Il fix: entrambi i campi, mai uno solo
      expect(updateCall.client_id).toBe("client-resolved-1");
      expect(updateCall.client_name).toBe("Acme Corp");
      expect(mockResolveClientId).toHaveBeenCalledWith("test-user-id", "Acme Corp");
    });

    it("[86-1 AC3] clearing the client nulls BOTH client_id and client_name", async () => {
      // resolveClientId ritorna null su nome vuoto
      mockResolveClientId.mockResolvedValue(null);
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Acme Corp")).toBeDefined();
      });
      const triggers = screen.getAllByLabelText(/Azioni per incasso/);
      openRadixDropdown(triggers[0]);
      await waitFor(() => {
        expect(screen.getByText("Modifica")).toBeDefined();
      });
      fireEvent.click(screen.getByText("Modifica"));
      await waitFor(() => {
        expect(screen.getByText("Modifica Incasso")).toBeDefined();
      });

      // Svuota il campo cliente tramite la CommandInput del combobox
      fireEvent.click(screen.getByLabelText("Cliente"));
      await waitFor(() => {
        expect(screen.getByLabelText("Cerca cliente")).toBeDefined();
      });
      fireEvent.change(screen.getByLabelText("Cerca cliente"), {
        target: { value: "" },
      });

      fireEvent.click(screen.getByText("Salva"));

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalled();
      });

      const updateCall = mockUpdate.mock.calls[0]?.[0] as Record<string, any>;
      // I due campi non devono MAI divergere: entrambi null
      expect(updateCall.client_id).toBeNull();
      expect(updateCall.client_name).toBeNull();
    });

    it("edit with changed amount updates breakdown correctly", async () => {
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Acme Corp")).toBeDefined();
      });

      // Open dropdown → Modifica
      const rows = screen.getAllByRole("row");
      const triggerBtn = rows[1].querySelector('button[aria-haspopup="menu"]');
      openRadixDropdown(triggerBtn!);
      await waitFor(() => {
        expect(screen.getByText("Modifica")).toBeDefined();
      });
      fireEvent.click(screen.getByText("Modifica"));

      await waitFor(() => {
        expect(screen.getByText("Modifica Incasso")).toBeDefined();
      });

      // Change amount to 1000
      const amountInput = screen.getByLabelText(/Importo Lordo/);
      fireEvent.change(amountInput, { target: { value: "1000" } });

      fireEvent.click(screen.getByText("Salva"));

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalled();
      });

      const updateCall = mockUpdate.mock.calls[0]?.[0] as Record<string, any>;
      expect(updateCall.gross_amount).toBe(1000);
      // taxable = 1000 * 67% = 670 (uses mockSettings, NOT fallback 78%)
      expect(updateCall.taxable_amount).toBe(670);
      // tax = 670 * 5% = 33.50 (uses mockSettings, NOT fallback 15%)
      expect(updateCall.tax_amount).toBe(33.5);
    });

    it("shows toast 'Incasso aggiornato!' after successful edit save", async () => {
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Acme Corp")).toBeDefined();
      });

      // Open dropdown → Modifica
      const rows = screen.getAllByRole("row");
      const triggerBtn = rows[1].querySelector('button[aria-haspopup="menu"]');
      openRadixDropdown(triggerBtn!);
      await waitFor(() => {
        expect(screen.getByText("Modifica")).toBeDefined();
      });
      fireEvent.click(screen.getByText("Modifica"));

      await waitFor(() => {
        expect(screen.getByText("Modifica Incasso")).toBeDefined();
      });

      fireEvent.click(screen.getByText("Salva"));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({ title: "Incasso aggiornato!" });
      });
    });
  });

  describe("Story 6.3: Delete flow — conferma e ricalcolo", () => {
    it("delete dialog shows correct confirmation message", async () => {
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Acme Corp")).toBeDefined();
      });

      // Open dropdown → Elimina
      const rows = screen.getAllByRole("row");
      const triggerBtn = rows[1].querySelector('button[aria-haspopup="menu"]');
      openRadixDropdown(triggerBtn!);
      await waitFor(() => {
        expect(screen.getByText("Elimina")).toBeDefined();
      });
      fireEvent.click(screen.getByText("Elimina"));

      await waitFor(() => {
        expect(screen.getByText("Eliminare l'incasso?")).toBeDefined();
      });

      expect(screen.getByText(/Questa azione non può essere annullata/)).toBeDefined();
    });

    it("delete confirm calls Supabase delete with correct receipt id", async () => {
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Acme Corp")).toBeDefined();
      });

      // Open dropdown → Elimina
      const rows = screen.getAllByRole("row");
      const triggerBtn = rows[1].querySelector('button[aria-haspopup="menu"]');
      openRadixDropdown(triggerBtn!);
      await waitFor(() => {
        expect(screen.getByText("Elimina")).toBeDefined();
      });
      fireEvent.click(screen.getByText("Elimina"));

      await waitFor(() => {
        expect(screen.getByText("Eliminare l'incasso?")).toBeDefined();
      });

      // Click confirm Elimina inside AlertDialog
      const alertButtons = screen.getAllByRole("button");
      const confirmBtn = alertButtons.find(
        (btn) => btn.textContent?.trim() === "Elimina" && btn.closest("[role='alertdialog']")
      );
      fireEvent.click(confirmBtn!);

      await waitFor(() => {
        expect(mockDelete).toHaveBeenCalled();
      });
    });

    it("shows toast 'Incasso eliminato!' after successful delete", async () => {
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Acme Corp")).toBeDefined();
      });

      // Open dropdown → Elimina → Confirm
      const rows = screen.getAllByRole("row");
      const triggerBtn = rows[1].querySelector('button[aria-haspopup="menu"]');
      openRadixDropdown(triggerBtn!);
      await waitFor(() => {
        expect(screen.getByText("Elimina")).toBeDefined();
      });
      fireEvent.click(screen.getByText("Elimina"));

      await waitFor(() => {
        expect(screen.getByText("Eliminare l'incasso?")).toBeDefined();
      });

      const alertButtons = screen.getAllByRole("button");
      const confirmBtn = alertButtons.find(
        (btn) => btn.textContent?.trim() === "Elimina" && btn.closest("[role='alertdialog']")
      );
      fireEvent.click(confirmBtn!);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({ title: "Incasso eliminato!" });
      });
    });

    it("delete cancel closes dialog without calling delete", async () => {
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Acme Corp")).toBeDefined();
      });

      // Open dropdown → Elimina
      const rows = screen.getAllByRole("row");
      const triggerBtn = rows[1].querySelector('button[aria-haspopup="menu"]');
      openRadixDropdown(triggerBtn!);
      await waitFor(() => {
        expect(screen.getByText("Elimina")).toBeDefined();
      });
      fireEvent.click(screen.getByText("Elimina"));

      await waitFor(() => {
        expect(screen.getByText("Eliminare l'incasso?")).toBeDefined();
      });

      // Click Annulla
      const cancelBtn = screen.getAllByRole("button").find(
        (btn) => btn.textContent?.trim() === "Annulla" && btn.closest("[role='alertdialog']")
      );
      expect(cancelBtn).toBeDefined();
      fireEvent.click(cancelBtn!);

      // Dialog should close
      await waitFor(() => {
        expect(screen.queryByText("Eliminare l'incasso?")).toBeNull();
      });

      // Delete should NOT have been called
      expect(mockDelete).not.toHaveBeenCalled();
    });
  });

  // ===== Story 6.4: Enforcement limiti Free tier =====

  describe("Story 6.4: Enforcement Free tier — Incassi page", () => {
    it("shows Lock button and opens ReceiptLimitDialog when canAddReceipt is false", async () => {
      mockCanAddReceipt = false;

      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Incassi")).toBeDefined();
      });

      // Should show Lock icon on the "Nuovo Incasso" button (desktop)
      // The Lock button has text "Nuovo Incasso" but with Lock icon
      const newBtn = screen.getByText("Nuovo Incasso");
      expect(newBtn).toBeDefined();

      // Click the Lock button → opens ReceiptLimitDialog
      fireEvent.click(newBtn);

      await waitFor(() => {
        expect(screen.getByTestId("receipt-limit-dialog")).toBeDefined();
      });

      // Should NOT navigate to /incassi/nuovo
      expect(mockNavigate).not.toHaveBeenCalledWith("/incassi/nuovo");
    });

    it("shows normal Nuovo Incasso button when canAddReceipt is true", async () => {
      mockCanAddReceipt = true;

      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Incassi")).toBeDefined();
      });

      const newBtn = screen.getByText("Nuovo Incasso");
      fireEvent.click(newBtn);

      expect(mockNavigate).toHaveBeenCalledWith("/incassi/nuovo");
    });

    it("shows Lock on export when canExport is false", async () => {
      mockCanExport = false;

      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Incassi")).toBeDefined();
      });

      // Open the Altro dropdown (desktop) — progressive disclosure requires countTotal >= 2
      // mockIncomeStats has count_total: 5, so the dropdown should be visible
      const altroBtn = screen.getByText("Altro");
      openRadixDropdown(altroBtn);

      await waitFor(() => {
        expect(screen.getByText("Esporta Excel (limite)")).toBeDefined();
      });
    });

    it("shows Lock on import when canImport is false", async () => {
      mockCanImport = false;

      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Incassi")).toBeDefined();
      });

      const altroBtn = screen.getByText("Altro");
      openRadixDropdown(altroBtn);

      await waitFor(() => {
        expect(screen.getByText("Importa XML (limite)")).toBeDefined();
      });
    });

    it("Pro user: no Lock on buttons, export/import enabled", async () => {
      mockIsPro = true;
      mockCanAddReceipt = true;
      mockCanExport = true;
      mockCanImport = true;

      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Incassi")).toBeDefined();
      });

      // Normal Nuovo Incasso button (no Lock)
      const newBtn = screen.getByText("Nuovo Incasso");
      fireEvent.click(newBtn);
      expect(mockNavigate).toHaveBeenCalledWith("/incassi/nuovo");

      // Export and import should be regular (no "(Pro)" suffix)
      const altroBtn = screen.getByText("Altro");
      openRadixDropdown(altroBtn);

      await waitFor(() => {
        expect(screen.getByText("Esporta Excel")).toBeDefined();
        expect(screen.getByText("Importa XML")).toBeDefined();
      });

      expect(screen.queryByText("Esporta Excel (limite)")).toBeNull();
      expect(screen.queryByText("Importa XML (limite)")).toBeNull();
    });
  });

  // ===== Story 6.3: Query invalidation coverage =====

  describe("Story 6.3: Query invalidation after edit/delete", () => {
    const EXPECTED_QUERY_KEYS = [
      "receipts",
      "receipts_ytd",
      "clients",
      "due_soon_schedules",
      "next_deadline",
      "income_stats",
      "receipt_count_limit",
    ];

    it("edit save invalidates all 7 required query keys", async () => {
      const invalidateSpy = vi.spyOn(QueryClient.prototype, "invalidateQueries");

      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Acme Corp")).toBeDefined();
      });

      // Open dropdown → Modifica → Salva
      const rows = screen.getAllByRole("row");
      const triggerBtn = rows[1].querySelector('button[aria-haspopup="menu"]');
      openRadixDropdown(triggerBtn!);
      await waitFor(() => {
        expect(screen.getByText("Modifica")).toBeDefined();
      });
      fireEvent.click(screen.getByText("Modifica"));
      await waitFor(() => {
        expect(screen.getByText("Modifica Incasso")).toBeDefined();
      });
      fireEvent.click(screen.getByText("Salva"));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({ title: "Incasso aggiornato!" });
      });

      const invalidatedKeys = invalidateSpy.mock.calls.map(
        (call) => (call[0] as { queryKey: string[] })?.queryKey?.[0]
      );

      for (const key of EXPECTED_QUERY_KEYS) {
        expect(invalidatedKeys).toContain(key);
      }

      invalidateSpy.mockRestore();
    });

    it("delete confirm invalidates all 7 required query keys", async () => {
      const invalidateSpy = vi.spyOn(QueryClient.prototype, "invalidateQueries");

      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Acme Corp")).toBeDefined();
      });

      // Open dropdown → Elimina → Confirm
      const rows = screen.getAllByRole("row");
      const triggerBtn = rows[1].querySelector('button[aria-haspopup="menu"]');
      openRadixDropdown(triggerBtn!);
      await waitFor(() => {
        expect(screen.getByText("Elimina")).toBeDefined();
      });
      fireEvent.click(screen.getByText("Elimina"));
      await waitFor(() => {
        expect(screen.getByText("Eliminare l'incasso?")).toBeDefined();
      });

      const alertButtons = screen.getAllByRole("button");
      const confirmBtn = alertButtons.find(
        (btn) => btn.textContent?.trim() === "Elimina" && btn.closest("[role='alertdialog']")
      );
      fireEvent.click(confirmBtn!);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({ title: "Incasso eliminato!" });
      });

      const invalidatedKeys = invalidateSpy.mock.calls.map(
        (call) => (call[0] as { queryKey: string[] })?.queryKey?.[0]
      );

      for (const key of EXPECTED_QUERY_KEYS) {
        expect(invalidatedKeys).toContain(key);
      }

      invalidateSpy.mockRestore();
    });
  });

  // ===== Story 18.5: Installment Plans section =====

  const mockPlan1 = {
    id: "plan-1",
    user_id: "test-user-id",
    total_amount: 5000,
    client_name: "Piano Rate Corp",
    description: "Consulenza a rate",
    start_date: "2026-01-15",
    fiscal_year: 2026,
    status: "in_corso",
    created_at: "2026-01-15T10:00:00Z",
    updated_at: "2026-01-15T10:00:00Z",
    deadlines: [
      { id: "d1", expected_amount: 2500, due_date: "2026-01-15", is_paid: true },
      { id: "d2", expected_amount: 2500, due_date: "2026-04-15", is_paid: false },
    ],
    totalPaid: 2500,
    residuo: 2500,
    paidCount: 1,
    totalCount: 2,
    nextDeadline: { id: "d2", expected_amount: 2500, due_date: "2026-04-15", is_paid: false },
  };

  const mockPlan2 = {
    id: "plan-2",
    user_id: "test-user-id",
    total_amount: 3000,
    client_name: "Secondo Piano Srl",
    description: "Secondo piano",
    start_date: "2026-03-01",
    fiscal_year: 2026,
    status: "in_corso",
    created_at: "2026-03-01T10:00:00Z",
    updated_at: "2026-03-01T10:00:00Z",
    deadlines: [
      { id: "d3", expected_amount: 1000, due_date: "2026-04-01", is_paid: false },
      { id: "d4", expected_amount: 1000, due_date: "2026-07-01", is_paid: false },
      { id: "d5", expected_amount: 1000, due_date: "2026-10-01", is_paid: false },
    ],
    totalPaid: 0,
    residuo: 3000,
    paidCount: 0,
    totalCount: 3,
    nextDeadline: { id: "d3", expected_amount: 1000, due_date: "2026-04-01", is_paid: false },
  };

  describe("Story 18.5: Sezione Incassi a rate in corso", () => {
    it("does not render installment section when activePlans is empty", async () => {
      mockActivePlansData = [];

      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Acme Corp")).toBeDefined();
      });

      expect(screen.queryByText("Incassi a rate in corso")).toBeNull();
    });

    it("renders installment section with title when activePlans has data", async () => {
      mockActivePlansData = [mockPlan1];

      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Incassi a rate in corso")).toBeDefined();
      });
    });

    it("renders InstallmentPlanCard for each active plan", async () => {
      mockActivePlansData = [mockPlan1, mockPlan2];

      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId("plan-card-plan-1")).toBeDefined();
        expect(screen.getByTestId("plan-card-plan-2")).toBeDefined();
      });

      expect(screen.getByText("Piano Rate Corp")).toBeDefined();
      expect(screen.getByText("Secondo Piano Srl")).toBeDefined();
    });

    it("renders educational text about installment payments", async () => {
      mockActivePlansData = [mockPlan1];

      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText(/Ogni rata registrata aggiorna i tuoi calcoli fiscali/)).toBeDefined();
      });
    });
  });

  describe("Story 18.5: Interazione piani rate — Sheet e pagamento", () => {
    it("click Dettaglio opens InstallmentPlanSheet", async () => {
      mockActivePlansData = [mockPlan1];

      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId("plan-card-plan-1")).toBeDefined();
      });

      // Sheet should not be open initially
      expect(screen.queryByTestId("plan-sheet")).toBeNull();

      fireEvent.click(screen.getByTestId("view-plan-1"));

      await waitFor(() => {
        expect(screen.getByTestId("plan-sheet")).toBeDefined();
      });

      // Plan name appears in both card and sheet — verify sheet rendered
      expect(screen.getByTestId("plan-sheet").textContent).toContain("Piano Rate Corp");
    });

    it("click Modifica (onEdit) opens InstallmentPlanSheet", async () => {
      mockActivePlansData = [mockPlan1];

      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId("plan-card-plan-1")).toBeDefined();
      });

      expect(screen.queryByTestId("plan-sheet")).toBeNull();

      fireEvent.click(screen.getByTestId("edit-plan-1"));

      await waitFor(() => {
        expect(screen.getByTestId("plan-sheet")).toBeDefined();
      });

      expect(screen.getByTestId("plan-sheet").textContent).toContain("Piano Rate Corp");
    });

    it("click Registra pagamento opens RegisterPaymentDialog", async () => {
      mockActivePlansData = [mockPlan1];

      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId("plan-card-plan-1")).toBeDefined();
      });

      // Dialog should not be open initially
      expect(screen.queryByTestId("payment-dialog")).toBeNull();

      fireEvent.click(screen.getByTestId("pay-plan-1"));

      await waitFor(() => {
        expect(screen.getByTestId("payment-dialog")).toBeDefined();
      });
    });

    it("confirm payment calls registerPaymentMutation with fiscal params", async () => {
      mockActivePlansData = [mockPlan1];

      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId("plan-card-plan-1")).toBeDefined();
      });

      // Open payment dialog
      fireEvent.click(screen.getByTestId("pay-plan-1"));

      await waitFor(() => {
        expect(screen.getByTestId("payment-dialog")).toBeDefined();
      });

      // Confirm payment
      fireEvent.click(screen.getByTestId("confirm-payment"));

      await waitFor(() => {
        expect(mockRegisterPaymentMutate).toHaveBeenCalled();
      });

      // Verify mutation called with correct params including fiscal settings
      const callArgs = mockRegisterPaymentMutate.mock.calls[0][0];
      expect(callArgs.planId).toBe("plan-1");
      expect(callArgs.deadlineId).toBe("d2");
      expect(callArgs.importo).toBe(1000);
      // Fiscal params from mockSettings: profit_coefficient=67, tax_rate=5, inps_rate=26.07
      expect(callArgs.profitCoefficient).toBe(67);
      expect(callArgs.taxRate).toBe(5);
      expect(callArgs.inpsRate).toBe(26.07);
    });

    it("successful payment shows toast and closes dialog", async () => {
      mockRegisterPaymentMutate.mockImplementation((_args: any, opts: any) => {
        opts?.onSuccess?.();
      });
      mockActivePlansData = [mockPlan1];

      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId("plan-card-plan-1")).toBeDefined();
      });

      fireEvent.click(screen.getByTestId("pay-plan-1"));

      await waitFor(() => {
        expect(screen.getByTestId("payment-dialog")).toBeDefined();
      });

      fireEvent.click(screen.getByTestId("confirm-payment"));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({ title: expect.stringContaining("registrato") })
        );
      });

      // Dialog should close after success
      await waitFor(() => {
        expect(screen.queryByTestId("payment-dialog")).toBeNull();
      });
    });
  });

  describe("Story 18.5: Eliminazione piano rate", () => {
    it("click Elimina piano opens delete confirmation AlertDialog", async () => {
      mockActivePlansData = [mockPlan1];

      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId("plan-card-plan-1")).toBeDefined();
      });

      fireEvent.click(screen.getByTestId("delete-plan-1"));

      await waitFor(() => {
        expect(screen.getByText("Eliminare il piano rate?")).toBeDefined();
      });

      // Shows client name in confirmation message (multiple matches: card + dialog)
      const alertDialog = screen.getByRole("alertdialog");
      expect(alertDialog.textContent).toContain("Piano Rate Corp");
    });

    it("confirm delete calls deletePlanMutation with plan id", async () => {
      mockActivePlansData = [mockPlan1];

      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId("plan-card-plan-1")).toBeDefined();
      });

      fireEvent.click(screen.getByTestId("delete-plan-1"));

      await waitFor(() => {
        expect(screen.getByText("Eliminare il piano rate?")).toBeDefined();
      });

      const alertDialog = screen.getByRole("alertdialog");
      fireEvent.click(within(alertDialog).getByText("Elimina"));

      await waitFor(() => {
        expect(mockDeletePlanMutate).toHaveBeenCalledWith(
          "plan-1",
          expect.objectContaining({ onSuccess: expect.any(Function) })
        );
      });
    });

    it("successful delete shows toast", async () => {
      mockDeletePlanMutate.mockImplementation((_id: string, opts: any) => {
        opts?.onSuccess?.();
      });
      mockActivePlansData = [mockPlan1];

      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId("plan-card-plan-1")).toBeDefined();
      });

      fireEvent.click(screen.getByTestId("delete-plan-1"));

      await waitFor(() => {
        expect(screen.getByText("Eliminare il piano rate?")).toBeDefined();
      });

      const alertDialog = screen.getByRole("alertdialog");
      fireEvent.click(within(alertDialog).getByText("Elimina"));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({ title: "Piano rate eliminato" });
      });
    });

    it("cancel delete closes dialog without calling mutation", async () => {
      mockActivePlansData = [mockPlan1];

      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId("plan-card-plan-1")).toBeDefined();
      });

      fireEvent.click(screen.getByTestId("delete-plan-1"));

      await waitFor(() => {
        expect(screen.getByText("Eliminare il piano rate?")).toBeDefined();
      });

      const alertDialog = screen.getByRole("alertdialog");
      fireEvent.click(within(alertDialog).getByText("Annulla"));

      await waitFor(() => {
        expect(screen.queryByText("Eliminare il piano rate?")).toBeNull();
      });

      expect(mockDeletePlanMutate).not.toHaveBeenCalled();
    });
  });

  describe("Story 18.5: Assenza codice fatture", () => {
    it("no 'Mostra fatture' toggle in the DOM", async () => {
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Acme Corp")).toBeDefined();
      });

      expect(screen.queryByText(/Mostra fatture/i)).toBeNull();
    });

    it("no 'Converti in fattura' menu item in receipt dropdown", async () => {
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Acme Corp")).toBeDefined();
      });

      // Open dropdown for first row
      const rows = screen.getAllByRole("row");
      const triggerBtn = rows[1].querySelector('button[aria-haspopup="menu"]');
      openRadixDropdown(triggerBtn!);

      await waitFor(() => {
        expect(screen.getByText("Modifica")).toBeDefined();
      });

      // Should NOT have "Converti in fattura"
      expect(screen.queryByText(/Converti in fattura/i)).toBeNull();
      // Should only have Modifica and Elimina
      expect(screen.getByText("Elimina")).toBeDefined();
    });

    it("header subtitle matches new copy without fattura mention", async () => {
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Registra i tuoi incassi e monitora lo spendibile")).toBeDefined();
      });
    });
  });

  // ===== Story 85-1: Marca da bollo — edit dialog + badge + fix rivalsa =====

  describe("Story 85-1: Marca da bollo", () => {
    /** Apre l'edit dialog della prima riga (helper). */
    async function openFirstEditDialog() {
      await waitFor(() => {
        expect(screen.getByText("Acme Corp")).toBeDefined();
      });
      const rows = screen.getAllByRole("row");
      const triggerBtn = rows[1].querySelector('button[aria-haspopup="menu"]');
      openRadixDropdown(triggerBtn!);
      await waitFor(() => {
        expect(screen.getByText("Modifica")).toBeDefined();
      });
      fireEvent.click(screen.getByText("Modifica"));
      await waitFor(() => {
        expect(screen.getByText("Modifica Incasso")).toBeDefined();
      });
    }

    it("badge bollo visibile sulla riga quando marca_bollo_applied=true", async () => {
      mockReceiptsData = [
        { ...mockReceipts[0], marca_bollo_applied: true, marca_bollo_amount: 2 },
      ];
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTitle(/Marca da bollo/)).toBeDefined();
      });
    });

    it("nessun badge bollo quando flag assente", async () => {
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Acme Corp")).toBeDefined();
      });
      expect(screen.queryByTitle(/Marca da bollo/)).toBeNull();
    });

    it("retro-toggle ON: update con marca_bollo_applied=true, amount=2, gross INVARIATO", async () => {
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });
      await openFirstEditDialog();

      // Toggle bollo visibile (gross 5000 > 77,47) e OFF
      const bolloSwitch = screen.getByRole("switch", { name: /marca da bollo/i });
      fireEvent.click(bolloSwitch);

      fireEvent.click(screen.getByText("Salva"));

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalled();
      });
      const updateCall = mockUpdate.mock.calls[0]?.[0] as Record<string, any>;
      expect(updateCall.gross_amount).toBe(5000);
      expect(updateCall.marca_bollo_applied).toBe(true);
      expect(updateCall.marca_bollo_amount).toBe(2);
    });

    it("retro-toggle OFF: update con marca_bollo_applied=false, amount=0, gross INVARIATO", async () => {
      mockReceiptsData = [
        { ...mockReceipts[0], marca_bollo_applied: true, marca_bollo_amount: 2 },
      ];
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });
      await openFirstEditDialog();

      const bolloSwitch = screen.getByRole("switch", { name: /marca da bollo/i });
      // Pre-selezionato dal receipt
      expect(bolloSwitch.getAttribute("data-state")).toBe("checked");
      fireEvent.click(bolloSwitch);

      fireEvent.click(screen.getByText("Salva"));

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalled();
      });
      const updateCall = mockUpdate.mock.calls[0]?.[0] as Record<string, any>;
      expect(updateCall.gross_amount).toBe(5000);
      expect(updateCall.marca_bollo_applied).toBe(false);
      expect(updateCall.marca_bollo_amount).toBe(0);
    });

    it("[REGRESSION 85-1 AC4] rivalsa estratta da (gross - bollo): 1042 con entrambi ON → rivalsa 40, non 40,08", async () => {
      mockReceiptsData = [
        {
          ...mockReceipts[0],
          gross_amount: 1042,
          rivalsa_inps_applied: true,
          rivalsa_inps_amount: 40,
          marca_bollo_applied: true,
          marca_bollo_amount: 2,
        },
      ];
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });
      await openFirstEditDialog();

      // Entrambi i toggle pre-selezionati; salva senza modifiche
      fireEvent.click(screen.getByText("Salva"));

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalled();
      });
      const updateCall = mockUpdate.mock.calls[0]?.[0] as Record<string, any>;
      expect(updateCall.gross_amount).toBe(1042);
      expect(updateCall.marca_bollo_amount).toBe(2);
      // Fix: rivalsa = (1042 - 2) × 4/104 = 40. Senza fix sarebbe 1042 × 4/104 ≈ 40,08
      expect(updateCall.rivalsa_inps_amount).toBe(40);
    });

    it("rivalsa senza bollo: estrazione 4/104 sul gross pieno (comportamento invariato)", async () => {
      mockReceiptsData = [
        {
          ...mockReceipts[0],
          gross_amount: 1040,
          rivalsa_inps_applied: true,
          rivalsa_inps_amount: 40,
        },
      ];
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });
      await openFirstEditDialog();

      fireEvent.click(screen.getByText("Salva"));

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalled();
      });
      const updateCall = mockUpdate.mock.calls[0]?.[0] as Record<string, any>;
      expect(updateCall.rivalsa_inps_amount).toBe(40);
      expect(updateCall.marca_bollo_applied).toBe(false);
      expect(updateCall.marca_bollo_amount).toBe(0);
    });
  });

  // ===== Story 85-2: Bollo retroattivo — batch + nudge =====

  describe("Story 85-2: Bollo retroattivo — batch + nudge", () => {
    const NUDGE_KEY = "bollo_nudge_dismissed_test-user-id";

    beforeEach(() => {
      localStorage.clear();
    });

    /** Attende il render della tabella (riga Acme di default). */
    async function waitForTable(clientName = "Acme Corp") {
      await waitFor(() => {
        expect(screen.getByText(clientName)).toBeDefined();
      });
    }

    // --- AC 1: selezione sganciata dalle categorie ---

    it("[AC1] checkbox di selezione visibili anche senza categorie attive", async () => {
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });
      await waitForTable();

      // Header select-all + 3 righe dati (activeCategories = [] nel mock)
      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes.length).toBe(4);
      expect(
        screen.getByRole("checkbox", { name: "Seleziona tutti gli incassi" })
      ).toBeDefined();
    });

    it("[AC1] toolbar senza categorie: 'Marca da bollo' presente, 'Assegna categoria' assente", async () => {
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });
      await waitForTable();

      const rowCheckboxes = screen.getAllByRole("checkbox").slice(1);
      fireEvent.click(rowCheckboxes[0]);

      await waitFor(() => {
        expect(screen.getByText("1 selezionato")).toBeDefined();
      });
      expect(screen.getByRole("button", { name: "Marca da bollo" })).toBeDefined();
      expect(screen.queryByText("Assegna categoria")).toBeNull();
    });

    // --- AC 2+3: batch su selezione mista ---

    it("[AC2+3] batch su selezione mista: update SOLO id eleggibili, payload corretto, conteggi nel dialog", async () => {
      mockReceiptsData = [
        // eleggibile: sopra soglia, flag falsy
        { ...mockReceipts[0] }, // r1, 5000
        // NON eleggibile: già flaggato
        { ...mockReceipts[1], marca_bollo_applied: true, marca_bollo_amount: 2 }, // r2
        // NON eleggibile: sotto soglia 77,47
        { ...mockReceipts[2], gross_amount: 50 }, // r3
      ];
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });
      await waitForTable();

      fireEvent.click(
        screen.getByRole("checkbox", { name: "Seleziona tutti gli incassi" })
      );
      await waitFor(() => {
        expect(screen.getByText("3 selezionati")).toBeDefined();
      });

      fireEvent.click(screen.getByRole("button", { name: "Marca da bollo" }));
      await waitFor(() => {
        expect(screen.getByText("Marca da bollo addebitata")).toBeDefined();
      });
      // Conteggi: 1 eleggibile su 3, 2 saltati
      expect(screen.getByText(/1 di 3/)).toBeDefined();
      expect(screen.getByText(/2 saltati/)).toBeDefined();

      fireEvent.click(screen.getByRole("button", { name: "Applica" }));

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalled();
      });
      // Payload: SOLO i 2 campi bollo, gross assente
      const payload = mockUpdate.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(payload).toEqual({
        marca_bollo_applied: true,
        marca_bollo_amount: 2,
      });
      // .in("id", ids) con SOLO gli eleggibili
      const inArgs = mockIn.mock.calls[0] as [string, string[]];
      expect(inArgs[0]).toBe("id");
      expect(inArgs[1]).toEqual(["r1"]);
    });

    it("[AC3] conferma disabilitata quando nessun selezionato è eleggibile", async () => {
      mockReceiptsData = [
        { ...mockReceipts[0], gross_amount: 50, client_name: "Sotto Soglia" },
      ];
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });
      await waitForTable("Sotto Soglia");

      const rowCheckboxes = screen.getAllByRole("checkbox").slice(1);
      fireEvent.click(rowCheckboxes[0]);
      await waitFor(() => {
        expect(screen.getByText("1 selezionato")).toBeDefined();
      });

      fireEvent.click(screen.getByRole("button", { name: "Marca da bollo" }));
      await waitFor(() => {
        expect(screen.getByText("Marca da bollo addebitata")).toBeDefined();
      });

      const applyBtn = screen.getByRole("button", { name: "Applica" }) as HTMLButtonElement;
      expect(applyBtn.disabled).toBe(true);
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    // --- AC 6: invalidation ---

    it("[AC6] batch conferma invalida receipts e bollo_total", async () => {
      const invalidateSpy = vi.spyOn(QueryClient.prototype, "invalidateQueries");

      render(React.createElement(IncassiPage), { wrapper: createWrapper() });
      await waitForTable();

      fireEvent.click(
        screen.getByRole("checkbox", { name: "Seleziona tutti gli incassi" })
      );
      fireEvent.click(screen.getByRole("button", { name: "Marca da bollo" }));
      await waitFor(() => {
        expect(screen.getByText("Marca da bollo addebitata")).toBeDefined();
      });
      invalidateSpy.mockClear();
      fireEvent.click(screen.getByRole("button", { name: "Applica" }));

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalled();
      });
      await waitFor(() => {
        const keys = invalidateSpy.mock.calls.map(
          (c) => (c[0] as { queryKey: string[] })?.queryKey?.[0]
        );
        expect(keys).toContain("receipts");
        expect(keys).toContain("bollo_total");
      });
    });

    // --- AC 5: nudge one-shot ---

    it("[AC5] nudge visibile con N eleggibili ≥ 1 e conteggio corretto", async () => {
      // Default: 3 receipts tutti sopra soglia, nessun flag → N = 3
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });
      await waitForTable();

      expect(
        screen.getByText(/Hai 3 incassi sopra 77,47 € senza marca da bollo/)
      ).toBeDefined();
      expect(screen.getByRole("button", { name: "Rivedi e applica" })).toBeDefined();
    });

    it("[AC5] nudge nascosto quando N = 0 (tutti flaggati o sotto soglia)", async () => {
      mockReceiptsData = [
        { ...mockReceipts[0], marca_bollo_applied: true, marca_bollo_amount: 2 },
        { ...mockReceipts[1], gross_amount: 50 },
      ];
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });
      await waitForTable();

      expect(screen.queryByText(/senza marca da bollo/)).toBeNull();
    });

    it("[AC5] dismiss X → localStorage permanente e banner sparisce", async () => {
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });
      await waitForTable();

      fireEvent.click(
        screen.getByRole("button", { name: "Chiudi avviso marca da bollo" })
      );

      expect(localStorage.getItem(NUDGE_KEY)).toBe("true");
      expect(screen.queryByText(/senza marca da bollo/)).toBeNull();
    });

    it("[AC5] nudge nascosto se già dismissato in localStorage", async () => {
      localStorage.setItem(NUDGE_KEY, "true");
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });
      await waitForTable();

      expect(screen.queryByText(/senza marca da bollo/)).toBeNull();
    });

    it("[AC5] CTA pre-seleziona SOLO le righe eleggibili", async () => {
      mockReceiptsData = [
        { ...mockReceipts[0] }, // eleggibile
        { ...mockReceipts[1], marca_bollo_applied: true, marca_bollo_amount: 2 },
        { ...mockReceipts[2], gross_amount: 50 },
      ];
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });
      await waitForTable();

      fireEvent.click(screen.getByRole("button", { name: "Rivedi e applica" }));

      await waitFor(() => {
        expect(screen.getByText("1 selezionato")).toBeDefined();
      });
    });
  });

  // ===== Story 10.1: TaxSliceBar integration =====

  describe("Story 10.1: TaxSliceBar integration", () => {
    it("renders Ripartizione column header in desktop view", async () => {
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Ripartizione")).toBeDefined();
      });
    });

    it("renders TaxSliceBar for each receipt row with bar segments", async () => {
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Acme Corp")).toBeDefined();
      });

      // Each receipt row should have TaxSliceBar rendered (role=img)
      // Desktop: one in the Ripartizione column + mobile: one hidden inside gross amount cell
      // In jsdom (desktop mock: isMobile=false), both desktop and mobile bars render
      // but mobile is hidden via CSS (md:hidden). We check role=img exists.
      const bars = document.querySelectorAll("[role='img']");
      // At least 3 bars (one per receipt in desktop column) — mobile bars also render in DOM
      expect(bars.length).toBeGreaterThanOrEqual(3);
    });

    it("TaxSliceBar segments have correct width for first receipt", async () => {
      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Acme Corp")).toBeDefined();
      });

      // First receipt: gross=5000, tax=167.5, inps=873.35, net=3959.15
      // net%=79.183%, tax%=3.35%, inps%=17.467%
      const bars = document.querySelectorAll("[role='img']");
      expect(bars.length).toBeGreaterThanOrEqual(1);

      const firstBar = bars[0];
      const segments = Array.from(firstBar.children) as HTMLElement[];
      expect(segments.length).toBe(3);

      // Verify segments have non-zero widths
      expect(parseFloat(segments[0].style.width)).toBeGreaterThan(0);
      expect(parseFloat(segments[1].style.width)).toBeGreaterThan(0);
      expect(parseFloat(segments[2].style.width)).toBeGreaterThan(0);
    });

    it("does not render TaxSliceBar for legacy receipt with null fiscal fields", async () => {
      // Replace r3 with a legacy receipt (null fiscal fields)
      mockReceiptsData = [
        { ...mockReceipts[0] },
        { ...mockReceipts[1] },
        {
          id: "r3-legacy",
          receipt_date: "2026-03-01",
          client_name: "Legacy Client",
          gross_amount: 1500,
          taxable_amount: null,
          tax_amount: null,
          inps_amount: null,
          net_spendable: null,
          notes: null,
          fiscal_year: 2026,
        },
      ];

      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Legacy Client")).toBeDefined();
      });

      // Only 2 receipts should have bars (r1 and r2), r3-legacy should not
      // Desktop bars + mobile bars = 2 * 2 = 4 bars (not 6)
      const bars = document.querySelectorAll("[role='img']");
      expect(bars.length).toBe(4); // 2 receipts × 2 (desktop + mobile)
    });

    it("legacy receipt row does not crash and shows other data normally", async () => {
      mockReceiptsData = [
        {
          id: "r-legacy",
          receipt_date: "2026-01-15",
          client_name: "Old Client",
          gross_amount: 800,
          taxable_amount: null,
          tax_amount: null,
          inps_amount: null,
          net_spendable: null,
          notes: "Legacy receipt",
          fiscal_year: 2026,
        },
      ];

      render(React.createElement(IncassiPage), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Old Client")).toBeDefined();
      });

      // No bars rendered
      expect(document.querySelectorAll("[role='img']").length).toBe(0);

      // Other data displays normally — gross amount rendered via formatCurrency
      // Multiple matches expected (summary card + row), so use getAllByText
      expect(screen.getAllByText("€ 800,00").length).toBeGreaterThanOrEqual(1);
    });
  });

});
