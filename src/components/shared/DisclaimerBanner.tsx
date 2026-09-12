import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface DisclaimerBannerProps {
  className?: string;
}

export function DisclaimerBanner({ className }: DisclaimerBannerProps) {
  return (
    <div
      className={cn(
        "flex gap-2 items-start text-xs text-v2-text-tertiary",
        className
      )}
    >
      <Info className="h-3 w-3 shrink-0 mt-0.5 text-v2-text-tertiary" />
      <p>
        Stime indicative per la tua pianificazione. Non sostituiscono la
        consulenza del commercialista.
      </p>
    </div>
  );
}
