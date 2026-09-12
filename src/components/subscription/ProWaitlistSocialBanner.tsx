import { Link } from "react-router-dom";
import { Users, X } from "lucide-react";
import { useWaitlistCount, formatWaitlistCount } from "@/hooks/useWaitlistCount";
import { useSubscription } from "@/hooks/useSubscription";
import { useUserRole } from "@/hooks/useUserRole";
import { useProWaitlist } from "@/hooks/useProWaitlist";
import { useProBannerDismiss } from "@/hooks/useProBannerDismiss";

interface ProWaitlistSocialBannerProps {
  showOnboarding?: boolean;
}

export function ProWaitlistSocialBanner({ showOnboarding }: ProWaitlistSocialBannerProps) {
  const { isPro, isLoading: isSubscriptionLoading } = useSubscription();
  const { data: role, isLoading: isRoleLoading } = useUserRole();
  const { isJoined, isLoading: isMembershipLoading } = useProWaitlist();
  const { count: waitlistCount, isLoading: isCountLoading } = useWaitlistCount();
  const formatted = waitlistCount !== null ? formatWaitlistCount(waitlistCount) : null;
  const { isDismissed, dismiss } = useProBannerDismiss("waitlist-social");

  const isAdmin = role === "admin";
  const isCapReached = waitlistCount !== null && waitlistCount >= 100;

  if (isSubscriptionLoading || isRoleLoading || isMembershipLoading || isCountLoading) return null;
  if (isPro || isAdmin || isJoined || isDismissed || showOnboarding) return null;
  if (waitlistCount === null || waitlistCount < 15 || !formatted) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-teal-50 border border-teal-200/60 px-4 py-3">
      <div className="flex items-center gap-2 text-sm text-teal-800 min-w-0">
        <Users className="h-4 w-4 shrink-0" />
        <span>
          {isCapReached
            ? "La waitlist PRO è quasi piena — ultimi posti!"
            : `PRO arriva presto — ${formatted} in lista`}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          to="/pro-presto"
          className="text-sm font-semibold text-teal-700 hover:text-teal-900 whitespace-nowrap"
        >
          {isCapReached ? "Iscriviti ora" : "Iscriviti"}
        </Link>
        <button
          onClick={dismiss}
          className="text-teal-600 hover:text-teal-800 p-0.5"
          aria-label="Chiudi banner waitlist"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
