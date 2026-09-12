import { useEffect, useMemo, useState, type RefObject } from "react";
import { getSvgPath } from "figma-squircle";

/**
 * Returns the size of an element via ResizeObserver.
 * SSR-safe: returns {0,0} when window is undefined or ref not yet mounted.
 *
 * Used internally by `useSquirclePath` so the SVG path follows the element
 * as it grows/shrinks (responsive layouts, modal resize, sidebar collapse).
 */
export function useElementSize<T extends HTMLElement>(
  ref: RefObject<T>,
): { width: number; height: number } {
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const element = ref.current;
    if (!element) return;

    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      setSize((prev) => {
        if (prev.width === rect.width && prev.height === rect.height) return prev;
        return { width: rect.width, height: rect.height };
      });
    };

    updateSize();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateSize);
      return () => window.removeEventListener("resize", updateSize);
    }

    let rafId: number | null = null;
    const observer = new ResizeObserver(() => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateSize);
    });
    observer.observe(element);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [ref]);

  return size;
}

export interface UseSquirclePathParams {
  width: number;
  height: number;
  radius: number;
  smoothing: number;
}

/**
 * Returns a memoized SVG path string for a squircle (superellipse) shape.
 * Returns `null` when the element has zero dimensions (pre-mount or hidden),
 * so callers can fall back to standard `border-radius`.
 *
 * The path is generated via `figma-squircle` (~3KB), matching the iOS-style
 * smooth corner curvature. `smoothing` accepts 0..1 (0 = standard rounded,
 * 0.6 = iOS default, 1 = maximum squircle).
 */
export function useSquirclePath({
  width,
  height,
  radius,
  smoothing,
}: UseSquirclePathParams): string | null {
  return useMemo(() => {
    if (width <= 0 || height <= 0) return null;
    if (radius <= 0) return null;
    return getSvgPath({
      width,
      height,
      cornerRadius: radius,
      cornerSmoothing: smoothing,
      preserveSmoothing: true,
    });
  }, [width, height, radius, smoothing]);
}
