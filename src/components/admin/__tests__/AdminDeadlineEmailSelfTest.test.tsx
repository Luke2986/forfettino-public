/**
 * Test per AdminDeadlineEmailSelfTest — invio di test "un clic" a sé stessi.
 * Mock dell'hook EF + supabase.auth.getUser.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const runDryRun = vi.fn();
const runReal = vi.fn();

vi.mock("@/hooks/useDeadlineReminderTrigger", () => ({
  useDeadlineReminderTrigger: () => ({
    runDryRun,
    runReal,
    dryRunLoading: false,
    sendLoading: false,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: () =>
        Promise.resolve({ data: { user: { id: "admin-uid-1" } }, error: null }),
    },
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { AdminDeadlineEmailSelfTest } from "../AdminDeadlineEmailSelfTest";

function renderComponent() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AdminDeadlineEmailSelfTest />
    </QueryClientProvider>,
  );
}

describe("AdminDeadlineEmailSelfTest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Anteprima usa l'uid dell'admin loggato come unico destinatario", async () => {
    runDryRun.mockResolvedValue({
      dryRun: true,
      today: "2026-06-27",
      thresholds: [],
      candidates: 1,
      recipients: 1,
      sample: { to: "a***@x.com", subject: "Promemoria scadenza", htmlLength: 10, textPreview: "..." },
    });

    renderComponent();
    fireEvent.click(screen.getByTestId("selftest-preview-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("selftest-recipients")).toHaveTextContent("1");
    });
    // userIds = solo l'uid dell'admin
    expect(runDryRun).toHaveBeenCalledWith(
      expect.objectContaining({ userIds: ["admin-uid-1"] }),
    );
  });

  it("Invia a me è abilitato solo dopo un'anteprima con destinatari", async () => {
    runDryRun.mockResolvedValue({
      dryRun: true,
      today: "2026-06-27",
      thresholds: [],
      candidates: 2,
      recipients: 2,
    });
    runReal.mockResolvedValue({
      dryRun: false,
      today: "2026-06-27",
      thresholds: [],
      candidates: 2,
      sent: 2,
    });

    renderComponent();
    // disabilitato prima dell'anteprima
    expect(screen.getByTestId("selftest-send-btn")).toBeDisabled();

    fireEvent.click(screen.getByTestId("selftest-preview-btn"));
    await waitFor(() => expect(screen.getByTestId("selftest-send-btn")).not.toBeDisabled());

    fireEvent.click(screen.getByTestId("selftest-send-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("selftest-result")).toBeInTheDocument();
    });
    expect(runReal).toHaveBeenCalledWith(
      expect.objectContaining({ userIds: ["admin-uid-1"] }),
    );
  });

  it("mostra a schermo il messaggio d'errore REALE della Edge Function", async () => {
    // Simula FunctionsHttpError: message generico + body vero in .context (Response)
    const httpErr = Object.assign(new Error("Edge Function returned a non-2xx status code"), {
      context: { json: () => Promise.resolve({ error: "CRON_SECRET not configured" }) },
    });
    runDryRun.mockRejectedValue(httpErr);

    renderComponent();
    fireEvent.click(screen.getByTestId("selftest-preview-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("selftest-error")).toHaveTextContent(
        "CRON_SECRET not configured",
      );
    });
    // niente preview, invio resta disabilitato
    expect(screen.getByTestId("selftest-send-btn")).toBeDisabled();
  });

  it("zero rate aperte → nessun destinatario, invio resta disabilitato", async () => {
    runDryRun.mockResolvedValue({
      dryRun: true,
      today: "2026-06-27",
      thresholds: [],
      candidates: 0,
      message: "Nessuna rata non pagata in soglia",
    });

    renderComponent();
    fireEvent.click(screen.getByTestId("selftest-preview-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("selftest-preview")).toHaveTextContent(/Nessuna rata/i);
    });
    expect(screen.getByTestId("selftest-send-btn")).toBeDisabled();
  });
});
