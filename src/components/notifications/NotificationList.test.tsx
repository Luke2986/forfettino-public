import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const mockNavigate = vi.fn();

// Mock dependencies
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@/hooks/useNotifications", () => ({
  useNotifications: vi.fn(),
}));

vi.mock("@/hooks/useMarkNotificationRead", () => ({
  useMarkNotificationRead: vi.fn(),
}));

vi.mock("@/hooks/useMarkAllNotificationsRead", () => ({
  useMarkAllNotificationsRead: vi.fn(),
}));

import { useNotifications } from "@/hooks/useNotifications";
import { useMarkNotificationRead } from "@/hooks/useMarkNotificationRead";
import { useMarkAllNotificationsRead } from "@/hooks/useMarkAllNotificationsRead";
import { NotificationList } from "./NotificationList";

const mockUseNotifications = vi.mocked(useNotifications);
const mockUseMarkNotificationRead = vi.mocked(useMarkNotificationRead);
const mockUseMarkAllNotificationsRead = vi.mocked(useMarkAllNotificationsRead);

function buildNotification(overrides: Record<string, unknown> = {}) {
  return {
    id: "n1",
    user_id: "user-1",
    type: "deadline_reminder_7d",
    category: "scadenze",
    title: "Scadenza tra 7 giorni",
    body: "Rata INPS Q1 di €1.234",
    read_at: null,
    action_url: "/scadenziario",
    action_label: "Vai allo Scadenziario",
    metadata: null,
    email_sent_at: null,
    sms_sent_at: null,
    created_at: new Date().toISOString(), // Oggi
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("NotificationList", () => {
  const mockMarkReadMutate = vi.fn();
  const mockMarkAllReadMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMarkNotificationRead.mockReturnValue({
      mutate: mockMarkReadMutate,
    } as any);
    mockUseMarkAllNotificationsRead.mockReturnValue({
      mutate: mockMarkAllReadMutate,
    } as any);
  });

  it("mostra empty state quando non ci sono notifiche", () => {
    mockUseNotifications.mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    render(<NotificationList />);

    expect(screen.getByTestId("notification-empty-state")).toBeInTheDocument();
    expect(screen.getByText("Nessuna notifica")).toBeInTheDocument();
    expect(screen.getByText("Le notifiche sulle scadenze appariranno qui")).toBeInTheDocument();
  });

  it("mostra stato di caricamento", () => {
    mockUseNotifications.mockReturnValue({
      data: [],
      isLoading: true,
    } as any);

    render(<NotificationList />);

    expect(screen.getByText("Caricamento...")).toBeInTheDocument();
  });

  it("mostra le notifiche raggruppate sotto 'Oggi'", () => {
    const todayNotification = buildNotification({ id: "n1", title: "Scadenza oggi" });

    mockUseNotifications.mockReturnValue({
      data: [todayNotification],
      isLoading: false,
    } as any);

    render(<NotificationList />);

    expect(screen.getByText("Oggi")).toBeInTheDocument();
    expect(screen.getByText("Scadenza oggi")).toBeInTheDocument();
  });

  it("mostra 'Segna tutte come lette' quando ci sono notifiche non lette", () => {
    const unread = buildNotification({ id: "n1", read_at: null });

    mockUseNotifications.mockReturnValue({
      data: [unread],
      isLoading: false,
    } as any);

    render(<NotificationList />);

    const markAllBtn = screen.getByTestId("mark-all-read-btn");
    expect(markAllBtn).toBeInTheDocument();
    expect(markAllBtn).toHaveTextContent("Segna tutte come lette");
  });

  it("nasconde 'Segna tutte come lette' quando tutte sono lette", () => {
    const read = buildNotification({ id: "n1", read_at: "2026-02-17T12:00:00Z" });

    mockUseNotifications.mockReturnValue({
      data: [read],
      isLoading: false,
    } as any);

    render(<NotificationList />);

    expect(screen.queryByTestId("mark-all-read-btn")).not.toBeInTheDocument();
  });

  it("chiama markAllRead.mutate al click su 'Segna tutte come lette'", () => {
    const unread = buildNotification({ id: "n1", read_at: null });

    mockUseNotifications.mockReturnValue({
      data: [unread],
      isLoading: false,
    } as any);

    render(<NotificationList />);

    fireEvent.click(screen.getByTestId("mark-all-read-btn"));

    expect(mockMarkAllReadMutate).toHaveBeenCalledTimes(1);
  });

  it("chiama markRead.mutate al click su una notifica non letta", () => {
    const unread = buildNotification({ id: "n1", read_at: null, title: "Click me" });

    mockUseNotifications.mockReturnValue({
      data: [unread],
      isLoading: false,
    } as any);

    render(<NotificationList />);

    fireEvent.click(screen.getByText("Click me"));

    expect(mockMarkReadMutate).toHaveBeenCalledWith("n1");
  });

  it("NON chiama markRead al click su una notifica già letta", () => {
    const read = buildNotification({
      id: "n2",
      read_at: "2026-02-17T12:00:00Z",
      title: "Already read",
    });

    mockUseNotifications.mockReturnValue({
      data: [read],
      isLoading: false,
    } as any);

    render(<NotificationList />);

    fireEvent.click(screen.getByText("Already read"));

    expect(mockMarkReadMutate).not.toHaveBeenCalled();
  });

  it("notifica non letta ha sfondo evidenziato (bg-primary/5)", () => {
    const unread = buildNotification({ id: "n1", read_at: null });

    mockUseNotifications.mockReturnValue({
      data: [unread],
      isLoading: false,
    } as any);

    render(<NotificationList />);

    const item = screen.getByTestId("notification-n1");
    expect(item.className).toContain("bg-primary/5");
  });

  it("notifica letta NON ha sfondo evidenziato", () => {
    const read = buildNotification({ id: "n2", read_at: "2026-02-17T12:00:00Z" });

    mockUseNotifications.mockReturnValue({
      data: [read],
      isLoading: false,
    } as any);

    render(<NotificationList />);

    const item = screen.getByTestId("notification-n2");
    expect(item.className).not.toContain("bg-primary/5");
  });

  it("la lista ha role='list' e aria-label", () => {
    const notification = buildNotification({ id: "n1" });

    mockUseNotifications.mockReturnValue({
      data: [notification],
      isLoading: false,
    } as any);

    render(<NotificationList />);

    const list = screen.getByRole("list", { name: "Centro notifiche" });
    expect(list).toBeInTheDocument();
  });

  it("raggruppa correttamente notifiche vecchie sotto 'Precedenti'", () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 14); // 2 settimane fa

    const oldNotification = buildNotification({
      id: "old1",
      title: "Notifica vecchia",
      created_at: oldDate.toISOString(),
    });

    mockUseNotifications.mockReturnValue({
      data: [oldNotification],
      isLoading: false,
    } as any);

    render(<NotificationList />);

    expect(screen.getByText("Precedenti")).toBeInTheDocument();
    expect(screen.getByText("Notifica vecchia")).toBeInTheDocument();
  });

  // --- Keyboard accessibility ---

  it("attiva notifica con tasto Enter", () => {
    const unread = buildNotification({ id: "n1", read_at: null, title: "Enter me" });

    mockUseNotifications.mockReturnValue({
      data: [unread],
      isLoading: false,
    } as any);

    render(<NotificationList />);

    const item = screen.getByTestId("notification-n1");
    fireEvent.keyDown(item, { key: "Enter" });

    expect(mockMarkReadMutate).toHaveBeenCalledWith("n1");
  });

  it("attiva notifica con tasto Space", () => {
    const unread = buildNotification({ id: "n2", read_at: null, title: "Space me" });

    mockUseNotifications.mockReturnValue({
      data: [unread],
      isLoading: false,
    } as any);

    render(<NotificationList />);

    const item = screen.getByTestId("notification-n2");
    fireEvent.keyDown(item, { key: " " });

    expect(mockMarkReadMutate).toHaveBeenCalledWith("n2");
  });

  it("NON attiva notifica con tasto Tab (solo Enter e Space)", () => {
    const unread = buildNotification({ id: "n1", read_at: null, title: "Tab me" });

    mockUseNotifications.mockReturnValue({
      data: [unread],
      isLoading: false,
    } as any);

    render(<NotificationList />);

    const item = screen.getByTestId("notification-n1");
    fireEvent.keyDown(item, { key: "Tab" });

    expect(mockMarkReadMutate).not.toHaveBeenCalled();
  });

  it("notifica ha tabIndex=0 per focus da tastiera", () => {
    const notification = buildNotification({ id: "n1" });

    mockUseNotifications.mockReturnValue({
      data: [notification],
      isLoading: false,
    } as any);

    render(<NotificationList />);

    const item = screen.getByTestId("notification-n1");
    expect(item).toHaveAttribute("tabindex", "0");
  });

  // --- Dialog detail flow: click lista → apre dialog → click action → naviga ---

  it("apre il dialog dettaglio al click su una notifica", () => {
    const notification = buildNotification({
      id: "n1",
      title: "Vai allo scadenziario",
      body: "Contenuto completo della notifica",
    });

    mockUseNotifications.mockReturnValue({
      data: [notification],
      isLoading: false,
    } as any);

    render(<NotificationList />);

    fireEvent.click(screen.getByText("Vai allo scadenziario"));

    // Il dialog mostra il contenuto completo
    const dialog = screen.getByTestId("notification-detail-n1");
    expect(dialog).toBeInTheDocument();
    // Il body compare sia nella lista (troncato) che nel dialog (intero)
    expect(screen.getAllByText("Contenuto completo della notifica").length).toBeGreaterThanOrEqual(1);
  });

  it("naviga alla action_url dal bottone nel dialog dettaglio", () => {
    const withUrl = buildNotification({
      id: "n1",
      read_at: null,
      title: "Vai allo scadenziario",
      action_url: "/scadenziario",
      action_label: "Vai allo Scadenziario",
    });

    mockUseNotifications.mockReturnValue({
      data: [withUrl],
      isLoading: false,
    } as any);

    render(<NotificationList />);

    // Step 1: click nella lista → apre dialog
    fireEvent.click(screen.getByText("Vai allo scadenziario"));

    // Step 2: click sul bottone action nel dialog → naviga
    fireEvent.click(screen.getByTestId("notification-detail-action"));

    expect(mockNavigate).toHaveBeenCalledWith("/scadenziario");
  });

  it("chiama onClose dopo navigazione dal dialog dettaglio", () => {
    const onClose = vi.fn();
    const withUrl = buildNotification({
      id: "n1",
      read_at: null,
      title: "Con close",
      action_url: "/scadenziario",
    });

    mockUseNotifications.mockReturnValue({
      data: [withUrl],
      isLoading: false,
    } as any);

    render(<NotificationList onClose={onClose} />);

    // Step 1: click nella lista → apre dialog
    fireEvent.click(screen.getByText("Con close"));

    // Step 2: click sul bottone action nel dialog → naviga + chiude
    fireEvent.click(screen.getByTestId("notification-detail-action"));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/scadenziario");
  });
});
