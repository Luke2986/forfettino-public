/**
 * useDigestNotificationCheck.ts
 *
 * Story 9.5 — Client-side trigger for digest notification generation.
 *
 * On first daily login, invokes the Edge Function `generate-digest-notifications`
 * to create in-app digest notifications (monthly summary, inactivity, threshold).
 * Debounces with localStorage timestamp (24h).
 * Errors are silent — never blocks UX.
 */
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const STORAGE_KEY = "forfettino:last-digest-check";
export const DEBOUNCE_MS = 24 * 60 * 60 * 1000; // 24 hours

export function useDigestNotificationCheck(): void {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    const lastCheck = localStorage.getItem(STORAGE_KEY);
    const now = Date.now();

    // Skip if checked within the last 24 hours
    if (lastCheck && now - Number(lastCheck) < DEBOUNCE_MS) return;

    // Invoke Edge Function
    supabase.functions
      .invoke("generate-digest-notifications", {
        body: { user_id: user.id },
      })
      .then(({ error }) => {
        if (error) {
          console.error("[useDigestNotificationCheck] Edge Function error:", error);
          return;
        }
        // Mark as checked
        localStorage.setItem(STORAGE_KEY, String(now));
        // Invalidate notification queries to refresh badge count
        queryClient.invalidateQueries({ queryKey: ["notifications", "count", user.id] });
        queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
      })
      .catch(() => {
        // Silent failure — don't block UX for digest notification check errors
      });
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
}
