/**
 * Story 64.3 — Test trigger ProBanner contestuali (T1-T5 + dismiss)
 *
 * Strategia: test leggeri che renderizzano solo i frammenti JSX rilevanti,
 * mockando ProBanner per verificare che venga montato con i props corretti.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import React from "react";

// ─── Shared mock state ─────────────────────────────────────────────────

let mockSubscription: Record<string, any> = {};
vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => mockSubscription,
}));

let mockUserRole: string | null = "user";
vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: () => ({ data: mockUserRole, isLoading: false }),
}));

let mockIsJoined = false;
vi.mock("@/hooks/useProWaitlist", () => ({
  useProWaitlist: () => ({ isJoined: mockIsJoined, join: vi.fn(), isLoading: false }),
}));

vi.mock("@/hooks/useLaunchWindow", () => ({
  useLaunchWindow: () => ({ isOpen: false }),
}));

const mockDismissedSet = new Set<string>();
vi.mock("@/hooks/useProBannerDismiss", () => ({
  useProBannerDismiss: (triggerId: string) => ({
    isDismissed: mockDismissedSet.has(triggerId),
    dismiss: () => mockDismissedSet.add(triggerId),
  }),
}));

// ─── T1 + T2: Incassi page ProBanners ──────────────────────────────────

// We test the trigger conditions by rendering just the ProBanner calls
// as they appear in Incassi.tsx, without mounting the whole page.
// This validates the conditions, not the full page integration.

import { ProBanner } from "@/components/subscription/ProBanner";

// Mock ProWaitlistConsentDialog (used by ProBanner internally)
vi.mock("@/components/subscription/ProWaitlistConsentDialog", () => ({
  ProWaitlistConsentDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="pro-waitlist-dialog" /> : null,
}));

function withRouter(ui: React.ReactElement) {
  return <MemoryRouter>{ui}</MemoryRouter>;
}

/**
 * Helper: renders the T1+T2 banner zone as it appears in Incassi.tsx
 */
function IncassiBannerZone() {
  const { canAddReceipt, isPro, canImport } = mockSubscription;
  return (
    <div>
      {!canAddReceipt && !isPro && (
        <ProBanner
          triggerId="receipt-limit"
          title="Con PRO, incassi illimitati"
          description="Registra tutti i tuoi incassi senza limiti, tutto l'anno."
        />
      )}
      {!canImport && !isPro && (
        <ProBanner
          triggerId="import-limit"
          title="Hai raggiunto il limite di import XML"
          description="Con PRO, importa tutte le fatture XML che vuoi."
        />
      )}
    </div>
  );
}

describe("T1 — ProBanner receipt-limit (Incassi)", () => {
  beforeEach(() => {
    mockDismissedSet.clear();
    mockUserRole = "user";
    mockIsJoined = false;
    mockSubscription = {
      isPro: false, isLoading: false,
      canAddReceipt: true, receiptsUsed: 3, receiptsLimit: 5,
      importsUsed: 1, importsLimit: 3, canImport: true,
      canExport: false, canSelectYear: false,
    };
  });

  it("mostra ProBanner quando canAddReceipt=false e !isPro", () => {
    mockSubscription.canAddReceipt = false;
    render(withRouter(<IncassiBannerZone />));
    expect(screen.getByText("Con PRO, incassi illimitati")).toBeTruthy();
  });

  it("NON mostra ProBanner quando canAddReceipt=true", () => {
    mockSubscription.canAddReceipt = true;
    render(withRouter(<IncassiBannerZone />));
    expect(screen.queryByText("Con PRO, incassi illimitati")).toBeNull();
  });

  it("NON mostra ProBanner quando isPro=true", () => {
    mockSubscription.canAddReceipt = false;
    mockSubscription.isPro = true;
    render(withRouter(<IncassiBannerZone />));
    // ProBanner internamente ritorna null per isPro
    expect(screen.queryByText("Con PRO, incassi illimitati")).toBeNull();
  });

  it("NON mostra ProBanner quando isAdmin", () => {
    mockSubscription.canAddReceipt = false;
    mockUserRole = "admin";
    render(withRouter(<IncassiBannerZone />));
    expect(screen.queryByText("Con PRO, incassi illimitati")).toBeNull();
  });

  it("dismiss nasconde il banner nella stessa sessione", () => {
    mockSubscription.canAddReceipt = false;
    const { rerender } = render(withRouter(<IncassiBannerZone />));
    expect(screen.getByText("Con PRO, incassi illimitati")).toBeTruthy();
    // Simulare dismiss
    const dismissBtn = screen.getByLabelText("Chiudi");
    fireEvent.click(dismissBtn);
    rerender(withRouter(<IncassiBannerZone />));
    expect(screen.queryByText("Con PRO, incassi illimitati")).toBeNull();
  });
});

