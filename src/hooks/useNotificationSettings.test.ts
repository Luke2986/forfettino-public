/**
 * Tests for useNotificationSettings hook and deriveToneFromSeniority helper.
 * Story 25.3 — Preferenze Notifiche Espanse
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  deriveToneFromSeniority,
  NOTIFICATION_SETTINGS_DEFAULTS,
  useNotificationSettings,
} from "./useNotificationSettings";
import type { NotificationSettings } from "./useNotificationSettings";

// ── deriveToneFromSeniority (pure function) ──

describe("deriveToneFromSeniority", () => {
  const currentYear = 2026;

  it("returns 'rassicurante' for 0 years (same year)", () => {
    expect(deriveToneFromSeniority(2026, currentYear)).toBe("rassicurante");
  });

  it("returns 'rassicurante' for 2 years", () => {
    expect(deriveToneFromSeniority(2024, currentYear)).toBe("rassicurante");
  });

  it("returns 'neutro' for 3 years", () => {
    expect(deriveToneFromSeniority(2023, currentYear)).toBe("neutro");
  });

  it("returns 'neutro' for 5 years", () => {
    expect(deriveToneFromSeniority(2021, currentYear)).toBe("neutro");
  });

  it("returns 'minimalista' for 6 years", () => {
    expect(deriveToneFromSeniority(2020, currentYear)).toBe("minimalista");
  });

  it("returns 'minimalista' for 10+ years", () => {
    expect(deriveToneFromSeniority(2015, currentYear)).toBe("minimalista");
  });

  it("returns 'neutro' for null (anno_apertura_piva not available)", () => {
    expect(deriveToneFromSeniority(null, currentYear)).toBe("neutro");
  });
});

// ── NOTIFICATION_SETTINGS_DEFAULTS ──

describe("NOTIFICATION_SETTINGS_DEFAULTS", () => {
  it("has correct default values", () => {
    expect(NOTIFICATION_SETTINGS_DEFAULTS).toEqual({
      master_enabled: true,
      tone: "neutro",
      has_accountant: false,
      scadenze_enabled: true,
      scadenze_email_enabled: true,
      reminder_thresholds: [30, 7, 3, 0],
      feedback_enabled: true,
      insights_enabled: true,
      admin_messages_enabled: true,
      aggiornamenti_enabled: true,
    });
  });
});

// ── useNotificationSettings hook ──

const mockUser = { id: "user-123" };

vi.mock("./useAuth", () => ({
  useAuth: () => ({ user: mockUser }),
}));

// Mock for Supabase client — dynamically controlled
const mockMaybeSingle = vi.fn();
const mockFiscalMaybeSingle = vi.fn();
const mockUpsert = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === "fiscal_year_settings") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: mockFiscalMaybeSingle,
              }),
            }),
          }),
        };
      }
      // user_notification_settings
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: mockMaybeSingle,
          }),
        }),
        upsert: mockUpsert.mockReturnValue({
          then: vi.fn().mockImplementation((cb: any) => cb({ error: null })),
        }),
      };
    }),
  },
}));

vi.mock("./use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

describe("useNotificationSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns existing settings when row exists in DB", async () => {
    const mockSettings: NotificationSettings = {
      master_enabled: false,
      tone: "minimalista",
      has_accountant: true,
      scadenze_enabled: false,
      scadenze_email_enabled: false,
      reminder_thresholds: [7, 0],
      feedback_enabled: true,
      insights_enabled: true,
      admin_messages_enabled: false,
      aggiornamenti_enabled: true,
    };
    mockMaybeSingle.mockResolvedValue({ data: mockSettings, error: null });

    const { result } = renderHook(() => useNotificationSettings(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.settings).toEqual(mockSettings);
  });

  it("returns defaults with calculated tone when no row exists", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    // anno_apertura_piva = 2024, currentYear = 2026 → 2 years → rassicurante
    mockFiscalMaybeSingle.mockResolvedValue({
      data: { anno_apertura_piva: 2024 },
      error: null,
    });

    const { result } = renderHook(() => useNotificationSettings(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.settings?.tone).toBe("rassicurante");
    expect(result.current.settings?.master_enabled).toBe(true);
    expect(result.current.settings?.aggiornamenti_enabled).toBe(true);
  });

  it("returns neutro tone when anno_apertura_piva is null", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockFiscalMaybeSingle.mockResolvedValue({
      data: { anno_apertura_piva: null },
      error: null,
    });

    const { result } = renderHook(() => useNotificationSettings(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.settings?.tone).toBe("neutro");
  });

  it("returns neutro tone when fiscal_year_settings row does not exist", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockFiscalMaybeSingle.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useNotificationSettings(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.settings?.tone).toBe("neutro");
  });

  it("calls upsert with correct args when updateSetting is invoked", async () => {
    const mockSettings: NotificationSettings = {
      master_enabled: true,
      tone: "neutro",
      has_accountant: false,
      scadenze_enabled: true,
      scadenze_email_enabled: true,
      reminder_thresholds: [30, 7, 3, 0],
      feedback_enabled: true,
      insights_enabled: true,
      admin_messages_enabled: true,
      aggiornamenti_enabled: true,
    };
    mockMaybeSingle.mockResolvedValue({ data: mockSettings, error: null });
    mockUpsert.mockReturnValue({ error: null });

    const { result } = renderHook(() => useNotificationSettings(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Invoke mutation
    act(() => {
      result.current.updateSetting("master_enabled", false);
    });

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalled();
    });

    // Verify upsert was called with the full merged settings (current + override)
    // and the user_id, per the hook's implementation (optimistic full-row upsert).
    expect(mockUpsert).toHaveBeenCalledWith(
      { ...mockSettings, master_enabled: false, user_id: mockUser.id },
      { onConflict: "user_id" },
    );
  });

  it("upsert includes reminder_thresholds when updateSetting('reminder_thresholds', ...) is invoked (84-10)", async () => {
    const mockSettings: NotificationSettings = {
      master_enabled: true,
      tone: "neutro",
      has_accountant: false,
      scadenze_enabled: true,
      scadenze_email_enabled: true,
      reminder_thresholds: [30, 7, 3, 0],
      feedback_enabled: true,
      insights_enabled: true,
      admin_messages_enabled: true,
      aggiornamenti_enabled: true,
    };
    mockMaybeSingle.mockResolvedValue({ data: mockSettings, error: null });
    mockUpsert.mockReturnValue({ error: null });

    const { result } = renderHook(() => useNotificationSettings(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.updateSetting("reminder_thresholds", [7, 0]);
    });

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalled();
    });

    expect(mockUpsert).toHaveBeenCalledWith(
      { ...mockSettings, reminder_thresholds: [7, 0], user_id: mockUser.id },
      { onConflict: "user_id" },
    );
  });
});
