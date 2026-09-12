import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRpc = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: mockRpc,
  },
}));

import { trackSession } from "./session-tracker";

describe("trackSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls supabase.rpc with increment_user_session", () => {
    mockRpc.mockReturnValue(Promise.resolve({ data: null, error: null }));

    trackSession();

    expect(mockRpc).toHaveBeenCalledWith("increment_user_session");
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it("does not throw on rpc failure (fail-silent)", () => {
    mockRpc.mockReturnValue(Promise.reject(new Error("network error")));

    // Should not throw
    expect(() => trackSession()).not.toThrow();
  });

  it("can be called multiple times", () => {
    mockRpc.mockReturnValue(Promise.resolve({ data: null, error: null }));

    trackSession();
    trackSession();

    expect(mockRpc).toHaveBeenCalledTimes(2);
  });
});