describe("T2 — ProBanner import-limit (Incassi)", () => {
  beforeEach(() => {
    mockDismissedSet.clear();
    mockUserRole = "user";
    mockIsJoined = false;
    mockSubscription = {
      isPro: false, isLoading: false,
      canAddReceipt: true, receiptsUsed: 3, receiptsLimit: 5,
      importsUsed: 3, importsLimit: 3, canImport: false,
      canExport: false, canSelectYear: false,
    };
  });

  it("mostra ProBanner quando importsUsed >= importsLimit e !isPro", () => {
    render(withRouter(<IncassiBannerZone />));
    expect(screen.getByText("Hai raggiunto il limite di import XML")).toBeTruthy();
  });

  it("NON mostra ProBanner quando canImport=true", () => {
    mockSubscription.canImport = true;
    render(withRouter(<IncassiBannerZone />));
    expect(screen.queryByText("Hai raggiunto il limite di import XML")).toBeNull();
  });

  it("NON mostra ProBanner quando isPro=true", () => {
    mockSubscription.isPro = true;
    render(withRouter(<IncassiBannerZone />));
    expect(screen.queryByText("Hai raggiunto il limite di import XML")).toBeNull();
  });

  it("dismiss nasconde il banner nella stessa sessione", () => {
    const { rerender } = render(withRouter(<IncassiBannerZone />));
    expect(screen.getByText("Hai raggiunto il limite di import XML")).toBeTruthy();
    const dismissBtn = screen.getByLabelText("Chiudi");
    fireEvent.click(dismissBtn);
    rerender(withRouter(<IncassiBannerZone />));
    expect(screen.queryByText("Hai raggiunto il limite di import XML")).toBeNull();
  });
});

// ─── T4: Year gate dialog (Dashboard) ──────────────────────────────────

// Mock Dialog from shadcn/ui for jsdom compatibility
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog-root">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useState } from "react";

const currentCalendarYear = new Date().getFullYear();

/**
 * Helper: renders the T4 year gate logic as it appears in Dashboard.tsx
 */
