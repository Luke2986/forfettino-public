import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock dependencies
vi.mock("@/hooks/useNotificationCount", () => ({
  useNotificationCount: vi.fn(),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: vi.fn(),
}));

// Mock notification list to avoid deep dependency chain
vi.mock("./NotificationList", () => ({
  NotificationList: () => <div data-testid="notification-list">Mock List</div>,
}));

import { useNotificationCount } from "@/hooks/useNotificationCount";
import { useIsMobile } from "@/hooks/use-mobile";
import { NotificationBell } from "./NotificationBell";

const mockUseNotificationCount = vi.mocked(useNotificationCount);
const mockUseIsMobile = vi.mocked(useIsMobile);

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseIsMobile.mockReturnValue(false); // Desktop di default
  });

  it("mostra la campanella senza badge quando count è 0", () => {
    mockUseNotificationCount.mockReturnValue({ data: 0 } as any);

    render(<NotificationBell />);

    const bell = screen.getByTestId("notification-bell");
    expect(bell).toBeInTheDocument();
    expect(bell).toHaveAttribute("aria-label", "Notifiche, nessuna non letta");
    expect(screen.queryByTestId("notification-badge")).not.toBeInTheDocument();
  });

  it("mostra il badge con il conteggio corretto", () => {
    mockUseNotificationCount.mockReturnValue({ data: 7 } as any);

    render(<NotificationBell />);

    const badge = screen.getByTestId("notification-badge");
    expect(badge).toHaveTextContent("7");

    const bell = screen.getByTestId("notification-bell");
    expect(bell).toHaveAttribute("aria-label", "Notifiche, 7 non lette");
  });

  it("mostra 99+ quando count supera 99", () => {
    mockUseNotificationCount.mockReturnValue({ data: 150 } as any);

    render(<NotificationBell />);

    const badge = screen.getByTestId("notification-badge");
    expect(badge).toHaveTextContent("99+");
  });

  it("apre il Popover su desktop al click", async () => {
    mockUseNotificationCount.mockReturnValue({ data: 3 } as any);
    mockUseIsMobile.mockReturnValue(false);

    render(<NotificationBell />);

    fireEvent.click(screen.getByTestId("notification-bell"));

    // Il popover dovrebbe mostrare il NotificationList mockato
    expect(await screen.findByTestId("notification-list")).toBeInTheDocument();
  });

  it("apre lo Sheet su mobile al click", async () => {
    mockUseNotificationCount.mockReturnValue({ data: 3 } as any);
    mockUseIsMobile.mockReturnValue(true);

    render(<NotificationBell />);

    fireEvent.click(screen.getByTestId("notification-bell"));

    expect(await screen.findByTestId("notification-list")).toBeInTheDocument();
  });

  it("non mostra badge quando count è undefined (loading)", () => {
    mockUseNotificationCount.mockReturnValue({ data: undefined } as any);

    render(<NotificationBell />);

    expect(screen.queryByTestId("notification-badge")).not.toBeInTheDocument();
  });

  it("badge aria-hidden per screen reader", () => {
    mockUseNotificationCount.mockReturnValue({ data: 5 } as any);

    render(<NotificationBell />);

    const badge = screen.getByTestId("notification-badge");
    expect(badge).toHaveAttribute("aria-hidden", "true");
  });
});
