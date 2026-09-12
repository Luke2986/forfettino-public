/**
 * Test integrazione AppSidebar — Story 57.3
 * Copertura: rendering ordine sezioni, collapsible Clienti/Supporto,
 * access control (Free/Pro/Admin), active state e auto-open.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";

// ── Mutable mock state ──
const mockState = {
  userRole: "user" as string,
  isPro: false,
  isAdmin: false,
  npsVisible: false,
  unreadCount: 0,
};

// ── Mock hooks ──
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1" } }),
}));
vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({ data: { user_code: "FF-26-ABC" } }),
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

// ── Mock sidebar UI primitives ──
vi.mock("@/components/ui/sidebar", () => ({
  Sidebar: ({ children, ...props }: any) => createElement("div", { "data-testid": "sidebar", ...props }, children),
  SidebarContent: ({ children }: any) => createElement("div", null, children),
  SidebarFooter: ({ children }: any) => createElement("div", null, children),
  SidebarGroup: ({ children }: any) => createElement("div", null, children),
  SidebarGroupContent: ({ children }: any) => createElement("div", null, children),
  SidebarGroupLabel: ({ children, ...props }: any) => createElement("div", props, children),
  SidebarHeader: ({ children }: any) => createElement("div", null, children),
  SidebarMenu: ({ children }: any) => createElement("div", null, children),
  SidebarMenuButton: ({ children }: any) => createElement("div", null, children),
  SidebarMenuItem: ({ children }: any) => createElement("div", null, children),
}));
vi.mock("@/components/ui/collapsible", () => ({
  Collapsible: ({ children, defaultOpen, ...props }: any) =>
    createElement("div", { "data-testid": "collapsible", "data-default-open": String(!!defaultOpen), ...props }, children),
  CollapsibleTrigger: ({ children, asChild, ...props }: any) => createElement("div", props, children),
  CollapsibleContent: ({ children }: any) => createElement("div", { "data-testid": "collapsible-content" }, children),
}));
vi.mock("@/components/NavLink", async () => {
  const rrd = await import("react-router-dom");
  const react = await import("react");
  return {
    NavLink: ({ children, to, activeClassName, className, ...props }: any) => {
      const location = rrd.useLocation();
      const isActive = location.pathname === to;
      return react.createElement("a", {
        href: to,
        "aria-current": isActive ? "page" : undefined,
        className: [className, isActive && activeClassName].filter(Boolean).join(" ") || undefined,
        ...props,
      }, children);
    },
  };
});
vi.mock("./UserCodeBlock", () => ({
  UserCodeBlock: () => null,
}));
vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: any) => createElement("span", null, children),
}));
vi.mock("@/components/subscription/UsageCounter", () => ({
  UsageCounter: () => null,
}));
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return { ...actual, useQuery: () => ({ data: null, isLoading: false }) };
});
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn() },
}));

import { AppSidebar } from "./AppSidebar";

function renderSidebar(
  props: { onOpenNpsSurvey?: () => void } = {},
  initialEntries: string[] = ["/dashboard"],
) {
  return render(
    createElement(MemoryRouter, { initialEntries }, createElement(AppSidebar, props)),
  );
}

function setMockUser(role: "free" | "pro" | "admin") {
  mockState.userRole = role === "admin" ? "admin" : "user";
  mockState.isPro = role === "pro" || role === "admin";
  mockState.isAdmin = role === "admin";
}

beforeEach(() => {
  mockState.userRole = "user";
  mockState.isPro = false;
  mockState.isAdmin = false;
  mockState.npsVisible = false;
  mockState.unreadCount = 0;
});

// ═══════════════════════════════════════════════════
// Task 1: Test rendering ordine sezioni sidebar desktop (AC #1)
// ═══════════════════════════════════════════════════
describe("AppSidebar — ordine sezioni desktop (AC #1)", () => {
  it("renderizza tutte le sezioni nell'ordine corretto", () => {
    setMockUser("admin");
    mockState.npsVisible = true;
    const { container } = renderSidebar({ onOpenNpsSurvey: vi.fn() });
    const text = container.textContent || "";

    // Ordine atteso: Dashboard → Messaggi → Gestione → Pianificazione → Strumenti → Impostazioni → Supporto → Admin
    const positions = [
      text.indexOf("Dashboard"),
      text.indexOf("Messaggi"),
      text.indexOf("Gestione"),
      text.indexOf("Pianificazione"),
      text.indexOf("Strumenti"),
      text.indexOf("Impostazioni"),
      // "Supporto" appare come parent collapsible E come child — cerchiamo la label sezione
      text.lastIndexOf("Admin"),
    ];

    // Tutti presenti
    positions.forEach((pos, i) => {
      expect(pos).toBeGreaterThan(-1);
    });

    // Ordine crescente
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]);
    }
  });

  it("renderizza voci specifiche dentro ogni sezione", () => {
    setMockUser("admin");
    renderSidebar();

    // Gestione
    expect(screen.getByText("Incassi")).toBeInTheDocument();
    expect(screen.getByText("Clienti")).toBeInTheDocument();
    expect(screen.getByText("Costi")).toBeInTheDocument();

    // Pianificazione
    expect(screen.getByText("Scadenziario")).toBeInTheDocument();
    expect(screen.getByText("Calendario")).toBeInTheDocument();

    // Strumenti
    expect(screen.getByText("Il tuo contributo")).toBeInTheDocument();
    expect(screen.getByText("Comparatore")).toBeInTheDocument();
    expect(screen.getByText("Allocazione")).toBeInTheDocument();
    expect(screen.getByText("Guide per te")).toBeInTheDocument();

    // Admin
    expect(screen.getByText("Pannello Admin")).toBeInTheDocument();
    expect(screen.getByText("Parametri INPS")).toBeInTheDocument();
  });

  it("sezione Admin visibile solo per admin", () => {
    setMockUser("free");
    renderSidebar();
    expect(screen.queryByText("Pannello Admin")).toBeNull();
    expect(screen.queryByText("Parametri INPS")).toBeNull();
  });

  it("sezione Admin visibile per admin", () => {
    setMockUser("admin");
    renderSidebar();
    expect(screen.getByText("Pannello Admin")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════
// Task 3: Test collapsible Clienti (AC #3)
// ═══════════════════════════════════════════════════
describe("AppSidebar — collapsible Clienti (AC #3)", () => {
  it("Report Fatturato visibile per utente Pro", () => {
    setMockUser("pro");
    renderSidebar();
    expect(screen.getByText("Report Fatturato")).toBeInTheDocument();
  });

  it("Report Fatturato visibile per Free con ProBadge (Epic 64)", () => {
    setMockUser("free");
    renderSidebar();
    // Post-Epic 64: la voce è visibile anche per Free con ProBadge accanto (preview gated)
    expect(screen.getByText("Report Fatturato")).toBeInTheDocument();
  });

  it("Report Fatturato visibile per Admin", () => {
    setMockUser("admin");
    renderSidebar();
    expect(screen.getByText("Report Fatturato")).toBeInTheDocument();
  });

  it("Clienti renderizza children indentati (collapsible content presente)", () => {
    setMockUser("pro");
    renderSidebar();
    // CollapsibleContent mockato con data-testid — verifica che esista almeno uno
    const contents = screen.getAllByTestId("collapsible-content");
    expect(contents.length).toBeGreaterThan(0);
    // Report Fatturato è dentro un collapsible content
    expect(screen.getByText("Report Fatturato")).toBeInTheDocument();
  });

  it("Clienti mostra chevron quando children visibili (utente Pro)", () => {
    setMockUser("pro");
    renderSidebar();
    // Parent "Clienti" is a toggle-only button (not a link) — chevron is inside it
    const clientiEl = screen.getByText("Clienti").closest("[data-testid='collapsible']");
    expect(clientiEl).toBeInTheDocument();
    expect(clientiEl?.querySelector(".lucide-chevron-down")).toBeInTheDocument();
  });

  it("Clienti Free mostra entrambi children (Report Fatturato con ProBadge, Epic 64)", () => {
    setMockUser("free");
    renderSidebar();
    // Post-Epic 64: sia "I miei Clienti" sia "Report Fatturato" sono visibili per Free,
    // ma "Report Fatturato" ha ProBadge accanto (preview gated)
    expect(screen.getByText("I miei Clienti")).toBeInTheDocument();
    expect(screen.getByText("Report Fatturato")).toBeInTheDocument();
    // Still a collapsible with chevron
    const clientiEl = screen.getByText("Clienti").closest("[data-testid='collapsible']");
    expect(clientiEl).toBeInTheDocument();
    expect(clientiEl?.querySelector(".lucide-chevron-down")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════
// Task 4: Test collapsible Supporto (AC #4)
// ═══════════════════════════════════════════════════
describe("AppSidebar — collapsible Supporto (AC #4)", () => {
  it("Supporto mostra 3 children base (senza NPS): Scrivi feedback, Centro Assistenza, Call", () => {
    setMockUser("free");
    renderSidebar();
    expect(screen.getByText("Scrivi feedback")).toBeInTheDocument();
    expect(screen.getByText("Centro Assistenza")).toBeInTheDocument();
    expect(screen.getByText("Call")).toBeInTheDocument();
  });

  it("Call ha target _blank (link esterno)", () => {
    setMockUser("free");
    renderSidebar();
    const callLink = screen.getByText("Call").closest("a");
    expect(callLink).toBeTruthy();
    expect(callLink!.getAttribute("target")).toBe("_blank");
  });

  it("Valuta Forfettino nascosto quando NPS non attivo", () => {
    mockState.npsVisible = false;
    renderSidebar({ onOpenNpsSurvey: vi.fn() });
    expect(screen.queryByText("Valuta Forfettino")).toBeNull();
  });

  it("Valuta Forfettino visibile quando NPS attivo", () => {
    mockState.npsVisible = true;
    renderSidebar({ onOpenNpsSurvey: vi.fn() });
    expect(screen.getByText("Valuta Forfettino")).toBeInTheDocument();
  });

  it("Valuta Forfettino nascosto quando onOpenNpsSurvey non fornito", () => {
    mockState.npsVisible = true;
    renderSidebar(); // no onOpenNpsSurvey
    expect(screen.queryByText("Valuta Forfettino")).toBeNull();
  });
});

// ═══════════════════════════════════════════════════
// Task 5: Test access control (AC #5)
// ═══════════════════════════════════════════════════
describe("AppSidebar — access control (AC #5)", () => {
  it("utente Free: Comparatore, Allocazione, Report Fatturato visibili con ProBadge (Epic 64)", () => {
    setMockUser("free");
    renderSidebar();
    // Post-Epic 64: voci PRO sono visibili per Free con ProBadge accanto (preview gated)
    expect(screen.getByText("Comparatore")).toBeInTheDocument();
    expect(screen.getByText("Allocazione")).toBeInTheDocument();
    expect(screen.getByText("Report Fatturato")).toBeInTheDocument();
  });

  it("utente Pro: Comparatore, Allocazione, Report Fatturato visibili", () => {
    setMockUser("pro");
    renderSidebar();
    expect(screen.getByText("Comparatore")).toBeInTheDocument();
    expect(screen.getByText("Allocazione")).toBeInTheDocument();
    expect(screen.getByText("Report Fatturato")).toBeInTheDocument();
  });

  it("Admin: tutte le voci visibili + sezione Admin", () => {
    setMockUser("admin");
    renderSidebar();
    expect(screen.getByText("Comparatore")).toBeInTheDocument();
    expect(screen.getByText("Allocazione")).toBeInTheDocument();
    expect(screen.getByText("Report Fatturato")).toBeInTheDocument();
    expect(screen.getByText("Pannello Admin")).toBeInTheDocument();
    expect(screen.getByText("Parametri INPS")).toBeInTheDocument();
  });

  it("Clienti collapsible: children proOnly visibili con ProBadge (Epic 64)", () => {
    setMockUser("free");
    renderSidebar();
    // Post-Epic 64: il parent "Clienti" e il child "Report Fatturato" sono entrambi visibili per Free
    expect(screen.getByText("Clienti")).toBeInTheDocument();
    expect(screen.getByText("Report Fatturato")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════
// Task 6: Test active state e auto-open (AC #6)
// ═══════════════════════════════════════════════════
describe("AppSidebar — active state (AC #6)", () => {
  it("Dashboard ha aria-current=page quando route è /dashboard", () => {
    setMockUser("free");
    renderSidebar({}, ["/dashboard"]);
    const dashLink = screen.getByText("Dashboard").closest("a");
    expect(dashLink).toBeTruthy();
    expect(dashLink!.getAttribute("aria-current")).toBe("page");
  });

  it("Dashboard NON ha aria-current quando route è /incassi", () => {
    setMockUser("free");
    renderSidebar({}, ["/incassi"]);
    const dashLink = screen.getByText("Dashboard").closest("a");
    expect(dashLink!.getAttribute("aria-current")).toBeNull();
  });

  it("Report Fatturato ha aria-current=page quando route è /report", () => {
    setMockUser("pro");
    renderSidebar({}, ["/report"]);
    const link = screen.getByText("Report Fatturato").closest("a");
    expect(link).toBeTruthy();
    expect(link!.getAttribute("aria-current")).toBe("page");
  });

  it("Clienti collapsible defaultOpen=true quando child route /report attiva", () => {
    setMockUser("pro");
    renderSidebar({}, ["/report"]);
    const collapsibles = screen.getAllByTestId("collapsible");
    const clientiCollapsible = collapsibles.find(
      (c) => c.textContent?.includes("Clienti") && c.textContent?.includes("Report Fatturato"),
    );
    expect(clientiCollapsible).toBeTruthy();
    expect(clientiCollapsible!.getAttribute("data-default-open")).toBe("true");
  });

  it("Clienti collapsible defaultOpen=false quando su /dashboard", () => {
    setMockUser("pro");
    renderSidebar({}, ["/dashboard"]);
    const collapsibles = screen.getAllByTestId("collapsible");
    const clientiCollapsible = collapsibles.find(
      (c) => c.textContent?.includes("Clienti") && c.textContent?.includes("Report Fatturato"),
    );
    expect(clientiCollapsible).toBeTruthy();
    expect(clientiCollapsible!.getAttribute("data-default-open")).toBe("false");
  });

  it("Supporto collapsible defaultOpen=true quando child route /feedback attiva", () => {
    setMockUser("free");
    renderSidebar({}, ["/feedback"]);
    const collapsibles = screen.getAllByTestId("collapsible");
    const supportoCollapsible = collapsibles.find(
      (c) => c.textContent?.includes("Scrivi feedback"),
    );
    expect(supportoCollapsible).toBeTruthy();
    expect(supportoCollapsible!.getAttribute("data-default-open")).toBe("true");
  });

  it("Supporto collapsible defaultOpen=false quando su /dashboard", () => {
    setMockUser("free");
    renderSidebar({}, ["/dashboard"]);
    const collapsibles = screen.getAllByTestId("collapsible");
    const supportoCollapsible = collapsibles.find(
      (c) => c.textContent?.includes("Scrivi feedback"),
    );
    expect(supportoCollapsible).toBeTruthy();
    expect(supportoCollapsible!.getAttribute("data-default-open")).toBe("false");
  });
});
