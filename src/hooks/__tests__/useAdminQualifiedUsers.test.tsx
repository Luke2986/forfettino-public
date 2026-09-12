/**
 * Test per useAdminQualifiedUsers
 * Story 41.2 — Admin: Export utenti qualificati con email
 *
 * Copertura:
 * - Hook chiama RPC con p_min_receipts corretto
 * - Mapping snake_case → camelCase
 * - Soglia diversa aggiorna query key
 * - Propaga errore RPC
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const mockRpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

import { useAdminQualifiedUsers } from "../useAdminQualifiedUsers";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const MOCK_USERS = [
  {
    user_id: "u1",
    email: "luca@example.com",
    first_name: "Luca",
    user_code: "26AB1234",
    receipt_count: 5,
    inps_type: "gestione_separata",
    created_at: "2026-01-15T10:00:00Z",
    email_consent: true,
  },
  {
    user_id: "u2",
    email: "anna@example.com",
    first_name: null,
    user_code: "26CD5678",
    receipt_count: 3,
    inps_type: null,
    created_at: "2026-02-20T08:30:00Z",
    email_consent: true,
  },
];

describe("useAdminQualifiedUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("chiama RPC con p_min_receipts e mappa risultato correttamente", async () => {
    mockRpc.mockResolvedValue({ data: MOCK_USERS, error: null });

    const { result } = renderHook(
      () => useAdminQualifiedUsers(3),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRpc).toHaveBeenCalledWith(
      "get_admin_qualified_users",
      { p_min_receipts: 3 },
    );

    expect(result.current.data).toEqual([
      {
        userId: "u1",
        email: "luca@example.com",
        firstName: "Luca",
        userCode: "26AB1234",
        receiptCount: 5,
        inpsType: "gestione_separata",
        createdAt: "2026-01-15T10:00:00Z",
        emailConsent: true,
      },
      {
        userId: "u2",
        email: "anna@example.com",
        firstName: null,
        userCode: "26CD5678",
        receiptCount: 3,
        inpsType: null,
        createdAt: "2026-02-20T08:30:00Z",
        emailConsent: true,
      },
    ]);
  });

  it("passa soglia diversa alla RPC", async () => {
    mockRpc.mockResolvedValue({ data: [MOCK_USERS[0]], error: null });

    const { result } = renderHook(
      () => useAdminQualifiedUsers(5),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRpc).toHaveBeenCalledWith(
      "get_admin_qualified_users",
      { p_min_receipts: 5 },
    );
    expect(result.current.data).toHaveLength(1);
  });

  it("restituisce array vuoto se nessun utente qualificato", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(
      () => useAdminQualifiedUsers(10),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it("non chiama la RPC quando la query e' disabilitata", async () => {
    const { result } = renderHook(
      () => useAdminQualifiedUsers(3, false),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("propaga errore RPC", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "Unauthorized: admin role required" },
    });

    const { result } = renderHook(
      () => useAdminQualifiedUsers(3),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeTruthy();
  });
});
