import { useState } from "react";
import { Link } from "react-router-dom";
import { Lock, CheckCircle2, Sparkles } from "lucide-react";
import { useProWaitlist } from "@/hooks/useProWaitlist";
import { useLaunchWindow } from "@/hooks/useLaunchWindow";
import { ProWaitlistConsentDialog } from "@/components/subscription/ProWaitlistConsentDialog";

interface UpgradeCTAProps {
  feature: string;
  variant?: "inline" | "banner";
}

export function UpgradeCTA({ feature, variant = "inline" }: UpgradeCTAProps) {
  const { isJoined, isLoading } = useProWaitlist();
  const { isOpen } = useLaunchWindow();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Launch window open → link to pricing page
  if (isOpen) {
    if (variant === "banner") {
      return (
        <Link
          to="/pricing"
          className="flex items-center gap-3 p-4 rounded-lg bg-teal-50/60 border border-teal-200/50 hover:bg-teal-50 transition-colors no-underline"
        >
          <Sparkles className="h-5 w-5 text-teal-600 shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-sm text-slate-900">{feature}</p>
            <p className="text-sm text-teal-700">Disponibile con PRO</p>
          </div>
          <span className="text-sm font-medium text-teal-600 shrink-0">Passa a PRO</span>
        </Link>
      );
    }

    return (
      <Link
        to="/pricing"
        className="inline-flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700 transition-colors"
      >
        <Sparkles className="h-4 w-4" />
        {feature} — Passa a PRO
      </Link>
    );
  }

  if (variant === "banner") {
    if (isLoading) {
      return (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border border-border">
          <Lock className="h-5 w-5 text-muted-foreground shrink-0" />
          <p className="font-medium text-sm">{feature}</p>
        </div>
      );
    }

    if (isJoined) {
      return (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-teal-50/60 border border-teal-200/50">
          <CheckCircle2 className="h-5 w-5 text-teal-600 shrink-0" />
          <div>
            <p className="font-medium text-sm">{feature}</p>
            <p className="text-sm text-teal-700">Sei in lista per PRO</p>
          </div>
        </div>
      );
    }

    return (
      <>
        <div
          className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border border-border cursor-pointer hover:bg-muted/70 transition-colors"
          onClick={() => setDialogOpen(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setDialogOpen(true);
            }
          }}
        >
          <Sparkles className="h-5 w-5 text-sky-600 shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-sm">{feature}</p>
            <p className="text-sm text-muted-foreground">Disponibile con PRO</p>
          </div>
          <span className="text-sm font-medium text-sky-600 shrink-0">Scopri PRO</span>
        </div>
        <ProWaitlistConsentDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      </>
    );
  }

  // Inline variant
  if (isLoading) {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <Lock className="h-4 w-4" />
        {feature} (PRO)
      </span>
    );
  }

  if (isJoined) {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-teal-600">
        <CheckCircle2 className="h-4 w-4" />
        {feature} (PRO)
        <span className="sr-only">— Sei in lista per PRO</span>
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-sky-600 transition-colors cursor-pointer"
        onClick={() => setDialogOpen(true)}
      >
        <Lock className="h-4 w-4" />
        {feature} (PRO)
      </button>
      <ProWaitlistConsentDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
