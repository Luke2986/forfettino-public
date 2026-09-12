/**
 * Test per AdminDeadlineEmailTrigger
 * Story 84.4 — One-shot: Invio Manuale Prossima Scadenza
 *
 * Copertura (Testing Standards §84-4):
 * - Render form (soglie, userIds, data, bottoni)
 * - "Invia reale" bloccato finché non è stato eseguito un dry-run con risultato (AC#2)
 * - Dry-run renderizza count/eligible/skipped/preview/sample dalla response mock (AC#2)
 * - Guardrail anomalia (recipients oltre soglia) → warning + conferma rinforzata (AC#7)
 * - Conferma chiama la EF con dryRun:false e i thresholds/userIds correnti (AC#2)
 * - sent:0 su re-run identico = stato neutro (info), non errore (AC#6)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// Mock supabase
const mockFunctionsInvoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockFunctionsInvoke(...args),
    },
  },
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import { AdminDeadlineEmailTrigger } from "../AdminDeadlineEmailTrigger";

const DRY_RUN_OK = {
  dryRun: true as const,
  today: "2026-06-27",
  thresholds: [24],
  candidates: 2,
  eligible: 2,
  skipped_prefs: 0,
  recipients: 2,
  recipientsPreview: [
    { to: "a***@test.it", bucket: "saldo_acconto", threshold: 24, amountEuro: 1200 },
    { to: "b***@test.it", bucket: "saldo_acconto", threshold: 24, amountEuro: 800 },
  ],
  sample: {
    to: "a***@test.it",
    subject: "La tua scadenza fiscale tra 24 giorni",
    htmlLength: 4200,
    textPreview: "Ciao, ti ricordiamo la scadenza del saldo+acconto...",
  },
};

const REAL_OK = {
  dryRun: false as const,
  today: "2026-06-27",
  thresholds: [24],
  batchId: "batch-abc-123",
  candidates: 2,
  eligible: 2,
  skipped_prefs: 0,
  sent: 2,
  failed: 0,
};

/** Mock che instrada la response in base a body.dryRun. */
function routeInvoke(dryResp: unknown, realResp: unknown) {
  mockFunctionsInvoke.mockImplementation((_name: string, opts: any) => {
    if (opts?.body?.dryRun) return Promise.resolve({ data: dryResp, error: null });
    return Promise.resolve({ data: realResp, error: null });
  });
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

async function fillAndDryRun(thresholds = "24") {
  fireEvent.change(screen.getByTestId("deadline-thresholds"), {
    target: { value: thresholds },
  });
  fireEvent.click(screen.getByTestId("deadline-dryrun-btn"));
  await waitFor(() => {
    expect(screen.getByTestId("deadline-preview")).toBeInTheDocument();
  });
}

describe("AdminDeadlineEmailTrigger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeInvoke(DRY_RUN_OK, REAL_OK);
  });

  it("renders form with thresholds, userIds, today inputs and both buttons", () => {
    render(<AdminDeadlineEmailTrigger />, { wrapper: createWrapper() });
    expect(
      screen.getByText("Promemoria Scadenza — Invio Manuale"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("deadline-thresholds")).toBeInTheDocument();
    expect(screen.getByTestId("deadline-userids")).toBeInTheDocument();
    expect(screen.getByTestId("deadline-today")).toBeInTheDocument();
    expect(screen.getByTestId("deadline-dryrun-btn")).toBeInTheDocument();
    expect(screen.getByTestId("deadline-send-btn")).toBeInTheDocument();
  });

  it("dry-run button disabled until valid thresholds entered", () => {
    render(<AdminDeadlineEmailTrigger />, { wrapper: createWrapper() });
    expect(screen.getByTestId("deadline-dryrun-btn")).toBeDisabled();
    fireEvent.change(screen.getByTestId("deadline-thresholds"), {
      target: { value: "24" },
    });
    expect(screen.getByTestId("deadline-dryrun-btn")).not.toBeDisabled();
  });

  it("real send is blocked until a dry-run has returned a result (AC#2)", async () => {
    render(<AdminDeadlineEmailTrigger />, { wrapper: createWrapper() });

    // Thresholds set but no dry-run yet → send disabled
    fireEvent.change(screen.getByTestId("deadline-thresholds"), {
      target: { value: "24" },
    });
    expect(screen.getByTestId("deadline-send-btn")).toBeDisabled();

    // After dry-run with recipients > 0 → send enabled
    await fillAndDryRun();
    expect(screen.getByTestId("deadline-send-btn")).not.toBeDisabled();
  });

  it("changing thresholds after a dry-run re-blocks real send (forces fresh dry-run)", async () => {
    render(<AdminDeadlineEmailTrigger />, { wrapper: createWrapper() });
    await fillAndDryRun();
    expect(screen.getByTestId("deadline-send-btn")).not.toBeDisabled();

    fireEvent.change(screen.getByTestId("deadline-thresholds"), {
      target: { value: "7" },
    });
    expect(screen.queryByTestId("deadline-preview")).not.toBeInTheDocument();
    expect(screen.getByTestId("deadline-send-btn")).toBeDisabled();
  });

  it("dry-run renders counts, masked preview and sample from mock", async () => {
    render(<AdminDeadlineEmailTrigger />, { wrapper: createWrapper() });
    await fillAndDryRun();

    expect(screen.getByTestId("deadline-recipients-count")).toHaveTextContent("2");
    expect(screen.getByText(/a\*\*\*@test\.it/)).toBeInTheDocument();
    expect(
      screen.getByText(/La tua scadenza fiscale tra 24 giorni/),
    ).toBeInTheDocument();
    // No anomaly for small recipient count
    expect(screen.queryByTestId("deadline-anomaly-warning")).not.toBeInTheDocument();
  });

  it("dry-run with candidates:0 shows neutral empty message", async () => {
    routeInvoke(
      {
        dryRun: true,
        today: "2026-06-27",
        thresholds: [99],
        candidates: 0,
        sent: 0,
        message: "Nessuna rata non pagata in soglia",
      },
      REAL_OK,
    );
    render(<AdminDeadlineEmailTrigger />, { wrapper: createWrapper() });
    fireEvent.change(screen.getByTestId("deadline-thresholds"), {
      target: { value: "99" },
    });
    fireEvent.click(screen.getByTestId("deadline-dryrun-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("deadline-preview-empty")).toHaveTextContent(
        "Nessuna rata non pagata in soglia",
      );
    });
    // recipients 0 → real send stays disabled
    expect(screen.getByTestId("deadline-send-btn")).toBeDisabled();
  });

  it("anomaly guardrail: recipients over threshold shows warning + requires reinforced confirm (AC#7)", async () => {
    routeInvoke(
      {
        ...DRY_RUN_OK,
        candidates: 100,
        eligible: 100,
        recipients: 100,
        recipientsPreview: [],
        sample: null,
      },
      REAL_OK,
    );
    render(<AdminDeadlineEmailTrigger />, { wrapper: createWrapper() });
    await fillAndDryRun();

    // Warning visible in preview
    expect(screen.getByTestId("deadline-anomaly-warning")).toBeInTheDocument();

    // Open confirm dialog
    fireEvent.click(screen.getByTestId("deadline-send-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("deadline-confirm-send")).toBeInTheDocument();
    });

    // Confirm action disabled until anomaly acknowledged
    expect(screen.getByTestId("deadline-confirm-send")).toBeDisabled();
    fireEvent.click(screen.getByTestId("deadline-anomaly-ack"));
    expect(screen.getByTestId("deadline-confirm-send")).not.toBeDisabled();
  });

  it("confirm calls EF with dryRun:false and current thresholds/userIds (AC#2)", async () => {
    render(<AdminDeadlineEmailTrigger />, { wrapper: createWrapper() });

    fireEvent.change(screen.getByTestId("deadline-userids"), {
      target: { value: "uuid-test-1" },
    });
    await fillAndDryRun("24");

    fireEvent.click(screen.getByTestId("deadline-send-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("deadline-confirm-send")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("deadline-confirm-send"));

    await waitFor(() => {
      expect(mockFunctionsInvoke).toHaveBeenCalledWith(
        "send-deadline-reminder-email",
        {
          body: {
            dryRun: false,
            thresholds: [24],
            userIds: ["uuid-test-1"],
            ignoreUserThresholds: true,
          },
        },
      );
    });

    // Esito invio mostra batchId
    await waitFor(() => {
      expect(screen.getByTestId("deadline-batch-id")).toHaveTextContent(
        "batch-abc-123",
      );
    });
  });

  it("forwards todayISO in the request body when provided", async () => {
    render(<AdminDeadlineEmailTrigger />, { wrapper: createWrapper() });

    fireEvent.change(screen.getByTestId("deadline-today"), {
      target: { value: "2026-06-30" },
    });
    await fillAndDryRun("24");

    await waitFor(() => {
      expect(mockFunctionsInvoke).toHaveBeenCalledWith(
        "send-deadline-reminder-email",
        { body: { dryRun: true, thresholds: [24], todayISO: "2026-06-30", ignoreUserThresholds: true } },
      );
    });
  });

  it("dry-run error shows toast.error and keeps real send blocked", async () => {
    const { toast } = await import("sonner");
    mockFunctionsInvoke.mockResolvedValue({
      data: null,
      error: new Error("boom"),
    });
    render(<AdminDeadlineEmailTrigger />, { wrapper: createWrapper() });

    fireEvent.change(screen.getByTestId("deadline-thresholds"), {
      target: { value: "24" },
    });
    fireEvent.click(screen.getByTestId("deadline-dryrun-btn"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
    // No preview rendered, real send stays disabled
    expect(screen.queryByTestId("deadline-preview")).not.toBeInTheDocument();
    expect(screen.getByTestId("deadline-send-btn")).toBeDisabled();
  });

  it("successful real send clears the stale dry-run and re-disables send (M2)", async () => {
    render(<AdminDeadlineEmailTrigger />, { wrapper: createWrapper() });
    await fillAndDryRun("24");

    fireEvent.click(screen.getByTestId("deadline-send-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("deadline-confirm-send")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("deadline-confirm-send"));

    // Esito invio shown
    await waitFor(() => {
      expect(screen.getByTestId("deadline-send-result")).toBeInTheDocument();
    });
    // Stale dry-run preview cleared → no misleading re-send
    expect(screen.queryByTestId("deadline-preview")).not.toBeInTheDocument();
    expect(screen.getByTestId("deadline-send-btn")).toBeDisabled();
  });

  it("surfaces non-integer threshold tokens as dropped (L3)", () => {
    render(<AdminDeadlineEmailTrigger />, { wrapper: createWrapper() });
    fireEvent.change(screen.getByTestId("deadline-thresholds"), {
      target: { value: "24, abc, 7" },
    });
    expect(screen.getByTestId("deadline-thresholds-dropped")).toHaveTextContent(
      "abc",
    );
    // Valid tokens still enable the dry-run
    expect(screen.getByTestId("deadline-dryrun-btn")).not.toBeDisabled();
  });

  it("sent:0 on identical re-run is shown as neutral info, not error (AC#6)", async () => {
    const { toast } = await import("sonner");
    routeInvoke(DRY_RUN_OK, {
      ...REAL_OK,
      batchId: undefined,
      sent: 0,
      failed: 0,
      message: "Nessuna rata non pagata in soglia",
    });
    render(<AdminDeadlineEmailTrigger />, { wrapper: createWrapper() });
    await fillAndDryRun();

    fireEvent.click(screen.getByTestId("deadline-send-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("deadline-confirm-send")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("deadline-confirm-send"));

    await waitFor(() => {
      expect(toast.info).toHaveBeenCalled();
    });
    expect(toast.error).not.toHaveBeenCalled();
  });
});
