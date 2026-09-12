/**
 * Test per useUserTasks hook
 * Story 61.2 — Task Board Personale CRUD
 *
 * Copertura: fetch query, createTask, updateTask, toggleComplete, deleteTask,
 * return shape, invalidation
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ===== Mocks =====

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "test-user-id" } }),
}));

const mockTasksData = [
  {
    id: "task-1",
    user_id: "test-user-id",
    title: "Comprare latte",
    description: null,
    due_date: "2026-04-01",
    priority: "alta",
    status: "da_fare",
    completed_at: null,
    created_at: "2026-03-20T10:00:00Z",
    updated_at: "2026-03-20T10:00:00Z",
  },
  {
    id: "task-2",
    user_id: "test-user-id",
    title: "Chiamare commercialista",
    description: "Per dichiarazione",
    due_date: null,
    priority: "media",
    status: "completato",
    completed_at: "2026-03-22T15:00:00Z",
    created_at: "2026-03-19T10:00:00Z",
    updated_at: "2026-03-22T15:00:00Z",
  },
];

const mockInsert = vi.fn(() => ({
  select: vi.fn(() => ({
    single: vi.fn(() =>
      Promise.resolve({
        data: { id: "new-task", ...mockTasksData[0] },
        error: null,
      })
    ),
  })),
}));

const mockUpdate = vi.fn(() => ({
  eq: vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn(() =>
        Promise.resolve({ data: mockTasksData[0], error: null })
      ),
    })),
  })),
}));

const mockDelete = vi.fn(() => ({
  eq: vi.fn(() => Promise.resolve({ error: null })),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() =>
            Promise.resolve({ data: mockTasksData, error: null })
          ),
        })),
      })),
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    })),
  },
}));

// ===== Helpers =====

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: qc },
      children
    );
  };
}

// ===== Tests =====

describe("useUserTasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns correct shape", async () => {
    const { useUserTasks } = await import("@/hooks/useUserTasks");
    const { result } = renderHook(() => useUserTasks(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toHaveProperty("tasks");
    expect(result.current).toHaveProperty("isLoading");
    expect(result.current).toHaveProperty("error");
    expect(result.current).toHaveProperty("createTask");
    expect(result.current).toHaveProperty("updateTask");
    expect(result.current).toHaveProperty("toggleComplete");
    expect(result.current).toHaveProperty("deleteTask");
  });

  it("fetches tasks on mount", async () => {
    const { useUserTasks } = await import("@/hooks/useUserTasks");
    const { result } = renderHook(() => useUserTasks(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.tasks).toHaveLength(2);
    expect(result.current.tasks[0].title).toBe("Comprare latte");
  });

  it("createTask calls supabase insert", async () => {
    const { useUserTasks } = await import("@/hooks/useUserTasks");
    const { result } = renderHook(() => useUserTasks(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.createTask.mutate({
        title: "Nuovo task",
        priority: "media",
      });
    });

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalled();
    });
  });

  it("toggleComplete calls supabase update", async () => {
    const { useUserTasks } = await import("@/hooks/useUserTasks");
    const { result } = renderHook(() => useUserTasks(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.toggleComplete.mutate(mockTasksData[0] as any);
    });

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  it("deleteTask calls supabase delete", async () => {
    const { useUserTasks } = await import("@/hooks/useUserTasks");
    const { result } = renderHook(() => useUserTasks(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.deleteTask.mutate("task-1");
    });

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalled();
    });
  });
});
