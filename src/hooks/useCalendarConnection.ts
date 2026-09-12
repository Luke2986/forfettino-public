import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

/**
 * Calendar connection record from calendar_connections table.
 * Using inline type because auto-generated types don't include this table yet (as any pattern).
 */
export interface CalendarConnection {
  id: string;
  user_id: string;
  provider: string;
  provider_email: string | null;
  expires_at: string | null;
  status: string;
  last_synced_at: string | null;
  sync_token: string | null;
  created_at: string;
  updated_at: string;
}

const QUERY_KEY = "calendar_connection_google";

export function useCalendarConnection() {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Query: fetch current Google Calendar connection
  const {
    data: connection,
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: [QUERY_KEY, user?.id],
    queryFn: async () => {
      if (!user) return null;
      console.log("[GCAL-DEBUG] Fetching connection for user:", user.id);
      const { data, error } = await (supabase as any)
        .from("calendar_connections")
        .select("id, user_id, provider, provider_email, expires_at, status, last_synced_at, sync_token, created_at, updated_at")
        .eq("user_id", user.id)
        .eq("provider", "google")
        .maybeSingle();
      if (error) {
        console.error("[GCAL-DEBUG] Connection query ERROR:", error);
        throw error;
      }
      console.log("[GCAL-DEBUG] Connection query result:", data ? { status: data.status, email: data.provider_email } : "null (no connection)");
      return (data as CalendarConnection) ?? null;
    },
    enabled: !!user,
  });

  // Mutation: initiate Google OAuth flow
  const initiateMutation = useMutation({
    mutationFn: async () => {
      if (!session?.access_token) throw new Error("Not authenticated");

      const redirectUri = `${window.location.origin}/calendario`;
      console.log("[GCAL-DEBUG] Initiate OAuth, redirectUri:", redirectUri);

      const res = await supabase.functions.invoke("google-calendar-auth", {
        body: { action: "initiate", redirect_uri: redirectUri },
      });

      console.log("[GCAL-DEBUG] Initiate response:", { error: res.error, data: res.data });
      if (res.error) throw new Error(res.error.message);
      const { url } = res.data as { url: string };
      if (!url) throw new Error("No OAuth URL returned");

      return url;
    },
    onSuccess: (url) => {
      console.log("[GCAL-DEBUG] Redirecting to Google OAuth...");
      window.location.href = url;
    },
    onError: (err) => {
      console.error("[GCAL-DEBUG] Initiate OAuth FAILED:", err);
    },
  });

  // Mutation: handle OAuth callback (exchange code for tokens)
  const callbackMutation = useMutation({
    mutationFn: async ({
      code,
      state,
    }: {
      code: string;
      state: string;
    }) => {
      if (!session?.access_token) throw new Error("Not authenticated");

      const redirectUri = `${window.location.origin}/calendario`;

      console.log("[GCAL-DEBUG] Callback: exchanging code for tokens...", { codeLen: code.length, state });
      const res = await supabase.functions.invoke("google-calendar-auth", {
        body: { action: "callback", code, state, redirect_uri: redirectUri },
      });

      console.log("[GCAL-DEBUG] Callback response:", { error: res.error, data: res.data });
      if (res.error) throw new Error(res.error.message);
      const data = res.data as {
        success: boolean;
        email: string;
        connected_at: string;
      };
      if (!data.success) throw new Error("Callback failed");

      return data;
    },
    onSuccess: (data) => {
      console.log("[GCAL-DEBUG] Callback SUCCESS — connected as:", data.email);
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
    onError: (err) => {
      console.error("[GCAL-DEBUG] Callback FAILED:", err);
    },
  });

  // Mutation: disconnect Google Calendar (delete connection, cascade deletes events cache)
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!connection?.id || !user?.id) throw new Error("No connection to disconnect");
      const { error } = await (supabase as any)
        .from("calendar_connections")
        .delete()
        .eq("id", connection.id)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["google_calendar_events"] });
      queryClient.invalidateQueries({ queryKey: ["calendar_events"] });
    },
    onError: () => {
      toast({
        title: "Errore durante la disconnessione",
        variant: "destructive",
        duration: 5000,
      });
    },
  });

  const connectGoogle = useCallback(() => {
    initiateMutation.mutate();
  }, [initiateMutation]);

  const handleCallback = useCallback((code: string, state: string) => {
    callbackMutation.mutate({ code, state });
  }, [callbackMutation]);

  const disconnectGoogle = useCallback(() => {
    disconnectMutation.mutate();
  }, [disconnectMutation]);

  const isConnected =
    connection?.status === "active" && !!connection?.provider_email;

  // Raw status from DB — allows UI to distinguish error/revoked from no-connection
  const connectionStatus = connection?.status ?? null;

  return {
    connection,
    isConnected,
    connectionStatus,
    isLoading,
    error: queryError || initiateMutation.error || callbackMutation.error,
    connectGoogle,
    handleCallback,
    disconnectGoogle,
    isDisconnecting: disconnectMutation.isPending,
    isCallbackLoading: callbackMutation.isPending,
    isCallbackSuccess: callbackMutation.isSuccess,
  };
}
