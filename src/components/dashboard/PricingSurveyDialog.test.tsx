/**
 * Tests for PricingSurveyDialog — Van Westendorp 4-question form.
 *
 * Verifies form fields, validation, soft warning, and submit flow.
 * The Sheet renders in a portal, so we query from document.body.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PricingSurveyDialog } from "./PricingSurveyDialog";

// --- Mocks ---
const { mockInsert, mockRpc, mockUpdate, mockSelectLimit } = vi.hoisted(() => ({
  mockInsert: vi.fn().mockResolvedValue({ error: null }),
  mockRpc: vi.fn().mockResolvedValue({ data: true, error: null }),
  mockUpdate: vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  }),
  mockSelectLimit: vi.fn().mockResolvedValue({ data: [] }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user-123" } }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      insert: mockInsert,
      update: mockUpdate,
      select: () => ({
        eq: () => ({
          eq: () => ({
            limit: mockSelectLimit,
          }),
        }),
      }),
    }),
    rpc: mockRpc,
  },
}));

vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
  trackAnonymous: vi.fn(),
  setAnalyticsConsent: vi.fn(),
  ANALYTICS_EVENTS: {},
}));

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  onComplete: vi.fn(),
};

// Helper to query inside the portal
function body() {
  return within(document.body);
}

describe("PricingSurveyDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render dialog title", () => {
    render(<PricingSurveyDialog {...defaultProps} />, { wrapper: createWrapper() });
    expect(body().getByText("Quanto vale Forfettino Pro per te?")).toBeDefined();
  });

  it("should render all 4 pricing question labels", () => {
    render(<PricingSurveyDialog {...defaultProps} />, { wrapper: createWrapper() });
    expect(body().getByText(/troppo economico/)).toBeDefined();
    expect(body().getByText(/buon affare/)).toBeDefined();
    expect(body().getByText(/caro, ma lo considereresti/)).toBeDefined();
    expect(body().getByText(/troppo caro e non lo pagheresti/)).toBeDefined();
  });

  it("should render EUR/anno suffix on inputs", () => {
    render(<PricingSurveyDialog {...defaultProps} />, { wrapper: createWrapper() });
    const suffixes = body().getAllByText("EUR/anno");
    expect(suffixes.length).toBe(4);
  });

  it("should render optional textarea", () => {
    render(<PricingSurveyDialog {...defaultProps} />, { wrapper: createWrapper() });
    expect(body().getByText("Vuoi aggiungere qualcosa?")).toBeDefined();
  });

  it("should disable submit button when not all fields filled", () => {
    render(<PricingSurveyDialog {...defaultProps} />, { wrapper: createWrapper() });
    const submitBtn = body().getByRole("button", { name: "Invia" });
    expect(submitBtn).toHaveProperty("disabled", true);
  });

  it("should enable submit when all 4 fields have values > 0", () => {
    render(<PricingSurveyDialog {...defaultProps} />, { wrapper: createWrapper() });
    const inputs = body().getAllByPlaceholderText(/^es\./);
    fireEvent.change(inputs[0], { target: { value: "10" } });
    fireEvent.change(inputs[1], { target: { value: "50" } });
    fireEvent.change(inputs[2], { target: { value: "100" } });
    fireEvent.change(inputs[3], { target: { value: "200" } });
    const submitBtn = body().getByRole("button", { name: "Invia" });
    expect(submitBtn).toHaveProperty("disabled", false);
  });

  it("should show soft warning when tooCheap > goodValue", () => {
    render(<PricingSurveyDialog {...defaultProps} />, { wrapper: createWrapper() });
    const inputs = body().getAllByPlaceholderText(/^es\./);
    fireEvent.change(inputs[0], { target: { value: "100" } });
    fireEvent.change(inputs[1], { target: { value: "50" } });
    expect(body().getByText(/Di solito il prezzo troppo economico/)).toBeDefined();
  });

  it("should NOT show warning when tooCheap < goodValue", () => {
    render(<PricingSurveyDialog {...defaultProps} />, { wrapper: createWrapper() });
    const inputs = body().getAllByPlaceholderText(/^es\./);
    fireEvent.change(inputs[0], { target: { value: "10" } });
    fireEvent.change(inputs[1], { target: { value: "50" } });
    expect(body().queryByText(/Di solito il prezzo troppo economico/)).toBeNull();
  });

  it("should submit successfully and show thank-you state", async () => {
    render(<PricingSurveyDialog {...defaultProps} />, { wrapper: createWrapper() });

    const inputs = body().getAllByPlaceholderText(/^es\./);
    fireEvent.change(inputs[0], { target: { value: "10" } });
    fireEvent.change(inputs[1], { target: { value: "50" } });
    fireEvent.change(inputs[2], { target: { value: "100" } });
    fireEvent.change(inputs[3], { target: { value: "200" } });

    fireEvent.click(body().getByRole("button", { name: "Invia" }));

    await waitFor(() => {
      expect(body().getByText("Grazie!")).toBeDefined();
    });

    expect(mockInsert).toHaveBeenCalledWith({
      user_id: "user-123",
      survey_key: "pricing_van_westendorp_v1",
      selected_reason: JSON.stringify({
        too_cheap: 10,
        good_value: 50,
        expensive_ok: 100,
        too_expensive: 200,
      }),
      free_text: null,
    });
  });

  it("should include free text in submission when provided", async () => {
    render(<PricingSurveyDialog {...defaultProps} />, { wrapper: createWrapper() });

    const inputs = body().getAllByPlaceholderText(/^es\./);
    fireEvent.change(inputs[0], { target: { value: "10" } });
    fireEvent.change(inputs[1], { target: { value: "50" } });
    fireEvent.change(inputs[2], { target: { value: "100" } });
    fireEvent.change(inputs[3], { target: { value: "200" } });

    const textarea = body().getByPlaceholderText(/Preferenze sul modello/);
    fireEvent.change(textarea, { target: { value: "Vorrei un piano mensile" } });

    fireEvent.click(body().getByRole("button", { name: "Invia" }));

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          free_text: "Vorrei un piano mensile",
        }),
      );
    });
  });

  it("should show +10 points badge after successful submission", async () => {
    render(<PricingSurveyDialog {...defaultProps} />, { wrapper: createWrapper() });

    const inputs = body().getAllByPlaceholderText(/^es\./);
    fireEvent.change(inputs[0], { target: { value: "10" } });
    fireEvent.change(inputs[1], { target: { value: "50" } });
    fireEvent.change(inputs[2], { target: { value: "100" } });
    fireEvent.change(inputs[3], { target: { value: "200" } });

    fireEvent.click(body().getByRole("button", { name: "Invia" }));

    await waitFor(() => {
      expect(body().getByText("+10 punti")).toBeDefined();
    });
  });

  it("should render intro text about anonymity", () => {
    render(<PricingSurveyDialog {...defaultProps} />, { wrapper: createWrapper() });
    expect(body().getByText(/Le risposte sono anonime/)).toBeDefined();
  });

  it("should show error message when insert fails", async () => {
    mockInsert.mockResolvedValueOnce({ error: { message: "DB error" } });
    render(<PricingSurveyDialog {...defaultProps} />, { wrapper: createWrapper() });

    const inputs = body().getAllByPlaceholderText(/^es\./);
    fireEvent.change(inputs[0], { target: { value: "10" } });
    fireEvent.change(inputs[1], { target: { value: "50" } });
    fireEvent.change(inputs[2], { target: { value: "100" } });
    fireEvent.change(inputs[3], { target: { value: "200" } });

    fireEvent.click(body().getByRole("button", { name: "Invia" }));

    await waitFor(() => {
      expect(body().getByText(/Invio fallito/)).toBeDefined();
    });
  });

  it("should skip insert and show success when user already responded (duplicate guard)", async () => {
    mockSelectLimit.mockResolvedValueOnce({ data: [{ id: "existing-resp" }] });
    render(<PricingSurveyDialog {...defaultProps} />, { wrapper: createWrapper() });

    const inputs = body().getAllByPlaceholderText(/^es\./);
    fireEvent.change(inputs[0], { target: { value: "10" } });
    fireEvent.change(inputs[1], { target: { value: "50" } });
    fireEvent.change(inputs[2], { target: { value: "100" } });
    fireEvent.change(inputs[3], { target: { value: "200" } });

    fireEvent.click(body().getByRole("button", { name: "Invia" }));

    await waitFor(() => {
      expect(body().getByText("Grazie!")).toBeDefined();
    });
    // insert should NOT have been called
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
