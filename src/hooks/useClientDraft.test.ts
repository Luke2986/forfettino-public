import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useClientDraft, type ClientFormDraft } from "./useClientDraft";

const sampleDraft: ClientFormDraft = {
  display_name: "Mario Rossi",
  legal_name: "Acme Srl",
  vat_number: "12345678901",
  tax_code: "RSSMRA80A01H501Z",
  email: "mario@acme.it",
  phone: "+39 333 1234567",
  address_text: "Via Roma 1, Milano",
  notes: "VIP",
  active: true,
};

describe("useClientDraft", () => {
  let mockStorage: Record<string, string>;

  beforeEach(() => {
    mockStorage = {};
    vi.stubGlobal("sessionStorage", {
      getItem: vi.fn((key: string) => mockStorage[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        mockStorage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStorage[key];
      }),
    });
  });

  describe("initial read", () => {
    it("returns draft=null when sessionStorage has no entry", () => {
      const { result } = renderHook(() =>
        useClientDraft({ userId: "u1", clientId: null, enabled: true }),
      );
      expect(result.current.draft).toBeNull();
      expect(result.current.hasDraft).toBe(false);
    });

    it("returns draft=null when enabled=false", () => {
      mockStorage["forfettino:client-draft:u1:new"] = JSON.stringify(sampleDraft);
      const { result } = renderHook(() =>
        useClientDraft({ userId: "u1", clientId: null, enabled: false }),
      );
      expect(result.current.draft).toBeNull();
    });

    it("returns draft=null when userId undefined", () => {
      mockStorage["forfettino:client-draft:undefined:new"] = JSON.stringify(sampleDraft);
      const { result } = renderHook(() =>
        useClientDraft({ userId: undefined, clientId: null, enabled: true }),
      );
      expect(result.current.draft).toBeNull();
    });

    it("reads parsed draft for userId+clientId=null (new)", () => {
      mockStorage["forfettino:client-draft:u1:new"] = JSON.stringify(sampleDraft);
      const { result } = renderHook(() =>
        useClientDraft({ userId: "u1", clientId: null, enabled: true }),
      );
      expect(result.current.draft).toEqual(sampleDraft);
      expect(result.current.hasDraft).toBe(true);
    });

    it("reads parsed draft for userId+clientId=<id>", () => {
      mockStorage["forfettino:client-draft:u1:c-42"] = JSON.stringify(sampleDraft);
      const { result } = renderHook(() =>
        useClientDraft({ userId: "u1", clientId: "c-42", enabled: true }),
      );
      expect(result.current.draft).toEqual(sampleDraft);
    });

    it("returns draft=null for corrupt JSON", () => {
      mockStorage["forfettino:client-draft:u1:new"] = "{not json";
      const { result } = renderHook(() =>
        useClientDraft({ userId: "u1", clientId: null, enabled: true }),
      );
      expect(result.current.draft).toBeNull();
    });

    it("returns draft=null for invalid shape (missing fields)", () => {
      mockStorage["forfettino:client-draft:u1:new"] = JSON.stringify({
        display_name: "X",
        // legal_name e altri mancanti
      });
      const { result } = renderHook(() =>
        useClientDraft({ userId: "u1", clientId: null, enabled: true }),
      );
      expect(result.current.draft).toBeNull();
    });

    it("returns draft=null for invalid shape (wrong types)", () => {
      mockStorage["forfettino:client-draft:u1:new"] = JSON.stringify({
        ...sampleDraft,
        active: "yes", // string instead of boolean
      });
      const { result } = renderHook(() =>
        useClientDraft({ userId: "u1", clientId: null, enabled: true }),
      );
      expect(result.current.draft).toBeNull();
    });
  });

  describe("saveDraft", () => {
    it("writes to sessionStorage under the correct key (new)", () => {
      const { result } = renderHook(() =>
        useClientDraft({ userId: "u1", clientId: null, enabled: true }),
      );
      act(() => {
        result.current.saveDraft(sampleDraft);
      });
      expect(sessionStorage.setItem).toHaveBeenCalledWith(
        "forfettino:client-draft:u1:new",
        JSON.stringify(sampleDraft),
      );
      expect(mockStorage["forfettino:client-draft:u1:new"]).toBe(
        JSON.stringify(sampleDraft),
      );
    });

    it("writes to sessionStorage under the correct key (edit)", () => {
      const { result } = renderHook(() =>
        useClientDraft({ userId: "u1", clientId: "c-42", enabled: true }),
      );
      act(() => {
        result.current.saveDraft(sampleDraft);
      });
      expect(mockStorage["forfettino:client-draft:u1:c-42"]).toBe(
        JSON.stringify(sampleDraft),
      );
    });

    it("no-ops when enabled=false", () => {
      const { result } = renderHook(() =>
        useClientDraft({ userId: "u1", clientId: null, enabled: false }),
      );
      act(() => {
        result.current.saveDraft(sampleDraft);
      });
      expect(sessionStorage.setItem).not.toHaveBeenCalled();
      expect(Object.keys(mockStorage)).toHaveLength(0);
    });

    it("no-ops when userId undefined", () => {
      const { result } = renderHook(() =>
        useClientDraft({ userId: undefined, clientId: null, enabled: true }),
      );
      act(() => {
        result.current.saveDraft(sampleDraft);
      });
      expect(sessionStorage.setItem).not.toHaveBeenCalled();
    });

    it("does not mutate local draft state (restore happens on next mount/key change)", () => {
      const { result } = renderHook(() =>
        useClientDraft({ userId: "u1", clientId: null, enabled: true }),
      );
      expect(result.current.draft).toBeNull();
      act(() => {
        result.current.saveDraft(sampleDraft);
      });
      // Storage updated but local draft state stays null
      expect(result.current.draft).toBeNull();
      expect(mockStorage["forfettino:client-draft:u1:new"]).toBeDefined();
    });
  });

  describe("clearDraft", () => {
    it("removes sessionStorage entry and resets state to null", () => {
      mockStorage["forfettino:client-draft:u1:new"] = JSON.stringify(sampleDraft);
      const { result } = renderHook(() =>
        useClientDraft({ userId: "u1", clientId: null, enabled: true }),
      );
      expect(result.current.draft).toEqual(sampleDraft);

      act(() => {
        result.current.clearDraft();
      });

      expect(sessionStorage.removeItem).toHaveBeenCalledWith(
        "forfettino:client-draft:u1:new",
      );
      expect(mockStorage["forfettino:client-draft:u1:new"]).toBeUndefined();
      expect(result.current.draft).toBeNull();
      expect(result.current.hasDraft).toBe(false);
    });

    it("is a no-op on storage when key is null (still resets state)", () => {
      const { result } = renderHook(() =>
        useClientDraft({ userId: undefined, clientId: null, enabled: true }),
      );
      act(() => {
        result.current.clearDraft();
      });
      expect(sessionStorage.removeItem).not.toHaveBeenCalled();
      expect(result.current.draft).toBeNull();
    });
  });

  describe("key isolation", () => {
    it("different clientIds use different keys", () => {
      mockStorage["forfettino:client-draft:u1:c-A"] = JSON.stringify(sampleDraft);

      const { result: rA } = renderHook(() =>
        useClientDraft({ userId: "u1", clientId: "c-A", enabled: true }),
      );
      const { result: rB } = renderHook(() =>
        useClientDraft({ userId: "u1", clientId: "c-B", enabled: true }),
      );

      expect(rA.current.draft).toEqual(sampleDraft);
      expect(rB.current.draft).toBeNull();
    });

    it("different userIds use different keys", () => {
      mockStorage["forfettino:client-draft:u1:new"] = JSON.stringify(sampleDraft);

      const { result: r1 } = renderHook(() =>
        useClientDraft({ userId: "u1", clientId: null, enabled: true }),
      );
      const { result: r2 } = renderHook(() =>
        useClientDraft({ userId: "u2", clientId: null, enabled: true }),
      );

      expect(r1.current.draft).toEqual(sampleDraft);
      expect(r2.current.draft).toBeNull();
    });

    it("'new' (clientId=null) is isolated from an edit draft", () => {
      mockStorage["forfettino:client-draft:u1:new"] = JSON.stringify({
        ...sampleDraft,
        display_name: "Draft NEW",
      });
      mockStorage["forfettino:client-draft:u1:c-7"] = JSON.stringify({
        ...sampleDraft,
        display_name: "Draft EDIT",
      });

      const { result: rNew } = renderHook(() =>
        useClientDraft({ userId: "u1", clientId: null, enabled: true }),
      );
      const { result: rEdit } = renderHook(() =>
        useClientDraft({ userId: "u1", clientId: "c-7", enabled: true }),
      );

      expect(rNew.current.draft?.display_name).toBe("Draft NEW");
      expect(rEdit.current.draft?.display_name).toBe("Draft EDIT");
    });
  });

  describe("re-read on key change", () => {
    it("updates draft when clientId changes", () => {
      mockStorage["forfettino:client-draft:u1:c-A"] = JSON.stringify({
        ...sampleDraft,
        display_name: "A",
      });
      mockStorage["forfettino:client-draft:u1:c-B"] = JSON.stringify({
        ...sampleDraft,
        display_name: "B",
      });

      const { result, rerender } = renderHook(
        ({ clientId }: { clientId: string }) =>
          useClientDraft({ userId: "u1", clientId, enabled: true }),
        { initialProps: { clientId: "c-A" } },
      );

      expect(result.current.draft?.display_name).toBe("A");

      rerender({ clientId: "c-B" });
      expect(result.current.draft?.display_name).toBe("B");
    });

    it("re-reads when enabled flips from false to true", () => {
      mockStorage["forfettino:client-draft:u1:new"] = JSON.stringify(sampleDraft);

      const { result, rerender } = renderHook(
        ({ enabled }: { enabled: boolean }) =>
          useClientDraft({ userId: "u1", clientId: null, enabled }),
        { initialProps: { enabled: false } },
      );

      expect(result.current.draft).toBeNull();

      rerender({ enabled: true });
      expect(result.current.draft).toEqual(sampleDraft);
    });
  });

  describe("resilience (sessionStorage errors)", () => {
    it("returns draft=null when getItem throws (incognito/SecurityError)", () => {
      vi.stubGlobal("sessionStorage", {
        getItem: vi.fn(() => {
          throw new Error("SecurityError");
        }),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      });

      const { result } = renderHook(() =>
        useClientDraft({ userId: "u1", clientId: null, enabled: true }),
      );
      expect(result.current.draft).toBeNull();
    });

    it("does not throw when setItem fails (quota/SSR)", () => {
      vi.stubGlobal("sessionStorage", {
        getItem: vi.fn(() => null),
        setItem: vi.fn(() => {
          throw new Error("QuotaExceeded");
        }),
        removeItem: vi.fn(),
      });

      const { result } = renderHook(() =>
        useClientDraft({ userId: "u1", clientId: null, enabled: true }),
      );

      expect(() => {
        act(() => {
          result.current.saveDraft(sampleDraft);
        });
      }).not.toThrow();
    });

    it("does not throw when removeItem fails", () => {
      vi.stubGlobal("sessionStorage", {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(() => {
          throw new Error("SecurityError");
        }),
      });

      const { result } = renderHook(() =>
        useClientDraft({ userId: "u1", clientId: null, enabled: true }),
      );

      expect(() => {
        act(() => {
          result.current.clearDraft();
        });
      }).not.toThrow();
      expect(result.current.draft).toBeNull();
    });
  });
});
