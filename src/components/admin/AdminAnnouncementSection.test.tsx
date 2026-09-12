import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AdminAnnouncementSection } from "./AdminAnnouncementSection";

// ── Mock hooks ──
const mockUseAdminAnnouncements = vi.fn();
vi.mock("@/hooks/useAdminAnnouncements", () => ({
  useAdminAnnouncements: (...args: unknown[]) => mockUseAdminAnnouncements(...args),
}));

// Mock NewAnnouncementDialog to isolate AdminAnnouncementSection tests
vi.mock("./NewAnnouncementDialog", () => ({
  NewAnnouncementDialog: ({
    open,
    onOpenChange,
    defaultValues,
    resendTitle,
  }: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    defaultValues?: any;
    resendTitle?: string;
  }) =>
    open ? (
      <div data-testid="mock-dialog">
        {resendTitle && <span data-testid="mock-resend-title">{resendTitle}</span>}
        {defaultValues && <span data-testid="mock-default-values">{JSON.stringify(defaultValues)}</span>}
        <button onClick={() => onOpenChange(false)}>Close</button>
      </div>
    ) : null,
}));

// ── Helper factory ──
function makeAnnouncement(overrides?: Record<string, unknown>) {
  return {
    id: crypto.randomUUID(),
    admin_user_id: "admin-1",
    title: "Test annuncio",
    body: "Corpo del test",
    action_url: null,
    action_label: null,
    target_audience: "all",
    target_type: "broadcast",
    sent_count: 42,
    created_at: "2026-02-18T10:00:00Z",
    published_at: "2026-02-18T10:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAdminAnnouncements.mockReturnValue({
    data: [],
    isLoading: false,
    error: null,
  });
});

