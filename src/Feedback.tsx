import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { Card, CardContent } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRecordFeedback } from "@/hooks/useRecordFeedback";
import { Check } from "lucide-react";

const APP_VERSION = "1.0.0";

// Declare Tally global type
declare global {
  interface Window {
    Tally?: {
      loadEmbeds: () => void;
    };
  }
}

export default function FeedbackPage() {
  const isMobile = useIsMobile();
  const location = useLocation();
  const recordFeedback = useRecordFeedback();
  // "awarded" = points actually inserted; "submitted" = form sent but points skipped (cooldown)
  const [status, setStatus] = useState<"idle" | "awarded" | "submitted">("idle");

  // Ref to always access latest mutation without stale closure
  const recordFeedbackRef = useRef(recordFeedback);
  recordFeedbackRef.current = recordFeedback;

  // Listen for Tally FormSubmitted event — auto-award points on real submission
  // Tally sends event.data as a JSON *string*, not an object (per Tally docs)
  useEffect(() => {
    if (status !== "idle") return; // Already processed, no need to listen

    const handler = (event: MessageEvent) => {
      // Security: only accept messages from Tally's origin
      if (event.origin !== "https://tally.so") return;
      // Tally postMessage data is a JSON string — check with includes()
      if (typeof event.data !== "string" || !event.data.includes("Tally.FormSubmitted")) return;

      recordFeedbackRef.current.mutate(undefined, {
        onSuccess: (pointsAwarded) => {
          setStatus(pointsAwarded ? "awarded" : "submitted");
        },
      });
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [status]);

  // Build iframe URL with hidden fields
  const iframeUrl = useMemo(() => {
    const deviceType = isMobile ? "Mobile" : "Desktop";
    const originPage = location.state?.from || "/feedback";

    const params = new URLSearchParams({
      transparentBackground: "1",
      OriginPage: originPage,
      AppVersion: APP_VERSION,
      DeviceType: deviceType,
    });

    return `https://tally.so/embed/Gxllxe?${params.toString()}`;
  }, [isMobile, location.state?.from]);

  // Load Tally widget script
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://tally.so/widgets/embed.js";
    script.async = true;
    script.onload = () => {
      if (window.Tally) {
        window.Tally.loadEmbeds();
      }
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <AppLayout>
      {isMobile && <MobileHeader title="Scrivi feedback" />}
      <div className="p-6 space-y-6">
        {/* Header - desktop only */}
        <div className="hidden md:block">
          <h1 className="text-2xl font-bold text-foreground">Scrivi feedback</h1>
          <p className="text-muted-foreground">
            Segnala un bug o proponi un'idea. Ci vogliono 30 secondi. Nessun dato personale richiesto.
          </p>
        </div>

        {/* Mobile description */}
        {isMobile && (
          <p className="text-sm text-muted-foreground">
            Segnala un bug o proponi un'idea. Nessun dato personale richiesto.
          </p>
        )}

        {/* Tally Form Card */}
        <Card className="overflow-hidden">
          <CardContent className="p-4 md:p-6">
            <iframe
              data-tally-src={iframeUrl}
              width="100%"
              height={isMobile ? "550" : "480"}
              frameBorder="0"
              marginHeight={0}
              marginWidth={0}
              title="Feedback"
              style={{
                border: 0,
                background: "transparent"
              }}
            />
          </CardContent>
        </Card>

        {/* Confirmation after Tally submission */}
        {status === "awarded" && (
          <div className="flex justify-center">
            <span className="inline-flex items-center gap-2 text-sm text-emerald-600 font-medium">
              <Check className="h-4 w-4" />
              Grazie per il feedback! Punti guadagnati.
            </span>
          </div>
        )}
        {status === "submitted" && (
          <div className="flex justify-center">
            <span className="inline-flex items-center gap-2 text-sm text-slate-500 font-medium">
              <Check className="h-4 w-4" />
              Grazie per il feedback! Hai gia ricevuto punti di recente.
            </span>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
