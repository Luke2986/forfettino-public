/**
 * Tests for PrivacyDataSection component.
 * Story 35-4 — Impostazioni Privacy, export dati e consent gating
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

// ── Hoisted mocks (vi.mock factories can reference these) ──
const { mockMutateAsync, mockToast, mockNavigate, mockSignOut, mockInvoke, mockSetAnalyticsConsent } = vi.hoisted(() => ({
  mockMutateAsync: vi.fn().mockResolvedValue({}),
  mockToast: vi.fn(),
  mockNavigate: vi.fn(),
  mockSignOut: vi.fn().mockResolvedValue(undefined),
  mockInvoke: vi.fn(),
  mockSetAnalyticsConsent: vi.fn(),
}));

let mockProfile: any = null;
let mockProfileLoading = false;

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({
    data: mockProfileLoading ? null : mockProfile,
    isLoading: mockProfileLoading,
  }),
  useUpdateProfile: () => ({
    mutateAsync: mockMutateAsync,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", email: "test@example.com" } }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: "test-token" } },
      }),
      signOut: mockSignOut,
    },
    functions: {
      invoke: mockInvoke,
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: "p1" } }),
        }),
      }),
    }),
  },
}));

vi.mock("@/lib/analytics", () => ({
  setAnalyticsConsent: mockSetAnalyticsConsent,
}));

// --- Mock useProWaitlist (uses useQueryClient, no QueryClientProvider in tests) ---
vi.mock("@/hooks/useProWaitlist", () => ({
  PRO_WAITLIST_CONSENT_TEXT: "Consent text mock",
  useProWaitlist: () => ({
    data: null,
    isLoading: false,
    isEnrolled: false,
    join: { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false },
    leave: { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false },
  }),
}));

import { PrivacyDataSection } from "./PrivacyDataSection";

const DEFAULT_PROFILE = {
  id: "p1",
  user_id: "u1",
  privacy_policy_accepted_at: "2026-03-05T12:00:00Z",
  privacy_policy_version: "2026-03-05-v1.0",
  tos_accepted_at: "2026-03-05T12:00:00Z",
  tos_version: "2026-03-05-v1.0",
  analytics_consent: true,
  analytics_consent_at: "2026-03-05T12:00:00Z",
  marketing_email_consent: false,
  marketing_email_consent_at: null,
};

// Mock URL APIs for jsdom
if (!URL.createObjectURL) {
  URL.createObjectURL = vi.fn().mockReturnValue("blob:mock");
}
if (!URL.revokeObjectURL) {
  URL.revokeObjectURL = vi.fn();
}

describe("PrivacyDataSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProfileLoading = false;
    mockProfile = { ...DEFAULT_PROFILE };
  });

  // ── Rendering ──

  it("renders legal documents section with acceptance dates", () => {
    render(React.createElement(PrivacyDataSection));

    expect(screen.getByText("Documenti Legali")).toBeTruthy();
    expect(screen.getByText("Privacy Policy")).toBeTruthy();
    expect(screen.getByText("Cookie Policy")).toBeTruthy();
    expect(screen.getByText("Termini di Servizio")).toBeTruthy();
    const dateTexts = screen.getAllByText(/Accettati il:/);
    expect(dateTexts.length).toBeGreaterThanOrEqual(2);
  });

  it("shows 'Non ancora accettati' when privacy_policy_accepted_at is null", () => {
    mockProfile = {
      ...DEFAULT_PROFILE,
      privacy_policy_accepted_at: null,
      privacy_policy_version: null,
    };
    render(React.createElement(PrivacyDataSection));

    const notAccepted = screen.getAllByText("Non ancora accettati");
    expect(notAccepted.length).toBeGreaterThanOrEqual(1);
  });

  it("renders consent toggles section", () => {
    render(React.createElement(PrivacyDataSection));

    expect(screen.getByText("Consensi")).toBeTruthy();
    expect(screen.getByLabelText("Email di marketing")).toBeTruthy();
    expect(screen.getByLabelText("Tracciamento analytics")).toBeTruthy();
  });

  it("renders export and delete buttons", () => {
    render(React.createElement(PrivacyDataSection));

    expect(screen.getByText("I Tuoi Dati")).toBeTruthy();
    expect(screen.getByText("Esporta i miei dati")).toBeTruthy();
    expect(screen.getByText("Elimina il mio account")).toBeTruthy();
  });

  it("renders skeleton when loading", () => {
    mockProfileLoading = true;
    const { container } = render(React.createElement(PrivacyDataSection));

    expect(screen.queryByText("Documenti Legali")).toBeNull();
    // Skeleton component renders divs with animate-pulse class
    const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  // ── Analytics toggle ──

  it("analytics toggle saves consent and calls setAnalyticsConsent", async () => {
    render(React.createElement(PrivacyDataSection));

    const analyticsSwitch = screen.getByLabelText("Tracciamento analytics");
    fireEvent.click(analyticsSwitch);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ analytics_consent: false })
      );
    });

    expect(mockSetAnalyticsConsent).toHaveBeenCalledWith(false);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Analytics disattivato" }));
  });

  // ── Marketing toggle ──

  it("marketing toggle saves consent", async () => {
    render(React.createElement(PrivacyDataSection));

    const marketingSwitch = screen.getByLabelText("Email di marketing");
    fireEvent.click(marketingSwitch);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ marketing_email_consent: true })
      );
    });

    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Email marketing attivate" }));
  });

  // ── Note disattivazione analytics ──

  it("shows note about data deletion when analytics is off", () => {
    mockProfile = { ...DEFAULT_PROFILE, analytics_consent: false };
    render(React.createElement(PrivacyDataSection));

    expect(screen.getByText(/dati gia' raccolti verranno cancellati/)).toBeTruthy();
  });

  it("does not show data deletion note when analytics is on", () => {
    render(React.createElement(PrivacyDataSection));

    expect(screen.queryByText(/dati gia' raccolti verranno cancellati/)).toBeNull();
  });

  // ── Export ──

  it("export button calls edge function", async () => {
    mockInvoke.mockResolvedValue({ data: { profiles: { id: "p1" } }, error: null });

    render(React.createElement(PrivacyDataSection));

    fireEvent.click(screen.getByText("Esporta i miei dati"));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("export-user-data", expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
      }));
    });

    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Esportazione completata" }));
  });

  // ── Delete account ──

  it("delete account requires typing ELIMINA to enable button", async () => {
    render(React.createElement(PrivacyDataSection));

    fireEvent.click(screen.getByText("Elimina il mio account"));

    await waitFor(() => {
      expect(screen.getByText("Sei sicuro di voler eliminare il tuo account?")).toBeTruthy();
    });

    const confirmBtn = screen.getByText("Elimina permanentemente");
    expect(confirmBtn).toHaveProperty("disabled", true);

    fireEvent.change(screen.getByPlaceholderText("Digita ELIMINA per confermare"), {
      target: { value: "ELIMINA" },
    });

    expect(confirmBtn).toHaveProperty("disabled", false);
  });

  it("delete account calls edge function and signs out", async () => {
    mockInvoke.mockResolvedValue({ data: {}, error: null });

    render(React.createElement(PrivacyDataSection));

    fireEvent.click(screen.getByText("Elimina il mio account"));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Digita ELIMINA per confermare")).toBeTruthy();
    });

    fireEvent.change(screen.getByPlaceholderText("Digita ELIMINA per confermare"), {
      target: { value: "ELIMINA" },
    });
    fireEvent.click(screen.getByText("Elimina permanentemente"));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("delete-account", expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
      }));
    });

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith("/");
    });
  });

  // ── Service comms note ──

  it("shows note about service communications staying active", () => {
    render(React.createElement(PrivacyDataSection));

    expect(screen.getByText(/comunicazioni di servizio.*restano sempre attive/)).toBeTruthy();
  });
});
