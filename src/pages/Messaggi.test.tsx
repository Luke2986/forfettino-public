/**
 * Test per Messaggi.tsx
 * Copertura:
 * - Rendering heading "Messaggi"
 * - Empty state ("Nessun messaggio")
 * - Loading state ("Caricamento...")
 * - Date grouping: "Oggi", "Questa settimana", "Precedenti"
 * - Unread indicator (blue dot)
 * - Click card -> markRead + expand/collapse toggle
 * - "Segna tutte come lette" button visibility
 * - Action button with action_label in expanded card
 * - MobileHeader on mobile
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import React, { createElement } from "react";
import { MemoryRouter } from "react-router-dom";

// ── Mocks (before imports) ──

const mockMutateMarkRead = vi.fn();
const mockMutateMarkAllRead = vi.fn();
const mockNavigate = vi.fn();

vi.mock("@/hooks/useNotifications", () => ({
  useNotifications: vi.fn(),
}));
vi.mock("@/hooks/useNotificationCount", () => ({
  useNotificationCount: vi.fn(),
}));
vi.mock("@/hooks/useMarkNotificationRead", () => ({
  useMarkNotificationRead: vi.fn(),
}));
vi.mock("@/hooks/useMarkAllNotificationsRead", () => ({
  useMarkAllNotificationsRead: vi.fn(),
}));
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: vi.fn(),
}));
vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) =>
    createElement("div", { "data-testid": "app-layout" }, children),
}));
vi.mock("@/components/layout/MobileHeader", () => ({
  MobileHeader: ({ title }: { title: string }) =>
    createElement("div", { "data-testid": "mobile-header" }, title),
}));
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

// ── Now import modules that use the mocks ──

import Messaggi from "./Messaggi";
import { useNotifications } from "@/hooks/useNotifications";
import { useNotificationCount } from "@/hooks/useNotificationCount";
import { useMarkNotificationRead } from "@/hooks/useMarkNotificationRead";
import { useMarkAllNotificationsRead } from "@/hooks/useMarkAllNotificationsRead";
import { useIsMobile } from "@/hooks/use-mobile";

// ── Typed mock references ──

const mockUseNotifications = useNotifications as ReturnType<typeof vi.fn>;
const mockUseNotificationCount = useNotificationCount as ReturnType<typeof vi.fn>;
const mockUseMarkNotificationRead = useMarkNotificationRead as ReturnType<typeof vi.fn>;
const mockUseMarkAllNotificationsRead = useMarkAllNotificationsRead as ReturnType<typeof vi.fn>;
const mockUseIsMobile = useIsMobile as ReturnType<typeof vi.fn>;

// ── Notification factory ──

interface PartialNotification {
  id: string;
  title: string;
  body: string;
  category?: string;
  read_at?: string | null;
  action_url?: string | null;
  action_label?: string | null;
  created_at: string;
}

function makeNotification(partial: PartialNotification) {
  return {
    id: partial.id,
    user_id: "user-1",
    title: partial.title,
    body: partial.body,
    category: partial.category ?? "scadenze",
    delivery_channel: "sidebar",
    read_at: partial.read_at ?? null,
    dismissed_at: null,
    action_url: partial.action_url ?? null,
    action_label: partial.action_label ?? null,
    created_at: partial.created_at,
  };
}

// ── Render helper ──

function renderMessaggi() {
  return render(
    createElement(MemoryRouter, null, createElement(Messaggi))
  );
}

// ── Test suite ──

describe("Messaggi page", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Set system time to Thursday 2026-02-26 12:00 local
    vi.setSystemTime(new Date("2026-02-26T12:00:00"));

    mockUseIsMobile.mockReturnValue(false);
    mockUseNotifications.mockReturnValue({
      data: [],
      isLoading: false,
    });
    mockUseNotificationCount.mockReturnValue({
      data: 0,
    });
    mockUseMarkNotificationRead.mockReturnValue({
      mutate: mockMutateMarkRead,
    });
    mockUseMarkAllNotificationsRead.mockReturnValue({
      mutate: mockMutateMarkAllRead,
    });

    mockMutateMarkRead.mockClear();
    mockMutateMarkAllRead.mockClear();
    mockNavigate.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── 1. Renders the "Messaggi" heading ──

  it("renders the 'Messaggi' heading", () => {
    renderMessaggi();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Messaggi");
  });

  // ── 2. Empty state ──

  it("shows empty state with 'Nessun messaggio' when no notifications", () => {
    renderMessaggi();
    const emptyState = screen.getByTestId("messaggi-empty-state");
    expect(emptyState).toBeInTheDocument();
    expect(screen.getByText("Nessun messaggio")).toBeInTheDocument();
    expect(
      screen.getByText("Le notifiche sulle scadenze e gli aggiornamenti appariranno qui.")
    ).toBeInTheDocument();
  });

  it("does not show empty state when notifications exist", () => {
    mockUseNotifications.mockReturnValue({
      data: [
        makeNotification({
          id: "n1",
          title: "Test",
          body: "Body",
          created_at: "2026-02-26T10:00:00",
        }),
      ],
      isLoading: false,
    });
    renderMessaggi();
    expect(screen.queryByTestId("messaggi-empty-state")).not.toBeInTheDocument();
  });

  // ── 3. Loading state ──

  it("shows loading state when isLoading is true", () => {
    mockUseNotifications.mockReturnValue({
      data: [],
      isLoading: true,
    });
    renderMessaggi();
    expect(screen.getByText("Caricamento...")).toBeInTheDocument();
    // Empty state should NOT show while loading
    expect(screen.queryByTestId("messaggi-empty-state")).not.toBeInTheDocument();
  });

  it("does not show loading state when isLoading is false", () => {
    renderMessaggi();
    expect(screen.queryByText("Caricamento...")).not.toBeInTheDocument();
  });

  // ── 4. Groups notifications: "Oggi", "Questa settimana", "Precedenti" ──

  describe("date grouping", () => {
    // System time: Thursday 2026-02-26T12:00:00
    // Monday of this week = 2026-02-23
    // So:
    //   today = Feb 26
    //   thisWeek = Feb 23, 24, 25
    //   older = Feb 22 and before

    it("groups notifications into Oggi, Questa settimana, Precedenti", () => {
      const notifications = [
        makeNotification({
          id: "today-1",
          title: "Notifica di oggi",
          body: "Body oggi",
          created_at: "2026-02-26T09:00:00",
        }),
        makeNotification({
          id: "week-1",
          title: "Notifica di questa settimana",
          body: "Body settimana",
          created_at: "2026-02-24T14:00:00", // Tuesday
        }),
        makeNotification({
          id: "older-1",
          title: "Notifica vecchia",
          body: "Body vecchia",
          created_at: "2026-02-20T10:00:00", // Friday of previous week
        }),
      ];

      mockUseNotifications.mockReturnValue({
        data: notifications,
        isLoading: false,
      });

      renderMessaggi();

      // Group headers
      expect(screen.getByText("Oggi")).toBeInTheDocument();
      expect(screen.getByText("Questa settimana")).toBeInTheDocument();
      expect(screen.getByText("Precedenti")).toBeInTheDocument();

      // Notifications in correct groups
      expect(screen.getByText("Notifica di oggi")).toBeInTheDocument();
      expect(screen.getByText("Notifica di questa settimana")).toBeInTheDocument();
      expect(screen.getByText("Notifica vecchia")).toBeInTheDocument();
    });

    it("omits group headers with no items", () => {
      // Only a notification from today — no "Questa settimana" or "Precedenti"
      mockUseNotifications.mockReturnValue({
        data: [
          makeNotification({
            id: "today-only",
            title: "Solo oggi",
            body: "Body",
            created_at: "2026-02-26T08:00:00",
          }),
        ],
        isLoading: false,
      });

      renderMessaggi();

      expect(screen.getByText("Oggi")).toBeInTheDocument();
      expect(screen.queryByText("Questa settimana")).not.toBeInTheDocument();
      expect(screen.queryByText("Precedenti")).not.toBeInTheDocument();
    });

    it("puts Monday of current week in 'Questa settimana' group", () => {
      // Monday Feb 23 is start of week, should be in "Questa settimana" (not today, not older)
      mockUseNotifications.mockReturnValue({
        data: [
          makeNotification({
            id: "monday",
            title: "Monday notification",
            body: "Body",
            created_at: "2026-02-23T09:00:00",
          }),
        ],
        isLoading: false,
      });

      renderMessaggi();

      expect(screen.getByText("Questa settimana")).toBeInTheDocument();
      expect(screen.queryByText("Oggi")).not.toBeInTheDocument();
      expect(screen.queryByText("Precedenti")).not.toBeInTheDocument();
    });

    it("puts Sunday before current week in 'Precedenti' group", () => {
      // Sunday Feb 22 is before current week's Monday Feb 23
      mockUseNotifications.mockReturnValue({
        data: [
          makeNotification({
            id: "old-sunday",
            title: "Old Sunday notification",
            body: "Body",
            created_at: "2026-02-22T18:00:00",
          }),
        ],
        isLoading: false,
      });

      renderMessaggi();

      expect(screen.getByText("Precedenti")).toBeInTheDocument();
      expect(screen.queryByText("Oggi")).not.toBeInTheDocument();
      expect(screen.queryByText("Questa settimana")).not.toBeInTheDocument();
    });
  });

  // ── 5. Unread indicator (blue dot) ──

  it("shows unread indicator on unread notifications", () => {
    mockUseNotifications.mockReturnValue({
      data: [
        makeNotification({
          id: "unread-1",
          title: "Unread notification",
          body: "Body",
          read_at: null,
          created_at: "2026-02-26T10:00:00",
        }),
      ],
      isLoading: false,
    });

    renderMessaggi();

    const card = screen.getByTestId("messaggi-card-unread-1");
    const unreadDot = within(card).getByLabelText("Non letta");
    expect(unreadDot).toBeInTheDocument();
  });

  it("does NOT show unread indicator on read notifications", () => {
    mockUseNotifications.mockReturnValue({
      data: [
        makeNotification({
          id: "read-1",
          title: "Read notification",
          body: "Body",
          read_at: "2026-02-25T10:00:00",
          created_at: "2026-02-26T10:00:00",
        }),
      ],
      isLoading: false,
    });

    renderMessaggi();

    const card = screen.getByTestId("messaggi-card-read-1");
    expect(within(card).queryByLabelText("Non letta")).not.toBeInTheDocument();
  });

  // ── 6. Click card -> markRead + toggle expand ──

  it("calls markRead and expands card on click for unread notification", () => {
    mockUseNotifications.mockReturnValue({
      data: [
        makeNotification({
          id: "n1",
          title: "Click me",
          body: "Expanded body content here",
          read_at: null,
          created_at: "2026-02-26T10:00:00",
          action_url: "/dashboard",
          action_label: "Vai alla dashboard",
        }),
      ],
      isLoading: false,
    });

    renderMessaggi();

    const card = screen.getByTestId("messaggi-card-n1");
    fireEvent.click(card);

    // markRead should have been called with the notification id
    expect(mockMutateMarkRead).toHaveBeenCalledWith("n1");

    // Card is now expanded — action button should be visible
    expect(screen.getByTestId("messaggi-action-btn")).toBeInTheDocument();
  });

  it("does NOT call markRead on click for already-read notification", () => {
    mockUseNotifications.mockReturnValue({
      data: [
        makeNotification({
          id: "n2",
          title: "Already read",
          body: "Body text",
          read_at: "2026-02-25T08:00:00",
          created_at: "2026-02-26T10:00:00",
        }),
      ],
      isLoading: false,
    });

    renderMessaggi();

    const card = screen.getByTestId("messaggi-card-n2");
    fireEvent.click(card);

    expect(mockMutateMarkRead).not.toHaveBeenCalled();
  });

  it("collapses card on second click (toggle)", () => {
    mockUseNotifications.mockReturnValue({
      data: [
        makeNotification({
          id: "n3",
          title: "Toggle test",
          body: "Detailed body",
          read_at: "2026-02-25T08:00:00",
          created_at: "2026-02-26T10:00:00",
          action_url: "/some-page",
          action_label: "Go",
        }),
      ],
      isLoading: false,
    });

    renderMessaggi();

    const card = screen.getByTestId("messaggi-card-n3");

    // First click: expand
    fireEvent.click(card);
    expect(screen.getByTestId("messaggi-action-btn")).toBeInTheDocument();

    // Second click: collapse
    fireEvent.click(card);
    expect(screen.queryByTestId("messaggi-action-btn")).not.toBeInTheDocument();
  });

  it("expands only one card at a time", () => {
    mockUseNotifications.mockReturnValue({
      data: [
        makeNotification({
          id: "a",
          title: "Card A",
          body: "Body A",
          created_at: "2026-02-26T10:00:00",
          action_url: "/a",
          action_label: "Action A",
        }),
        makeNotification({
          id: "b",
          title: "Card B",
          body: "Body B",
          created_at: "2026-02-26T09:00:00",
          action_url: "/b",
          action_label: "Action B",
        }),
      ],
      isLoading: false,
    });

    renderMessaggi();

    // Expand card A
    fireEvent.click(screen.getByTestId("messaggi-card-a"));
    const actionBtns = screen.getAllByTestId("messaggi-action-btn");
    expect(actionBtns).toHaveLength(1);
    expect(actionBtns[0]).toHaveTextContent("Action A");

    // Click card B — should collapse A and expand B
    fireEvent.click(screen.getByTestId("messaggi-card-b"));
    const actionBtns2 = screen.getAllByTestId("messaggi-action-btn");
    expect(actionBtns2).toHaveLength(1);
    expect(actionBtns2[0]).toHaveTextContent("Action B");
  });

  // ── 7. "Segna tutte come lette" button when unreadCount > 0 ──

  it("shows 'Segna tutte come lette' button when unreadCount > 0", () => {
    mockUseNotificationCount.mockReturnValue({ data: 3 });

    renderMessaggi();

    const btn = screen.getByTestId("mark-all-read-btn");
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent("Segna tutte come lette");
  });

  it("calls markAllRead.mutate when 'Segna tutte come lette' is clicked", () => {
    mockUseNotificationCount.mockReturnValue({ data: 2 });

    renderMessaggi();

    const btn = screen.getByTestId("mark-all-read-btn");
    fireEvent.click(btn);
    expect(mockMutateMarkAllRead).toHaveBeenCalledTimes(1);
  });

  // ── 8. Hides "Segna tutte come lette" when unreadCount is 0 ──

  it("hides 'Segna tutte come lette' button when unreadCount is 0", () => {
    mockUseNotificationCount.mockReturnValue({ data: 0 });

    renderMessaggi();

    expect(screen.queryByTestId("mark-all-read-btn")).not.toBeInTheDocument();
  });

  // ── 9. Action button with action_label in expanded card ──

  it("shows action button with action_label text in expanded card", () => {
    mockUseNotifications.mockReturnValue({
      data: [
        makeNotification({
          id: "action-1",
          title: "With action",
          body: "Body",
          created_at: "2026-02-26T10:00:00",
          action_url: "/impostazioni",
          action_label: "Apri impostazioni",
        }),
      ],
      isLoading: false,
    });

    renderMessaggi();

    // Expand
    fireEvent.click(screen.getByTestId("messaggi-card-action-1"));

    const actionBtn = screen.getByTestId("messaggi-action-btn");
    expect(actionBtn).toHaveTextContent("Apri impostazioni");
  });

  it("shows fallback 'Vai' text when action_label is null", () => {
    mockUseNotifications.mockReturnValue({
      data: [
        makeNotification({
          id: "action-2",
          title: "No label",
          body: "Body",
          created_at: "2026-02-26T10:00:00",
          action_url: "/dashboard",
          action_label: null,
        }),
      ],
      isLoading: false,
    });

    renderMessaggi();

    fireEvent.click(screen.getByTestId("messaggi-card-action-2"));

    const actionBtn = screen.getByTestId("messaggi-action-btn");
    expect(actionBtn).toHaveTextContent("Vai");
  });

  it("does NOT show action button when action_url is null", () => {
    mockUseNotifications.mockReturnValue({
      data: [
        makeNotification({
          id: "no-action",
          title: "No action url",
          body: "Body",
          created_at: "2026-02-26T10:00:00",
          action_url: null,
          action_label: null,
        }),
      ],
      isLoading: false,
    });

    renderMessaggi();

    fireEvent.click(screen.getByTestId("messaggi-card-no-action"));

    expect(screen.queryByTestId("messaggi-action-btn")).not.toBeInTheDocument();
  });

  it("navigates to action_url when action button is clicked", () => {
    mockUseNotifications.mockReturnValue({
      data: [
        makeNotification({
          id: "nav-1",
          title: "Navigate test",
          body: "Body",
          created_at: "2026-02-26T10:00:00",
          action_url: "/impostazioni",
          action_label: "Vai alle impostazioni",
        }),
      ],
      isLoading: false,
    });

    renderMessaggi();

    // Expand card
    fireEvent.click(screen.getByTestId("messaggi-card-nav-1"));

    // Click action button
    const actionBtn = screen.getByTestId("messaggi-action-btn");
    fireEvent.click(actionBtn);

    expect(mockNavigate).toHaveBeenCalledWith("/impostazioni");
  });

  // ── 10. MobileHeader on mobile ──

  it("shows MobileHeader when isMobile is true", () => {
    mockUseIsMobile.mockReturnValue(true);

    renderMessaggi();

    const mobileHeader = screen.getByTestId("mobile-header");
    expect(mobileHeader).toBeInTheDocument();
    expect(mobileHeader).toHaveTextContent("Messaggi");
  });

  it("does NOT show MobileHeader when isMobile is false", () => {
    mockUseIsMobile.mockReturnValue(false);

    renderMessaggi();

    expect(screen.queryByTestId("mobile-header")).not.toBeInTheDocument();
  });

  // ── AppLayout wrapper ──

  it("wraps content in AppLayout", () => {
    renderMessaggi();
    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });

  // ── Category labels ──

  describe("category labels", () => {
    it("shows 'Scadenza' label for scadenze category", () => {
      mockUseNotifications.mockReturnValue({
        data: [
          makeNotification({
            id: "cat-1",
            title: "Scadenza test",
            body: "Body",
            category: "scadenze",
            created_at: "2026-02-26T10:00:00",
          }),
        ],
        isLoading: false,
      });

      renderMessaggi();
      expect(screen.getByText("Scadenza")).toBeInTheDocument();
    });

    it("shows 'Insight' label for insights category", () => {
      mockUseNotifications.mockReturnValue({
        data: [
          makeNotification({
            id: "cat-2",
            title: "Insight test",
            body: "Body",
            category: "insights",
            created_at: "2026-02-26T10:00:00",
          }),
        ],
        isLoading: false,
      });

      renderMessaggi();
      expect(screen.getByText("Insight")).toBeInTheDocument();
    });

    it("shows 'Aggiornamento' label for aggiornamenti category", () => {
      mockUseNotifications.mockReturnValue({
        data: [
          makeNotification({
            id: "cat-3",
            title: "Aggiornamento test",
            body: "Body",
            category: "aggiornamenti",
            created_at: "2026-02-26T10:00:00",
          }),
        ],
        isLoading: false,
      });

      renderMessaggi();
      expect(screen.getByText("Aggiornamento")).toBeInTheDocument();
    });

    it("shows 'Admin' label for admin category", () => {
      mockUseNotifications.mockReturnValue({
        data: [
          makeNotification({
            id: "cat-4",
            title: "Admin test",
            body: "Body",
            category: "admin",
            created_at: "2026-02-26T10:00:00",
          }),
        ],
        isLoading: false,
      });

      renderMessaggi();
      expect(screen.getByText("Admin")).toBeInTheDocument();
    });

    it("shows fallback 'Notifica' label for unknown category", () => {
      mockUseNotifications.mockReturnValue({
        data: [
          makeNotification({
            id: "cat-5",
            title: "Unknown cat test",
            body: "Body",
            category: "sconosciuta",
            created_at: "2026-02-26T10:00:00",
          }),
        ],
        isLoading: false,
      });

      renderMessaggi();
      expect(screen.getByText("Notifica")).toBeInTheDocument();
    });
  });

  // ── Keyboard accessibility ──

  it("expands card on Enter keydown", () => {
    mockUseNotifications.mockReturnValue({
      data: [
        makeNotification({
          id: "kb-1",
          title: "Keyboard test",
          body: "Body",
          created_at: "2026-02-26T10:00:00",
          action_url: "/test",
          action_label: "Test action",
        }),
      ],
      isLoading: false,
    });

    renderMessaggi();

    const card = screen.getByTestId("messaggi-card-kb-1");
    fireEvent.keyDown(card, { key: "Enter" });

    expect(screen.getByTestId("messaggi-action-btn")).toBeInTheDocument();
  });

  it("expands card on Space keydown", () => {
    mockUseNotifications.mockReturnValue({
      data: [
        makeNotification({
          id: "kb-2",
          title: "Keyboard space test",
          body: "Body",
          created_at: "2026-02-26T10:00:00",
          action_url: "/test",
          action_label: "Test action",
        }),
      ],
      isLoading: false,
    });

    renderMessaggi();

    const card = screen.getByTestId("messaggi-card-kb-2");
    fireEvent.keyDown(card, { key: " " });

    expect(screen.getByTestId("messaggi-action-btn")).toBeInTheDocument();
  });

  // ── Unread title styling ──

  it("renders unread notification title with font-semibold", () => {
    mockUseNotifications.mockReturnValue({
      data: [
        makeNotification({
          id: "style-1",
          title: "Bold title",
          body: "Body",
          read_at: null,
          created_at: "2026-02-26T10:00:00",
        }),
      ],
      isLoading: false,
    });

    renderMessaggi();

    const title = screen.getByText("Bold title");
    expect(title.className).toContain("font-semibold");
  });

  it("renders read notification title with font-normal", () => {
    mockUseNotifications.mockReturnValue({
      data: [
        makeNotification({
          id: "style-2",
          title: "Normal title",
          body: "Body",
          read_at: "2026-02-25T10:00:00",
          created_at: "2026-02-26T10:00:00",
        }),
      ],
      isLoading: false,
    });

    renderMessaggi();

    const title = screen.getByText("Normal title");
    expect(title.className).toContain("font-normal");
  });

  // ── Collapsed body preview vs expanded full body ──

  it("shows truncated body preview when collapsed, full body when expanded", () => {
    const longBody = "Questa e' una notifica con un corpo molto lungo che viene visualizzato per intero solo quando la card e' espansa.";

    mockUseNotifications.mockReturnValue({
      data: [
        makeNotification({
          id: "body-1",
          title: "Body preview test",
          body: longBody,
          read_at: "2026-02-25T10:00:00",
          created_at: "2026-02-26T10:00:00",
        }),
      ],
      isLoading: false,
    });

    renderMessaggi();

    // When collapsed, body text appears in the preview (line-clamp-2 element)
    const card = screen.getByTestId("messaggi-card-body-1");
    expect(within(card).getByText(longBody)).toBeInTheDocument();

    // Expand
    fireEvent.click(card);

    // After expanding, the body appears in the expanded section
    // The preview (line-clamp) is hidden, and the expanded detail shows
    expect(within(card).getByText(longBody)).toBeInTheDocument();
  });
});
