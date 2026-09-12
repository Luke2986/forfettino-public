/**
 * Test per AppSidebar — bottone "Valuta Forfettino" (Story 50-4)
 * Verifica visibilità condizionale e click handler.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";

// ── Mock useNpsSidebarButton ──
const mockNpsSidebarButton = {
  isVisible: false,
  activeCampaignId: null as string | null,
  isLoading: false,
};
vi.mock("@/hooks/useNpsSidebarButton", () => ({
  useNpsSidebarButton: () => mockNpsSidebarButton,
}));

// ── Mock other hooks used by AppSidebar ──
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1" } }),
}));
vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({ data: { user_code: "FF-26-ABC" } }),
}));
vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: () => ({ data: "user" }),
}));
vi.mock("@/hooks/useNotificationCount", () => ({
  useNotificationCount: () => ({ data: 0 }),
}));
vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ isPro: false, isLoading: false }),
}));
vi.mock("@/lib/feature-gates", () => ({
  isGuideLive: () => false,
}));

// ── Mock sidebar UI primitives to simple divs ──
vi.mock("@/components/ui/sidebar", () => ({
  Sidebar: ({ children, ...props }: any) => createElement("div", { "data-testid": "sidebar", ...props }, children),
  SidebarContent: ({ children }: any) => createElement("div", null, children),
  SidebarFooter: ({ children }: any) => createElement("div", null, children),
  SidebarGroup: ({ children }: any) => createElement("div", null, children),
  SidebarGroupContent: ({ children }: any) => createElement("div", null, children),
  SidebarGroupLabel: ({ children }: any) => createElement("div", null, children),
  SidebarHeader: ({ children }: any) => createElement("div", null, children),
  SidebarMenu: ({ children }: any) => createElement("div", null, children),
  SidebarMenuButton: ({ children }: any) => createElement("div", null, children),
  SidebarMenuItem: ({ children }: any) => createElement("div", null, children),
}));
vi.mock("./UserCodeBlock", () => ({
  UserCodeBlock: () => null,
}));
vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: any) => createElement("span", null, children),
}));
vi.mock("@/components/subscription/UsageCounter", () => ({
  UsageCounter: () => null,
}));
vi.mock("@/components/NavLink", () => ({
  NavLink: ({ children, to, ...props }: any) =>
    createElement("a", { href: to, ...props }, children),
}));
// Mock Radix Collapsible to always show content (CollapsibleNavGroup renders children inside it)
vi.mock("@/components/ui/collapsible", () => ({
  Collapsible: ({ children }: any) => createElement("div", null, children),
  CollapsibleTrigger: ({ children }: any) => createElement("div", null, children),
  CollapsibleContent: ({ children }: any) => createElement("div", null, children),
}));
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: () => ({ data: null, isLoading: false }),
  };
});
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn() },
}));

import { AppSidebar } from "./AppSidebar";

function renderSidebar(props: { onOpenNpsSurvey?: () => void } = {}) {
  return render(
    createElement(
      MemoryRouter,
      null,
      createElement(AppSidebar, props)
    )
  );
}

describe("AppSidebar — NPS button (Story 50-4)", () => {
  beforeEach(() => {
    mockNpsSidebarButton.isVisible = false;
    mockNpsSidebarButton.activeCampaignId = null;
    mockNpsSidebarButton.isLoading = false;
  });

  it("shows 'Valuta Forfettino' button when isVisible=true and onOpenNpsSurvey provided", () => {
    mockNpsSidebarButton.isVisible = true;
    mockNpsSidebarButton.activeCampaignId = "camp-1";

    renderSidebar({ onOpenNpsSurvey: vi.fn() });

    expect(screen.getByText("Valuta Forfettino")).toBeInTheDocument();
  });

  it("does NOT show button when isVisible=false", () => {
    mockNpsSidebarButton.isVisible = false;

    renderSidebar({ onOpenNpsSurvey: vi.fn() });

    expect(screen.queryByText("Valuta Forfettino")).toBeNull();
  });

  it("does NOT show button when onOpenNpsSurvey is not provided", () => {
    mockNpsSidebarButton.isVisible = true;

    renderSidebar(); // No onOpenNpsSurvey prop

    expect(screen.queryByText("Valuta Forfettino")).toBeNull();
  });

  it("calls onOpenNpsSurvey when button is clicked", () => {
    mockNpsSidebarButton.isVisible = true;
    const handleOpen = vi.fn();

    renderSidebar({ onOpenNpsSurvey: handleOpen });

    fireEvent.click(screen.getByText("Valuta Forfettino"));
    expect(handleOpen).toHaveBeenCalledOnce();
  });
});
