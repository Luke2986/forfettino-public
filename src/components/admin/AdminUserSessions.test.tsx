import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AdminUserSessions } from "./AdminUserSessions";
import type { UserSessionData } from "@/hooks/useAdminStats";

function makeSessions(): UserSessionData[] {
  return [
    { userCode: "LB26K3M9X", today: 3, week: 12, month: 28 },
    { userCode: "MA25J2P7Q", today: 0, week: 5, month: 15 },
    { userCode: "XC24H1N8R", today: 1, week: 1, month: 2 },
  ];
}

function makeManySessions(count: number): UserSessionData[] {
  return Array.from({ length: count }, (_, i) => ({
    userCode: `UA26${String(i).padStart(5, "0")}`,
    today: count - i,
    week: (count - i) * 2,
    month: (count - i) * 4,
  }));
}

describe("AdminUserSessions", () => {
  it("renders section title and description", () => {
    render(<AdminUserSessions data={makeSessions()} />);

    expect(screen.getByText("Attività Utenti")).toBeInTheDocument();
    expect(screen.getByText(/Sessioni per codice utente/)).toBeInTheDocument();
  });

  it("renders table headers", () => {
    render(<AdminUserSessions data={makeSessions()} />);

    expect(screen.getByText("Codice Utente")).toBeInTheDocument();
    expect(screen.getByText("Oggi")).toBeInTheDocument();
    expect(screen.getByText("7gg")).toBeInTheDocument();
    expect(screen.getByText("30gg")).toBeInTheDocument();
  });

  it("renders user codes in monospace", () => {
    render(<AdminUserSessions data={makeSessions()} />);

    const codeCell = screen.getByText("LB26K3M9X");
    expect(codeCell).toBeInTheDocument();
    expect(codeCell.className).toContain("font-mono");
  });

  it("renders session counts correctly", () => {
    render(<AdminUserSessions data={makeSessions()} />);

    // First user: today=3, week=12, month=28
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("28")).toBeInTheDocument();
  });

  it("renders zero consistently for all columns", () => {
    const zeroUser: UserSessionData[] = [
      { userCode: "XA26Z0000", today: 0, week: 0, month: 0 },
    ];

    render(<AdminUserSessions data={zeroUser} />);

    // All three zeros should be displayed as "0", not "—"
    const zeros = screen.getAllByText("0");
    expect(zeros).toHaveLength(3);
  });

  it("renders all user rows", () => {
    render(<AdminUserSessions data={makeSessions()} />);

    expect(screen.getByText("LB26K3M9X")).toBeInTheDocument();
    expect(screen.getByText("MA25J2P7Q")).toBeInTheDocument();
    expect(screen.getByText("XC24H1N8R")).toBeInTheDocument();
  });

  it("renders empty state when no sessions", () => {
    render(<AdminUserSessions data={[]} />);

    expect(screen.getByText("Nessuna sessione registrata")).toBeInTheDocument();
    expect(screen.queryByText("Codice Utente")).not.toBeInTheDocument();
  });

  it("renders single session correctly", () => {
    const single: UserSessionData[] = [
      { userCode: "ZZ29A1B2C", today: 1, week: 1, month: 1 },
    ];

    render(<AdminUserSessions data={single} />);

    expect(screen.getByText("ZZ29A1B2C")).toBeInTheDocument();
  });

  it("handles large session counts", () => {
    const large: UserSessionData[] = [
      { userCode: "PA26W1234", today: 50, week: 350, month: 1500 },
    ];

    render(<AdminUserSessions data={large} />);

    expect(screen.getByText("1500")).toBeInTheDocument();
    expect(screen.getByText("350")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
  });

  it("handles empty user_code gracefully", () => {
    const noCode: UserSessionData[] = [
      { userCode: "", today: 1, week: 1, month: 1 },
    ];

    render(<AdminUserSessions data={noCode} />);

    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  describe("pagination", () => {
    it("does not show pagination footer when data fits in one page", () => {
      render(<AdminUserSessions data={makeSessions()} />);

      expect(screen.queryByText(/Mostra/)).not.toBeInTheDocument();
      expect(screen.queryByText("Precedente")).not.toBeInTheDocument();
    });

    it("shows pagination footer when data exceeds page size", () => {
      render(<AdminUserSessions data={makeManySessions(15)} />);

      expect(screen.getByText(/Mostra 1 – 10 di 15 risultati/)).toBeInTheDocument();
      expect(screen.getByText("Precedente")).toBeInTheDocument();
      expect(screen.getByText("Successivo")).toBeInTheDocument();
    });

    it("shows only first 10 rows on first page", () => {
      render(<AdminUserSessions data={makeManySessions(15)} />);

      expect(screen.getByText("UA2600000")).toBeInTheDocument();
      expect(screen.getByText("UA2600009")).toBeInTheDocument();
      expect(screen.queryByText("UA2600010")).not.toBeInTheDocument();
    });

    it("navigates to second page", () => {
      render(<AdminUserSessions data={makeManySessions(15)} />);

      fireEvent.click(screen.getByText("Successivo"));

      expect(screen.getByText(/Mostra 11 – 15 di 15 risultati/)).toBeInTheDocument();
      expect(screen.queryByText("UA2600000")).not.toBeInTheDocument();
      expect(screen.getByText("UA2600010")).toBeInTheDocument();
      expect(screen.getByText("UA2600014")).toBeInTheDocument();
    });

    it("navigates back to first page", () => {
      render(<AdminUserSessions data={makeManySessions(15)} />);

      fireEvent.click(screen.getByText("Successivo"));
      fireEvent.click(screen.getByText("Precedente"));

      expect(screen.getByText(/Mostra 1 – 10 di 15 risultati/)).toBeInTheDocument();
      expect(screen.getByText("UA2600000")).toBeInTheDocument();
    });

    it("disables Precedente on first page", () => {
      render(<AdminUserSessions data={makeManySessions(15)} />);

      const prevButton = screen.getByText("Precedente").closest("button")!;
      expect(prevButton).toBeDisabled();
    });

    it("disables Successivo on last page", () => {
      render(<AdminUserSessions data={makeManySessions(15)} />);

      fireEvent.click(screen.getByText("Successivo"));

      const nextButton = screen.getByText("Successivo").closest("button")!;
      expect(nextButton).toBeDisabled();
    });

    it("shows exactly 10 items on page size boundary", () => {
      render(<AdminUserSessions data={makeManySessions(10)} />);

      // Exactly 10 items = 1 page, no pagination
      expect(screen.queryByText(/Mostra/)).not.toBeInTheDocument();
      expect(screen.getByText("UA2600000")).toBeInTheDocument();
      expect(screen.getByText("UA2600009")).toBeInTheDocument();
    });

    it("shows pagination for 11 items (2 pages)", () => {
      render(<AdminUserSessions data={makeManySessions(11)} />);

      expect(screen.getByText(/Mostra 1 – 10 di 11 risultati/)).toBeInTheDocument();

      fireEvent.click(screen.getByText("Successivo"));
      expect(screen.getByText(/Mostra 11 – 11 di 11 risultati/)).toBeInTheDocument();
      expect(screen.getByText("UA2600010")).toBeInTheDocument();
    });
  });

  // --- Internal account filtering (Story 24-1) ---
  describe("internal account filtering", () => {
    const internalCodes = new Set(["LA269TSP9"]);
    const sessionsWithInternal: UserSessionData[] = [
      { userCode: "LB26K3M9X", today: 3, week: 12, month: 28 },
      { userCode: "LA269TSP9", today: 10, week: 50, month: 100 },
      { userCode: "XC24H1N8R", today: 1, week: 1, month: 2 },
    ];

    it("hides internal user sessions by default", () => {
      render(
        <AdminUserSessions data={sessionsWithInternal} internalUserCodes={internalCodes} />
      );
      expect(screen.getByText("LB26K3M9X")).toBeInTheDocument();
      expect(screen.getByText("XC24H1N8R")).toBeInTheDocument();
      expect(screen.queryByText("LA269TSP9")).not.toBeInTheDocument();
    });

    it("shows internal user sessions when showInternal=true", () => {
      render(
        <AdminUserSessions
          data={sessionsWithInternal}
          internalUserCodes={internalCodes}
          showInternal={true}
        />
      );
      expect(screen.getByText("LB26K3M9X")).toBeInTheDocument();
      expect(screen.getByText("LA269TSP9")).toBeInTheDocument();
      expect(screen.getByText("XC24H1N8R")).toBeInTheDocument();
    });

    it("shows all sessions when no internalUserCodes provided", () => {
      render(<AdminUserSessions data={sessionsWithInternal} />);
      expect(screen.getByText("LB26K3M9X")).toBeInTheDocument();
      expect(screen.getByText("LA269TSP9")).toBeInTheDocument();
      expect(screen.getByText("XC24H1N8R")).toBeInTheDocument();
    });
  });
});
