import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminSecuritySettings } from "../AdminSecuritySettings";

// --- Mock state ---
let mockSettingsData: { device_trust_enabled: boolean; otp_threshold_days: number } | null = null;
let mockSettingsError: unknown = null;
let mockUpdateError: unknown = null;
const mockToast = vi.fn();

function createSettingsChain() {
  const chain: Record<string, any> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(() =>
    Promise.resolve({ data: mockSettingsData, error: mockSettingsError })
  );
  chain.update = vi.fn(() => ({
    eq: vi.fn(() => Promise.resolve({ error: mockUpdateError })),
  }));
  return chain;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "app_settings") return createSettingsChain();
      return {};
    },
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

function renderComponent() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <AdminSecuritySettings />
    </QueryClientProvider>
  );
}

describe("AdminSecuritySettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsData = { device_trust_enabled: true, otp_threshold_days: 14 };
    mockSettingsError = null;
    mockUpdateError = null;
  });

  it("renderizza card con titolo Sicurezza", async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText("Sicurezza")).toBeTruthy();
    });
  });

  it("mostra toggle Device Trust e input soglia OTP", async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText("Device Trust")).toBeTruthy();
      expect(screen.getByLabelText(/Soglia inattivita/)).toBeTruthy();
    });
  });

  it("mostra il valore corrente della soglia nell'input", async () => {
    mockSettingsData = { device_trust_enabled: true, otp_threshold_days: 7 };
    renderComponent();
    await waitFor(() => {
      const input = screen.getByLabelText(/Soglia inattivita/) as HTMLInputElement;
      expect(input.value).toBe("7");
    });
  });

  it("bottone Salva disabilitato se valore non cambiato", async () => {
    renderComponent();
    await waitFor(() => {
      const btn = screen.getByRole("button", { name: "Salva" });
      expect(btn).toBeDisabled();
    });
  });

  it("bottone Salva abilitato quando valore cambia a valore valido", async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByLabelText(/Soglia inattivita/)).toBeTruthy();
    });
    const input = screen.getByLabelText(/Soglia inattivita/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "30" } });
    const btn = screen.getByRole("button", { name: "Salva" });
    expect(btn).not.toBeDisabled();
  });

  it("bottone Salva disabilitato per valore 0 (fuori range)", async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByLabelText(/Soglia inattivita/)).toBeTruthy();
    });
    const input = screen.getByLabelText(/Soglia inattivita/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "0" } });
    const btn = screen.getByRole("button", { name: "Salva" });
    expect(btn).toBeDisabled();
  });

  it("bottone Salva disabilitato per valore 91 (fuori range)", async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByLabelText(/Soglia inattivita/)).toBeTruthy();
    });
    const input = screen.getByLabelText(/Soglia inattivita/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "91" } });
    const btn = screen.getByRole("button", { name: "Salva" });
    expect(btn).toBeDisabled();
  });

  it("bottone Salva disabilitato per valore negativo", async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByLabelText(/Soglia inattivita/)).toBeTruthy();
    });
    const input = screen.getByLabelText(/Soglia inattivita/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "-1" } });
    const btn = screen.getByRole("button", { name: "Salva" });
    expect(btn).toBeDisabled();
  });

  it("bottone Salva disabilitato per input non numerico", async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByLabelText(/Soglia inattivita/)).toBeTruthy();
    });
    const input = screen.getByLabelText(/Soglia inattivita/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "abc" } });
    const btn = screen.getByRole("button", { name: "Salva" });
    expect(btn).toBeDisabled();
  });

  it("mostra avviso quando query fallisce con errore", async () => {
    mockSettingsData = null;
    mockSettingsError = new Error("network failure");
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText(/Impossibile caricare le impostazioni/)).toBeTruthy();
    });
  });

  it("toggle Device Trust chiama mutation", async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByRole("switch")).toBeTruthy();
    });
    const toggle = screen.getByRole("switch");
    fireEvent.click(toggle);
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalled();
    });
  });
});
