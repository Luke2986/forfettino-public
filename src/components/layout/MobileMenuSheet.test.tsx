/**
 * Test MobileMenuSheet — Story 57.3, AC #2
 * Copertura: ordine sezioni mobile, Messaggi sotto Dashboard,
 * Impostazioni standalone con divider, Supporto collapsible con children,
 * access control, active state.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";

// ── Mutable mock state ──
const mockState = {
  userRole: "user" as string,
  isPro: false,
  npsVisible: false,
  unreadCount: 0,
  menuOpen: true,
};

// ── Mock hooks ──
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", email: "test@test.com" }, signOut: vi.fn() }),
}));
vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({ data: { user_code: "FF-26-ABC", first_name: "Luca", last_name: "Test" } }),
}));
vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: () => ({ data: mockState.userRole }),
}));
vi.mock("@/hooks/useNotificationCount", () => ({
  useNotificationCount: () => ({ data: mockState.unreadCount }),
}));
vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ isPro: mockState.isPro, isLoading: false }),
}));
vi.mock("@/hooks/useNpsSidebarButton", () => ({
  useNpsSidebarButton: () => ({ isVisible: mockState.npsVisible, activeCampaignId: mockState.npsVisible ? "c1" : null, isLoading: false }),
}));
vi.mock("@/lib/feature-gates", () => ({
  isGuideLive: () => true,
}));

// ── Mock MobileMenuContext ──
vi.mock("./MobileMenuContext", () => ({
  useMobileMenu: () => ({
    menuOpen: mockState.menuOpen,
    setMenuOpen: vi.fn(),
    openMenu: vi.fn(),
    closeMenu: vi.fn(),
  }),
}));

// ── Mock Sheet UI ──
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children, open }: any) => (open ? createElement("div", { "data-testid": "sheet" }, children) : null),
  SheetContent: ({ children }: any) => createElement("div", { "data-testid": "sheet-content" }, children),
  SheetHeader: ({ children }: any) => createElement("div", null, children),
  SheetTitle: ({ children }: any) => createElement("div", null, children),
}));
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, asChild, className, ...props }: any) => {
    if (asChild) {
      // asChild: render children directly (for external links)
      return createElement("div", { className }, children);
    }
    return createElement("button", { onClick, className, ...props }, children);
  },
}));
vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children }: any) => createElement("div", null, children),
  AvatarFallback: ({ children }: any) => createElement("span", null, children),
}));
vi.mock("./UserCodeBlock", () => ({
  UserCodeBlock: () => null,
}));

import { MobileMenuSheet } from "./MobileMenuSheet";

function renderMobile(
  props: { onOpenNpsSurvey?: () => void } = {},
  initialEntries: string[] = ["/dashboard"],
) {
  return render(
    createElement(MemoryRouter, { initialEntries }, createElement(MobileMenuSheet, props)),
  );
}

function setMockUser(role: "free" | "pro" | "admin") {
  mockState.userRole = role === "admin" ? "admin" : "user";
  mockState.isPro = role === "pro" || role === "admin";
}

beforeEach(() => {
  mockState.userRole = "user";
  mockState.isPro = false;
  mockState.npsVisible = false;
  mockState.unreadCount = 0;
  mockState.menuOpen = true;
});

// ═══════════════════════════════════════════════════
// Task 2: Test rendering ordine sezioni mobile (AC #2)
// ═══════════════════════════════════════════════════
describe("MobileMenuSheet — ordine sezioni (AC #2)", () => {
  it("renderizza tutte le sezioni nell'ordine corretto", () => {
    setMockUser("admin");
    mockState.npsVisible = true;
    const { container } = renderMobile({ onOpenNpsSurvey: vi.fn() });
    const text = container.textContent || "";

    const positions = [
      text.indexOf("Dashboard"),
      text.indexOf("Messaggi"),
      text.indexOf("Gestione"),
      text.indexOf("Pianificazione"),
      text.indexOf("Strumenti"),
      text.indexOf("Impostazioni"),
      text.lastIndexOf("Admin"),
    ];

    positions.forEach((pos) => {
      expect(pos).toBeGreaterThan(-1);
    });

    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]);
    }
  });

  it("Messaggi appare subito dopo Dashboard", () => {
    setMockUser("free");
    const { container } = renderMobile();
    const text = container.textContent || "";

    const dashPos = text.indexOf("Dashboard");
    const msgPos = text.indexOf("Messaggi");
    const gestionePos = text.indexOf("Gestione");

    expect(msgPos).toBeGreaterThan(dashPos);
    expect(gestionePos).toBeGreaterThan(msgPos);
  });

  it("Impostazioni è standalone con divider sopra", () => {
    setMockUser("free");
    const { container } = renderMobile();
    // Impostazioni deve essere preceduto da un divider (border-t)
    const impostazioniBtn = screen.getByText("Impostazioni").closest("button");
    expect(impostazioniBtn).toBeTruthy();
    // Verifica strutturale: il parent wrapper ha un sibling precedente con border-t
    const wrapperDiv = impostazioniBtn!.closest(".space-y-1");
    const prevSibling = wrapperDiv?.previousElementSibling;
    expect(prevSibling).toBeTruthy();
    expect(prevSibling!.className).toContain("border-t");
  });
});

// ═══════════════════════════════════════════════════
// Task 2 extra: Supporto collapsible mobile (AC #2)
// ═══════════════════════════════════════════════════
describe("MobileMenuSheet — Supporto collapsible (AC #2)", () => {
  it("Supporto renderizza children quando aperto (default state)", () => {
    setMockUser("free");
    // Supporto is open by default when no child route active (but initial state is open per code)
    renderMobile({}, ["/supporto"]);
    expect(screen.getByText("Scrivi feedback")).toBeInTheDocument();
    expect(screen.getByText("Call")).toBeInTheDocument();
  });

  it("Call ha target _blank (link esterno)", () => {
    setMockUser("free");
    renderMobile({}, ["/supporto"]);
    const callLink = screen.getByText("Call").closest("a");
    expect(callLink).toBeTruthy();
    expect(callLink!.getAttribute("target")).toBe("_blank");
  });

  it("Valuta Forfettino nascosto quando NPS non attivo", () => {
    mockState.npsVisible = false;
    renderMobile({ onOpenNpsSurvey: vi.fn() }, ["/supporto"]);
    expect(screen.queryByText("Valuta Forfettino")).toBeNull();
  });

  it("Valuta Forfettino visibile quando NPS attivo", () => {
    mockState.npsVisible = true;
    renderMobile({ onOpenNpsSurvey: vi.fn() }, ["/supporto"]);
    expect(screen.getByText("Valuta Forfettino")).toBeInTheDocument();
  });

  it("click Valuta Forfettino chiama onOpenNpsSurvey", () => {
    mockState.npsVisible = true;
    const handleOpen = vi.fn();
    renderMobile({ onOpenNpsSurvey: handleOpen }, ["/supporto"]);
    fireEvent.click(screen.getByText("Valuta Forfettino"));
    expect(handleOpen).toHaveBeenCalledOnce();
  });
});

// ═══════════════════════════════════════════════════
// Task 5 mobile: Access control (AC #5)
// ═══════════════════════════════════════════════════
describe("MobileMenuSheet — access control (AC #5)", () => {
  it("utente Free: Comparatore, Allocazione, Report Fatturato nascosti (mobile filter proOnly)", () => {
    setMockUser("free");
    renderMobile();
    // Mobile filtra proOnly (diverso da desktop che mostra ProBadge)
    expect(screen.queryByText("Comparatore")).toBeNull();
    expect(screen.queryByText("Allocazione")).toBeNull();
    expect(screen.queryByText("Report Fatturato")).toBeNull();
  });

  it("utente Pro: Comparatore, Allocazione, Report Fatturato visibili", () => {
    setMockUser("pro");
    renderMobile();
    expect(screen.getByText("Comparatore")).toBeInTheDocument();
    expect(screen.getByText("Allocazione")).toBeInTheDocument();
    expect(screen.getByText("Report Fatturato")).toBeInTheDocument();
  });

  it("Admin: tutte le voci + sezione Admin", () => {
    setMockUser("admin");
    renderMobile();
    expect(screen.getByText("Comparatore")).toBeInTheDocument();
    expect(screen.getByText("Pannello Admin")).toBeInTheDocument();
    expect(screen.getByText("Parametri INPS")).toBeInTheDocument();
  });

  it("sezione Admin nascosta per utente non-admin", () => {
    setMockUser("free");
    renderMobile();
    expect(screen.queryByText("Pannello Admin")).toBeNull();
  });
});

// ═══════════════════════════════════════════════════
// Task 6 mobile: Active state (AC #6)
// ═══════════════════════════════════════════════════
describe("MobileMenuSheet — active state (AC #6)", () => {
  it("Dashboard ha aria-current=page su /dashboard", () => {
    setMockUser("free");
    renderMobile({}, ["/dashboard"]);
    const dashBtn = screen.getByText("Dashboard").closest("button");
    expect(dashBtn).toBeTruthy();
    expect(dashBtn!.getAttribute("aria-current")).toBe("page");
  });

  it("Messaggi ha aria-current=page su /messaggi", () => {
    setMockUser("free");
    renderMobile({}, ["/messaggi"]);
    const btn = screen.getByText("Messaggi").closest("button");
    expect(btn).toBeTruthy();
    expect(btn!.getAttribute("aria-current")).toBe("page");
  });

  it("Supporto collapsible auto-open quando child route /feedback attiva", () => {
    setMockUser("free");
    renderMobile({}, ["/feedback"]);
    // Children should be visible because supportoOpen is initialized based on child route
    expect(screen.getByText("Scrivi feedback")).toBeInTheDocument();
  });

  it("Supporto collapsible chiuso su /dashboard (children non visibili)", () => {
    setMockUser("free");
    renderMobile({}, ["/dashboard"]);
    // supportoOpen=false perché nessuna child route attiva → children non renderizzati
    expect(screen.queryByText("Scrivi feedback")).toBeNull();
  });
});
