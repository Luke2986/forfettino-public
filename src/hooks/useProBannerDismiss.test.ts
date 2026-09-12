import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useProBannerDismiss } from "./useProBannerDismiss";

describe("useProBannerDismiss", () => {
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

  it("returns isDismissed=false when sessionStorage has no entry", () => {
    const { result } = renderHook(() => useProBannerDismiss("test-trigger"));
    expect(result.current.isDismissed).toBe(false);
    expect(sessionStorage.getItem).toHaveBeenCalledWith(
      "pro-banner-dismissed-test-trigger"
    );
  });

  it("returns isDismissed=true when sessionStorage has the key", () => {
    mockStorage["pro-banner-dismissed-my-trigger"] = "true";
    const { result } = renderHook(() => useProBannerDismiss("my-trigger"));
    expect(result.current.isDismissed).toBe(true);
  });

  it("dismiss() writes to sessionStorage and updates state", () => {
    const { result } = renderHook(() => useProBannerDismiss("banner-x"));
    expect(result.current.isDismissed).toBe(false);

    act(() => {
      result.current.dismiss();
    });

    expect(result.current.isDismissed).toBe(true);
    expect(sessionStorage.setItem).toHaveBeenCalledWith(
      "pro-banner-dismissed-banner-x",
      "true"
    );
  });

  it("uses different keys for different triggerIds", () => {
    const { result: r1 } = renderHook(() => useProBannerDismiss("a"));
    const { result: r2 } = renderHook(() => useProBannerDismiss("b"));

    act(() => {
      r1.current.dismiss();
    });

    expect(r1.current.isDismissed).toBe(true);
    expect(r2.current.isDismissed).toBe(false);
  });

  it("handles sessionStorage errors gracefully (SSR/incognito)", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: vi.fn(() => {
        throw new Error("SecurityError");
      }),
      setItem: vi.fn(() => {
        throw new Error("SecurityError");
      }),
      removeItem: vi.fn(),
    });

    const { result } = renderHook(() => useProBannerDismiss("safe"));
    expect(result.current.isDismissed).toBe(false);

    // dismiss should not throw
    act(() => {
      result.current.dismiss();
    });
    // State still updates even if sessionStorage throws
    expect(result.current.isDismissed).toBe(true);
  });
});
