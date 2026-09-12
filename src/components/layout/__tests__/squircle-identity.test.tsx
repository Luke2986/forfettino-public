/**
 * Test Story 81-3 — Squircle utility su sidebar nav items + logo box.
 * Verifica che `squircle-md` sostituisca `rounded-lg`/`rounded-xl` in:
 *  - sectionActiveClass (7 entries)
 *  - navLinkClass (default sidebar nav)
 *  - childLinkClass (CollapsibleNavGroup)
 *  - logo box AppSidebar + MobileMenuSheet
 *  - AvatarDropdown trigger conserva rounded-full + tap target 44px (decisione no-op AC #1)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";

// ── Mutable mock state riusato dai test esistenti ──
const mockState = {
  userRole: "user" as string,
  isPro: false,
  isAdmin: false,
  npsVisible: false,
  unreadCount: 0,
};

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1" }, signOut: vi.fn() }),
}));
vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({ data: { user_code: "FF-26-ABC", first_name: "Mario", last_name: "Rossi" } }),
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
  useNpsSidebarButton: () => ({ isVisible: mockState.npsVisible, activeCampaignId: null, isLoading: false }),
}));
vi.mock("@/lib/feature-gates", () => ({
  isGuideLive: () => true,
}));

// ── Sidebar UI primitives mockati (senza shadcn rendering complesso) ──
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
  Collapsible: ({ children }: any) => createElement("div", { "data-testid": "collapsible" }, children),
  CollapsibleTrigger: ({ children }: any) => createElement("div", null, children),
  CollapsibleContent: ({ children }: any) => createElement("div", null, children),
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
vi.mock("../UserCodeBlock", () => ({
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
vi.mock("../MobileMenuContext", () => ({
  useMobileMenu: () => ({ menuOpen: true, setMenuOpen: vi.fn(), closeMenu: vi.fn() }),
}));

import { AppSidebar, sectionActiveClass, navLinkClass } from "../AppSidebar";
import { childLinkClass } from "../CollapsibleNavGroup";
import { MobileMenuSheet } from "../MobileMenuSheet";
import { AvatarDropdown } from "@/components/dashboard/AvatarDropdown";

beforeEach(() => {
  mockState.userRole = "user";
  mockState.isPro = false;
  mockState.isAdmin = false;
  mockState.npsVisible = false;
  mockState.unreadCount = 0;
});

describe("Story 81-3 — sectionActiveClass squircle utility (AC #4, #9)", () => {
  it("ogni sezione contiene `squircle-md`", () => {
    Object.entries(sectionActiveClass).forEach(([section, cls]) => {
      expect(cls, `section "${section}" missing squircle-md`).toContain("squircle-md");
    });
  });

  it("nessuna sezione conserva piu' `rounded-lg`", () => {
    Object.entries(sectionActiveClass).forEach(([section, cls]) => {
      expect(cls, `section "${section}" still has rounded-lg`).not.toContain("rounded-lg");
    });
  });

  it("nessuna sezione conserva `rounded-xl`", () => {
    Object.entries(sectionActiveClass).forEach(([, cls]) => {
      expect(cls).not.toContain("rounded-xl");
    });
  });
});

describe("Story 81-3 — navLinkClass + childLinkClass (AC #4, #5)", () => {
  // Regex robusta: nessun rounded-* Tailwind standard residuo (sm/md/lg/xl/2xl/3xl/full).
  // Match con word-boundary per escludere falsi positivi (es. "squircle-md" non contiene "rounded-md").
  const TAILWIND_ROUNDED_REGEX = /(?:^|\s)rounded-(sm|md|lg|xl|2xl|3xl|full)(?:\s|$)/;

  it("navLinkClass contiene `squircle-md` e nessun `rounded-*` Tailwind standard", () => {
    expect(navLinkClass).toContain("squircle-md");
    expect(navLinkClass).not.toMatch(TAILWIND_ROUNDED_REGEX);
  });

  it("childLinkClass (CollapsibleNavGroup) contiene `squircle-md` e nessun `rounded-*`", () => {
    expect(childLinkClass).toContain("squircle-md");
    expect(childLinkClass).not.toMatch(TAILWIND_ROUNDED_REGEX);
  });

  it("sectionActiveClass: nessuna sezione conserva `rounded-*` Tailwind standard", () => {
    Object.entries(sectionActiveClass).forEach(([section, cls]) => {
      expect(cls, `section "${section}" still has rounded-*`).not.toMatch(TAILWIND_ROUNDED_REGEX);
    });
  });
});

describe("Story 81-3 — logo box squircle (AC #2, #3)", () => {
  it("AppSidebar logo box ha classe `squircle-md` su sfondo primary", () => {
    const { container } = render(
      createElement(MemoryRouter, null, createElement(AppSidebar, {})),
    );
    const logoBox = container.querySelector("div.squircle-md.bg-primary");
    expect(logoBox).toBeInTheDocument();
    expect(logoBox?.textContent).toBe("F");
  });

  it("AppSidebar logo box NON usa piu' `rounded-xl`", () => {
    const { container } = render(
      createElement(MemoryRouter, null, createElement(AppSidebar, {})),
    );
    const oldLogo = container.querySelector("div.rounded-xl.bg-primary");
    expect(oldLogo).toBeNull();
  });

  it("MobileMenuSheet logo box ha classe `squircle-md` su sfondo primary", () => {
    const { baseElement } = render(
      createElement(MemoryRouter, null, createElement(MobileMenuSheet, {})),
    );
    // Sheet content e' portalato in baseElement (document.body) tramite Radix
    const logoBox = baseElement.querySelector("div.squircle-md.bg-primary");
    expect(logoBox).toBeInTheDocument();
    expect(logoBox?.textContent).toBe("F");
  });
});

describe("Story 81-3 — AvatarDropdown decisione no-op (AC #1)", () => {
  it("trigger conserva `rounded-full` + tap target min 44x44", () => {
    const { container } = render(
      createElement(MemoryRouter, null, createElement(AvatarDropdown)),
    );
    const trigger = container.querySelector("button[aria-label='Menu utente']");
    expect(trigger).toBeInTheDocument();
    const cls = trigger!.className;
    expect(cls).toContain("rounded-full");
    expect(cls).toContain("min-h-[44px]");
    expect(cls).toContain("min-w-[44px]");
  });
});
