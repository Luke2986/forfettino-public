import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import React from "react";
import { DashboardHeader } from "../DashboardHeader";

// --- Mocks ---

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockSignOut = vi.fn();
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    signOut: mockSignOut,
    user: { email: "luca@test.com" },
  }),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({
    data: { first_name: "Luca", last_name: "Rossi" },
  }),
}));

const mockCanImport = { value: true };
vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ canImport: mockCanImport.value }),
}));

vi.mock("@/components/import/ImportFattureDialog", () => ({
  ImportFattureDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="import-dialog">Import Dialog</div> : null,
}));

vi.mock("@/components/dashboard/UserCountBadge", () => ({
  UserCountBadge: () => <span data-testid="user-count-badge" />,
}));

const mockTrack = vi.fn();
vi.mock("@/lib/analytics", () => ({
  track: (...args: unknown[]) => mockTrack(...args),
  setAnalyticsConsent: vi.fn(),
}));

// Mock Radix DropdownMenu to render content directly (jsdom can't open Radix portals)
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuTrigger: ({ children, ...props }: React.PropsWithChildren<{ asChild?: boolean }>) => {
    const { asChild: _, ...rest } = props;
    return <div data-testid="dropdown-trigger" {...rest}>{children}</div>;
  },
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-content">{children}</div>,
  DropdownMenuItem: ({
    children,
    onSelect,
    disabled,
    className,
  }: {
    children: React.ReactNode;
    onSelect?: (e: Event) => void;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
  }) => (
    <button
      role="menuitem"
      disabled={disabled}
      className={className}
      onClick={() => onSelect?.(new Event("select"))}
    >
      {children}
    </button>
  ),
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
}));

// --- Helpers ---

function renderHeader() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DashboardHeader />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// --- Tests ---

describe("DashboardHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanImport.value = true;
  });

  // --- Structure / Layout ---

  it("renders greeting with user name", () => {
    renderHeader();
    expect(screen.getByText("Ciao, Luca!")).toBeInTheDocument();
  });

  it("renders UserCountBadge in left zone", () => {
    renderHeader();
    expect(screen.getByTestId("user-count-badge")).toBeInTheDocument();
  });

  it("does NOT render standalone refresh button in left zone", () => {
    renderHeader();
    expect(screen.queryByLabelText("Aggiorna dashboard")).not.toBeInTheDocument();
  });

  it("does NOT render divider element", () => {
    const { container } = renderHeader();
    const dividers = container.querySelectorAll(".w-px.h-6");
    expect(dividers.length).toBe(0);
  });

  it("does NOT render standalone Settings icon button", () => {
    renderHeader();
    // Old standalone Settings had aria-label="Impostazioni" on a top-level button
    expect(screen.queryByLabelText("Impostazioni")).not.toBeInTheDocument();
  });

  // --- CTA Aggiungi incasso (AC 1) ---

  it("renders Aggiungi incasso CTA with responsive text (hidden on mobile)", () => {
    renderHeader();
    const span = screen.getByText("Aggiungi incasso");
    expect(span.className).toContain("hidden");
    expect(span.className).toContain("sm:inline");
  });

  it("navigates to /incassi/nuovo and tracks on CTA click", () => {
    renderHeader();
    const ctaButton = screen.getByText("Aggiungi incasso").closest("button")!;
    fireEvent.click(ctaButton);
    expect(mockNavigate).toHaveBeenCalledWith("/incassi/nuovo");
    expect(mockTrack).toHaveBeenCalledWith("add_income_click", {
      source: "dashboard_header",
    });
  });

  it("CTA button has min 44px touch target", () => {
    renderHeader();
    const cta = screen.getByText("Aggiungi incasso").closest("button")!;
    expect(cta.className).toContain("min-h-[44px]");
    expect(cta.className).toContain("min-w-[44px]");
  });

  // --- Dropdown Azioni ⋮ (AC 2) ---

  it("renders Importa XML and Aggiorna dati items", () => {
    renderHeader();
    expect(screen.getByText("Importa XML")).toBeInTheDocument();
    expect(screen.getByText("Aggiorna dati")).toBeInTheDocument();
  });

  it("opens import dialog from Importa XML item and tracks", () => {
    renderHeader();
    fireEvent.click(screen.getByText("Importa XML"));
    expect(screen.getByTestId("import-dialog")).toBeInTheDocument();
    expect(mockTrack).toHaveBeenCalledWith("import_xml_click", {
      source: "dashboard_header_actions_dropdown",
    });
  });

  it("shows disabled Importa XML with (limite) when canImport is false", () => {
    mockCanImport.value = false;
    renderHeader();
    const item = screen.getByText("Importa XML (limite)");
    expect(item.closest("button")).toBeDisabled();
  });

  it("Aggiorna dati tracks with correct source", () => {
    renderHeader();
    fireEvent.click(screen.getByText("Aggiorna dati"));
    expect(mockTrack).toHaveBeenCalledWith("refresh_click", {
      source: "dashboard_header_actions_dropdown",
    });
  });

  // --- Dropdown Avatar/Profilo (AC 3) ---

  it("renders user info in avatar dropdown", () => {
    renderHeader();
    expect(screen.getByText("Luca Rossi")).toBeInTheDocument();
    expect(screen.getByText("luca@test.com")).toBeInTheDocument();
  });

  it("renders Impostazioni and Esci items in avatar dropdown", () => {
    renderHeader();
    expect(screen.getByText("Impostazioni")).toBeInTheDocument();
    expect(screen.getByText("Esci")).toBeInTheDocument();
  });

  it("does NOT render Profilo item (route non esiste)", () => {
    renderHeader();
    expect(screen.queryByText("Profilo")).not.toBeInTheDocument();
  });

  it("navigates to /impostazioni from avatar dropdown", () => {
    renderHeader();
    fireEvent.click(screen.getByText("Impostazioni"));
    expect(mockNavigate).toHaveBeenCalledWith("/impostazioni");
  });

  it("calls signOut from Esci", () => {
    renderHeader();
    fireEvent.click(screen.getByText("Esci"));
    expect(mockSignOut).toHaveBeenCalled();
  });

  it("Esci has destructive styling", () => {
    renderHeader();
    const esci = screen.getByText("Esci").closest("button")!;
    expect(esci.className).toContain("text-destructive");
  });

  // --- Avatar initials ---

  it("shows user initials LU in avatar", () => {
    renderHeader();
    expect(screen.getByText("LU")).toBeInTheDocument();
  });
});
