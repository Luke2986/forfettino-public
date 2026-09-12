import * as React from "react";

import { cn } from "@/lib/utils";
import { Squircle } from "@/components/ui/squircle";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * When true, wraps `children` in `<Squircle>` (radius=16, smoothing=0.6)
   * applying iOS-style superellipse corners. Outer `<div>` retains
   * `rounded-2xl border shadow-sm` so shadow + border are not clipped.
   * Default: `false` (backward compat).
   * Epic 81 — Squircle Design System (Story 81-2).
   */
  squircle?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, squircle = false, children, ...props }, ref) => {
    if (squircle) {
      return (
        <div
          ref={ref}
          className={cn("rounded-2xl border shadow-sm", className)}
          {...props}
        >
          <Squircle radius={16} smoothing={0.6} className="bg-card text-card-foreground">
            {children}
          </Squircle>
        </div>
      );
    }
    return (
      <div
        ref={ref}
        className={cn("rounded-2xl border bg-card text-card-foreground shadow-sm", className)}
        {...props}
      >
        {children}
      </div>
    );
  },
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...props} />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />,
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