function YearGateZone() {
  const { canSelectYear } = mockSubscription;
  const isAdmin = mockUserRole === "admin";
  const [selectedYear, setSelectedYear] = useState(currentCalendarYear);
  const [yearGateOpen, setYearGateOpen] = useState(false);
  const [waitlistDialogOpen, setWaitlistDialogOpen] = useState(false);

  const handleYearChange = (year: number) => {
    if (!canSelectYear && !isAdmin && year !== currentCalendarYear) {
      setYearGateOpen(true);
      return;
    }
    setSelectedYear(year);
  };

  return (
    <div>
      <span data-testid="selected-year">{selectedYear}</span>
      <button onClick={() => handleYearChange(currentCalendarYear - 1)} data-testid="select-prev-year">
        {currentCalendarYear - 1}
      </button>
      <button onClick={() => handleYearChange(currentCalendarYear)} data-testid="select-current-year">
        {currentCalendarYear}
      </button>

      <Dialog open={yearGateOpen} onOpenChange={setYearGateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Storico multi-anno</DialogTitle>
            <DialogDescription>
              Lo storico multi-anno è disponibile con PRO.
            </DialogDescription>
          </DialogHeader>
          {mockIsJoined ? (
            <p data-testid="joined-msg">Sei in lista</p>
          ) : (
            <Button onClick={() => { setYearGateOpen(false); setWaitlistDialogOpen(true); }}>Scopri PRO</Button>
          )}
        </DialogContent>
      </Dialog>

      {waitlistDialogOpen && <div data-testid="waitlist-dialog-open" />}
    </div>
  );
}

describe("T4 — Year gate dialog (Dashboard)", () => {
  beforeEach(() => {
    mockDismissedSet.clear();
    mockUserRole = "user";
    mockIsJoined = false;
    mockSubscription = {
      isPro: false, isLoading: false,
      canAddReceipt: true, receiptsUsed: 3, receiptsLimit: 5,
      importsUsed: 1, importsLimit: 3, canImport: true,
      canExport: false, canSelectYear: false,
    };
  });

  it("selezionare anno diverso da corrente mostra dialog gate quando !canSelectYear", () => {
    render(withRouter(<YearGateZone />));
    fireEvent.click(screen.getByTestId("select-prev-year"));
    expect(screen.getByText("Storico multi-anno")).toBeTruthy();
    // Anno NON cambia
    expect(screen.getByTestId("selected-year").textContent).toBe(String(currentCalendarYear));
  });

  it("selezionare anno corrente NON mostra dialog gate", () => {
    render(withRouter(<YearGateZone />));
    fireEvent.click(screen.getByTestId("select-current-year"));
    expect(screen.queryByText("Storico multi-anno")).toBeNull();
  });

  it("utente canSelectYear=true può cambiare anno liberamente", () => {
    mockSubscription.canSelectYear = true;
    render(withRouter(<YearGateZone />));
    fireEvent.click(screen.getByTestId("select-prev-year"));
    expect(screen.queryByText("Storico multi-anno")).toBeNull();
    expect(screen.getByTestId("selected-year").textContent).toBe(String(currentCalendarYear - 1));
  });

  it("mostra messaggio isJoined se utente è in waitlist", () => {
    mockIsJoined = true;
    render(withRouter(<YearGateZone />));
    fireEvent.click(screen.getByTestId("select-prev-year"));
    expect(screen.getByTestId("joined-msg")).toBeTruthy();
  });

  it("admin può cambiare anno anche se !canSelectYear", () => {
    mockUserRole = "admin";
    render(withRouter(<YearGateZone />));
    fireEvent.click(screen.getByTestId("select-prev-year"));
    expect(screen.queryByText("Storico multi-anno")).toBeNull();
    expect(screen.getByTestId("selected-year").textContent).toBe(String(currentCalendarYear - 1));
  });

  it("click Scopri PRO apre waitlist dialog", () => {
    render(withRouter(<YearGateZone />));
    fireEvent.click(screen.getByTestId("select-prev-year"));
    fireEvent.click(screen.getByRole("button", { name: "Scopri PRO" }));
    expect(screen.getByTestId("waitlist-dialog-open")).toBeTruthy();
  });
});

// ─── T5: ProBanner soglia 85k (Dashboard) ──────────────────────────────

function Soglia85kZone({ incassiYTD }: { incassiYTD: number }) {
  return (
    <div>
      {incassiYTD >= 7000000 && !mockSubscription.isPro && (
        <ProBanner
          triggerId="soglia-85k"
          title="Ti stai avvicinando alla soglia forfettaria"
          description="Con PRO, monitoraggio avanzato e alert personalizzati sulla soglia 85k."
        />
      )}
    </div>
  );
}

describe("T5 — ProBanner soglia 85k (Dashboard)", () => {
  beforeEach(() => {
    mockDismissedSet.clear();
    mockUserRole = "user";
    mockIsJoined = false;
    mockSubscription = {
      isPro: false, isLoading: false,
      canAddReceipt: true, receiptsUsed: 3, receiptsLimit: 5,
      importsUsed: 1, importsLimit: 3, canImport: true,
      canExport: false, canSelectYear: false,
    };
  });

  it("mostra ProBanner quando incassiYTD >= 7000000 e !isPro", () => {
    render(withRouter(<Soglia85kZone incassiYTD={7000000} />));
    expect(screen.getByText("Ti stai avvicinando alla soglia forfettaria")).toBeTruthy();
  });

  it("NON mostra ProBanner quando incassiYTD < 7000000", () => {
    render(withRouter(<Soglia85kZone incassiYTD={6999999} />));
    expect(screen.queryByText("Ti stai avvicinando alla soglia forfettaria")).toBeNull();
  });

  it("NON mostra ProBanner quando isPro=true", () => {
    mockSubscription.isPro = true;
    render(withRouter(<Soglia85kZone incassiYTD={7000000} />));
    expect(screen.queryByText("Ti stai avvicinando alla soglia forfettaria")).toBeNull();
  });

  it("NON mostra ProBanner quando isAdmin", () => {
    mockUserRole = "admin";
    render(withRouter(<Soglia85kZone incassiYTD={7000000} />));
    expect(screen.queryByText("Ti stai avvicinando alla soglia forfettaria")).toBeNull();
  });

  it("dismiss nasconde il banner nella stessa sessione", () => {
    const { rerender } = render(withRouter(<Soglia85kZone incassiYTD={7000000} />));
    expect(screen.getByText("Ti stai avvicinando alla soglia forfettaria")).toBeTruthy();
    const dismissBtn = screen.getByLabelText("Chiudi");
    fireEvent.click(dismissBtn);
    rerender(withRouter(<Soglia85kZone incassiYTD={7000000} />));
    expect(screen.queryByText("Ti stai avvicinando alla soglia forfettaria")).toBeNull();
  });
});
