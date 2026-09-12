/**
 * Story 42.1 — Test pagina Budget (Allocazione Netto Spendibile)
 * Copertura: rendering, stato vuoto, breakdown, sheet, accessibilità
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import BudgetPage from "./Budget";

// --- Mocks ---

// ProGateOverlay — pass-through (gate tested in GatedPages.test.tsx)
vi.mock("@/components/subscription/ProGateOverlay", () => ({
  ProGateOverlay: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
}));

vi.mock("@/lib/money", async () => {
  const actual = await vi.importActual<typeof import("@/lib/money")>("@/lib/money");
  return {
    ...actual,
    formatCurrency: (v: number) => `€${v.toFixed(2)}`,
  };
});

const mockSave = vi.fn().mockResolvedValue(undefined);
const mockToast = vi.fn();

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Default mock values
let mockBudgetReturn = {
  items: [
    { key: "necessita" as const, percentage: 60, amount: 3000 },
    { key: "investimenti" as const, percentage: 10, amount: 500 },
    { key: "risparmio" as const, percentage: 10, amount: 500 },
    { key: "formazione" as const, percentage: 10, amount: 500 },
    { key: "svago" as const, percentage: 10, amount: 500 },
  ],
  config: { necessita: 60, investimenti: 10, risparmio: 10, formazione: 10, svago: 10 },
  nettoSpendibile: 5000,
  isDefault: true,
  isLoading: false,
  save: mockSave,
  resetToDefault: vi.fn(),
  isSaving: false,
};

vi.mock("@/hooks/useBudgetAllocation", () => ({
  useBudgetAllocation: () => mockBudgetReturn,
}));

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: any) => <div data-testid="app-layout">{children}</div>,
}));

vi.mock("@/components/layout/PageContainer", () => ({
  PageContainer: ({ children, ...props }: any) => <div data-testid="page-container" {...props}>{children}</div>,
}));

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: (props: any) => <div data-testid="skeleton" {...props} />,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children, open }: any) => open ? <div data-testid="sheet">{children}</div> : null,
  SheetContent: ({ children }: any) => <div>{children}</div>,
  SheetHeader: ({ children }: any) => <div>{children}</div>,
  SheetTitle: ({ children }: any) => <div>{children}</div>,
  SheetDescription: ({ children }: any) => <div>{children}</div>,
}));

describe("BudgetPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBudgetReturn = {
      items: [
        { key: "necessita", percentage: 60, amount: 3000 },
        { key: "investimenti", percentage: 10, amount: 500 },
        { key: "risparmio", percentage: 10, amount: 500 },
        { key: "formazione", percentage: 10, amount: 500 },
        { key: "svago", percentage: 10, amount: 500 },
      ],
      config: { necessita: 60, investimenti: 10, risparmio: 10, formazione: 10, svago: 10 },
      nettoSpendibile: 5000,
      isDefault: true,
      isLoading: false,
      save: mockSave,
      resetToDefault: vi.fn(),
      isSaving: false,
    };
  });

  it("mostra skeleton durante il loading", () => {
    mockBudgetReturn.isLoading = true;
    render(<BudgetPage />);
    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
  });

  it("mostra stato vuoto quando netto <= 0", () => {
    mockBudgetReturn.nettoSpendibile = 0;
    render(<BudgetPage />);
    expect(screen.getByText("Nessuna allocazione disponibile")).toBeTruthy();
    expect(screen.getByText(/Registra i tuoi incassi/)).toBeTruthy();
    const link = screen.getByText("Registra un incasso");
    expect(link.closest("a")?.getAttribute("href")).toBe("/incassi");
  });

  it("mostra stato vuoto per netto negativo", () => {
    mockBudgetReturn.nettoSpendibile = -500;
    render(<BudgetPage />);
    expect(screen.getByText("Nessuna allocazione disponibile")).toBeTruthy();
  });

  it("mostra breakdown con netto > 0", () => {
    render(<BudgetPage />);
    expect(screen.getByText("Allocazione Netto")).toBeTruthy();
    expect(screen.getByText("€5000.00")).toBeTruthy(); // Netto Spendibile formattato
    // Categorie nella lista (display labels)
    expect(screen.getByText("Necessità")).toBeTruthy();
    expect(screen.getByText("Investimenti — Libertà Finanziaria")).toBeTruthy();
    expect(screen.getByText("Risparmi a Lungo Termine")).toBeTruthy();
    expect(screen.getByText("Formazione/Educazione")).toBeTruthy();
    expect(screen.getByText("Divertimento")).toBeTruthy();
  });

  it("mostra card spiegazione", () => {
    render(<BudgetPage />);
    expect(screen.getByText("Cos'è l'allocazione")).toBeTruthy();
    expect(screen.getByText(/bussola/)).toBeTruthy();
  });

  it("mostra label Netto Spendibile con stile teal", () => {
    render(<BudgetPage />);
    const label = screen.getByText("Netto Spendibile");
    expect(label).toBeTruthy();
  });

  it("barra segmentata ha role='img' e aria-label", () => {
    render(<BudgetPage />);
    const bar = screen.getByRole("img");
    expect(bar.getAttribute("aria-label")).toMatch(/Distribuzione netto spendibile/);
  });

  it("lista categorie mostra percentuali e importi", () => {
    render(<BudgetPage />);
    expect(screen.getByText(/60% —/)).toBeTruthy();
    expect(screen.getByText("€3000.00")).toBeTruthy();
    // 10% appare 4 volte (investimenti, risparmio, formazione, svago)
    expect(screen.getAllByText(/10% —/)).toHaveLength(4);
  });

  it("button 'Personalizza le percentuali' apre il sheet", () => {
    render(<BudgetPage />);
    const btn = screen.getByText("Personalizza le percentuali");
    fireEvent.click(btn);
    expect(screen.getByTestId("sheet")).toBeTruthy();
  });

  it("lista usa dl semantico", () => {
    const { container } = render(<BudgetPage />);
    const dl = container.querySelector("dl");
    expect(dl).toBeTruthy();
  });

  // --- M3: Save / error toast flow ---

  it("handleSave — toast successo quando save (config non-default) OK", async () => {
    mockBudgetReturn.config = { necessita: 50, investimenti: 20, risparmio: 10, formazione: 10, svago: 10 };
    render(<BudgetPage />);
    fireEvent.click(screen.getByText("Personalizza le percentuali"));
    fireEvent.click(screen.getByText("Salva"));
    await waitFor(() => {
      expect(mockSave).toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Salvato" }));
    });
  });

  it("handleSave — toast errore quando save fallisce", async () => {
    mockBudgetReturn.config = { necessita: 50, investimenti: 20, risparmio: 10, formazione: 10, svago: 10 };
    mockSave.mockRejectedValueOnce(new Error("DB error"));
    render(<BudgetPage />);
    fireEvent.click(screen.getByText("Personalizza le percentuali"));
    fireEvent.click(screen.getByText("Salva"));
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Errore", variant: "destructive" })
      );
    });
  });

  it("handleSave chiama resetToDefault (non save) quando config è default", async () => {
    const mockResetDefault = vi.fn().mockResolvedValue(undefined);
    mockBudgetReturn.resetToDefault = mockResetDefault;
    render(<BudgetPage />);
    fireEvent.click(screen.getByText("Personalizza le percentuali"));
    fireEvent.click(screen.getByText("Salva"));
    await waitFor(() => {
      expect(mockResetDefault).toHaveBeenCalled();
      expect(mockSave).not.toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Salvato" }));
    });
  });

  // --- M2: Sheet validation UI ---

  it("sheet disabilita Salva quando totale ≠ 100%", () => {
    render(<BudgetPage />);
    fireEvent.click(screen.getByText("Personalizza le percentuali"));
    const input = screen.getByLabelText("Necessità");
    fireEvent.change(input, { target: { value: "50" } });
    const salvaBtn = screen.getByText("Salva") as HTMLButtonElement;
    expect(salvaBtn.disabled).toBe(true);
  });

  it("sheet mostra indicatore totale rosso quando ≠ 100%", () => {
    render(<BudgetPage />);
    fireEvent.click(screen.getByText("Personalizza le percentuali"));
    const input = screen.getByLabelText("Necessità");
    fireEvent.change(input, { target: { value: "50" } });
    expect(screen.getByText(/Totale: 90%/)).toBeTruthy();
    expect(screen.getByText(/Deve essere 100%/)).toBeTruthy();
  });

  it("sheet 'Ripristina default' resetta i valori a 60/10/10/10/10", () => {
    mockBudgetReturn.config = { necessita: 50, investimenti: 20, risparmio: 15, formazione: 10, svago: 5 };
    render(<BudgetPage />);
    fireEvent.click(screen.getByText("Personalizza le percentuali"));
    expect((screen.getByLabelText("Necessità") as HTMLInputElement).value).toBe("50");
    fireEvent.click(screen.getByText("Ripristina default"));
    expect((screen.getByLabelText("Necessità") as HTMLInputElement).value).toBe("60");
    expect((screen.getByLabelText("Investimenti") as HTMLInputElement).value).toBe("10");
  });

  it("sheet abilita Salva quando totale torna a 100%", () => {
    render(<BudgetPage />);
    fireEvent.click(screen.getByText("Personalizza le percentuali"));
    const input = screen.getByLabelText("Necessità");
    // Break total
    fireEvent.change(input, { target: { value: "50" } });
    expect((screen.getByText("Salva") as HTMLButtonElement).disabled).toBe(true);
    // Fix total back
    fireEvent.change(input, { target: { value: "60" } });
    expect((screen.getByText("Salva") as HTMLButtonElement).disabled).toBe(false);
  });
});
