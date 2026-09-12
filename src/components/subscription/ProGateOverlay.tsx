import { useCallback, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Lock, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { useUserRole } from "@/hooks/useUserRole";
import { useProWaitlist } from "@/hooks/useProWaitlist";
import { useLaunchWindow } from "@/hooks/useLaunchWindow";
import { ProWaitlistConsentDialog } from "@/components/subscription/ProWaitlistConsentDialog";

interface ProGateOverlayProps {
  featureName: string;
  featureDescription: string;
  children: React.ReactNode;
}

export function ProGateOverlay({
  featureName,
  featureDescription,
  children,
}: ProGateOverlayProps) {
  const { isPro, isLoading: subLoading } = useSubscription();
  const { data: userRole, isLoading: roleLoading } = useUserRole();
  const isAdmin = userRole === "admin";
  const { isJoined, isLoading: waitlistLoading } = useProWaitlist();
  const { isOpen: launchOpen } = useLaunchWindow();
  const [dialogOpen, setDialogOpen] = useState(false);
  const titleId = useId();
  const descId = useId();
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== "Tab" || !overlayRef.current) return;
      const focusable = overlayRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    []
  );

  // AC #6: Fail-closed — durante il loading, non mostrare nulla (previene FOUC)
  if (subLoading || roleLoading || waitlistLoading) {
    return null;
  }

  // AC #5: Pro o Admin → renderizza solo i children
  if (isPro || isAdmin) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      {/* AC #1: Contenuto blurrato */}
      <div
        className="blur-sm pointer-events-none select-none"
        aria-hidden="true"
      >
        {children}
      </div>

      {/* AC #2: Overlay fixed per coprire l'intero viewport */}
      <div
        ref={overlayRef}
        className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onKeyDown={handleKeyDown}
      >
        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 mx-4 sm:mx-auto max-w-md text-center">
          <Lock className="h-10 w-10 text-slate-500 mx-auto mb-4" />
          <h3
            id={titleId}
            className="text-lg font-semibold text-slate-900 mb-2"
          >
            {featureName}
          </h3>
          <p id={descId} className="text-sm text-slate-600 mb-6">
            {featureDescription}
          </p>

          {launchOpen ? (
            <Button asChild className="w-full sm:w-auto">
              <Link to="/pricing">Passa a PRO</Link>
            </Button>
          ) : isJoined ? (
            <div className="flex items-center justify-center gap-2 text-sm text-emerald-600 font-medium">
              <Check className="h-4 w-4" /> Sei in lista — ti avviseremo
            </div>
          ) : (
            <Button
              onClick={() => setDialogOpen(true)}
              className="w-full sm:w-auto"
            >
              Scopri PRO
            </Button>
          )}

          <Link
            to={launchOpen ? "/pricing" : "/impostazioni?tab=abbonamento"}
            className="block mt-3 text-sm text-sky-600 hover:text-sky-700 underline"
          >
            {launchOpen ? "Vedi i piani PRO" : "Vedi cosa include PRO"}
          </Link>
        </div>
      </div>

      <ProWaitlistConsentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
