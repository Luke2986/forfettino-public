import { AppLayout } from "@/components/layout/AppLayout";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { useIsMobile } from "@/hooks/use-mobile";
import { ContributionPersonalCard } from "@/components/classifica/ContributionPersonalCard";
import { ReferralShareSection } from "@/components/classifica/ReferralShareSection";
import { HowItWorksSection } from "@/components/classifica/HowItWorksSection";
import { MissionStatementCard } from "@/components/classifica/MissionStatementCard";
import { useMyContributions } from "@/hooks/useMyContributions";
import { useMilestones } from "@/hooks/useMilestones";
import { useActionConfig } from "@/hooks/useActionConfig";
import type { ContributionBreakdown } from "@/lib/contribution-helpers";

export default function ClassificaPage() {
  const isMobile = useIsMobile();
  const { data: breakdown, isLoading: breakdownLoading } = useMyContributions();
  const { data: milestones, isLoading: milestonesLoading } = useMilestones();
  const { data: configs, isLoading: configsLoading } = useActionConfig();

  const defaultBreakdown: ContributionBreakdown = {
    feedbackPts: 0,
    referralPts: 0,
    callPts: 0,
    firstImportXmlPts: 0,
    welcomeGiftPts: 0,
    adminManualPts: 0,
    npsSurveyPts: 0,
    pricingSurveyPts: 0,
    calendarSurveyPts: 0,
    totalPts: 0,
    myRank: 0,
    monthlyReferralCount: 0,
  };

  const safeBreakdown = breakdown ?? defaultBreakdown;
  const safeConfigs = configs ?? [];

  // Get referral points from config for ReferralShareSection
  const referralConfig = safeConfigs.find((c) => c.actionType === "referral_signup");
  const referralPoints = referralConfig?.points ?? 30;

  // Max milestone points — progress bar fills proportionally to this goal
  const maxMilestonePts = milestones?.length
    ? Math.max(...milestones.map((m) => m.pointsRequired))
    : undefined;

  return (
    <AppLayout>
      {isMobile && <MobileHeader title="Il tuo contributo" />}
      <PageContainer className="space-y-4">
        <div className="hidden md:block">
          <h1 className="text-lg font-semibold text-slate-800">Il tuo contributo</h1>
        </div>

        {/* Mission statement — personal letter from Luca */}
        <MissionStatementCard />

        {/* How it works: rules + milestones (collapsible) */}
        <HowItWorksSection
          configs={safeConfigs}
          milestones={milestones ?? []}
          totalPts={safeBreakdown.totalPts}
          milestonesLoading={milestonesLoading}
        />

        {/* Personal contribution card */}
        <ContributionPersonalCard
          breakdown={safeBreakdown}
          configs={safeConfigs}
          isLoading={breakdownLoading || configsLoading}
          maxPts={maxMilestonePts}
        />

        {/* Referral share section */}
        <ReferralShareSection
          monthlyReferralCount={safeBreakdown.monthlyReferralCount}
          referralPoints={referralPoints}
        />
      </PageContainer>
    </AppLayout>
  );
}
