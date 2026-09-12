import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// MRR prices in cents
const MRR_PRICES = {
  pro_monthly: 1000, // €10.00
  pro_annual: 825,   // €99/12 = €8.25 normalized monthly
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Get user from JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Create anon client to verify user
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Create service role client for admin queries
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user is admin by querying user_roles directly (avoids has_role overload ambiguity)
    const { data: roleRows, error: roleError } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .limit(1);
    const isAdmin = roleRows && roleRows.length > 0;

    if (roleError) {
      console.error("Role check error:", roleError);
      return new Response(
        JSON.stringify({ error: "Failed to verify admin status" }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    if (!isAdmin) {
      console.log(`User ${user.id} attempted admin access without admin role`);
      return new Response(
        JSON.stringify({ error: "Forbidden: Admin access required" }),
        { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    console.log(`Admin ${user.id} fetching stats...`);

    // Helper: format Date to "YYYY-MM-DD" without UTC conversion (MEMORY.md timezone safety)
    function formatDateStr(d: Date): string {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
    function localDateStr(daysAgo = 0): string {
      const d = new Date();
      d.setDate(d.getDate() - daysAgo);
      return formatDateStr(d);
    }

    // Fetch all data in parallel
    const currentYear = new Date().getFullYear();
    const sixtyDaysAgo = localDateStr(60);
    const [profilesRes, subscriptionsRes, receiptsRes, fiscalSettingsRes, userSessionsRes, notifTotalRes, notifReadRes, notifAnnouncementsRes, eventLogsRes, deletionsRes] = await Promise.all([
      serviceClient.from("profiles").select("id, user_id, first_name, last_name, onboarding_completed, created_at, user_code, is_internal, feedback_email_consent, admin_override_tier"),
      serviceClient.from("subscriptions").select("*"),
      serviceClient.from("receipts").select("id, user_id, gross_amount, receipt_date"),
      serviceClient.from("fiscal_year_settings").select("user_id, inps_management").eq("fiscal_year", currentYear),
      // User sessions: ALL time for lastSeenAt; filtered in JS for DAU/WAU/MAU (Story 22-1, 28-1)
      serviceClient.from("user_sessions").select("user_id, session_date, count"),
      // Notification stats: total count (HEAD-only, no data transfer)
      serviceClient.from("notifications").select("*", { count: "exact", head: true }),
      // Notification stats: read count (HEAD-only)
      serviceClient.from("notifications").select("*", { count: "exact", head: true }).not("read_at", "is", null),
      // Per-announcement read stats (uses existing metadata index, capped for safety)
      serviceClient.from("notifications").select("metadata, read_at").eq("type", "admin_announcement").limit(5000),
      // CTA funnel tracking: event_logs for last 30 days (Story 22-2) — includes user_id for internal filtering (Story 24-1)
      serviceClient.from("event_logs").select("event_name, created_at, user_id").in("event_name", ["add_income_click", "add_income_submitted", "import_xml_click", "import_xml_completed"]).gte("created_at", localDateStr(30) + "T00:00:00Z"),
      // Account deletions log (count only)
      serviceClient.from("account_deletions").select("*", { count: "exact", head: true }),
    ]);

    if (profilesRes.error) throw new Error(`Profiles query failed: ${profilesRes.error.message}`);
    if (subscriptionsRes.error) throw new Error(`Subscriptions query failed: ${subscriptionsRes.error.message}`);
    if (receiptsRes.error) throw new Error(`Receipts query failed: ${receiptsRes.error.message}`);
    if (fiscalSettingsRes.error) throw new Error(`Fiscal settings query failed: ${fiscalSettingsRes.error.message}`);
    // user_sessions may not exist yet (migration not applied) — graceful fallback
    if (userSessionsRes.error) console.warn(`User sessions query failed (table may not exist yet): ${userSessionsRes.error.message}`);
    // notifications table may not exist yet — graceful fallback
    if (notifTotalRes.error) console.warn(`Notification total query failed: ${notifTotalRes.error.message}`);
    if (notifReadRes.error) console.warn(`Notification read query failed: ${notifReadRes.error.message}`);
    if (notifAnnouncementsRes.error) console.warn(`Notification announcements query failed: ${notifAnnouncementsRes.error.message}`);
    // event_logs may not exist yet — graceful fallback
    if (eventLogsRes.error) console.warn(`Event logs query failed (table may not exist yet): ${eventLogsRes.error.message}`);
    // account_deletions may not exist yet — graceful fallback
    if (deletionsRes.error) console.warn(`Account deletions query failed (table may not exist yet): ${deletionsRes.error.message}`);

    const profiles = profilesRes.data || [];
    const subscriptions = subscriptionsRes.data || [];
    const receipts = receiptsRes.data || [];
    const fiscalSettings = fiscalSettingsRes.data || [];
    const userSessionRows = userSessionsRes.data || [];

    // === INTERNAL ACCOUNT FILTER (Story 24-1) ===
    const internalUserIds = new Set(
      profiles.filter((p: any) => p.is_internal).map((p) => p.user_id)
    );
    const externalProfiles = profiles.filter((p: any) => !p.is_internal);
    const externalSubscriptions = subscriptions.filter((s) => !internalUserIds.has(s.user_id));
    const externalReceipts = receipts.filter((r) => !internalUserIds.has(r.user_id));
    const externalFiscalSettings = fiscalSettings.filter((f) => !internalUserIds.has(f.user_id));

    // === USER STATS === (uses externalProfiles for accurate metrics)
    const totalUsers = externalProfiles.length;
    const onboardedUsers = externalProfiles.filter((p) => p.onboarding_completed).length;

    // Signups this month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const signupsThisMonth = externalProfiles.filter((p) => new Date(p.created_at) >= startOfMonth).length;

    // Signups by month (last 6 months)
    const signupsByMonth: { month: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const monthName = monthStart.toLocaleDateString("it-IT", { month: "short", year: "2-digit" });
      const count = externalProfiles.filter((p) => {
        const createdAt = new Date(p.created_at);
        return createdAt >= monthStart && createdAt <= monthEnd;
      }).length;
      signupsByMonth.push({ month: monthName, count });
    }

    // === SUBSCRIPTION STATS === (uses externalSubscriptions)
    const activeSubscriptions = externalSubscriptions.filter(
      (s) => s.tier === "pro" && (s.status === "active" || s.status === "trialing")
    );
    const proCount = activeSubscriptions.length;

    // MRR calculation
    let mrrCents = 0;
    for (const sub of activeSubscriptions) {
      if (sub.billing_interval === "month") {
        mrrCents += MRR_PRICES.pro_monthly;
      } else if (sub.billing_interval === "year") {
        mrrCents += MRR_PRICES.pro_annual;
      }
    }
    const arrCents = mrrCents * 12;

    // Churn: users with cancel_at_period_end = true
    const pendingChurnCount = externalSubscriptions.filter(
      (s) => s.cancel_at_period_end === true && s.status === "active"
    ).length;
    const totalActiveSubscriptions = activeSubscriptions.length;
    const churnRate = totalActiveSubscriptions > 0
      ? Math.round((pendingChurnCount / totalActiveSubscriptions) * 10000) / 100
      : 0;

    // === USAGE STATS === (uses externalReceipts)
    const usersWithReceipts = new Set(externalReceipts.map((r) => r.user_id)).size;

    // Story 14.4: Count external users with feedback email consent
    const usersWithFeedbackEmailConsent = externalProfiles.filter((p: any) => p.feedback_email_consent).length;

    // Pre-filter current year receipts (used by gestione metrics + derived metrics)
    const currentYearPrefix = `${currentYear}-`; // e.g. "2026-"
    const currentYearReceipts = externalReceipts.filter((r) => r.receipt_date?.startsWith(currentYearPrefix));

    // === GESTIONE INPS METRICS ===
    // Build lookup maps for ALL profiles (needed for userList) and subscriptions
    const profilesByUserId = new Map(profiles.map((p) => [p.user_id, p]));
    const subsByUser = new Map(subscriptions.map((s) => [s.user_id, s]));

    const gestioneMetrics: Record<string, { users: number; onboarded: number; onboardingRate: number; pro: number; conversionRate: number; receiptCount: number; receiptAmount: number }> = {
      separata: { users: 0, onboarded: 0, onboardingRate: 0, pro: 0, conversionRate: 0, receiptCount: 0, receiptAmount: 0 },
      artigiani: { users: 0, onboarded: 0, onboardingRate: 0, pro: 0, conversionRate: 0, receiptCount: 0, receiptAmount: 0 },
      commercianti: { users: 0, onboarded: 0, onboardingRate: 0, pro: 0, conversionRate: 0, receiptCount: 0, receiptAmount: 0 },
    };

    // Build userId → gestione lookup for receipt aggregation
    const gestioneByUserId = new Map<string, string>();

    for (const fs of externalFiscalSettings) {
      const gestione = fs.inps_management as string;
      if (!gestioneMetrics[gestione]) {
        console.warn(`Unexpected inps_management value: "${gestione}" for user ${fs.user_id}`);
        continue;
      }
      gestioneMetrics[gestione].users++;
      gestioneByUserId.set(fs.user_id, gestione);

      const profile = profilesByUserId.get(fs.user_id);
      if (profile?.onboarding_completed) gestioneMetrics[gestione].onboarded++;

      const sub = subsByUser.get(fs.user_id);
      if (sub?.tier === "pro" && (sub.status === "active" || sub.status === "trialing")) {
        gestioneMetrics[gestione].pro++;
      }
    }

    // Aggregate receipts by gestione (current year, external only)
    // Also count per-user receipts for distribution
    const receiptCountByUserGestione = new Map<string, number>();
    for (const r of currentYearReceipts) {
      const gestione = gestioneByUserId.get(r.user_id);
      if (gestione && gestioneMetrics[gestione]) {
        gestioneMetrics[gestione].receiptCount++;
        gestioneMetrics[gestione].receiptAmount += (r.gross_amount || 0);
        receiptCountByUserGestione.set(r.user_id, (receiptCountByUserGestione.get(r.user_id) || 0) + 1);
      }
    }

    // Build receipt distribution per gestione (buckets 0, 1, 2, 3, 4, 5+)
    const bucketLabelsG = ["0", "1", "2", "3", "4", "5+"];
    const gestioneDistribution: Record<string, { bucket: string; count: number; percent: number }[]> = {};
    for (const gestione of Object.keys(gestioneMetrics)) {
      const buckets = [0, 0, 0, 0, 0, 0];
      // Find all users of this gestione
      for (const fs of externalFiscalSettings) {
        if ((fs.inps_management as string) !== gestione) continue;
        const cnt = receiptCountByUserGestione.get(fs.user_id) || 0;
        buckets[Math.min(cnt, 5)]++;
      }
      const totalG = gestioneMetrics[gestione].users;
      gestioneDistribution[gestione] = bucketLabelsG.map((label, i) => ({
        bucket: label,
        count: buckets[i],
        percent: totalG > 0 ? Math.round((buckets[i] / totalG) * 10000) / 100 : 0,
      }));
    }

    // Calculate rates
    for (const m of Object.values(gestioneMetrics)) {
      m.onboardingRate = m.users > 0 ? Math.round((m.onboarded / m.users) * 10000) / 100 : 0;
      m.conversionRate = m.users > 0 ? Math.round((m.pro / m.users) * 10000) / 100 : 0;
    }

    // === DERIVED METRICS (FR52) === (uses externalReceipts)
    // Retention: users with receipts in 2+ distinct months THIS YEAR only
    const userMonths = new Map<string, Set<string>>();
    for (const r of externalReceipts) {
      const month = r.receipt_date?.substring(0, 7); // "YYYY-MM"
      if (!month || !r.user_id) continue;
      // Filter: only count receipts from the current fiscal year
      if (!month.startsWith(currentYearPrefix)) continue;
      if (!userMonths.has(r.user_id)) userMonths.set(r.user_id, new Set());
      userMonths.get(r.user_id)!.add(month);
    }
    const retainedUsers = [...userMonths.values()].filter((m) => m.size >= 2).length;
    const totalActiveUsers = userMonths.size;
    const retentionRate = totalActiveUsers > 0
      ? Math.round((retainedUsers / totalActiveUsers) * 10000) / 100
      : 0;

    // Avg receipts per active user (current year only)
    const avgReceiptsPerUser = totalActiveUsers > 0
      ? Math.round((currentYearReceipts.length / totalActiveUsers) * 100) / 100
      : 0;

    // === FREE RECEIPT DISTRIBUTION ===
    // Identify free users: those without an active pro/studio subscription
    const paidUserIds = new Set(
      externalSubscriptions
        .filter((s) => s.tier !== "free" && (s.status === "active" || s.status === "trialing"))
        .map((s) => s.user_id)
    );
    const freeExternalProfiles = externalProfiles.filter((p) => !paidUserIds.has(p.user_id) && p.onboarding_completed);

    // Count current-year receipts per free user
    const freeUserReceiptCounts = new Map<string, number>();
    for (const p of freeExternalProfiles) {
      freeUserReceiptCounts.set(p.user_id, 0);
    }
    for (const r of currentYearReceipts) {
      if (freeUserReceiptCounts.has(r.user_id)) {
        freeUserReceiptCounts.set(r.user_id, (freeUserReceiptCounts.get(r.user_id) || 0) + 1);
      }
    }

    // Bucket into 0, 1, 2, 3, 4, 5+
    const bucketLabels = ["0", "1", "2", "3", "4", "5+"];
    const bucketCounts = [0, 0, 0, 0, 0, 0];
    for (const count of freeUserReceiptCounts.values()) {
      const idx = Math.min(count, 5);
      bucketCounts[idx]++;
    }
    const totalFreeUsers = freeExternalProfiles.length;
    const freeReceiptDistribution = bucketLabels.map((label, i) => ({
      bucket: label,
      count: bucketCounts[i],
      percent: totalFreeUsers > 0
        ? Math.round((bucketCounts[i] / totalFreeUsers) * 10000) / 100
        : 0,
    }));

    const derivedMetrics = {
      retentionRate,
      avgReceiptsPerUser,
      freeReceiptDistribution,
    };

    // === NOTIFICATION STATS ===
    const totalNotifications = notifTotalRes.count ?? 0;
    const readNotifications = notifReadRes.count ?? 0;
    const overallOpenRate = totalNotifications > 0
      ? Math.round((readNotifications / totalNotifications) * 10000) / 100
      : 0;

    // Per-announcement read counts
    const announcementNotifs = notifAnnouncementsRes.data || [];
    const announcementReadCounts: Record<string, { sent: number; read: number; openRate: number }> = {};
    for (const n of announcementNotifs) {
      const annId = (n.metadata as Record<string, unknown> | null)?.announcement_id as string | undefined;
      if (!annId) continue;
      if (!announcementReadCounts[annId]) {
        announcementReadCounts[annId] = { sent: 0, read: 0, openRate: 0 };
      }
      announcementReadCounts[annId].sent++;
      if (n.read_at) announcementReadCounts[annId].read++;
    }
    for (const stats of Object.values(announcementReadCounts)) {
      stats.openRate = stats.sent > 0
        ? Math.round((stats.read / stats.sent) * 10000) / 100
        : 0;
    }

    const notificationStats = {
      totalNotifications,
      readNotifications,
      overallOpenRate,
      announcementReadCounts,
    };

    // === ACTIVITY KPI — DAU/WAU/MAU (Story 28-1) ===
    const todayStr = localDateStr(0);
    const yesterdayStr = localDateStr(1);
    const sevenDaysAgo = localDateStr(7);
    const fourteenDaysAgo = localDateStr(14);
    const thirtyDaysAgo = localDateStr(30);

    // Filter sessions: exclude internal users AND limit to last 60 days for activity KPI
    const externalSessionRows = userSessionRows.filter((r: any) => !internalUserIds.has(r.user_id) && r.session_date >= sixtyDaysAgo);

    function countUniqueUsers(rows: any[], from: string, to?: string): number {
      const users = new Set<string>();
      for (const r of rows) {
        if (r.session_date >= from && (!to || r.session_date < to)) {
          users.add(r.user_id);
        }
      }
      return users.size;
    }

    const dau = countUniqueUsers(externalSessionRows, todayStr);
    const dauPrev = countUniqueUsers(externalSessionRows, yesterdayStr, todayStr);
    const wau = countUniqueUsers(externalSessionRows, sevenDaysAgo);
    const wauPrev = countUniqueUsers(externalSessionRows, fourteenDaysAgo, sevenDaysAgo);
    const mau = countUniqueUsers(externalSessionRows, thirtyDaysAgo);
    const mauPrev = countUniqueUsers(externalSessionRows, sixtyDaysAgo, thirtyDaysAgo);

    const activityKpi = { dau, dauPrev, wau, wauPrev, mau, mauPrev };

    // === SIGNUP TREND — daily/weekly/monthly (Story 28-1) ===
    // Daily: last 30 days
    const signupDaily: { date: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const dayStr = localDateStr(i);
      const count = externalProfiles.filter((p) => formatDateStr(new Date(p.created_at)) === dayStr).length;
      signupDaily.push({ date: dayStr, count });
    }

    // Weekly: last 12 weeks (Mon-Sun buckets)
    // Fix C-1: getDay()=0 on Sunday → must subtract 6 to reach Monday, not add 1
    const signupWeekly: { week: string; count: number }[] = [];
    for (let w = 11; w >= 0; w--) {
      const weekStart = new Date();
      const dow = weekStart.getDay();
      const daysToMonday = dow === 0 ? 6 : dow - 1;
      weekStart.setDate(weekStart.getDate() - daysToMonday - w * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const wsStr = formatDateStr(weekStart);
      const weStr = formatDateStr(weekEnd);
      const count = externalProfiles.filter((p) => {
        const d = formatDateStr(new Date(p.created_at));
        return d >= wsStr && d < weStr;
      }).length;
      signupWeekly.push({ week: wsStr, count });
    }

    // Monthly: last 12 months
    const signupMonthly: { month: string; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const monthName = monthStart.toLocaleDateString("it-IT", { month: "short", year: "2-digit" });
      const count = externalProfiles.filter((p) => {
        const createdAt = new Date(p.created_at);
        return createdAt >= monthStart && createdAt <= monthEnd;
      }).length;
      signupMonthly.push({ month: monthName, count });
    }

    const signupTrend = { daily: signupDaily, weekly: signupWeekly, monthly: signupMonthly };

    // === ACTIVITY TREND — daily/weekly/monthly (Story 28-1) ===
    // Daily: last 30 days — unique users per day
    const activityDaily: { date: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const dayStr = localDateStr(i);
      const users = new Set<string>();
      for (const r of externalSessionRows) {
        if (r.session_date === dayStr) users.add(r.user_id);
      }
      activityDaily.push({ date: dayStr, count: users.size });
    }

    // Weekly: last 12 weeks — unique users per week
    // Fix C-1: same Sunday-safe Monday calculation
    const activityWeekly: { week: string; count: number }[] = [];
    for (let w = 11; w >= 0; w--) {
      const weekStart = new Date();
      const dowA = weekStart.getDay();
      const daysToMondayA = dowA === 0 ? 6 : dowA - 1;
      weekStart.setDate(weekStart.getDate() - daysToMondayA - w * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const wsStr = formatDateStr(weekStart);
      const weStr = formatDateStr(weekEnd);
      const users = new Set<string>();
      for (const r of externalSessionRows) {
        if (r.session_date >= wsStr && r.session_date < weStr) users.add(r.user_id);
      }
      activityWeekly.push({ week: wsStr, count: users.size });
    }

    // Monthly: last 12 months — unique users per month
    const activityMonthly: { month: string; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const msStr = formatDateStr(monthStart);
      const meStr = formatDateStr(monthEnd);
      const monthName = monthStart.toLocaleDateString("it-IT", { month: "short", year: "2-digit" });
      const users = new Set<string>();
      for (const r of externalSessionRows) {
        if (r.session_date >= msStr && r.session_date <= meStr) users.add(r.user_id);
      }
      activityMonthly.push({ month: monthName, count: users.size });
    }

    const activityTrend = { daily: activityDaily, weekly: activityWeekly, monthly: activityMonthly };

    // === CTA FUNNEL ANALYTICS (Story 22-2) === (excludes internal users — Story 24-1)
    const eventLogRows = (eventLogsRes.data || []).filter((r: any) => !internalUserIds.has(r.user_id));
    const ctaByEvent = new Map<string, { today: number; week: number; month: number }>();
    for (const row of eventLogRows) {
      const eventDate = formatDateStr(new Date(row.created_at));
      if (!ctaByEvent.has(row.event_name)) {
        ctaByEvent.set(row.event_name, { today: 0, week: 0, month: 0 });
      }
      const entry = ctaByEvent.get(row.event_name)!;
      entry.month += 1;
      if (eventDate >= sevenDaysAgo) entry.week += 1;
      if (eventDate === todayStr) entry.today += 1;
    }

    const ctaLabelMap: Record<string, string> = {
      "add_income_click": "Click Aggiungi Incasso",
      "add_income_submitted": "Incassi Creati",
      "import_xml_click": "Click Importa XML",
      "import_xml_completed": "Import Completati",
    };

    const ctaAnalytics = Object.entries(ctaLabelMap).map(([event, label]) => ({
      metricLabel: label,
      today: ctaByEvent.get(event)?.today ?? 0,
      week: ctaByEvent.get(event)?.week ?? 0,
      month: ctaByEvent.get(event)?.month ?? 0,
    }));

    // === BUILD USER LIST ===

    // Count current-year receipts per user (ALL users including internal — userList shows all)
    const allCurrentYearReceipts = receipts.filter((r) => r.receipt_date?.startsWith(currentYearPrefix));
    const receiptCountByUser = new Map<string, number>();
    for (const r of allCurrentYearReceipts) {
      if (!r.user_id) continue;
      receiptCountByUser.set(r.user_id, (receiptCountByUser.get(r.user_id) || 0) + 1);
    }

    // Gestione lookup for ALL users (including internal — needed for userList)
    const allGestioneByUserId = new Map<string, string>();
    for (const fs of fiscalSettings) {
      allGestioneByUserId.set(fs.user_id, fs.inps_management as string);
    }

    // Last seen date per user (most recent session_date from user_sessions)
    const lastSeenByUser = new Map<string, string>();
    for (const s of userSessionRows) {
      const uid = (s as any).user_id;
      const date = (s as any).session_date;
      if (!uid || !date) continue;
      const prev = lastSeenByUser.get(uid);
      if (!prev || date > prev) lastSeenByUser.set(uid, date);
    }

    const userList = profiles.map((p) => {
      const sub = subsByUser.get(p.user_id);
      return {
        id: p.user_id,
        userCode: (p as any).user_code || "",
        firstName: p.first_name || "",
        lastName: p.last_name || "",
        tier: sub?.tier || "free",
        status: sub?.status || null,
        cancelAtPeriodEnd: sub?.cancel_at_period_end || false,
        billingInterval: sub?.billing_interval || null,
        createdAt: p.created_at,
        isInternal: !!(p as any).is_internal,
        receiptCount: receiptCountByUser.get(p.user_id) || 0,
        onboardingCompleted: !!p.onboarding_completed,
        lastSeenAt: lastSeenByUser.get(p.user_id) || null,
        adminOverrideTier: (p as any).admin_override_tier ?? null,
        gestione: allGestioneByUserId.get(p.user_id) || null,
      };
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const response = {
      users: {
        total: totalUsers,
        onboarded: onboardedUsers,
        onboardingRate: totalUsers > 0 ? Math.round((onboardedUsers / totalUsers) * 10000) / 100 : 0,
        signupsThisMonth,
        signupsByMonth,
      },
      subscriptions: {
        proCount,
        conversionRate: totalUsers > 0 ? Math.round((proCount / totalUsers) * 10000) / 100 : 0,
        mrrCents,
        arrCents,
        pendingChurnCount,
        churnRate,
      },
      usage: {
        activeUsersWithReceipts: usersWithReceipts,
        usersWithFeedbackEmailConsent,
      },
      userList,
      gestioneMetrics,
      gestioneDistribution,
      derivedMetrics,
      notificationStats,
      ctaAnalytics,
      activityKpi,
      signupTrend,
      activityTrend,
      accountDeletions: deletionsRes.count ?? 0,
    };

    console.log(`Admin stats fetched: ${totalUsers} users, MRR €${(mrrCents / 100).toFixed(2)}, ${totalNotifications} notifiche (${overallOpenRate}% lette)`);

    return new Response(JSON.stringify(response), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
