import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Copy, Gift } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { MONTHLY_REFERRAL_CAP } from "@/lib/contribution-helpers";

interface ReferralShareSectionProps {
  monthlyReferralCount?: number;
  referralPoints: number;
}

export function ReferralShareSection({ monthlyReferralCount = 0, referralPoints }: ReferralShareSectionProps) {
  const { data: profile } = useProfile();
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const referralCode = profile?.user_code ?? "";
  const referralLink = referralCode
    ? `https://forfettino.it/referral/${referralCode}`
    : "";

  const capReached = monthlyReferralCount >= MONTHLY_REFERRAL_CAP;

  const handleCopy = async () => {
    if (!referralLink || capReached) return;
    // Clear any existing timer
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);

    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const input = document.createElement("input");
      input.value = referralLink;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!referralCode) return null;

  return (
    <Card className="bg-white rounded-2xl border-0 shadow-[0_1px_2px_rgba(0,0,0,0.05),0_0_0_1px_rgba(23,23,23,0.05)]">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 p-2 rounded-lg bg-violet-50">
            <Gift className="h-5 w-5 text-violet-500" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-700">
              Invita un amico
            </p>
            {capReached ? (
              <p className="text-sm text-amber-600 mt-0.5 font-medium">
                Hai raggiunto il limite di {MONTHLY_REFERRAL_CAP} inviti questo mese. Riprova il prossimo mese!
              </p>
            ) : (
              <p className="text-sm text-slate-500 mt-0.5">
                Condividi il tuo link. Quando un amico si registra e completa l'onboarding, guadagni {referralPoints} punti.
                {monthlyReferralCount > 0 && (
                  <span className="text-slate-500"> ({monthlyReferralCount}/{MONTHLY_REFERRAL_CAP} questo mese)</span>
                )}
              </p>
            )}
            <div className="flex gap-2 mt-3">
              <Input
                id="referral-link"
                value={referralLink}
                readOnly
                aria-readonly="true"
                aria-label="Link referral"
                className="text-xs font-mono bg-slate-50 h-8"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 h-8"
                onClick={handleCopy}
                disabled={capReached}
                aria-label={copied ? "Link copiato" : "Copia link referral"}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                )}
              </Button>
              <span className="sr-only" role="status" aria-live="polite">
                {copied ? "Link copiato negli appunti" : ""}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
