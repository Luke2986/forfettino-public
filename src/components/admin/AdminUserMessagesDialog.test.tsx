import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AdminUserMessagesDialog } from "./AdminUserMessagesDialog";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// ── Mock useAdminUserMessages ──
const mockMessages = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useAdminUserMessages", () => ({
  useAdminUserMessages: (userId: string | null) => mockMessages(userId),
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

const mockOnOpenChange = vi.fn();

function renderSheet(
  props?: Partial<React.ComponentProps<typeof AdminUserMessagesDialog>>,
) {
  return render(
    <AdminUserMessagesDialog
      open={true}
      onOpenChange={mockOnOpenChange}
      userId="user-123"
      userCode="LA26TEST1"
      userName="Mario R."
      {...props}
    />,
    { wrapper: createWrapper() },
  );
}

const sampleMessages = [
  {
    id: "msg-1",
    title: "Benvenuto!",
    body: "Grazie per esserti registrato al servizio.",
    action_url: null,
    action_label: null,
    delivery_type: "sidebar",
    sent_count: 1,
    created_at: "2026-02-27T10:00:00Z",
    published_at: "2026-02-27T10:00:00Z",
    read_at: "2026-02-27T11:00:00Z",
    dismissed_at: null,
    suppressed: false,
  },
  {
    id: "msg-2",
    title: "Aggiornamento importante",
    body: "Abbiamo aggiornato le funzionalità.\nScopri le novità.",
    action_url: "/novita",
    action_label: "Scopri",
    delivery_type: "popup",
    sent_count: 1,
    created_at: "2026-02-26T15:00:00Z",
    published_at: "2026-02-26T15:00:00Z",
    read_at: null,
    dismissed_at: null,
    suppressed: false,
  },
  {
    id: "msg-3",
    title: "Messaggio soppresso",
    body: "Questo messaggio è stato soppresso dalle preferenze.",
    action_url: null,
    action_label: null,
    delivery_type: "sidebar",
    sent_count: 0,
    created_at: "2026-02-25T09:00:00Z",
    published_at: "2026-02-25T09:00:00Z",
    read_at: "2026-02-25T09:00:00Z",
    dismissed_at: null,
    suppressed: true,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockMessages.mockReturnValue({ data: sampleMessages, isLoading: false });
});

describe("AdminUserMessagesDialog", () => {
  it("renders sheet with user info header", () => {
    renderSheet();

    expect(screen.getByText("Messaggi inviati")).toBeInTheDocument();
    expect(screen.getByText("LA26TEST1")).toBeInTheDocument();
    expect(screen.getByText(/Mario R\./)).toBeInTheDocument();
  });

  it("renders message rows", () => {
    renderSheet();

    expect(screen.getByText("Benvenuto!")).toBeInTheDocument();
    expect(screen.getByText("Aggiornamento importante")).toBeInTheDocument();
    expect(screen.getByText("Messaggio soppresso")).toBeInTheDocument();
  });

  it("shows correct status badges", () => {
    renderSheet();

    // msg-1: read
    expect(screen.getByTestId("message-row-msg-1").querySelector("[data-testid='status-read']")).toBeInTheDocument();

    // msg-2: unread
    expect(screen.getByTestId("message-row-msg-2").querySelector("[data-testid='status-unread']")).toBeInTheDocument();

    // msg-3: suppressed
    expect(screen.getByTestId("message-row-msg-3").querySelector("[data-testid='status-suppressed']")).toBeInTheDocument();
  });

  it("shows correct delivery type badges", () => {
    renderSheet();

    // msg-1: sidebar (campanella)
    expect(screen.getByTestId("message-row-msg-1").querySelector("[data-testid='delivery-sidebar']")).toBeInTheDocument();

    // msg-2: popup
    expect(screen.getByTestId("message-row-msg-2").querySelector("[data-testid='delivery-popup']")).toBeInTheDocument();
  });

  it("expands row on click to show full body", () => {
    renderSheet();

    // Body should not be visible initially
    expect(screen.queryByTestId("message-expanded-msg-1")).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(screen.getByTestId("message-toggle-msg-1"));

    // Body visible now
    expect(screen.getByTestId("message-expanded-msg-1")).toBeInTheDocument();
    expect(screen.getByText("Grazie per esserti registrato al servizio.")).toBeInTheDocument();
  });

  it("shows action link in expanded content when action_url present", () => {
    renderSheet();

    // Expand msg-2 which has action_url
    fireEvent.click(screen.getByTestId("message-toggle-msg-2"));

    expect(screen.getByTestId("message-expanded-msg-2")).toBeInTheDocument();
    expect(screen.getByText("Scopri")).toBeInTheDocument();
  });

  it("collapses expanded row on second click", () => {
    renderSheet();

    fireEvent.click(screen.getByTestId("message-toggle-msg-1"));
    expect(screen.getByTestId("message-expanded-msg-1")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("message-toggle-msg-1"));
    expect(screen.queryByTestId("message-expanded-msg-1")).not.toBeInTheDocument();
  });

  it("shows empty state when no messages", () => {
    mockMessages.mockReturnValue({ data: [], isLoading: false });
    renderSheet();

    expect(screen.getByTestId("messages-empty")).toBeInTheDocument();
    expect(screen.getByText("Nessun messaggio inviato a questo utente")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    mockMessages.mockReturnValue({ data: [], isLoading: true });
    renderSheet();

    expect(screen.getByTestId("messages-loading")).toBeInTheDocument();
  });

  it("does not render content when closed", () => {
    renderSheet({ open: false });

    expect(screen.queryByText("Messaggi inviati")).not.toBeInTheDocument();
  });
});
