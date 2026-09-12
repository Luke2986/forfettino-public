/**
 * Test per src/lib/clients.ts
 * Story 86-1 — Fix associazione incasso→cliente (modifica + import fatture)
 *
 * Copertura:
 * - Task 1: resolveClientId find-or-create
 * - AC2: nome nuovo => crea cliente con name E display_name
 * - AC3: nome vuoto => null (svuotamento campo)
 * - AC10: match su cliente disattivato => nessun duplicato (D7)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ===== vi.mock (hoisted) =====
const mockLimit = vi.fn<any>();
const mockSingle = vi.fn<any>();
const mockInsertSelect = vi.fn<any>(() => ({ single: mockSingle }));
const mockInsert = vi.fn<any>(() => ({ select: mockInsertSelect }));

const mockOrder = vi.fn<any>(() => ({ limit: mockLimit }));
const mockIlike = vi.fn<any>(() => ({ order: mockOrder }));
const mockEq = vi.fn<any>(() => ({ ilike: mockIlike }));
const mockSelect = vi.fn<any>(() => ({ eq: mockEq }));
const mockFrom = vi.fn<any>(() => ({ select: mockSelect, insert: mockInsert }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => mockFrom(table) },
}));

import { resolveClientId } from "./clients";

const USER_ID = "user-1";

describe("resolveClientId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimit.mockResolvedValue({ data: [], error: null });
    mockSingle.mockResolvedValue({ data: { id: "new-client" }, error: null });
  });

  it("returns null for an empty name without querying", async () => {
    const result = await resolveClientId(USER_ID, "   ");
    expect(result).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("reuses an existing client on case-insensitive match", async () => {
    mockLimit.mockResolvedValue({ data: [{ id: "existing-1" }], error: null });

    const result = await resolveClientId(USER_ID, "  ABM  ");

    expect(result).toBe("existing-1");
    expect(mockIlike).toHaveBeenCalledWith("display_name", "ABM");
    expect(mockInsert).not.toHaveBeenCalled();
  });

  // D7: il lookup NON filtra su active — un cliente disattivato omonimo
  // veniva ignorato e generava un duplicato.
  it("reuses a deactivated client instead of creating a duplicate", async () => {
    mockLimit.mockResolvedValue({ data: [{ id: "inactive-1" }], error: null });

    const result = await resolveClientId(USER_ID, "Cliente Sospeso");

    expect(result).toBe("inactive-1");
    expect(mockInsert).not.toHaveBeenCalled();
    // nessuna chiamata .eq("active", true) nel lookup
    expect(mockEq).toHaveBeenCalledWith("user_id", USER_ID);
    expect(mockEq).not.toHaveBeenCalledWith("active", true);
  });

  it("creates a client with both name and display_name when no match", async () => {
    mockLimit.mockResolvedValue({ data: [], error: null });

    const result = await resolveClientId(USER_ID, "  Nuovo Cliente  ");

    expect(result).toBe("new-client");
    const payload = mockInsert.mock.calls[0]?.[0] as Record<string, any>;
    // `name` e' legacy ma NOT NULL: ometterlo fa fallire l'insert
    expect(payload.name).toBe("Nuovo Cliente");
    expect(payload.display_name).toBe("Nuovo Cliente");
    expect(payload.user_id).toBe(USER_ID);
    expect(payload.active).toBe(true);
  });

  it("orders by created_at so homonyms resolve deterministically", async () => {
    mockLimit.mockResolvedValue({ data: [{ id: "oldest" }], error: null });

    await resolveClientId(USER_ID, "Mario Rossi");

    expect(mockOrder).toHaveBeenCalledWith("created_at", { ascending: true });
  });

  it("propagates a lookup error", async () => {
    mockLimit.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(resolveClientId(USER_ID, "X")).rejects.toBeDefined();
  });

  it("propagates an insert error", async () => {
    mockLimit.mockResolvedValue({ data: [], error: null });
    mockSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(resolveClientId(USER_ID, "X")).rejects.toBeDefined();
  });
});
