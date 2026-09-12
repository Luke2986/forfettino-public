import {
  forwardRef,
  useRef,
  type CSSProperties,
  type ElementType,
  type HTMLAttributes,
  type MutableRefObject,
  type RefObject,
} from "react";

import { useElementSize, useSquirclePath } from "@/hooks/useSquirclePath";

const SQUIRCLE_FEATURE_FLAG =
  (import.meta.env.VITE_SQUIRCLE_ENABLED ?? "true") !== "false";

export interface SquircleProps extends HTMLAttributes<HTMLElement> {
  /** Corner radius in pixels. Default 16 (matches `--squircle-radius-lg`). */
  radius?: number;
  /** Corner smoothing 0..1. Default 0.6 (iOS-style). */
  smoothing?: number;
  /** HTML element type. Default `div`. */
  as?: ElementType;
}

function mergeRefs<T>(
  ...refs: Array<RefObject<T> | ((instance: T | null) => void) | null | undefined>
) {
  return (instance: T | null) => {
    refs.forEach((ref) => {
      if (!ref) return;
      if (typeof ref === "function") {
        ref(instance);
      } else {
        (ref as MutableRefObject<T | null>).current = instance;
      }
    });
  };
}

/**
 * Squircle wrapper — renders any element with an iOS-style superellipse shape
 * via SVG `clip-path`. Cross-browser support ~96% (Chrome, Safari 13.1+,
 * Firefox, Edge, iOS Safari 13.4+, Chrome Android). Older browsers fall back
 * to `border-radius`.
 *
 * Falls back to standard `border-radius` when:
 * - Element has zero dimensions (pre-mount, hidden, SSR)
 * - `VITE_SQUIRCLE_ENABLED=false` env var at BUILD TIME (Vite static replace —
 *   runtime toggle requires rebuild + redeploy, not env-var swap on server)
 *
 * `clip-path` clips both shadows AND CSS borders. Patterns:
 * - Shadow + squircle: wrap `<Squircle>` inside outer `<div>` with `rounded-2xl
 *   shadow-...`. Outer carries shadow, inner carries squircle clip.
 * - Border + squircle: use `outline` or ring shadow (`shadow-[0_0_0_1px_...]`)
 *   instead of CSS `border-*` (clipped silently).
 *
 * @example
 * <Squircle radius={24} smoothing={0.6} className="bg-white p-6">
 *   <h2>Hero card</h2>
 * </Squircle>
 *
 * @example with shadow wrapper pattern
 * <div className="rounded-2xl shadow-elevated">
 *   <Squircle radius={24} className="bg-white p-6">...</Squircle>
 * </div>
 */
export const Squircle = forwardRef<HTMLElement, SquircleProps>(
  (
    {
      radius = 16,
      smoothing = 0.6,
      as: Component = "div",
      className,
      style,
      children,
      ...rest
    },
    forwardedRef,
  ) => {
    const innerRef = useRef<HTMLElement>(null);
    const { width, height } = useElementSize(innerRef);
    const path = useSquirclePath({ width, height, radius, smoothing });

    const squircleStyle: CSSProperties =
      SQUIRCLE_FEATURE_FLAG && path
        ? { clipPath: `path('${path}')`, borderRadius: radius, ...style }
        : { borderRadius: radius, ...style };

    return (
      <Component
        ref={mergeRefs(forwardedRef, innerRef)}
        className={className}
        style={squircleStyle}
        {...rest}
      >
        {children}
      </Component>
    );
  },
);

Squircle.displayName = "Squircle";
