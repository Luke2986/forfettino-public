import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { AdminUserTable } from "./AdminUserTable";
import type { AdminUser } from "./AdminUserTable";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Mock useAdminUserMessages to avoid QueryClient requirement in AdminUserMessagesDialog
vi.mock("@/hooks/useAdminUserMessages", () => ({
  useAdminUserMessages: () => ({ data: [], isLoading: false }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

function makeUser(overrides?: Partial<AdminUser>): AdminUser {
  return {
    id: crypto.randomUUID(),
    userCode: "MF26A1B2C",
    firstName: "Mario",
    lastName: "Rossi",
    tier: "free",
    status: null,
    cancelAtPeriodEnd: false,
    billingInterval: null,
    createdAt: "2026-01-15T10:00:00Z",
    isInternal: false,
    receiptCount: 0,
    onboardingCompleted: true,
    lastSeenAt: null,
    adminOverrideTier: null,
    gestione: null,
    ...overrides,
  };
}

function renderTable(ui: React.ReactElement) {
  return render(ui, { wrapper: createWrapper() });
}

function makeUsers(count: number): AdminUser[] {
  return Array.from({ length: count }, (_, i) =>
    makeUser({
      id: `user-${i}`,
      userCode: `XA26${String(i).padStart(5, "0")}`,
      firstName: `Nome${i}`,
      lastName: `Cognome${i}`,
      createdAt: `2026-01-${String(28 - (i % 28)).padStart(2, "0")}T10:00:00Z`,
    }),
  );
}

describe("AdminUserTable", () => {
  // --- Empty state ---
  it("renders empty state when users array is empty", () => {
    renderTable(<AdminUserTable users={[]} />);
    expect(screen.getByText("Nessun utente registrato")).toBeInTheDocument();
    expect(screen.getByText("Lista Utenti")).toBeInTheDocument();
  });

  // --- Header ---
  it("renders card header with correct user count", () => {
    renderTable(<AdminUserTable users={makeUsers(5)} />);
    expect(screen.getByText("5 utenti registrati")).toBeInTheDocument();
  });

  it("renders table column headers", () => {
    renderTable(<AdminUserTable users={[makeUser()]} />);
    expect(screen.getByText("ID")).toBeInTheDocument();
    expect(screen.getByText("Nome")).toBeInTheDocument();
    expect(screen.getByText("Piano")).toBeInTheDocument();
    expect(screen.getByText("Onboarding")).toBeInTheDocument();
    expect(screen.getByText("Incassi")).toBeInTheDocument();
    expect(screen.getByText("Ultimo Accesso")).toBeInTheDocument();
    expect(screen.getByText("Registrazione")).toBeInTheDocument();
  });

  it("renders user code in ID column", () => {
    renderTable(<AdminUserTable users={[makeUser({ userCode: "LF26K3M9X" })]} />);
    expect(screen.getByText("LF26K3M9X")).toBeInTheDocument();
  });

  // --- Display name ---
  it("renders display name with lastName initial", () => {
    renderTable(<AdminUserTable users={[makeUser({ firstName: "Luca", lastName: "Versilia" })]} />);
    expect(screen.getByText("Luca V.")).toBeInTheDocument();
  });

  it("renders firstName only when lastName is empty", () => {
    renderTable(<AdminUserTable users={[makeUser({ firstName: "Luca", lastName: "" })]} />);
    expect(screen.getByText("Luca")).toBeInTheDocument();
  });

  it("renders em-dash when both names are empty", () => {
    renderTable(<AdminUserTable users={[makeUser({ firstName: "", lastName: "" })]} />);
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  // --- Tier badges ---
  it("renders Pro badge for pro tier", () => {
    renderTable(<AdminUserTable users={[makeUser({ tier: "pro", status: "active" })]} />);
    const table = screen.getByRole("table");
    expect(within(table).getByText("Pro")).toBeInTheDocument();
  });

  it("renders Pro (cancella) badge when cancelAtPeriodEnd", () => {
    render(
      <AdminUserTable
        users={[makeUser({ tier: "pro", status: "active", cancelAtPeriodEnd: true })]}
      />,
    );
    expect(screen.getByText("Pro (cancella)")).toBeInTheDocument();
  });

  it("renders Pro (trial) badge when status is trialing", () => {
    renderTable(<AdminUserTable users={[makeUser({ tier: "pro", status: "trialing" })]} />);
    expect(screen.getByText("Pro (trial)")).toBeInTheDocument();
  });

  it("renders Free badge for free tier", () => {
    renderTable(<AdminUserTable users={[makeUser({ tier: "free" })]} />);
    const table = screen.getByRole("table");
    expect(within(table).getByText("Free")).toBeInTheDocument();
  });

  it("renders Studio badge for studio tier", () => {
    renderTable(<AdminUserTable users={[makeUser({ tier: "studio" })]} />);
    expect(screen.getByText("Studio")).toBeInTheDocument();
  });

  // --- Onboarding column ---
  it("renders checkmark icon for completed onboarding", () => {
    renderTable(<AdminUserTable users={[makeUser({ onboardingCompleted: true })]} />);
    expect(screen.getByLabelText("Onboarding completato")).toBeInTheDocument();
  });

  it("hides users with incomplete onboarding from the table", () => {
    renderTable(<AdminUserTable users={[makeUser({ onboardingCompleted: false })]} />);
    expect(screen.getByText("Nessun utente registrato")).toBeInTheDocument();
  });

  // --- Ultimo Accesso column ---
  it("renders registration date fallback when lastSeenAt is null", () => {
    renderTable(<AdminUserTable users={[makeUser({ lastSeenAt: null, createdAt: "2026-01-15T10:00:00Z" })]} />);
    // Should show "reg. {date}" instead of "Mai"
    const cells = screen.getAllByRole("cell");
    const lastSeenCell = cells.find((c) => c.textContent?.startsWith("reg."));
    expect(lastSeenCell).toBeTruthy();
  });

  it("renders relative time for lastSeenAt", () => {
    // Use a date close to now so formatDistanceToNow produces a predictable output
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    renderTable(<AdminUserTable users={[makeUser({ lastSeenAt: yesterday })]} />);
    // Should contain "fa" (Italian suffix for relative time)
    const cells = screen.getAllByRole("cell");
    const lastSeenCell = cells.find((c) => c.textContent?.includes("fa"));
    expect(lastSeenCell).toBeTruthy();
  });

  // --- Date rendering ---
  it("renders date in Italian locale format", () => {
    renderTable(<AdminUserTable users={[makeUser({ createdAt: "2026-01-15T10:00:00Z" })]} />);
    expect(screen.getByText("15 gen 2026")).toBeInTheDocument();
  });

  // --- Pagination ---
  it("shows first 10 users when list has more than 10", () => {
    renderTable(<AdminUserTable users={makeUsers(25)} />);
    expect(screen.getByText("Nome0 C.")).toBeInTheDocument();
    expect(screen.getByText("Nome9 C.")).toBeInTheDocument();
    expect(screen.queryByText("Nome10 C.")).not.toBeInTheDocument();
  });

  it("shows pagination footer when more than 10 users", () => {
    renderTable(<AdminUserTable users={makeUsers(15)} />);
    expect(screen.getByText("Precedente")).toBeInTheDocument();
    expect(screen.getByText("Successivo")).toBeInTheDocument();
  });

  it("does NOT show pagination footer when 10 or fewer users", () => {
    renderTable(<AdminUserTable users={makeUsers(10)} />);
    expect(screen.queryByText("Precedente")).not.toBeInTheDocument();
    expect(screen.queryByText("Successivo")).not.toBeInTheDocument();
  });

  it("shows correct range text for first page", () => {
    renderTable(<AdminUserTable users={makeUsers(25)} />);
    expect(screen.getByText(/Mostra 1 – 10 di 25 risultati/)).toBeInTheDocument();
  });

  it("navigates to next page on Successivo click", () => {
    renderTable(<AdminUserTable users={makeUsers(25)} />);
    fireEvent.click(screen.getByText("Successivo"));
    expect(screen.getByText("Nome10 C.")).toBeInTheDocument();
    expect(screen.queryByText("Nome0 C.")).not.toBeInTheDocument();
    expect(screen.getByText(/Mostra 11 – 20 di 25 risultati/)).toBeInTheDocument();
  });

  it("navigates back on Precedente click", () => {
    renderTable(<AdminUserTable users={makeUsers(25)} />);
    fireEvent.click(screen.getByText("Successivo"));
    fireEvent.click(screen.getByText("Precedente"));
    expect(screen.getByText("Nome0 C.")).toBeInTheDocument();
    expect(screen.getByText(/Mostra 1 – 10 di 25 risultati/)).toBeInTheDocument();
  });

  it("disables Precedente button on first page", () => {
    renderTable(<AdminUserTable users={makeUsers(15)} />);
    const prevButton = screen.getByText("Precedente").closest("button")!;
    expect(prevButton).toBeDisabled();
  });

  it("disables Successivo button on last page", () => {
    renderTable(<AdminUserTable users={makeUsers(15)} />);
    fireEvent.click(screen.getByText("Successivo"));
    const nextButton = screen.getByText("Successivo").closest("button")!;
    expect(nextButton).toBeDisabled();
  });

  it("shows correct partial count on last page", () => {
    renderTable(<AdminUserTable users={makeUsers(25)} />);
    fireEvent.click(screen.getByText("Successivo"));
    fireEvent.click(screen.getByText("Successivo"));
    expect(screen.getByText(/Mostra 21 – 25 di 25 risultati/)).toBeInTheDocument();
  });

  // --- Page reset on data change (AC6) ---
  it("resets to first page when users count changes", () => {
    const { rerender } = renderTable(<AdminUserTable users={makeUsers(25)} />);
    fireEvent.click(screen.getByText("Successivo"));
    expect(screen.getByText(/Mostra 11 – 20 di 25 risultati/)).toBeInTheDocument();

    // Rerender with fewer users — should reset to page 1
    rerender(<AdminUserTable users={makeUsers(15)} />);
    expect(screen.getByText(/Mostra 1 – 10 di 15 risultati/)).toBeInTheDocument();
  });

  // --- Display name edge case (L1) ---
  it("renders lastName initial when firstName is empty but lastName exists", () => {
    renderTable(<AdminUserTable users={[makeUser({ firstName: "", lastName: "Rossi" })]} />);
    expect(screen.getByText("R.")).toBeInTheDocument();
  });

  // --- Row actions ---
  it("renders row action button for each visible row", () => {
    renderTable(<AdminUserTable users={makeUsers(3)} />);
    const actionButtons = screen.getAllByRole("button", { name: /^Azioni per/ });
    expect(actionButtons).toHaveLength(3);
  });

  it("row action button has accessible label", () => {
    renderTable(<AdminUserTable users={[makeUser()]} />);
    expect(screen.getByRole("button", { name: "Azioni per MF26A1B2C" })).toBeInTheDocument();
  });

  // Note: Dropdown menu content ("Visualizza dettagli") cannot be tested in jsdom
  // due to Radix UI Portal/Presence limitations. Verifiable in E2E only.

  // --- Incassi column ---
  it("renders receipt count in Incassi column", () => {
    renderTable(<AdminUserTable users={[makeUser({ receiptCount: 7 })]} />);
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("renders zero receipt count", () => {
    renderTable(<AdminUserTable users={[makeUser({ receiptCount: 0 })]} />);
    const table = screen.getByRole("table");
    expect(within(table).getByText("0")).toBeInTheDocument();
  });

  // --- Sorting ---
  describe("sorting", () => {
    const sortableUsers = [
      makeUser({ id: "u1", userCode: "CC260003", receiptCount: 5, createdAt: "2026-03-01T10:00:00Z" }),
      makeUser({ id: "u2", userCode: "AA260001", receiptCount: 2, createdAt: "2026-01-15T10:00:00Z" }),
      makeUser({ id: "u3", userCode: "BB260002", receiptCount: 8, createdAt: "2026-02-10T10:00:00Z" }),
    ];

    it("sorts by userCode ASC on first click", () => {
      renderTable(<AdminUserTable users={sortableUsers} />);
      fireEvent.click(screen.getByLabelText("Ordina per ID"));
      const rows = screen.getAllByRole("row").slice(1); // skip header
      expect(rows[0]).toHaveTextContent("AA260001");
      expect(rows[1]).toHaveTextContent("BB260002");
      expect(rows[2]).toHaveTextContent("CC260003");
    });

    it("sorts by userCode DESC on second click", () => {
      renderTable(<AdminUserTable users={sortableUsers} />);
      fireEvent.click(screen.getByLabelText("Ordina per ID"));
      fireEvent.click(screen.getByLabelText("Ordina per ID"));
      const rows = screen.getAllByRole("row").slice(1);
      expect(rows[0]).toHaveTextContent("CC260003");
    });

    it("resets sort on third click", () => {
      renderTable(<AdminUserTable users={sortableUsers} />);
      fireEvent.click(screen.getByLabelText("Ordina per ID"));
      fireEvent.click(screen.getByLabelText("Ordina per ID"));
      fireEvent.click(screen.getByLabelText("Ordina per ID"));
      const rows = screen.getAllByRole("row").slice(1);
      // Original order: CC, AA, BB (as passed in props)
      expect(rows[0]).toHaveTextContent("CC260003");
    });

    it("sorts by receiptCount ASC on click", () => {
      renderTable(<AdminUserTable users={sortableUsers} />);
      fireEvent.click(screen.getByLabelText("Ordina per incassi"));
      const rows = screen.getAllByRole("row").slice(1);
      expect(rows[0]).toHaveTextContent("AA260001"); // 2 receipts
      expect(rows[2]).toHaveTextContent("BB260002"); // 8 receipts
    });

    it("sorts by lastSeenAt ASC on click", () => {
      const usersWithLastSeen = [
        makeUser({ id: "u1", userCode: "CC260003", lastSeenAt: "2026-03-05" }),
        makeUser({ id: "u2", userCode: "AA260001", lastSeenAt: null }),
        makeUser({ id: "u3", userCode: "BB260002", lastSeenAt: "2026-03-01" }),
      ];
      renderTable(<AdminUserTable users={usersWithLastSeen} />);
      fireEvent.click(screen.getByLabelText("Ordina per ultimo accesso"));
      const rows = screen.getAllByRole("row").slice(1);
      expect(rows[0]).toHaveTextContent("AA260001"); // null = "0" → first ASC
      expect(rows[1]).toHaveTextContent("BB260002"); // Mar 1
      expect(rows[2]).toHaveTextContent("CC260003"); // Mar 5
    });

    it("sorts by createdAt ASC on click", () => {
      renderTable(<AdminUserTable users={sortableUsers} />);
      fireEvent.click(screen.getByLabelText("Ordina per data registrazione"));
      const rows = screen.getAllByRole("row").slice(1);
      expect(rows[0]).toHaveTextContent("AA260001"); // Jan 15
      expect(rows[2]).toHaveTextContent("CC260003"); // Mar 1
    });

    it("resets pagination to page 1 on sort change", () => {
      const manyUsers = Array.from({ length: 15 }, (_, i) =>
        makeUser({
          id: `u-${i}`,
          userCode: `ZZ26${String(i).padStart(4, "0")}`,
          receiptCount: i,
          createdAt: `2026-01-${String(28 - i).padStart(2, "0")}T10:00:00Z`,
        })
      );
      renderTable(<AdminUserTable users={manyUsers} />);
      fireEvent.click(screen.getByText("Successivo"));
      expect(screen.getByText(/Mostra 11 – 15/)).toBeInTheDocument();
      fireEvent.click(screen.getByLabelText("Ordina per ID"));
      expect(screen.getByText(/Mostra 1 – 10/)).toBeInTheDocument();
    });
  });

  // --- Internal accounts (Story 24-1) ---
  describe("internal account filtering", () => {
    const usersWithInternal = [
      makeUser({ id: "u1", userCode: "AA260001", firstName: "Utente", lastName: "Reale", isInternal: false }),
      makeUser({ id: "u2", userCode: "LA269TSP9", firstName: "Admin", lastName: "Test", isInternal: true }),
      makeUser({ id: "u3", userCode: "BB260002", firstName: "Altro", lastName: "Reale", isInternal: false }),
    ];

    it("hides internal users by default (showInternal=false)", () => {
      renderTable(<AdminUserTable users={usersWithInternal} />);
      expect(screen.getByText("AA260001")).toBeInTheDocument();
      expect(screen.getByText("BB260002")).toBeInTheDocument();
      expect(screen.queryByText("LA269TSP9")).not.toBeInTheDocument();
      expect(screen.getByText("2 utenti registrati")).toBeInTheDocument();
    });

    it("shows internal users when showInternal=true", () => {
      renderTable(<AdminUserTable users={usersWithInternal} showInternal={true} />);
      expect(screen.getByText("AA260001")).toBeInTheDocument();
      expect(screen.getByText("LA269TSP9")).toBeInTheDocument();
      expect(screen.getByText("BB260002")).toBeInTheDocument();
      expect(screen.getByText("3 utenti registrati")).toBeInTheDocument();
    });

    it("renders 'Interno' badge for internal users when shown", () => {
      renderTable(<AdminUserTable users={usersWithInternal} showInternal={true} />);
      expect(screen.getByText("Interno")).toBeInTheDocument();
    });

    it("does not render 'Interno' badge for external users", () => {
      const externalOnly = [makeUser({ isInternal: false })];
      renderTable(<AdminUserTable users={externalOnly} showInternal={true} />);
      expect(screen.queryByText("Interno")).not.toBeInTheDocument();
    });

    it("pagination reflects filtered count", () => {
      const manyUsers = [
        ...makeUsers(12),
        makeUser({ id: "internal-1", userCode: "INT00001", isInternal: true }),
        makeUser({ id: "internal-2", userCode: "INT00002", isInternal: true }),
      ];
      renderTable(<AdminUserTable users={manyUsers} />);
      expect(screen.getByText(/Mostra 1 – 10 di 12 risultati/)).toBeInTheDocument();
    });

    it("shows empty state when all users are internal and showInternal=false", () => {
      const allInternal = [
        makeUser({ id: "i1", isInternal: true }),
        makeUser({ id: "i2", isInternal: true }),
      ];
      renderTable(<AdminUserTable users={allInternal} />);
      expect(screen.getByText("Nessun utente registrato")).toBeInTheDocument();
    });
  });

  // --- Override tier badges (Story 56-2) ---
  describe("override tier badges", () => {
    it("renders 'Pro (regalo)' badge for free user with adminOverrideTier=pro", () => {
      renderTable(
        <AdminUserTable users={[makeUser({ tier: "free", adminOverrideTier: "pro" })]} />,
      );
      expect(screen.getByText("Pro (regalo)")).toBeInTheDocument();
    });

    it("renders 'Beta Tester' badge for free user with adminOverrideTier=beta_tester", () => {
      renderTable(
        <AdminUserTable users={[makeUser({ tier: "free", adminOverrideTier: "beta_tester" })]} />,
      );
      const table = screen.getByRole("table");
      expect(within(table).getByText("Beta Tester")).toBeInTheDocument();
    });

    it("renders standard 'Pro' badge when Stripe Pro active even with override", () => {
      renderTable(
        <AdminUserTable
          users={[makeUser({ tier: "pro", status: "active", adminOverrideTier: "pro" })]}
        />,
      );
      const table = screen.getByRole("table");
      expect(within(table).getByText("Pro")).toBeInTheDocument();
      expect(screen.queryByText("Pro (regalo)")).not.toBeInTheDocument();
    });

    it("renders 'Free' badge when no override and no subscription", () => {
      renderTable(
        <AdminUserTable users={[makeUser({ tier: "free", adminOverrideTier: null })]} />,
      );
      const table = screen.getByRole("table");
      expect(within(table).getByText("Free")).toBeInTheDocument();
    });

    it("renders 'Pro (regalo)' with teal background", () => {
      renderTable(
        <AdminUserTable users={[makeUser({ tier: "free", adminOverrideTier: "pro" })]} />,
      );
      const badge = screen.getByText("Pro (regalo)");
      expect(badge.className).toContain("bg-teal-600");
    });

    it("renders 'Beta Tester' with violet background", () => {
      renderTable(
        <AdminUserTable users={[makeUser({ tier: "free", adminOverrideTier: "beta_tester" })]} />,
      );
      const table = screen.getByRole("table");
      const badge = within(table).getByText("Beta Tester");
      expect(badge.className).toContain("bg-violet-600");
    });

    it("renders 'Pro (trial)' when Stripe trialing even with beta_tester override (Stripe prevale)", () => {
      renderTable(
        <AdminUserTable
          users={[makeUser({ tier: "pro", status: "trialing", adminOverrideTier: "beta_tester" })]}
        />,
      );
      expect(screen.getByText("Pro (trial)")).toBeInTheDocument();
      const table = screen.getByRole("table");
      expect(within(table).queryByText("Beta Tester")).not.toBeInTheDocument();
    });

    it("renders 'Pro (cancella)' when cancel pending even with pro override (Stripe prevale)", () => {
      renderTable(
        <AdminUserTable
          users={[makeUser({ tier: "pro", status: "active", cancelAtPeriodEnd: true, adminOverrideTier: "pro" })]}
        />,
      );
      expect(screen.getByText("Pro (cancella)")).toBeInTheDocument();
      expect(screen.queryByText("Pro (regalo)")).not.toBeInTheDocument();
    });

    it("renders 'Pro (regalo)' when Stripe canceled but override active (H1 fix)", () => {
      renderTable(
        <AdminUserTable
          users={[makeUser({ tier: "pro", status: "canceled", adminOverrideTier: "pro" })]}
        />,
      );
      expect(screen.getByText("Pro (regalo)")).toBeInTheDocument();
    });
  });

  // --- Plan filter ---
  describe("plan filter", () => {
    const mixedUsers: AdminUser[] = [
      makeUser({ id: "f1", userCode: "FREE00001", tier: "free" }),
      makeUser({ id: "f2", userCode: "FREE00002", tier: "free" }),
      makeUser({ id: "p1", userCode: "PROS00001", tier: "pro", status: "active" }),
      makeUser({ id: "p2", userCode: "PROS00002", tier: "free", adminOverrideTier: "pro" }),
      makeUser({ id: "b1", userCode: "BETA00001", tier: "free", adminOverrideTier: "beta_tester" }),
    ];

    it("renders all four filter tabs with counts", () => {
      renderTable(<AdminUserTable users={mixedUsers} />);
      const tablist = screen.getByRole("tablist", { name: "Filtra per piano" });
      expect(within(tablist).getByRole("tab", { name: /Tutti 5/ })).toBeInTheDocument();
      expect(within(tablist).getByRole("tab", { name: /Free 2/ })).toBeInTheDocument();
      expect(within(tablist).getByRole("tab", { name: /Beta Tester 1/ })).toBeInTheDocument();
      expect(within(tablist).getByRole("tab", { name: /Pro 2/ })).toBeInTheDocument();
    });

    it("defaults to 'Tutti' tab selected", () => {
      renderTable(<AdminUserTable users={mixedUsers} />);
      const tablist = screen.getByRole("tablist", { name: "Filtra per piano" });
      expect(within(tablist).getByRole("tab", { name: /Tutti/ })).toHaveAttribute("aria-selected", "true");
    });

    it("filters to Free only when Free tab clicked", () => {
      renderTable(<AdminUserTable users={mixedUsers} />);
      const tablist = screen.getByRole("tablist", { name: "Filtra per piano" });
      fireEvent.click(within(tablist).getByRole("tab", { name: /Free 2/ }));
      expect(screen.getByText("FREE00001")).toBeInTheDocument();
      expect(screen.getByText("FREE00002")).toBeInTheDocument();
      expect(screen.queryByText("PROS00001")).not.toBeInTheDocument();
      expect(screen.queryByText("PROS00002")).not.toBeInTheDocument();
      expect(screen.queryByText("BETA00001")).not.toBeInTheDocument();
    });

    it("filters to Pro (includes Stripe active + admin override regalo)", () => {
      renderTable(<AdminUserTable users={mixedUsers} />);
      const tablist = screen.getByRole("tablist", { name: "Filtra per piano" });
      fireEvent.click(within(tablist).getByRole("tab", { name: /Pro 2/ }));
      expect(screen.getByText("PROS00001")).toBeInTheDocument();
      expect(screen.getByText("PROS00002")).toBeInTheDocument();
      expect(screen.queryByText("FREE00001")).not.toBeInTheDocument();
      expect(screen.queryByText("BETA00001")).not.toBeInTheDocument();
    });

    it("filters to Beta Tester only", () => {
      renderTable(<AdminUserTable users={mixedUsers} />);
      const tablist = screen.getByRole("tablist", { name: "Filtra per piano" });
      fireEvent.click(within(tablist).getByRole("tab", { name: /Beta Tester 1/ }));
      expect(screen.getByText("BETA00001")).toBeInTheDocument();
      expect(screen.queryByText("FREE00001")).not.toBeInTheDocument();
      expect(screen.queryByText("PROS00001")).not.toBeInTheDocument();
    });

    it("combines plan filter with search query", () => {
      renderTable(<AdminUserTable users={mixedUsers} />);
      const tablist = screen.getByRole("tablist", { name: "Filtra per piano" });
      fireEvent.click(within(tablist).getByRole("tab", { name: /Pro 2/ }));
      fireEvent.change(screen.getByPlaceholderText("Cerca codice o nome…"), {
        target: { value: "PROS00001" },
      });
      expect(screen.getByText("PROS00001")).toBeInTheDocument();
      expect(screen.queryByText("PROS00002")).not.toBeInTheDocument();
    });

    it("shows inline 'no results' with reset button when filter hides all users", () => {
      renderTable(<AdminUserTable users={[makeUser({ tier: "free" })]} />);
      const tablist = screen.getByRole("tablist", { name: "Filtra per piano" });
      fireEvent.click(within(tablist).getByRole("tab", { name: /Pro 0/ }));
      expect(screen.getByText(/Nessun utente corrisponde ai filtri attivi/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Azzera filtri" })).toBeInTheDocument();
    });

    it("reset button clears plan filter and search", () => {
      renderTable(<AdminUserTable users={[makeUser({ tier: "free", userCode: "ABC00001" })]} />);
      const tablist = screen.getByRole("tablist", { name: "Filtra per piano" });
      fireEvent.click(within(tablist).getByRole("tab", { name: /Pro/ }));
      fireEvent.click(screen.getByRole("button", { name: "Azzera filtri" }));
      expect(screen.getByText("ABC00001")).toBeInTheDocument();
      expect(within(tablist).getByRole("tab", { name: /Tutti/ })).toHaveAttribute("aria-selected", "true");
    });

    it("updates description text when plan filter is active", () => {
      renderTable(<AdminUserTable users={mixedUsers} />);
      expect(screen.getByText("5 utenti registrati")).toBeInTheDocument();
      const tablist = screen.getByRole("tablist", { name: "Filtra per piano" });
      fireEvent.click(within(tablist).getByRole("tab", { name: /Free 2/ }));
      expect(screen.getByText("2 utenti trovati")).toBeInTheDocument();
    });

    it("resets pagination to page 1 when changing plan filter", () => {
      const manyFree = Array.from({ length: 15 }, (_, i) =>
        makeUser({ id: `f-${i}`, userCode: `FF26${String(i).padStart(5, "0")}`, tier: "free" }),
      );
      const oneBeta = makeUser({
        id: "b",
        userCode: "BB2600001",
        tier: "free",
        adminOverrideTier: "beta_tester",
      });
      renderTable(<AdminUserTable users={[...manyFree, oneBeta]} />);
      fireEvent.click(screen.getByText("Successivo"));
      expect(screen.getByText(/Mostra 11 – 16/)).toBeInTheDocument();
      const tablist = screen.getByRole("tablist", { name: "Filtra per piano" });
      fireEvent.click(within(tablist).getByRole("tab", { name: /Beta Tester/ }));
      expect(screen.getByText("BB2600001")).toBeInTheDocument();
    });
  });

  // --- Override dropdown (Story 56-2) ---
  describe("override dropdown", () => {
    it("does not render override section when onOverrideChange is not provided", () => {
      renderTable(<AdminUserTable users={[makeUser()]} />);
      // Dropdown menu items are behind a portal — we check that "Livello" label is NOT present in the DOM
      expect(screen.queryByText("Livello")).not.toBeInTheDocument();
    });

    // Note: Radix UI DropdownMenu renders via Portal in jsdom which has limitations.
    // The dropdown content may not be accessible. Integration/E2E tests recommended
    // for full dropdown interaction testing.
  });
});
