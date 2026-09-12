import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminOtpStats } from "../AdminOtpStats";

// --- Mock state ---
let mockRpcData: unknown = null;
let mockRpcError: unknown = null;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (name: string) => {
      if (name === "get_otp_stats") {
        return Promise.resolve({ data: mockRpcData, error: mockRpcError });
      }
      return Promise.resolve({ data: null, error: null });
    },
  },
}));

function renderComponent() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <AdminOtpStats />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

describe("AdminOtpStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpcData = null;
    mockRpcError = null;
  });

  it("mostra skeleton durante il loading", () => {
    // With null data and no error, it will show loading briefly
    mockRpcData = {
      total_users: 10,
      users_with_otp: 5,
      users_needing_otp: 3,
      verified_last_30d: 4,
      last_otp_verified: "2026-03-30T10:00:00Z",
    };
    renderComponent();
    expect(screen.getByText("Statistiche OTP")).toBeTruthy();
  });

  it("renderizza tutte e 4 le stat card con dati", async () => {
    mockRpcData = {
      total_users: 50,
      users_with_otp: 30,
      users_needing_otp: 12,
      verified_last_30d: 25,
      last_otp_verified: "2026-03-30T10:00:00Z",
    };
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Verificati OTP")).toBeTruthy();
      expect(screen.getByText("30/50")).toBeTruthy();
      expect(screen.getByText("Richiedono OTP (stima)")).toBeTruthy();
      expect(screen.getByText("12")).toBeTruthy();
      expect(screen.getByText("Verificati ultimi 30gg")).toBeTruthy();
      expect(screen.getByText("25")).toBeTruthy();
      expect(screen.getByText("Ultima verifica")).toBeTruthy();
    });
  });

  it("renderizza con zero utenti", async () => {
    mockRpcData = {
      total_users: 0,
      users_with_otp: 0,
      users_needing_otp: 0,
      verified_last_30d: 0,
      last_otp_verified: null,
    };
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("0/0")).toBeTruthy();
      // last_otp_verified null → shows "—"
      expect(screen.getByText("\u2014")).toBeTruthy();
    });
  });

  it("mostra messaggio errore quando RPC fallisce", async () => {
    mockRpcError = new Error("rpc failure");
    mockRpcData = null;
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText(/Impossibile caricare le statistiche OTP/)).toBeTruthy();
    });
  });

  it("mostra subLabel informativa per stima OTP", async () => {
    mockRpcData = {
      total_users: 10,
      users_with_otp: 5,
      users_needing_otp: 3,
      verified_last_30d: 4,
      last_otp_verified: null,
    };
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Include utenti OAuth-only")).toBeTruthy();
      expect(screen.getByText("proxy device trust")).toBeTruthy();
    });
  });
});
