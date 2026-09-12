import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook per lo stato della finestra di vendita PRO.
 *
 * Il campo `is_active` è un override admin. La chiusura temporale
 * è derivata client-side da `ends_at` / `lifetime_ends_at`.
 * Polling ogni 60s per countdown e posti rimanenti.
 */
export function useLaunchWindow() {
  const query = useQuery({
    queryKey: ["launch-window"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("launch_windows")
        .select("*")
        .eq("is_active", true)
        .order("starts_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as LaunchWindowRow | null;
    },
    refetchInterval: 60_000,
  });

  const window = query.data ?? null;
  const now = new Date();

  const isOpen =
    !!window &&
    window.is_active &&
    now >= new Date(window.starts_at) &&
    now < new Date(window.ends_at);

  const isLifetimeOpen =
    isOpen && !!window && now < new Date(window.lifetime_ends_at);

  const daysRemaining = isOpen && window ? daysUntilDate(window.ends_at) : 0;
  const lifetimeDaysRemaining =
    isLifetimeOpen && window ? daysUntilDate(window.lifetime_ends_at) : 0;

  const spotsRemaining = window?.cap_remaining ?? 0;

  return {
    window,
    isOpen,
    isLifetimeOpen,
    daysRemaining,
    lifetimeDaysRemaining,
    spotsRemaining,
    isLoading: query.isLoading,
  };
}

// ── Helpers ──

function daysUntilDate(dateStr: string): number {
  // timestamptz arriva come ISO string dal DB — parse diretto è safe
  const target = new Date(dateStr);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

// ── Type (inline finché tipi auto-generati non disponibili) ──

export interface LaunchWindowRow {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  lifetime_ends_at: string;
  cap_total: number;
  cap_remaining: number;
  prices: {
    six_month: number;
    annual: number;
    lifetime: number;
  };
  is_active: boolean;
  created_at: string;
}
