import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { useWaitlistReferral } from "@/hooks/useWaitlistReferral";
import { posthog, isPosthogReady } from "@/lib/posthog";

async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fallback below
    }
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  } catch {
    return false;
  }
}

function trackEvent(event: string, props?: Record<string, string>) {
  if (isPosthogReady) {
    try {
      posthog.capture(event, props);
    } catch {
      // fail-silent
    }
  }
}

const SHARE_TEXT = "Gestisco il forfettario con Forfettino — iscriviti alla waitlist PRO:";

export function WaitlistReferralPanel() {
  const {
    referralUrl,
    invitesCount,
    nextBoostAt,
    nextBoostLabel,
    isLoading,
  } = useWaitlistReferral();
  const [copied, setCopied] = useState(false);

  if (isLoading || !referralUrl) return null;

  const handleCopy = async () => {
    const ok = await copyToClipboard(referralUrl);
    if (ok) {
      setCopied(true);
      trackEvent("pro_referral_link_copied");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const encodedText = encodeURIComponent(`${SHARE_TEXT} ${referralUrl}`);
  const encodedUrl = encodeURIComponent(referralUrl);

  const shareLinks = [
    {
      label: "WhatsApp",
      href: `https://wa.me/?text=${encodedText}`,
      color: "bg-green-500 hover:bg-green-600",
    },
    {
      label: "X",
      href: `https://twitter.com/intent/tweet?text=${encodedText}`,
      color: "bg-slate-900 hover:bg-slate-800",
    },
    {
      label: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      color: "bg-blue-600 hover:bg-blue-700",
    },
  ];

  const hasMaxBoost = invitesCount >= 10;
  const progressCurrent = nextBoostAt ? invitesCount : invitesCount;
  const progressTarget = nextBoostAt ?? invitesCount;
  const progressPercent =
    progressTarget > 0 ? Math.min((progressCurrent / progressTarget) * 100, 100) : 100;

  return (
    <div className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05),0_0_0_1px_rgba(23,23,23,0.05)] space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Share2 className="h-5 w-5 text-teal-600" />
        <h3 className="text-sm font-semibold text-slate-900">
          Invita amici, salta in coda
        </h3>
      </div>

      {/* Referral link + copy */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          readOnly
          value={referralUrl}
          className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none truncate"
          aria-label="Link referral"
        />
        <button
          onClick={handleCopy}
          className="shrink-0 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-teal-700"
          aria-label="Copia link referral"
        >
          {copied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Counter + progress */}
      <div className="space-y-2">
        <p className="text-sm text-slate-700">
          <span className="font-semibold text-slate-900">{invitesCount}</span>{" "}
          {invitesCount === 1 ? "amico iscritto" : "amici iscritti"}
        </p>

        {hasMaxBoost ? (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1.5">
            <span className="text-sm font-semibold text-violet-700">
              Lifetime tier garantito
            </span>
          </div>
        ) : nextBoostAt ? (
          <div className="space-y-1">
            <div
              className="h-2 rounded-full bg-slate-200 overflow-hidden"
              role="progressbar"
              aria-valuenow={invitesCount}
              aria-valuemin={0}
              aria-valuemax={nextBoostAt ?? invitesCount}
              aria-label={`Progresso verso ${nextBoostLabel}`}
            >
              <div
                className="h-full rounded-full bg-teal-500 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-sm text-slate-600">
              {invitesCount}/{nextBoostAt} per {nextBoostLabel}
            </p>
          </div>
        ) : null}
      </div>

      {/* Share buttons */}
      <div className="flex gap-2">
        {shareLinks.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              trackEvent("pro_referral_shared", { channel: link.label.toLowerCase() })
            }
            className={`flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium text-white transition ${link.color}`}
          >
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
}
