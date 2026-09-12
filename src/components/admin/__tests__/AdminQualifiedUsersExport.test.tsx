/**
 * Test per AdminQualifiedUsersExport
 * Story 41.2 — Admin: Export utenti qualificati con email
 *
 * Copertura:
 * - Render card con titolo e input soglia
 * - Preview conteggio utenti visibile
 * - Cambio soglia input aggiorna il conteggio
 * - Click export scarica CSV
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// Mock supabase
const mockRpc = vi.fn();
const mockUseAuth = vi.fn();
const mockUseUserRole = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: () => mockUseUserRole(),
}));

// Mock csv-export
const mockDownloadCsv = vi.fn();
vi.mock("@/lib/csv-export", () => ({
  csvSafe: (v: string) => `"${v}"`,
  downloadCsv: (...args: unknown[]) => mockDownloadCsv(...args),
}));

import { AdminQualifiedUsersExport } from "../AdminQualifiedUsersExport";

const MOCK_RPC_DATA = [
  {
    user_id: "u1",
    email: "luca@example.com",
    first_name: "Luca",
    user_code: "26AB1234",
    receipt_count: 5,
    inps_type: "gestione_separata",
    created_at: "2026-01-15T10:00:00Z",
    email_consent: true,
  },
  {
    user_id: "u2",
    email: "anna@example.com",
    first_name: "Anna",
    user_code: "26CD5678",
    receipt_count: 3,
    inps_type: "gestione_artigiani",
    created_at: "2026-02-20T08:30:00Z",
    email_consent: true,
  },
];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("AdminQualifiedUsersExport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: "admin-1" }, loading: false });
    mockUseUserRole.mockReturnValue({ data: "admin", isLoading: false });
    mockRpc.mockResolvedValue({ data: MOCK_RPC_DATA, error: null });
  });

  it("renderizza card con titolo e input soglia", async () => {
    render(<AdminQualifiedUsersExport />, { wrapper: createWrapper() });

    expect(screen.getByText("Export Utenti Qualificati")).toBeInTheDocument();
    expect(screen.getByLabelText(/soglia minima incassi/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /esporta csv/i })).toBeInTheDocument();
  });

  it("mostra preview conteggio utenti", async () => {
    render(<AdminQualifiedUsersExport />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("2 utenti")).toBeInTheDocument();
    });
  });

  it("cambio soglia aggiorna la query RPC", async () => {
    mockRpc.mockResolvedValue({ data: MOCK_RPC_DATA, error: null });

    render(<AdminQualifiedUsersExport />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("2 utenti")).toBeInTheDocument();
    });

    // Cambia soglia a 5
    const input = screen.getByLabelText(/soglia minima incassi/i);
    fireEvent.change(input, { target: { value: "5" } });

    // Dopo debounce (300ms), deve richiamare con p_min_receipts: 5
    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith(
        "get_admin_qualified_users",
        { p_min_receipts: 5 },
      );
    }, { timeout: 1000 });
  });

  it("click export scarica CSV con dati corretti", async () => {
    render(<AdminQualifiedUsersExport />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("2 utenti")).toBeInTheDocument();
    });

    const exportBtn = screen.getByRole("button", { name: /esporta csv/i });
    fireEvent.click(exportBtn);

    expect(mockDownloadCsv).toHaveBeenCalledTimes(1);
    const [header, rows, filename] = mockDownloadCsv.mock.calls[0];
    expect(header).toBe("codice,nome,email,incassi,gestione_inps,data_iscrizione,consenso_email");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain("gestione_separata");
    expect(rows[1]).toContain("gestione_artigiani");
    expect(filename).toMatch(/^utenti_qualificati_\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
