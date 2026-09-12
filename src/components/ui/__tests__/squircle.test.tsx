import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, render, act } from "@testing-library/react";
import { createRef, useRef } from "react";

import { Squircle } from "../squircle";
import { useElementSize, useSquirclePath } from "@/hooks/useSquirclePath";

describe("Squircle component", () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 320,
      height: 200,
      top: 0,
      left: 0,
      right: 320,
      bottom: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders default div with children", () => {
    const { getByTestId } = render(
      <Squircle data-testid="squircle">content</Squircle>,
    );
    const el = getByTestId("squircle");
    expect(el.tagName).toBe("DIV");
    expect(el.textContent).toBe("content");
  });

  it("applies clip-path inline style when path is generated", () => {
    const { getByTestId } = render(
      <Squircle data-testid="squircle" radius={16} smoothing={0.6}>
        x
      </Squircle>,
    );
    const el = getByTestId("squircle") as HTMLElement;
    expect(el.style.clipPath).toMatch(/^path\(/);
    expect(el.style.borderRadius).toBe("16px");
  });

  it("renders custom element via `as` prop", () => {
    const { getByTestId } = render(
      <Squircle as="section" data-testid="squircle">
        x
      </Squircle>,
    );
    expect(getByTestId("squircle").tagName).toBe("SECTION");
  });

  it("forwards ref to the rendered element", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Squircle ref={ref as never} data-testid="squircle">
        x
      </Squircle>,
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it("falls back to border-radius when dimensions are zero", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 0,
      height: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const { getByTestId } = render(
      <Squircle data-testid="squircle" radius={20}>
        x
      </Squircle>,
    );
    const el = getByTestId("squircle") as HTMLElement;
    expect(el.style.clipPath).toBe("");
    expect(el.style.borderRadius).toBe("20px");
  });

  it("merges user-provided inline styles", () => {
    const { getByTestId } = render(
      <Squircle
        data-testid="squircle"
        radius={16}
        style={{ backgroundColor: "rgb(255, 0, 0)", padding: "12px" }}
      >
        x
      </Squircle>,
    );
    const el = getByTestId("squircle") as HTMLElement;
    expect(el.style.backgroundColor).toBe("rgb(255, 0, 0)");
    expect(el.style.padding).toBe("12px");
    expect(el.style.borderRadius).toBe("16px");
  });

  it("preserves className", () => {
    const { getByTestId } = render(
      <Squircle data-testid="squircle" className="bg-white p-4">
        x
      </Squircle>,
    );
    expect(getByTestId("squircle").className).toBe("bg-white p-4");
  });
});

describe("useSquirclePath hook", () => {
  it("returns a SVG path string for valid dimensions", () => {
    const { result } = renderHook(() =>
      useSquirclePath({ width: 320, height: 200, radius: 16, smoothing: 0.6 }),
    );
    expect(typeof result.current).toBe("string");
    expect(result.current).toMatch(/^M /);
  });

  it("returns null for zero width", () => {
    const { result } = renderHook(() =>
      useSquirclePath({ width: 0, height: 200, radius: 16, smoothing: 0.6 }),
    );
    expect(result.current).toBeNull();
  });

  it("returns null for zero height", () => {
    const { result } = renderHook(() =>
      useSquirclePath({ width: 320, height: 0, radius: 16, smoothing: 0.6 }),
    );
    expect(result.current).toBeNull();
  });

  it("returns null for zero radius", () => {
    const { result } = renderHook(() =>
      useSquirclePath({ width: 320, height: 200, radius: 0, smoothing: 0.6 }),
    );
    expect(result.current).toBeNull();
  });

  it("returns different paths for different smoothing values", () => {
    const { result: low } = renderHook(() =>
      useSquirclePath({ width: 320, height: 200, radius: 16, smoothing: 0 }),
    );
    const { result: high } = renderHook(() =>
      useSquirclePath({ width: 320, height: 200, radius: 16, smoothing: 1 }),
    );
    expect(low.current).not.toBe(high.current);
  });
});

describe("Squircle feature flag (AC #6)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("does NOT apply clip-path when VITE_SQUIRCLE_ENABLED=false", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 320,
      height: 200,
      top: 0,
      left: 0,
      right: 320,
      bottom: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    vi.stubEnv("VITE_SQUIRCLE_ENABLED", "false");
    vi.resetModules();
    const { Squircle: SquircleDisabled } = await import("../squircle");
    const { getByTestId } = render(
      <SquircleDisabled data-testid="sq" radius={20}>
        x
      </SquircleDisabled>,
    );
    const el = getByTestId("sq") as HTMLElement;
    expect(el.style.clipPath).toBe("");
    expect(el.style.borderRadius).toBe("20px");
  });
});

describe("useSquirclePath smoothing=0 (AC #7)", () => {
  it("smoothing=0 produces a deterministic standard rounded-rectangle path", () => {
    const { result } = renderHook(() =>
      useSquirclePath({ width: 200, height: 100, radius: 16, smoothing: 0 }),
    );
    expect(result.current).toMatch(/^M /);
    const { result: zeroAgain } = renderHook(() =>
      useSquirclePath({ width: 200, height: 100, radius: 16, smoothing: 0 }),
    );
    expect(result.current).toBe(zeroAgain.current);
  });
});

describe("useElementSize ResizeObserver throttling (AC #7)", () => {
  it("recomputes size when ResizeObserver triggers (RAF throttled)", async () => {
    let observerCallback: ResizeObserverCallback | null = null;
    class MockResizeObserver {
      constructor(cb: ResizeObserverCallback) {
        observerCallback = cb;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 0;
    });

    const rect = {
      width: 100,
      height: 50,
      top: 0,
      left: 0,
      right: 100,
      bottom: 50,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    };
    const getBCR = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue(rect);

    const div = document.createElement("div");
    document.body.appendChild(div);

    const { result, rerender } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(null);
      Object.defineProperty(ref, "current", { value: div, writable: false });
      return useElementSize(ref);
    });

    expect(result.current).toEqual({ width: 100, height: 50 });
    expect(observerCallback).not.toBeNull();

    getBCR.mockReturnValue({ ...rect, width: 250, height: 120 });
    act(() => {
      observerCallback!([] as unknown as ResizeObserverEntry[], {} as ResizeObserver);
    });
    rerender();

    expect(result.current).toEqual({ width: 250, height: 120 });

    document.body.removeChild(div);
    vi.unstubAllGlobals();
  });
});

describe("useElementSize hook", () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 100,
      height: 50,
      top: 0,
      left: 0,
      right: 100,
      bottom: 50,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns measured size from getBoundingClientRect on mount", () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(null);
      const div = document.createElement("div");
      Object.defineProperty(ref, "current", { value: div, writable: false });
      return useElementSize(ref);
    });
    expect(result.current.width).toBe(100);
    expect(result.current.height).toBe(50);
  });

  it("returns {0,0} when ref is not attached", () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(null);
      return useElementSize(ref);
    });
    expect(result.current).toEqual({ width: 0, height: 0 });
  });
});
