import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

// Mock dependencies
vi.mock("./useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("./useSubscription", () => ({
  useSubscription: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { useAuth } from "./useAuth";
import { useSubscription } from "./useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { useServiceCategories } from "./useServiceCategories";
import { FREE_CATEGORY_LIMIT } from "@/types/subscription";

const mockUseAuth = vi.mocked(useAuth);
const mockUseSubscription = vi.mocked(useSubscription);
const mockFrom = vi.mocked(supabase.from);

const MOCK_USER = { id: "user-123" };

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

function createChain(data: unknown[] = []) {
  const chain: Record<string, any> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data: data[0] ?? null, error: null });
  // .order() is called twice — first returns chain, second resolves with data
  chain.order = vi
    .fn()
    .mockReturnValueOnce(chain)
    .mockResolvedValue({ data, error: null });
  mockFrom.mockReturnValue(chain);
  return chain;
}

const makeCategory = (overrides: Record<string, unknown> = {}) => ({
  id: "cat-1",
  user_id: MOCK_USER.id,
  name: "Consulenza",
  color: "#14b8a6",
  icon: null,
  sort_order: 0,
  active: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

describe("useServiceCategories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: MOCK_USER,
      loading: false,
      signOut: vi.fn(),
    } as any);
    mockUseSubscription.mockReturnValue({
      isPro: false,
      tier: "free",
      isActive: true,
      hasPaidPlan: false,
      isAdmin: false,
      isStudio: false,
      isBetaTester: false,
      overrideTier: null,
      isLoading: false,
    } as any);
  });

  it("should return empty categories when user has none", async () => {
    createChain([]);

    const { result } = renderHook(() => useServiceCategories(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.categories).toEqual([]);
    expect(result.current.activeCategories).toEqual([]);
    expect(result.current.categoriesUsed).toBe(0);
    expect(result.current.canAddCategory).toBe(true);
  });

  it("should return categories sorted by sort_order then created_at", async () => {
    const cats = [
      makeCategory({ id: "cat-1", sort_order: 0 }),
      makeCategory({ id: "cat-2", sort_order: 1, name: "Formazione" }),
    ];
    createChain(cats);

    const { result } = renderHook(() => useServiceCategories(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.categories).toHaveLength(2);
    });
  });

  it("should filter activeCategories by active=true", async () => {
    const cats = [
      makeCategory({ id: "cat-1", active: true }),
      makeCategory({ id: "cat-2", active: false, name: "Inattiva" }),
    ];
    createChain(cats);

    const { result } = renderHook(() => useServiceCategories(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.categories).toHaveLength(2);
    });

    expect(result.current.activeCategories).toHaveLength(1);
    expect(result.current.categoriesUsed).toBe(1);
  });

  it("should set canAddCategory=false when Free user reaches limit", async () => {
    const cats = Array.from({ length: FREE_CATEGORY_LIMIT }, (_, i) =>
      makeCategory({ id: `cat-${i}`, name: `Cat ${i}`, active: true })
    );
    createChain(cats);

    const { result } = renderHook(() => useServiceCategories(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.categories).toHaveLength(FREE_CATEGORY_LIMIT);
    });

    expect(result.current.canAddCategory).toBe(false);
  });

  it("should set canAddCategory=true for Pro user even at limit", async () => {
    mockUseSubscription.mockReturnValue({
      isPro: true,
      tier: "pro",
      isActive: true,
      hasPaidPlan: true,
      isAdmin: false,
      isStudio: false,
      isBetaTester: false,
      overrideTier: null,
      isLoading: false,
    } as any);

    const cats = Array.from({ length: FREE_CATEGORY_LIMIT }, (_, i) =>
      makeCategory({ id: `cat-${i}`, name: `Cat ${i}`, active: true })
    );
    createChain(cats);

    const { result } = renderHook(() => useServiceCategories(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.categories).toHaveLength(FREE_CATEGORY_LIMIT);
    });

    expect(result.current.canAddCategory).toBe(true);
  });

  it("createCategory should reject empty name", async () => {
    createChain([]);

    const { result } = renderHook(() => useServiceCategories(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await expect(
      act(() => result.current.createCategory({ name: "   " }))
    ).rejects.toThrow("vuoto");
  });

  it("createCategory should reject name longer than 50 chars", async () => {
    createChain([]);

    const { result } = renderHook(() => useServiceCategories(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await expect(
      act(() => result.current.createCategory({ name: "A".repeat(51) }))
    ).rejects.toThrow("50 caratteri");
  });

  it("createCategory should reject invalid hex color", async () => {
    createChain([]);

    const { result } = renderHook(() => useServiceCategories(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await expect(
      act(() =>
        result.current.createCategory({ name: "Test", color: "not-hex" })
      )
    ).rejects.toThrow("hex");
  });

  it("toggleActive should toggle active field", async () => {
    const cat = makeCategory({ active: true });
    const updatedCat = { ...cat, active: false };

    const chain = createChain([cat]);
    chain.single.mockResolvedValue({ data: updatedCat, error: null });

    const { result } = renderHook(() => useServiceCategories(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.categories).toHaveLength(1);
    });

    await act(() => result.current.toggleActive("cat-1"));

    expect(mockFrom).toHaveBeenCalledWith("service_categories");
    expect(chain.update).toHaveBeenCalled();
  });

  it("createCategory should reject when Free user at limit", async () => {
    const cats = Array.from({ length: FREE_CATEGORY_LIMIT }, (_, i) =>
      makeCategory({ id: `cat-${i}`, name: `Cat ${i}`, active: true })
    );
    createChain(cats);

    const { result } = renderHook(() => useServiceCategories(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.canAddCategory).toBe(false);
    });

    await expect(
      act(() => result.current.createCategory({ name: "Nuova" }))
    ).rejects.toThrow("limite");
  });

  it("toggleActive should reject reactivation when Free user at limit", async () => {
    const cats = [
      ...Array.from({ length: FREE_CATEGORY_LIMIT }, (_, i) =>
        makeCategory({ id: `cat-${i}`, name: `Cat ${i}`, active: true })
      ),
      makeCategory({ id: "cat-inactive", name: "Inattiva", active: false }),
    ];
    createChain(cats);

    const { result } = renderHook(() => useServiceCategories(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.categories).toHaveLength(FREE_CATEGORY_LIMIT + 1);
    });

    await expect(
      act(() => result.current.toggleActive("cat-inactive"))
    ).rejects.toThrow("limite");
  });

  it("updateCategory should update name and set updated_at", async () => {
    const cat = makeCategory();
    const updatedCat = { ...cat, name: "Nuovo Nome", updated_at: "2026-03-29T00:00:00Z" };

    const chain = createChain([cat]);
    chain.single.mockResolvedValue({ data: updatedCat, error: null });

    const { result } = renderHook(() => useServiceCategories(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.categories).toHaveLength(1);
    });

    await act(() =>
      result.current.updateCategory({ id: "cat-1", updates: { name: "Nuovo Nome" } })
    );

    expect(mockFrom).toHaveBeenCalledWith("service_categories");
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Nuovo Nome", updated_at: expect.any(String) })
    );
  });

  it("should not allow unauthenticated user to create", async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      signOut: vi.fn(),
    } as any);
    createChain([]);

    const { result } = renderHook(() => useServiceCategories(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await expect(
      act(() => result.current.createCategory({ name: "Test" }))
    ).rejects.toThrow("Not authenticated");
  });
});
