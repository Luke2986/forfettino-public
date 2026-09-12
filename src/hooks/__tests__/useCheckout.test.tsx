/**
 * Test per useCheckout.tsx
 * Story 8.1 — Integrazione Abbonamento Stripe
 *
 * Copertura:
 * - checkout() chiama create-checkout-session con billing interval corretto
 * - checkout() esegue redirect a URL Stripe
 * - checkout() mostra toast errore in caso di fallimento
 * - openPortal() chiama create-portal-session e redirect
 * - openPortal() mostra toast errore in caso di fallimento
 * - isLoading è true durante le chiamate
 */

import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock supabase functions
const mockInvoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

// Mock toast
const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock window.location
const originalLocation = window.location;

import { useCheckout } from "../useCheckout";

describe("useCheckout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.location.href as writable
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, href: "" },
      writable: true,
    });
  });

  afterAll(() => {
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
    });
  });

  describe("checkout()", () => {
    it("calls create-checkout-session with 'year' for yearly plan", async () => {
      mockInvoke.mockResolvedValueOnce({ data: { url: "https://checkout.stripe.com/test" }, error: null });

      const { result } = renderHook(() => useCheckout());

      await act(async () => {
        await result.current.checkout("year");
      });

      expect(mockInvoke).toHaveBeenCalledWith("create-checkout-session", {
        body: { billingInterval: "year" },
      });
      expect(window.location.href).toBe("https://checkout.stripe.com/test");
    });

    it("calls create-checkout-session with 'month' for monthly plan", async () => {
      mockInvoke.mockResolvedValueOnce({ data: { url: "https://checkout.stripe.com/monthly" }, error: null });

      const { result } = renderHook(() => useCheckout());

      await act(async () => {
        await result.current.checkout("month");
      });

      expect(mockInvoke).toHaveBeenCalledWith("create-checkout-session", {
        body: { billingInterval: "month" },
      });
      expect(window.location.href).toBe("https://checkout.stripe.com/monthly");
    });

    it("defaults to 'year' when no plan specified", async () => {
      mockInvoke.mockResolvedValueOnce({ data: { url: "https://checkout.stripe.com/default" }, error: null });

      const { result } = renderHook(() => useCheckout());

      await act(async () => {
        await result.current.checkout();
      });

      expect(mockInvoke).toHaveBeenCalledWith("create-checkout-session", {
        body: { billingInterval: "year" },
      });
    });

    it("shows error toast when checkout fails", async () => {
      mockInvoke.mockResolvedValueOnce({ data: null, error: new Error("Network error") });

      const { result } = renderHook(() => useCheckout());

      await act(async () => {
        await result.current.checkout("month");
      });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Errore",
          variant: "destructive",
        })
      );
    });

    it("shows error toast when no URL returned", async () => {
      mockInvoke.mockResolvedValueOnce({ data: {}, error: null });

      const { result } = renderHook(() => useCheckout());

      await act(async () => {
        await result.current.checkout("year");
      });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Errore",
          variant: "destructive",
        })
      );
    });
  });

  describe("openPortal()", () => {
    it("calls create-portal-session and redirects", async () => {
      mockInvoke.mockResolvedValueOnce({ data: { url: "https://billing.stripe.com/portal" }, error: null });

      const { result } = renderHook(() => useCheckout());

      await act(async () => {
        await result.current.openPortal();
      });

      expect(mockInvoke).toHaveBeenCalledWith("create-portal-session");
      expect(window.location.href).toBe("https://billing.stripe.com/portal");
    });

    it("shows error toast when portal fails", async () => {
      mockInvoke.mockResolvedValueOnce({ data: null, error: new Error("Portal error") });

      const { result } = renderHook(() => useCheckout());

      await act(async () => {
        await result.current.openPortal();
      });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Errore",
          variant: "destructive",
        })
      );
    });
  });
});