describe("AdminAnnouncementSection", () => {
  // --- Header ---
  it("renders section header and button", () => {
    render(<AdminAnnouncementSection />);

    expect(screen.getByText("Annunci Broadcast")).toBeInTheDocument();
    expect(screen.getByText("Nuovo Annuncio")).toBeInTheDocument();
  });

  // --- Loading ---
  it("renders loading state", () => {
    mockUseAdminAnnouncements.mockReturnValue({
      data: [],
      isLoading: true,
      error: null,
    });

    render(<AdminAnnouncementSection />);
    expect(screen.getByText("Caricamento...")).toBeInTheDocument();
  });

  // --- Empty state ---
  it("renders empty state when no announcements", () => {
    render(<AdminAnnouncementSection />);
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    expect(screen.getByText("Nessun annuncio inviato")).toBeInTheDocument();
  });

  // --- List rendering ---
  it("renders announcements list", () => {
    const announcements = [
      makeAnnouncement({ id: "1", title: "Primo", body: "Primo corpo", sent_count: 10, target_audience: "all" }),
      makeAnnouncement({ id: "2", title: "Secondo", body: "Secondo corpo", sent_count: 5, target_audience: "pro" }),
    ];

    mockUseAdminAnnouncements.mockReturnValue({
      data: announcements,
      isLoading: false,
      error: null,
    });

    render(<AdminAnnouncementSection />);

    expect(screen.getByTestId("announcements-list")).toBeInTheDocument();
    expect(screen.getByText("Primo")).toBeInTheDocument();
    expect(screen.getByText("Secondo")).toBeInTheDocument();
    expect(screen.getByText("Primo corpo")).toBeInTheDocument();
    expect(screen.getByText("Secondo corpo")).toBeInTheDocument();
  });

  // --- Audience badges ---
  it("renders correct audience labels", () => {
    const announcements = [
      makeAnnouncement({ id: "1", target_audience: "all" }),
      makeAnnouncement({ id: "2", target_audience: "pro" }),
      makeAnnouncement({ id: "3", target_audience: "free" }),
    ];

    mockUseAdminAnnouncements.mockReturnValue({
      data: announcements,
      isLoading: false,
      error: null,
    });

    render(<AdminAnnouncementSection />);

    expect(screen.getByText("Tutti")).toBeInTheDocument();
    expect(screen.getByText("Solo Pro")).toBeInTheDocument();
    expect(screen.getByText("Solo Free")).toBeInTheDocument();
  });

  // --- Sent count display ---
  it("shows sent count for each announcement", () => {
    const announcements = [
      makeAnnouncement({ id: "1", sent_count: 123, published_at: "2026-02-18T10:00:00Z" }),
    ];

    mockUseAdminAnnouncements.mockReturnValue({
      data: announcements,
      isLoading: false,
      error: null,
    });

    render(<AdminAnnouncementSection />);

    expect(screen.getByText(/123 inv\./)).toBeInTheDocument();
  });

  // --- Dialog open ---
  it("opens dialog when clicking Nuovo Annuncio", () => {
    render(<AdminAnnouncementSection />);

    expect(screen.queryByTestId("mock-dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Nuovo Annuncio"));

    expect(screen.getByTestId("mock-dialog")).toBeInTheDocument();
  });

  // --- Published_at null fallback ---
  it("shows dash when published_at is null", () => {
    const announcements = [
      makeAnnouncement({ id: "1", published_at: null, sent_count: 0 }),
    ];

    mockUseAdminAnnouncements.mockReturnValue({
      data: announcements,
      isLoading: false,
      error: null,
    });

    render(<AdminAnnouncementSection />);

    expect(screen.getByText(/0 inv\. · —/)).toBeInTheDocument();
  });

  // --- Read stats display ---
  it("shows read count and open rate when announcementReadCounts is provided", () => {
    const announcements = [
      makeAnnouncement({ id: "ann-1", sent_count: 100 }),
    ];

    mockUseAdminAnnouncements.mockReturnValue({
      data: announcements,
      isLoading: false,
      error: null,
    });

    render(
      <AdminAnnouncementSection
        announcementReadCounts={{
          "ann-1": { sent: 100, read: 75, openRate: 75 },
        }}
      />,
    );

    expect(screen.getByText(/75 letti/)).toBeInTheDocument();
    expect(screen.getByText(/75%/)).toBeInTheDocument();
  });

  it("gracefully renders without read counts (no prop)", () => {
    const announcements = [
      makeAnnouncement({ id: "ann-2", sent_count: 50 }),
    ];

    mockUseAdminAnnouncements.mockReturnValue({
      data: announcements,
      isLoading: false,
      error: null,
    });

    render(<AdminAnnouncementSection />);

    expect(screen.getByText(/50 inv\./)).toBeInTheDocument();
    expect(screen.queryByText(/letti/)).not.toBeInTheDocument();
  });

  it("shows read stats in detail dialog when clicking an announcement", () => {
    const announcements = [
      makeAnnouncement({ id: "ann-3", title: "Dettaglio test", sent_count: 200 }),
    ];

    mockUseAdminAnnouncements.mockReturnValue({
      data: announcements,
      isLoading: false,
      error: null,
    });

    render(
      <AdminAnnouncementSection
        announcementReadCounts={{
          "ann-3": { sent: 200, read: 150, openRate: 75 },
        }}
      />,
    );

    fireEvent.click(screen.getByTestId("announcement-row-ann-3"));

    const detail = screen.getByTestId("announcement-detail-ann-3");
    expect(detail).toBeInTheDocument();
    // Use data-testid to scope to the dialog stats (avoids matching list row)
    const detailStats = detail.querySelector("[data-testid='announcement-detail-stats']");
    expect(detailStats?.textContent).toMatch(/150 letti/);
    expect(detailStats?.textContent).toMatch(/75%/);
  });

  // --- Zero read stats edge case ---
  it("renders correctly when announcementReadCounts has zero reads", () => {
    const announcements = [
      makeAnnouncement({ id: "ann-zero", sent_count: 50 }),
    ];

    mockUseAdminAnnouncements.mockReturnValue({
      data: announcements,
      isLoading: false,
      error: null,
    });

    render(
      <AdminAnnouncementSection
        announcementReadCounts={{
          "ann-zero": { sent: 50, read: 0, openRate: 0 },
        }}
      />,
    );

    expect(screen.getByText(/0 letti/)).toBeInTheDocument();
    expect(screen.getByText(/0%/)).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════════════════════════
  // Re-invio Annunci Broadcast
  // ═══════════════════════════════════════════════════════════════

  describe("resend button", () => {
    it("shows Re-invia button in detail dialog for broadcast announcements", () => {
      const announcements = [
        makeAnnouncement({ id: "bc-1", title: "Broadcast test", target_type: "broadcast" }),
      ];

      mockUseAdminAnnouncements.mockReturnValue({
        data: announcements,
        isLoading: false,
        error: null,
      });

      render(<AdminAnnouncementSection />);
      fireEvent.click(screen.getByTestId("announcement-row-bc-1"));

      expect(screen.getByTestId("announcement-resend-btn")).toBeInTheDocument();
      expect(screen.getByText("Re-invia")).toBeInTheDocument();
    });

    it("shows Re-invia button when target_type is null (legacy records)", () => {
      const announcements = [
        makeAnnouncement({ id: "legacy-1", title: "Legacy test", target_type: null }),
      ];

      mockUseAdminAnnouncements.mockReturnValue({
        data: announcements,
        isLoading: false,
        error: null,
      });

      render(<AdminAnnouncementSection />);
      fireEvent.click(screen.getByTestId("announcement-row-legacy-1"));

      expect(screen.getByTestId("announcement-resend-btn")).toBeInTheDocument();
    });

    it("hides Re-invia button for individual announcements", () => {
      const announcements = [
        makeAnnouncement({ id: "ind-1", title: "Individual test", target_type: "individual" }),
      ];

      mockUseAdminAnnouncements.mockReturnValue({
        data: announcements,
        isLoading: false,
        error: null,
      });

      render(<AdminAnnouncementSection />);
      fireEvent.click(screen.getByTestId("announcement-row-ind-1"));

      expect(screen.queryByTestId("announcement-resend-btn")).not.toBeInTheDocument();
    });

    it("clicking Re-invia closes detail dialog and opens new dialog with pre-filled data", () => {
      const announcements = [
        makeAnnouncement({
          id: "rs-1",
          title: "Resend me",
          body: "Corpo resend",
          action_url: "https://example.com",
          action_label: "Clicca",
          target_audience: "pro",
          target_type: "broadcast",
        }),
      ];

      mockUseAdminAnnouncements.mockReturnValue({
        data: announcements,
        isLoading: false,
        error: null,
      });

      render(<AdminAnnouncementSection />);

      // Open detail dialog
      fireEvent.click(screen.getByTestId("announcement-row-rs-1"));
      expect(screen.getByTestId("announcement-detail-rs-1")).toBeInTheDocument();

      // Click Re-invia
      fireEvent.click(screen.getByTestId("announcement-resend-btn"));

      // Detail dialog should close, new dialog should open with resend data
      expect(screen.queryByTestId("announcement-detail-rs-1")).not.toBeInTheDocument();
      expect(screen.getByTestId("mock-dialog")).toBeInTheDocument();
      expect(screen.getByTestId("mock-resend-title")).toHaveTextContent("Resend me");

      const defaultValues = JSON.parse(screen.getByTestId("mock-default-values").textContent!);
      expect(defaultValues.title).toBe("Resend me");
      expect(defaultValues.body).toBe("Corpo resend");
      expect(defaultValues.actionUrl).toBe("https://example.com");
      expect(defaultValues.actionLabel).toBe("Clicca");
      expect(defaultValues.targetAudience).toBe("pro");
    });

    it("clicking Nuovo Annuncio does not pass defaultValues or resendTitle", () => {
      mockUseAdminAnnouncements.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      });

      render(<AdminAnnouncementSection />);
      fireEvent.click(screen.getByText("Nuovo Annuncio"));

      expect(screen.getByTestId("mock-dialog")).toBeInTheDocument();
      expect(screen.queryByTestId("mock-resend-title")).not.toBeInTheDocument();
      expect(screen.queryByTestId("mock-default-values")).not.toBeInTheDocument();
    });
  });
});
