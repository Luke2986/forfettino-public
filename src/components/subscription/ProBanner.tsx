import { useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { useUserRole } from "@/hooks/useUserRole";
import { useProWaitlist } from "@/hooks/useProWaitlist";
import { useLaunchWindow } from "@/hooks/useLaunchWindow";
import { useProBannerDismiss } from "@/hooks/useProBannerDismiss";
import { ProWaitlistConsentDialog } from "@/components/subscription/ProWaitlistConsentDialog";

interface ProBannerProps {
  triggerId: string;
  title: string;
  description: string;
  onCtaClick?: () => void;
}

export function ProBanner({
  triggerId,
  title,
  description,
  onCtaClick,
}: ProBannerProps) {
  const { isPro } = useSubscription();
  const { data: userRole } = useUserRole();
  const { isJoined } = useProWaitlist();
  const { isOpen } = useLaunchWindow();
  const { isDismissed, dismiss } = useProBannerDismiss(triggerId);
  const [dialogOpen, setDialogOpen] = useState(false);

  const isAdmin = userRole === "admin";

  // AC #4: hide for Pro users and admins
  if (isPro || isAdmin) return null;

  // AC #5: hide if dismissed this session
  if (isDismissed) return null;

  // AC #1, #2: default variant with CTA and dismiss
  const handleCtaClick = () => {
    if (onCtaClick) {
      onCtaClick();
    } else {
      setDialogOpen(true);
    }
  };

  // AC #3: joined variant — soft message, no dismiss (only when launch window closed)
  if (isJoined && !isOpen) {
    return (
      <div className="flex items-center gap-3 bg-sky-50 border border-sky-200/60 rounded-2xl p-4 sm:p-5">
        <Sparkles className="h-5 w-5 text-sky-600 shrink-0" />
        <p className="text-sm text-slate-700 flex-1">
          Sei in lista per PRO — ti avviseremo al lancio.{" "}
          <Link
            to="/impostazioni?tab=abbonamento"
            className="font-medium text-sky-600 hover:text-sky-700 underline underline-offset-2"
          >
            Vedi i dettagli
          </Link>
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-start gap-3 bg-sky-50 border border-sky-200/60 rounded-2xl p-4 sm:p-5">
        <Sparkles className="h-5 w-5 text-sky-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="text-sm text-slate-600 mt-0.5">{description}</p>
          {isOpen ? (
            <Link
              to="/pricing"
              className="inline-block mt-1.5 text-sm font-medium text-teal-600 hover:text-teal-700"
            >
              Vedi i piani PRO
            </Link>
          ) : (
            <Button
              variant="link"
              className="h-auto p-0 mt-1.5 text-sm font-medium text-sky-600 hover:text-sky-700"
              onClick={handleCtaClick}
            >
              Scopri PRO
            </Button>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="text-slate-500 hover:text-slate-600 shrink-0"
          aria-label="Chiudi"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {!isOpen && (
        <ProWaitlistConsentDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      )}
    </>
  );
}
