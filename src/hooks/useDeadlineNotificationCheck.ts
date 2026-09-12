/**
 * useDeadlineNotificationCheck.ts
 *
 * Story 9.3 — Client-side trigger for deadline notification generation.
 *
 * On first daily login, invokes the Edge Function `generate-deadline-notifications`
 * to create in-app notifications for upcoming fiscal deadlines.
 * Debounces with localStorage timestamp (24h).
 * Errors are silent — never blocks UX.
 */
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const STORAGE_KEY = "forfettino:last-notification-check";
const DEBOUNCE_MS = 24 * 60 * 60 * 1000; // 24 hours

export function useDeadlineNotificationCheck(): void {
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
      .invoke("generate-deadline-notifications", {
        body: { user_id: user.id },
      })
      .then(({ error }) => {
        if (error) {
          console.error("[useDeadlineNotificationCheck] Edge Function error:", error);
          return;
        }
        // Mark as checked
        localStorage.setItem(STORAGE_KEY, String(now));
        // Invalidate notification queries to refresh badge count
        queryClient.invalidateQueries({ queryKey: ["notifications", "count", user.id] });
        queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
      })
      .catch(() => {
        // Silent failure — don't block UX for notification check errors
      });
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
}
