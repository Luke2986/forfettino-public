/**
 * Test per AdminEmailLog e AdminConsentedEmailList
 * Story 44.3 — Email Log e Tracking Delivery
 *
 * Copertura:
 * - AdminEmailLog: rendering tabella, stato vuoto, espansione righe, paginazione
 * - AdminConsentedEmailList: rendering collapsible, espansione lista email
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// Mock hooks
const mockUseEmailLog = vi.fn();
const mockUseConsentedEmails = vi.fn();

vi.mock("@/hooks/useEmailLog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useEmailLog")>();
  return {
    ...actual,
    useEmailLog: () => mockUseEmailLog(),
  };
});

vi.mock("@/hooks/useConsentedEmails", () => ({
  useConsentedEmails: () => mockUseConsentedEmails(),
}));

import { AdminEmailLog } from "../AdminEmailLog";
import { AdminConsentedEmailList } from "../AdminConsentedEmailList";
import { groupByBatch } from "@/hooks/useEmailLog";
import type { EmailLogRow } from "@/hooks/useEmailLog";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("AdminEmailLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mostra stato vuoto quando non ci sono email inviate", () => {
    mockUseEmailLog.mockReturnValue({
      batches: [],
      isLoading: false,
      error: null,
    });

    render(<AdminEmailLog />, { wrapper });
    expect(screen.getByTestId("email-log-empty")).toBeInTheDocument();
    expect(screen.getByText("Nessuna email inviata")).toBeInTheDocument();
  });

  it("mostra loading state", () => {
    mockUseEmailLog.mockReturnValue({
      batches: [],
      isLoading: true,
      error: null,
    });

    render(<AdminEmailLog />, { wrapper });
    // Loader2 spinner visible (no empty message)
    expect(screen.queryByTestId("email-log-empty")).not.toBeInTheDocument();
    expect(screen.queryByTestId("email-log")).not.toBeInTheDocument();
  });

  it("renderizza tabella con batch e colonne corrette", () => {
    mockUseEmailLog.mockReturnValue({
      batches: [
        {
          batchId: "batch-1",
          subject: "Newsletter Marzo",
          sentAt: "2026-03-17T10:00:00Z",
          sentBy: "admin-1",
          recipients: [
            {
              id: "r1",
              recipient_email: "user1@test.com",
              subject: "Newsletter Marzo",
              resend_message_id: "resend-abc123",
              status: "sent",
              error_message: null,
              sent_at: "2026-03-17T10:00:00Z",
              sent_by: "admin-1",
              batch_id: "batch-1",
            },
            {
              id: "r2",
              recipient_email: "user2@test.com",
              subject: "Newsletter Marzo",
              resend_message_id: null,
              status: "failed",
              error_message: "Invalid email",
              sent_at: "2026-03-17T10:00:00Z",
              sent_by: "admin-1",
              batch_id: "batch-1",
            },
          ],
          summary: { total: 2, sent: 1, failed: 1 },
        },
      ],
      isLoading: false,
      error: null,
    });

    render(<AdminEmailLog />, { wrapper });
    expect(screen.getByTestId("email-log")).toBeInTheDocument();
    expect(screen.getByText("Newsletter Marzo")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument(); // total recipients
    expect(screen.getByText("1 inviate")).toBeInTheDocument();
    expect(screen.getByText("1 fallite")).toBeInTheDocument();
  });

  it("espande riga batch e mostra dettaglio destinatari", () => {
    mockUseEmailLog.mockReturnValue({
      batches: [
        {
          batchId: "batch-1",
          subject: "Test Email",
          sentAt: "2026-03-17T10:00:00Z",
          sentBy: "admin-1",
          recipients: [
            {
              id: "r1",
              recipient_email: "user1@test.com",
              subject: "Test Email",
              resend_message_id: "resend-abc123456",
              status: "sent",
              error_message: null,
              sent_at: "2026-03-17T10:00:00Z",
              sent_by: "admin-1",
              batch_id: "batch-1",
            },
          ],
          summary: { total: 1, sent: 1, failed: 0 },
        },
      ],
      isLoading: false,
      error: null,
    });

    render(<AdminEmailLog />, { wrapper });

    // Detail not visible before click
    expect(screen.queryByTestId("batch-detail-batch-1")).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(screen.getByTestId("batch-row-batch-1"));

    // Detail visible
    expect(screen.getByTestId("batch-detail-batch-1")).toBeInTheDocument();
    expect(screen.getByText("user1@test.com")).toBeInTheDocument();
    expect(screen.getByText("resend-abc12")).toBeInTheDocument(); // truncated to 12 chars

    // Click again to collapse
    fireEvent.click(screen.getByTestId("batch-row-batch-1"));
    expect(screen.queryByTestId("batch-detail-batch-1")).not.toBeInTheDocument();
  });

  it("paginazione mostra bottoni quando ci sono più di 10 batch", () => {
    const batches = Array.from({ length: 15 }, (_, i) => ({
      batchId: `batch-${i}`,
      subject: `Email ${i}`,
      sentAt: `2026-03-${String(17 - i).padStart(2, "0")}T10:00:00Z`,
      sentBy: "admin-1",
      recipients: [
        {
          id: `r-${i}`,
          recipient_email: `user${i}@test.com`,
          subject: `Email ${i}`,
          resend_message_id: `id-${i}`,
          status: "sent" as const,
          error_message: null,
          sent_at: `2026-03-${String(17 - i).padStart(2, "0")}T10:00:00Z`,
          sent_by: "admin-1",
          batch_id: `batch-${i}`,
        },
      ],
      summary: { total: 1, sent: 1, failed: 0 },
    }));

    mockUseEmailLog.mockReturnValue({
      batches,
      isLoading: false,
      error: null,
    });

    render(<AdminEmailLog />, { wrapper });

    expect(screen.getByText("Pagina 1 di 2 (15 invii totali)")).toBeInTheDocument();

    const prevBtn = screen.getByText("Precedente");
    const nextBtn = screen.getByText("Successiva");

    // Prev disabled on first page
    expect(prevBtn).toBeDisabled();
    expect(nextBtn).not.toBeDisabled();

    // Go to page 2
    fireEvent.click(nextBtn);
    expect(screen.getByText("Pagina 2 di 2 (15 invii totali)")).toBeInTheDocument();
    expect(prevBtn).not.toBeDisabled();
    expect(nextBtn).toBeDisabled();
  });
});

describe("groupByBatch", () => {
  it("raggruppa righe senza batch_id per sent_at + subject (fallback key)", () => {
    const rows: EmailLogRow[] = [
      {
        id: "r1",
        recipient_email: "a@test.com",
        subject: "Newsletter",
        resend_message_id: "id-1",
        status: "sent",
        error_message: null,
        sent_at: "2026-03-17T10:00:00Z",
        sent_by: "admin-1",
        batch_id: null,
      },
      {
        id: "r2",
        recipient_email: "b@test.com",
        subject: "Newsletter",
        resend_message_id: "id-2",
        status: "sent",
        error_message: null,
        sent_at: "2026-03-17T10:00:00Z",
        sent_by: "admin-1",
        batch_id: null,
      },
      {
        id: "r3",
        recipient_email: "c@test.com",
        subject: "Altro",
        resend_message_id: null,
        status: "failed",
        error_message: "bounce",
        sent_at: "2026-03-16T10:00:00Z",
        sent_by: "admin-1",
        batch_id: null,
      },
    ];

    const batches = groupByBatch(rows);

    // 2 batches: one for Newsletter (2 rows), one for Altro (1 row)
    expect(batches).toHaveLength(2);

    // Sorted by sentAt DESC — Newsletter (17 mar) first
    expect(batches[0].subject).toBe("Newsletter");
    expect(batches[0].recipients).toHaveLength(2);
    expect(batches[0].summary).toEqual({ total: 2, sent: 2, failed: 0 });

    expect(batches[1].subject).toBe("Altro");
    expect(batches[1].recipients).toHaveLength(1);
    expect(batches[1].summary).toEqual({ total: 1, sent: 0, failed: 1 });
  });
});

describe("AdminConsentedEmailList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderizza collapsible con conteggio destinatari", () => {
    mockUseConsentedEmails.mockReturnValue({
      emails: [
        { email: "a@test.com", consent_at: "2026-03-10T12:00:00Z" },
        { email: "b@test.com", consent_at: "2026-03-11T12:00:00Z" },
      ],
      count: 2,
      isLoading: false,
      error: null,
    });

    render(<AdminConsentedEmailList />, { wrapper });
    expect(screen.getByText("Destinatari con consenso (2)")).toBeInTheDocument();

    // Table not visible when collapsed
    expect(screen.queryByText("a@test.com")).not.toBeInTheDocument();
  });

  it("espande e mostra lista email con date", () => {
    mockUseConsentedEmails.mockReturnValue({
      emails: [
        { email: "a@test.com", consent_at: "2026-03-10T12:00:00Z" },
        { email: "b@test.com", consent_at: null },
      ],
      count: 2,
      isLoading: false,
      error: null,
    });

    render(<AdminConsentedEmailList />, { wrapper });

    // Click to expand
    fireEvent.click(screen.getByTestId("consented-email-trigger"));

    expect(screen.getByText("a@test.com")).toBeInTheDocument();
    expect(screen.getByText("b@test.com")).toBeInTheDocument();
    // null consent_at shows "—"
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("mostra stato vuoto quando nessun utente ha consenso", () => {
    mockUseConsentedEmails.mockReturnValue({
      emails: [],
      count: 0,
      isLoading: false,
      error: null,
    });

    render(<AdminConsentedEmailList />, { wrapper });

    // Click to expand
    fireEvent.click(screen.getByTestId("consented-email-trigger"));

    expect(screen.getByTestId("consented-empty")).toBeInTheDocument();
    expect(
      screen.getByText("Nessun utente ha dato il consenso email"),
    ).toBeInTheDocument();
  });

  it("mostra loading state", () => {
    mockUseConsentedEmails.mockReturnValue({
      emails: [],
      count: 0,
      isLoading: true,
      error: null,
    });

    render(<AdminConsentedEmailList />, { wrapper });
    expect(screen.getByText("Caricamento destinatari...")).toBeInTheDocument();
  });
});
