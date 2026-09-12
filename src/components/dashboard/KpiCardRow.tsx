import { ReactNode } from "react";

interface KpiCardRowProps {
  children: ReactNode;
}

export function KpiCardRow({ children }: KpiCardRowProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {children}
    </div>
  );
}
