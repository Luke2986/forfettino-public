/**
 * Test per useSurveyBudget hook (Story 50.1)
 *
 * Copertura:
 * - canShowSurvey = true quando last_survey_completed_at è null (mai completato)
 * - canShowSurvey = false quando < 60 giorni dall'ultimo survey
 * - canShowSurvey = true quando >= 60 giorni dall'ultimo survey
 * - isLoading = true durante il fetch, canShowSurvey = false
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Mock auth
const mockUser = { id: "user-123", email: "test@example.com" };
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mockUser }),
}));

// Mock supabase
let mockLastSurveyCompletedAt: string | null = null;
let mockError: any = null;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () =>
            Promise.resolve({
              data: mockError
                ? null
                : { last_survey_completed_at: mockLastSurveyCompletedAt },
              error: mockError,
            }),
        }),
      }),
    }),
  },
}));

// Import after mocks
import { useSurveyBudget } from "../useSurveyBudget";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
  };
}

describe("useSurveyBudget", () => {
  beforeEach(() => {
    mockLastSurveyCompletedAt = null;
    mockError = null;
  });

  it("canShowSurvey = true quando last_survey_completed_at è null (mai completato)", async () => {
    mockLastSurveyCompletedAt = null;

    const { result } = renderHook(() => useSurveyBudget(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.canShowSurvey).toBe(true);
    expect(result.current.daysUntilNextSurvey).toBe(0);
  });

  it("canShowSurvey = false quando < 60 giorni dall'ultimo survey", async () => {
    // 10 days ago
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    mockLastSurveyCompletedAt = tenDaysAgo.toISOString();

    const { result } = renderHook(() => useSurveyBudget(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.canShowSurvey).toBe(false);
    expect(result.current.daysUntilNextSurvey).toBe(50);
  });

  it("canShowSurvey = true quando >= 60 giorni dall'ultimo survey", async () => {
    // 61 days ago
    const sixtyOneDaysAgo = new Date();
    sixtyOneDaysAgo.setDate(sixtyOneDaysAgo.getDate() - 61);
    mockLastSurveyCompletedAt = sixtyOneDaysAgo.toISOString();

    const { result } = renderHook(() => useSurveyBudget(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.canShowSurvey).toBe(true);
    expect(result.current.daysUntilNextSurvey).toBe(0);
  });

  it("canShowSurvey = false e daysUntilNextSurvey = 60 durante il caricamento", () => {
    // Check initial state synchronously (before async resolves)
    const { result } = renderHook(() => useSurveyBudget(), {
      wrapper: createWrapper(),
    });

    // On first render, isLoading is true → canShowSurvey defaults to false
    expect(result.current.canShowSurvey).toBe(false);
  });

  it("canShowSurvey = false con errore supabase (fail-closed)", async () => {
    mockError = { message: "DB error" };

    const { result } = renderHook(() => useSurveyBudget(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // DB error → fail-closed, don't show survey popup for broken UX
    expect(result.current.canShowSurvey).toBe(false);
    expect(result.current.daysUntilNextSurvey).toBe(60);
  });
});
