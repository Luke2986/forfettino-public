import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AdminUser } from "@/components/admin/AdminUserTable";

export interface AnnouncementReadStats {
  sent: number;
  read: number;
  openRate: number;
}

export interface NotificationStats {
  totalNotifications: number;
  readNotifications: number;
  overallOpenRate: number;
  announcementReadCounts: Record<string, AnnouncementReadStats>;
}

export interface CTAAnalyticsData {
  metricLabel: string;
  today: number;
  week: number;
  month: number;
}

export interface ActivityKpi {
  dau: number;
  dauPrev: number;
  wau: number;
  wauPrev: number;
  mau: number;
  mauPrev: number;
}

export interface TrendDataPoint {
  date?: string;
  week?: string;
  month?: string;
  count: number;
}

export interface TrendData {
  daily: TrendDataPoint[];
  weekly: TrendDataPoint[];
  monthly: TrendDataPoint[];
}

export interface UserSessionData {
  userCode: string;
  today: number;
  week: number;
  month: number;
}

export interface AdminStats {
  users: {
    total: number;
    onboarded: number;
    onboardingRate: number;
    signupsThisMonth: number;
    signupsByMonth: { month: string; count: number }[];
  };
  subscriptions: {
    proCount: number;
    conversionRate: number;
    mrrCents: number;
    arrCents: number;
    pendingChurnCount: number;
    churnRate: number;
  };
  usage: {
    activeUsersWithReceipts: number;
    usersWithFeedbackEmailConsent: number;
  };
  userList: AdminUser[];
  gestioneMetrics: GestioneMetrics;
  gestioneDistribution?: GestioneDistribution;
  derivedMetrics: DerivedMetrics;
  notificationStats?: NotificationStats;
  ctaAnalytics?: CTAAnalyticsData[];
  activityKpi?: ActivityKpi;
  signupTrend?: TrendData;
  activityTrend?: TrendData;
  userSessions?: UserSessionData[];
  accountDeletions?: number;
}

export interface ReceiptDistributionBucket {
  bucket: string;   // "0", "1", "2", "3", "4", "5+"
  count: number;
  percent: number;
}

export interface DerivedMetrics {
  retentionRate: number;
  avgReceiptsPerUser: number;
  freeReceiptDistribution: ReceiptDistributionBucket[];
}

export interface GestioneBreakdown {
  users: number;
  onboarded: number;
  onboardingRate: number;
  pro: number;
  conversionRate: number;
  receiptCount: number;
  receiptAmount: number;
}

export interface GestioneMetrics {
  separata: GestioneBreakdown;
  artigiani: GestioneBreakdown;
  commercianti: GestioneBreakdown;
}

export type GestioneDistribution = Record<string, ReceiptDistributionBucket[]>;

export function useAdminStats() {
  return useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-stats");
      if (error) throw error;
      return data as AdminStats;
    },
    staleTime: 60_000, // 1 minute
    refetchInterval: 60_000, // Auto-refresh every minute
  });
}
