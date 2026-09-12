import { supabase } from "@/integrations/supabase/client";

/**
 * Fire-and-forget session increment.
 * Uses RPC `increment_user_session` for atomic UPSERT.
 * Never blocks UI, never throws.
 */
export function trackSession(): void {
  supabase
    .rpc("increment_user_session" as any)
    .then(
      () => {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.log("[session] tracked");
        }
      },
      () => {
        // fail-silent: session tracking should never break the app
      }
    );
}
