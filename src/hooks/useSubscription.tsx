/**
 * useSubscription - Context e hook per gestione tier subscription
 *
 * Fornisce a tutta l'app lo stato del piano utente (Free/Pro/Studio)
 * e i permessi sulle feature (canImport, canExport, canSelectYear, canAddReceipt).
 *
 * Ora si sincronizza con Stripe tramite edge function check-subscription.
 */

import { createContext, useContext, type ReactNode, useMemo, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import {
  type Subscription,
  type SubscriptionTier,
  type OverrideTier,
  FREE_RECEIPT_LIMIT,
  FREE_IMPORT_LIMIT,
} from "@/types/subscription";

interface SubscriptionContextValue {
  subscription: Subscription | null;
  isLoading: boolean;
  isPro: boolean;
  isStudio: boolean;
  hasPaidPlan: boolean;
  tier: SubscriptionTier;
  canImport: boolean;
  canExport: boolean;
  canSelectYear: boolean;
  canAddReceipt: boolean;
  receiptsUsed: number;
  receiptsLimit: number;
  importsUsed: number;
  importsLimit: number;
  canAddImport: boolean;
  refetch: () => void;
}

const SubscriptionCtx = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  // Check admin role via user_roles table
  const { data: adminRole } = useQuery({
    queryKey: ["user-role-admin", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
  const isAdmin = adminRole ?? false;
  const { data: profile, isLoading: profileLoading } = useProfile();
  const adminOverrideTier = profile?.admin_override_tier ?? null;
  const queryClient = useQueryClient();
  const currentRealYear = new Date().getFullYear();

  // Check subscription status via Stripe (syncs to DB)
  const {
    data: stripeStatus,
    isLoading: stripeLoading,
    refetch: refetchStripe
  } = useQuery({
    queryKey: ["stripe_subscription_status", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase.functions.invoke("check-subscription");

      if (error) {
        console.error("[Subscription] Error checking Stripe status:", error);
        return null;
      }

      return data as {
        subscribed: boolean;
        tier: string;
        billing_interval: string | null;
        subscription_end: string | null;
      };
    },
    enabled: !!user,
    staleTime: 60000, // 1 minute
    refetchInterval: 60000, // Check every minute
    refetchOnWindowFocus: true,
  });

  // Fetch subscription from database (synced by check-subscription)
  const { data: subscription, isLoading: dbLoading } = useQuery({
    queryKey: ["subscription", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("[Subscription] DB query error:", error);
        return null;
      }
      return data as Subscription | null;
    },
    enabled: !!user,
  });

  // Fetch manual receipt count per anno corrente (per limite Free)
  const { data: receiptCount = 0 } = useQuery({
    queryKey: ["receipt_count_limit", user?.id, currentRealYear],
    queryFn: async () => {
      if (!user) return 0;
      const { count, error } = await supabase
        .from("receipts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("fiscal_year", currentRealYear);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
  });

  // Import count: conta receipts con source = 'xml_import' per l'anno corrente
  // Fail-safe: se la query fallisce (es. colonna mancante), usa il limite come valore
  // per impedire bypass del limite Free in caso di errore DB
  const { data: importCount = 0, isError: importCountError } = useQuery({
    queryKey: ["import_count_limit", user?.id, currentRealYear],
    queryFn: async () => {
      if (!user) return 0;
      const { count, error } = await supabase
        .from("receipts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("fiscal_year", currentRealYear)
        .eq("source", "xml_import");

      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
    retry: 1,
  });
  const safeImportCount = importCountError ? FREE_IMPORT_LIMIT : importCount;

  // Refetch subscription when Stripe status changes
  useEffect(() => {
    if (stripeStatus?.subscribed !== undefined) {
      queryClient.invalidateQueries({ queryKey: ["subscription", user?.id] });
    }
  }, [stripeStatus, queryClient, user?.id]);

  const refetch = useCallback(() => {
    refetchStripe();
    queryClient.invalidateQueries({ queryKey: ["subscription", user?.id] });
  }, [refetchStripe, queryClient, user?.id]);

  const isLoading = stripeLoading || dbLoading || profileLoading;

  const value = useMemo<SubscriptionContextValue>(() => {
    // Priority: admin_override_tier > Stripe > DB subscription > free
    const hasOverride = adminOverrideTier === 'pro' || adminOverrideTier === 'beta_tester';

    const tier: SubscriptionTier = hasOverride
      ? "pro"
      : (stripeStatus?.tier as SubscriptionTier) ||
        (subscription?.tier as SubscriptionTier) ||
        "free";
    const isActive = hasOverride ||
                     stripeStatus?.subscribed ||
                     subscription?.status === "active" ||
                     subscription?.status === "trialing";
    const isPro = tier === "pro" && isActive;
    const isStudio = tier === "studio" && isActive;
    const hasPaidPlan = isPro || isStudio || isAdmin;

    console.log("[Subscription]", {
      tier,
      isPro,
      isActive,
      hasPaidPlan,
      canImport: hasPaidPlan || safeImportCount < FREE_IMPORT_LIMIT,
      canExport: hasPaidPlan,
      canSelectYear: hasPaidPlan,
      receiptCount,
      importCount: safeImportCount,
      canAddReceipt: hasPaidPlan || receiptCount < FREE_RECEIPT_LIMIT,
      canAddImport: hasPaidPlan || safeImportCount < FREE_IMPORT_LIMIT,
      stripeStatus,
      dbSubscription: subscription,
    });

    return {
      subscription,
      isLoading,
      isPro,
      isStudio,
      hasPaidPlan,
      tier,
      canImport: hasPaidPlan || safeImportCount < FREE_IMPORT_LIMIT,
      canExport: hasPaidPlan,
      canSelectYear: hasPaidPlan,
      canAddReceipt: hasPaidPlan || receiptCount < FREE_RECEIPT_LIMIT,
      receiptsUsed: receiptCount,
      receiptsLimit: hasPaidPlan ? Infinity : FREE_RECEIPT_LIMIT,
      importsUsed: safeImportCount,
      importsLimit: hasPaidPlan ? Infinity : FREE_IMPORT_LIMIT,
      canAddImport: hasPaidPlan || safeImportCount < FREE_IMPORT_LIMIT,
      refetch,
    };
  }, [subscription, isLoading, receiptCount, safeImportCount, refetch, stripeStatus, isAdmin, adminOverrideTier]);

  return (
    <SubscriptionCtx.Provider value={value}>
      {children}
    </SubscriptionCtx.Provider>
  );
}

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionCtx);
  if (!ctx) {
    throw new Error("useSubscription must be used within SubscriptionProvider");
  }
  return ctx;
}
