import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const ALLOWED_ORIGINS = [
  "https://forfettino.lovable.app",
  "https://forfettino.it",
  "http://localhost:5173",
  "http://localhost:8080",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

interface AnnouncementPayload {
  title: string;
  body: string;
  action_url?: string;
  action_label?: string;
  target_audience?: "all" | "pro" | "free";
  // Story 25.6: Individual message fields
  target_type?: "broadcast" | "individual";
  target_user_id?: string;
  delivery_type?: "sidebar" | "popup";
}

const VALID_AUDIENCES = new Set(["all", "pro", "free"]);

function jsonResponse(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // ── Auth: verify JWT ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(req, { error: "Missing authorization header" }, 401);
    }

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await anonClient.auth.getUser(token);

    if (userError || !user) {
      return jsonResponse(req, { error: "Unauthorized" }, 401);
    }

    // ── Admin role check ──
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: isAdmin, error: roleError } = await serviceClient.rpc(
      "has_role",
      { _user_id: user.id, _role: "admin" },
    );

    if (roleError) {
      console.error("Role check error:", roleError);
      return jsonResponse(req, { error: "Failed to verify admin status" }, 500);
    }

    if (!isAdmin) {
      return jsonResponse(req, { error: "Forbidden: Admin access required" }, 403);
    }

    // ── Parse and validate payload ──
    const payload: AnnouncementPayload = await req.json();

    if (!payload.title || typeof payload.title !== "string" || payload.title.trim().length === 0) {
      return jsonResponse(req, { error: "title is required" }, 400);
    }

    if (!payload.body || typeof payload.body !== "string" || payload.body.trim().length === 0) {
      return jsonResponse(req, { error: "body is required" }, 400);
    }

    const title = payload.title.trim().slice(0, 100);
    const body = payload.body.trim().slice(0, 1500);
    const actionUrl = payload.action_url?.trim() || null;
    const actionLabel = payload.action_label?.trim() || (actionUrl ? "Scopri di più" : null);
    const targetType = payload.target_type || "broadcast";

    // ════════════════════════════════════════════════════════════════
    // Story 25.6: INDIVIDUAL MESSAGE PATH
    // ════════════════════════════════════════════════════════════════
    if (targetType === "individual") {
      if (!payload.target_user_id) {
        return jsonResponse(req, { error: "target_user_id is required for individual messages" }, 400);
      }

      // Validate UUID format
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!UUID_RE.test(payload.target_user_id)) {
        return jsonResponse(req, { error: "target_user_id must be a valid UUID" }, 400);
      }

      const deliveryType = payload.delivery_type === "popup" ? "popup" : "sidebar";

      console.log(`Admin ${user.id} sending individual message: "${title}" to user ${payload.target_user_id}, delivery: ${deliveryType}`);

      // 0. Verify target user exists in profiles
      const { data: targetProfile, error: profileError } = await serviceClient
        .from("profiles")
        .select("user_id")
        .eq("user_id", payload.target_user_id)
        .maybeSingle();

      if (profileError || !targetProfile) {
        console.error("Target user not found in profiles:", payload.target_user_id);
        return jsonResponse(req, { error: "Target user not found" }, 404);
      }

      // 1. Check user notification preferences (admin_messages_enabled + master_enabled)
      const { data: userSettings } = await serviceClient
        .from("user_notification_settings")
        .select("master_enabled, admin_messages_enabled")
        .eq("user_id", payload.target_user_id)
        .maybeSingle();

      const isSuppressed = userSettings
        ? (userSettings.master_enabled === false || (userSettings as any).admin_messages_enabled === false)
        : false; // no row = all enabled (opt-out model)

      // 2. Create admin_announcements record
      const { data: announcement, error: announceError } = await serviceClient
        .from("admin_announcements")
        .insert({
          admin_user_id: user.id,
          title,
          body,
          action_url: actionUrl,
          action_label: actionLabel,
          target_audience: "all", // N/A for individual, placeholder
          target_type: "individual",
          target_user_id: payload.target_user_id,
          delivery_type: deliveryType,
          published_at: new Date().toISOString(),
          sent_count: isSuppressed ? 0 : 1,
        } as any)
        .select("id")
        .single();

      if (announceError || !announcement) {
        console.error("Failed to create individual announcement:", announceError);
        return jsonResponse(req, { error: "Failed to create announcement" }, 500);
      }

      const announcementId = announcement.id;

      // 3. Create 1 notification for the target user
      const suppressedFields = isSuppressed
        ? {
            read_at: new Date().toISOString(),
            ...(deliveryType === "popup" ? { dismissed_at: new Date().toISOString() } : {}),
          }
        : {};

      const notificationRecord = {
        user_id: payload.target_user_id,
        type: "admin_individual",
        category: "aggiornamenti",
        title,
        body,
        action_url: actionUrl,
        action_label: actionLabel,
        delivery_channel: deliveryType,
        metadata: {
          announcement_id: announcementId,
          ...(isSuppressed ? { suppressed: true } : {}),
        },
        ...suppressedFields,
      };

      const { error: notifError } = await serviceClient
        .from("notifications")
        .insert(notificationRecord);

      if (notifError) {
        console.error("Individual notification insert error:", notifError);
        return jsonResponse(req, { error: "Failed to send notification" }, 500);
      }

      console.log(`Individual message ${announcementId}: sent to ${payload.target_user_id}, suppressed=${isSuppressed}`);

      return jsonResponse(req, {
        announcement_id: announcementId,
        sent_count: isSuppressed ? 0 : 1,
        suppressed: isSuppressed,
      });
    }

    // ════════════════════════════════════════════════════════════════
    // BROADCAST PATH
    // ════════════════════════════════════════════════════════════════
    const targetAudience = VALID_AUDIENCES.has(payload.target_audience ?? "")
      ? payload.target_audience!
      : "all";
    const broadcastDeliveryChannel = payload.delivery_type === "popup" ? "popup" : "sidebar";

    console.log(`Admin ${user.id} sending broadcast announcement: "${title}" to audience: ${targetAudience}, delivery: ${broadcastDeliveryChannel}`);

    // ── Query target users FIRST (before creating record) ──
    // Opt-out model: aggiornamenti default = true (lazy creation).
    // Include ALL users EXCEPT those who explicitly opted out.

    // Step A: get ALL user IDs from auth.users (paginated — default is 50/page)
    const allUserIds: string[] = [];
    let page = 1;
    const perPage = 1000;
    while (true) {
      const { data: pageData, error: usersError } = await serviceClient.auth.admin.listUsers({ page, perPage });
      if (usersError) {
        console.error("Failed to list users:", usersError);
        return jsonResponse(req, { error: "Failed to query target users" }, 500);
      }
      const users = pageData?.users ?? [];
      for (const u of users) {
        allUserIds.push(u.id);
      }
      if (users.length < perPage) break;
      page++;
    }
    console.log(`Total auth users fetched: ${allUserIds.length} (${page} page(s))`);

    if (allUserIds.length === 0) {
      return jsonResponse(req, { sent_count: 0, message: "Nessun utente registrato" });
    }

    // Step B: find users who opted OUT — check new table first, fallback old
    // Story 25.3: user_notification_settings has master_enabled + aggiornamenti_enabled
    // TODO(DRY): Preference loading logic duplicated in generate-deadline-notifications
    // and generate-digest-notifications. Extract to _shared module when Lovable supports it.
    const { data: newSettingsRows } = await serviceClient
      .from("user_notification_settings")
      .select("user_id, master_enabled, aggiornamenti_enabled");

    const newSettingsMap = new Map(
      (newSettingsRows ?? []).map((r: any) => [r.user_id, r]),
    );

    // Old table fallback: users who explicitly opted OUT of aggiornamenti
    const { data: optedOutUsers, error: prefsError } = await serviceClient
      .from("notification_preferences")
      .select("user_id")
      .eq("category", "aggiornamenti")
      .eq("enabled", false);

    if (prefsError) {
      console.error("Failed to query preferences:", prefsError);
      return jsonResponse(req, { error: "Failed to query target users" }, 500);
    }

    const oldOptedOutIds = new Set((optedOutUsers ?? []).map((u: any) => u.user_id));

    // Filter: skip users who have master_enabled=false OR aggiornamenti_enabled=false
    let targetUserIds = allUserIds.filter((uid) => {
      const newRow = newSettingsMap.get(uid);
      if (newRow) {
        // New table: check master + aggiornamenti
        return newRow.master_enabled !== false && newRow.aggiornamenti_enabled !== false;
      }
      // Fallback: old table opt-out check
      return !oldOptedOutIds.has(uid);
    });

    // ── Filter by target_audience (pro/free) ──
    if (targetAudience === "pro") {
      const { data: proSubs } = await serviceClient
        .from("subscriptions")
        .select("user_id")
        .in("user_id", targetUserIds)
        .eq("tier", "pro")
        .in("status", ["active", "trialing"]);

      const proUserIds = new Set((proSubs ?? []).map((s) => s.user_id));
      targetUserIds = targetUserIds.filter((uid) => proUserIds.has(uid));
    } else if (targetAudience === "free") {
      const { data: proSubs } = await serviceClient
        .from("subscriptions")
        .select("user_id")
        .in("user_id", targetUserIds)
        .eq("tier", "pro")
        .in("status", ["active", "trialing"]);

      const proUserIds = new Set((proSubs ?? []).map((s) => s.user_id));
      targetUserIds = targetUserIds.filter((uid) => !proUserIds.has(uid));
    }

    if (targetUserIds.length === 0) {
      return jsonResponse(req, { sent_count: 0, message: "Nessun destinatario per il pubblico selezionato" });
    }

    // ── Create announcement record (only after confirming recipients exist) ──
    const { data: announcement, error: announceError } = await serviceClient
      .from("admin_announcements")
      .insert({
        admin_user_id: user.id,
        title,
        body,
        action_url: actionUrl,
        action_label: actionLabel,
        target_audience: targetAudience,
        published_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (announceError || !announcement) {
      console.error("Failed to create announcement:", announceError);
      return jsonResponse(req, { error: "Failed to create announcement" }, 500);
    }

    const announcementId = announcement.id;

    // ── Dedup: skip users who already have this announcement ──
    const { data: existingNotifs } = await serviceClient
      .from("notifications")
      .select("user_id")
      .eq("type", "admin_announcement")
      .filter("metadata->>announcement_id", "eq", announcementId)
      .in("user_id", targetUserIds);

    const alreadySent = new Set((existingNotifs ?? []).map((n) => n.user_id));
    const newTargetUserIds = targetUserIds.filter((uid) => !alreadySent.has(uid));

    if (newTargetUserIds.length === 0) {
      await serviceClient
        .from("admin_announcements")
        .update({ sent_count: 0 })
        .eq("id", announcementId);

      return jsonResponse(req, {
        announcement_id: announcementId,
        sent_count: 0,
        message: "Already sent to all targets",
      });
    }

    // ── Batch insert notifications ──
    const notificationsToInsert = newTargetUserIds.map((userId) => ({
      user_id: userId,
      type: "admin_announcement",
      category: "aggiornamenti",
      title,
      body,
      action_url: actionUrl,
      action_label: actionLabel,
      delivery_channel: broadcastDeliveryChannel,
      metadata: { announcement_id: announcementId },
    }));

    const { error: insertError, data: inserted } = await serviceClient
      .from("notifications")
      .insert(notificationsToInsert)
      .select("id");

    if (insertError) {
      console.error("Notification insert error:", insertError);
      return jsonResponse(req, { error: "Failed to send notifications" }, 500);
    }

    const sentCount = inserted?.length ?? 0;

    // ── Update sent_count on announcement ──
    await serviceClient
      .from("admin_announcements")
      .update({ sent_count: sentCount })
      .eq("id", announcementId);

    console.log(`Announcement ${announcementId}: sent ${sentCount} notifications`);

    return jsonResponse(req, { announcement_id: announcementId, sent_count: sentCount });
  } catch (err) {
    console.error("Unexpected error:", err);
    return jsonResponse(req, { error: "Internal server error" }, 500);
  }
});
