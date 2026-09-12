import { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  narrow?: boolean;
}

export function PageContainer({
  children,
  narrow,
  className,
  ...rest
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "p-4 sm:p-5 space-y-6 w-full min-w-0",
        narrow ? "max-w-3xl mx-auto" : "max-w-4xl mx-auto",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
