import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NpsCampaignConfig } from "../NpsCampaignConfig";

// --- Mock campaign data ---

const baseCampaign = {
  id: "camp-1",
  is_active: true,
  enabled_triggers: ["third_receipt", "30days_active"],
  repeat_interval: "6m",
  start_date: "2026-01-01",
  end_date: "2026-12-31",
  created_at: "2026-01-01T00:00:00Z",
};

let mockCampaignData: unknown[] = [baseCampaign];
let mockQueryError: unknown = null;
let mockUpdateFn: ReturnType<typeof vi.fn>;

function createChain() {
  const state: Record<string, unknown> = {};
  const chain: Record<string, any> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.update = vi.fn((payload: unknown) => {
    mockUpdateFn(payload);
    return chain;
  });
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: mockCampaignData, error: mockQueryError }).then(
      resolve,
    );
  return chain;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => createChain()),
  },
}));

// Mock sonner toast
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: any[]) => mockToastSuccess(...args),
    error: (...args: any[]) => mockToastError(...args),
  },
}));

// --- Helpers ---

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

// --- Tests ---

describe("NpsCampaignConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCampaignData = [baseCampaign];
    mockQueryError = null;
    mockUpdateFn = vi.fn();
  });

  it("renders form with campaign data preloaded", async () => {
    render(<NpsCampaignConfig />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(
        screen.getByText("Configurazione Campagna NPS"),
      ).toBeInTheDocument();
    });

    // Toggle should be present
    const toggle = screen.getByRole("switch");
    expect(toggle).toBeInTheDocument();

    // Trigger checkboxes
    expect(screen.getByText("3\u00B0 incasso registrato")).toBeInTheDocument();
    expect(
      screen.getByText("30 giorni di attivit\u00E0"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Post-scadenza fiscale"),
    ).toBeInTheDocument();

    // Repeat interval radios
    expect(screen.getByText("Mai (una tantum)")).toBeInTheDocument();
    expect(screen.getByText("Ogni 6 mesi")).toBeInTheDocument();

    // Save button
    expect(
      screen.getByRole("button", { name: /salva configurazione/i }),
    ).toBeInTheDocument();
  });

  it("shows empty state when no campaign exists", async () => {
    mockCampaignData = [];

    render(<NpsCampaignConfig />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(
        screen.getByText(/nessuna campagna nps trovata/i),
      ).toBeInTheDocument();
    });
  });

  it("toggle on/off updates isActive state", async () => {
    render(<NpsCampaignConfig />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole("switch")).toBeInTheDocument();
    });

    const toggle = screen.getByRole("switch");
    // Campaign starts as active (is_active: true)
    expect(toggle).toHaveAttribute("data-state", "checked");

    // Click to deactivate
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("data-state", "unchecked");
  });

  it("trigger checkbox toggles enabled_triggers", async () => {
    render(<NpsCampaignConfig />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(
        screen.getByText("Raggiungimento milestone/traguardo"),
      ).toBeInTheDocument();
    });

    // milestone_reached should be unchecked initially (not in baseCampaign.enabled_triggers)
    const milestoneCheckbox = screen.getByLabelText(
      "Raggiungimento milestone/traguardo",
    );
    expect(milestoneCheckbox).not.toBeChecked();

    // Click to enable
    fireEvent.click(milestoneCheckbox);
    expect(milestoneCheckbox).toBeChecked();
  });

  it("validates end_date >= start_date", async () => {
    render(<NpsCampaignConfig />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByLabelText("Data inizio")).toBeInTheDocument();
    });

    const startInput = screen.getByLabelText("Data inizio");
    const endInput = screen.getByLabelText("Data fine (opzionale)");

    // Set end before start
    fireEvent.change(startInput, { target: { value: "2026-06-01" } });
    fireEvent.change(endInput, { target: { value: "2026-01-01" } });

    expect(
      screen.getByText(
        /la data fine deve essere uguale o successiva alla data inizio/i,
      ),
    ).toBeInTheDocument();

    // Save button should be disabled
    const saveBtn = screen.getByRole("button", {
      name: /salva configurazione/i,
    });
    expect(saveBtn).toBeDisabled();
  });

  it("repeat interval radio changes value", async () => {
    render(<NpsCampaignConfig />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Mai (una tantum)")).toBeInTheDocument();
    });

    // Click "Ogni 3 mesi"
    const radio3m = screen.getByLabelText("Ogni 3 mesi");
    fireEvent.click(radio3m);
    expect(radio3m).toBeChecked();
  });

  it("shows warning when campaign is active but out of date range", async () => {
    // Campaign with past end_date
    mockCampaignData = [
      {
        ...baseCampaign,
        end_date: "2025-01-01", // past date
      },
    ];

    render(<NpsCampaignConfig />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(
        screen.getByText(/fuori dal periodo configurato/i),
      ).toBeInTheDocument();
    });

    // Badge should show "Abilitata ma fuori periodo"
    expect(
      screen.getByText("Abilitata ma fuori periodo"),
    ).toBeInTheDocument();
  });

  it("shows 'Disattivata' badge when campaign is inactive", async () => {
    mockCampaignData = [
      {
        ...baseCampaign,
        is_active: false,
      },
    ];

    render(<NpsCampaignConfig />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Disattivata")).toBeInTheDocument();
    });
  });

  it("calls save with updated payload on submit", async () => {
    render(<NpsCampaignConfig />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /salva configurazione/i }),
      ).toBeInTheDocument();
    });

    const saveBtn = screen.getByRole("button", {
      name: /salva configurazione/i,
    });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockUpdateFn).toHaveBeenCalledWith(
        expect.objectContaining({
          is_active: baseCampaign.is_active,
          enabled_triggers: baseCampaign.enabled_triggers,
          repeat_interval: baseCampaign.repeat_interval,
        }),
      );
    });
  });
});
