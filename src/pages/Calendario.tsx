import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  addDays,
  startOfWeek,
  endOfWeek,
  isToday
} from "date-fns";
import { it } from "date-fns/locale";
import { AppLayout } from "@/components/layout/AppLayout";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { useCalendarEvents, CalendarEvent, CalendarEventType } from "@/hooks/useCalendarEvents";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { MarkAsPaidButton } from "@/components/scadenziario/MarkAsPaidButton";
import { useMarkAsPaid } from "@/hooks/useMarkAsPaid";
import { buildEngineSnapshot } from "@/lib/discrepancy";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { bucketToLabel, formatDateIT, getRataBreakdown, rataTypeLabel, deriveRataType } from "@/lib/schedule-helpers";
import { formatCurrency } from "@/lib/money";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Receipt,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  RefreshCw,
  MapPin
} from "lucide-react";
import { CalendarSurveyBanner } from "@/components/calendario/CalendarSurveyBanner";
import { GoogleCalendarConnect } from "@/components/calendario/GoogleCalendarConnect";
import { useCalendarConnection } from "@/hooks/useCalendarConnection";
import { useGoogleCalendarSync } from "@/hooks/useGoogleCalendarSync";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import { useUserRole } from "@/hooks/useUserRole";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

type CalendarView = "month" | "week";

/** Status label italiana per accessibilità */
const STATUS_LABEL: Record<string, string> = {
  paid: "Pagata",
  overdue: "Scaduta",
  due_soon: "In scadenza",
  upcoming: "In programma",
};

/** Returns a human-readable status string, aware of event type */
function eventStatusLabel(event: { type: CalendarEventType; status?: string }): string {
  if (event.type === "google_event") return "Evento";
  return STATUS_LABEL[event.status || "upcoming"];
}

/** Colori per categoria evento */
const EVENT_CATEGORY_COLORS: Record<CalendarEventType, {
  dot: string;
  badge: string;
  preview: string;
  filterActive: string;
  filterInactive: string;
  label: string;
  icon: string;
}> = {
  tax_deadline: {
    dot: "bg-teal-500",
    badge: "bg-teal-50 text-teal-700 border-teal-200",
    preview: "bg-teal-50 text-teal-800 border-teal-200/60",
    filterActive: "bg-teal-50 text-teal-700 border-teal-300 shadow-sm",
    filterInactive: "bg-white text-slate-500 border-slate-200 opacity-60",
    label: "Scadenze fiscali",
    icon: "text-teal-600",
  },
  tool_renewal: {
    dot: "bg-violet-500",
    badge: "bg-violet-50 text-violet-700 border-violet-200",
    preview: "bg-violet-50 text-violet-800 border-violet-200/60",
    filterActive: "bg-violet-50 text-violet-700 border-violet-300 shadow-sm",
    filterInactive: "bg-white text-slate-500 border-slate-200 opacity-60",
    label: "Rinnovi tool",
    icon: "text-violet-600",
  },
  google_event: {
    dot: "bg-slate-400",
    badge: "bg-slate-100 text-slate-600 border-slate-200",
    preview: "bg-slate-50 text-slate-600 border-slate-200/60",
    filterActive: "bg-slate-100 text-slate-600 border-slate-300 shadow-sm",
    filterInactive: "bg-white text-slate-500 border-slate-200 opacity-60",
    label: "Google Calendar",
    icon: "text-slate-500",
  },
};

export default function CalendarioPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const { isPro } = useSubscription();
  const { data: userRole } = useUserRole();
  const isAdmin = userRole === "admin";
  const hasFullAccess = isPro || isAdmin;
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [calendarView, setCalendarView] = useState<CalendarView>("month");
  const [activeFilters, setActiveFilters] = useState<Set<CalendarEventType>>(
    new Set(["tax_deadline", "tool_renewal"])
  );
  // OAuth denial state from Google redirect (?error=access_denied)
  const [oauthDenied, setOauthDenied] = useState(false);
  // Toggle to show/hide external (Google) events — persisted in localStorage
  const [showExternalEvents, setShowExternalEvents] = useState(() => {
    try {
      return localStorage.getItem("forfettino_show_external_events") !== "false";
    } catch {
      return true;
    }
  });
  const { toast } = useToast();

  // Google Calendar connection hook — Pro + Admin only
  const { handleCallback, isCallbackSuccess, isConnected: rawIsConnected, connectionStatus } = useCalendarConnection();
  const isConnected = hasFullAccess && rawIsConnected;

  console.log("[GCAL-DEBUG] Calendario gate:", { isPro, userRole, isAdmin, hasFullAccess, rawIsConnected, isConnected, connectionStatus });

  // Google Calendar sync — auto-syncs at mount when connected, reads cached events
  const { googleEvents, triggerSync, isSyncing, lastSyncedAt, syncError, rawSyncError } = useGoogleCalendarSync(currentMonth, isConnected);

  // Manual sync tracking — show toast only for user-triggered syncs (not auto-sync)
  const manualSyncRef = useRef(false);
  const prevSyncingRef = useRef(false);

  const handleManualSync = useCallback(() => {
    manualSyncRef.current = true;
    triggerSync();
  }, [triggerSync]);

  useEffect(() => {
    if (prevSyncingRef.current && !isSyncing && manualSyncRef.current) {
      manualSyncRef.current = false;
      // Manual sync always shows toast regardless of consecutiveFailures count (AC #3, Task 6.5)
      if (rawSyncError) {
        toast({ title: "Errore durante l'aggiornamento", variant: "destructive", duration: 5000 });
      } else {
        toast({ title: "Calendario aggiornato", duration: 3000 });
      }
    }
    prevSyncingRef.current = isSyncing;
  }, [isSyncing, rawSyncError, toast]);

  // Handle Google OAuth callback: code+state (success) or error (denial)
  const oauthHandled = useRef(false);
  useEffect(() => {
    if (oauthHandled.current) return;

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error === "access_denied") {
      oauthHandled.current = true;
      setOauthDenied(true);
      navigate("/calendario", { replace: true });
      return;
    }

    if (code && state) {
      oauthHandled.current = true;
      handleCallback(code, state);
      navigate("/calendario", { replace: true });
    }
  }, [searchParams, handleCallback, navigate]);

  // Track calendar page visits in localStorage for NPS trigger (Story 50-3)
  const calendarVisitCounted = useRef(false);
  useEffect(() => {
    if (calendarVisitCounted.current) return;
    calendarVisitCounted.current = true;
    try {
      const key = "forfettino_calendar_visits";
      const current = parseInt(localStorage.getItem(key) || "0", 10);
      localStorage.setItem(key, String(current + 1));
    } catch {
      // localStorage unavailable — silently skip
    }
  }, []);

  // Only pass Google events when connection is active (not error/revoked)
  const activeGoogleEvents = isConnected ? googleEvents : undefined;
  const { events, getEventsForDay, isLoading } = useCalendarEvents(currentMonth, activeGoogleEvents);

  // Filter events by active category filters + external toggle
  const isEventVisible = useCallback(
    (e: CalendarEvent) => {
      // Google events controlled by dedicated toggle, not category filters
      if (e.type === "google_event") return showExternalEvents;
      return activeFilters.has(e.type);
    },
    [activeFilters, showExternalEvents]
  );

  const filteredGetEventsForDay = useCallback(
    (day: Date): CalendarEvent[] => {
      return getEventsForDay(day).filter(isEventVisible);
    },
    [getEventsForDay, isEventVisible]
  );

  const filteredEvents = useMemo(
    () => events.filter(isEventVisible),
    [events, isEventVisible]
  );

  // Impostazioni fiscali anno corrente per lo snapshot engine sul mark-as-paid.
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();
  const { data: fiscalSettings } = useQuery({
    queryKey: ["fiscal_year_settings", user?.id, currentYear],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("fiscal_year_settings")
        .select("*")
        .eq("user_id", user.id)
        .eq("fiscal_year", currentYear)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!user,
  });

  // Task 2.3-2.4: MarkAsPaid mutation with Sheet close on success
  const markAsPaidMutation = useMarkAsPaid({
    onSuccess: () => {
      setSelectedEvent(null);
    },
  });

  // Generate calendar days — month view
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Generate calendar days — week view
  const weekStart = startOfWeek(currentMonth, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentMonth, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const goToPrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const goToPrevWeek = () => setCurrentMonth(addDays(currentMonth, -7));
  const goToNextWeek = () => setCurrentMonth(addDays(currentMonth, 7));
  const goToToday = () => setCurrentMonth(new Date());

  const goToPrev = calendarView === "month" ? goToPrevMonth : goToPrevWeek;
  const goToNext = calendarView === "month" ? goToNextMonth : goToNextWeek;

  const toggleFilter = (type: CalendarEventType) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        // Don't allow disabling all filters
        if (next.size > 1) next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const handleDayClick = (day: Date) => {
    setSelectedDay(day);
    const dayEvents = filteredGetEventsForDay(day);
    if (dayEvents.length === 1) {
      setSelectedEvent(dayEvents[0]);
    } else {
      setSelectedEvent(null);
    }
  };

  const getEventStatusColor = (status?: CalendarEvent["status"]) => {
    switch (status) {
      case "paid":
        return "bg-success/20 text-success border-success/30";
      case "overdue":
        return "bg-destructive/20 text-destructive border-destructive/30";
      case "due_soon":
        return "bg-warning/20 text-warning border-warning/30";
      default:
        return "bg-primary/20 text-primary border-primary/30";
    }
  };

  const getEventIcon = (event: CalendarEvent) => {
    if (event.type === "tax_deadline") {
      if (event.status === "paid") return <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />;
      if (event.status === "overdue") return <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden="true" />;
      return <Receipt className={cn("h-4 w-4", EVENT_CATEGORY_COLORS.tax_deadline.icon)} aria-hidden="true" />;
    }
    if (event.type === "google_event") {
      return <CalendarIcon className={cn("h-4 w-4", EVENT_CATEGORY_COLORS.google_event.icon)} aria-hidden="true" />;
    }
    return <Wrench className={cn("h-4 w-4", EVENT_CATEGORY_COLORS.tool_renewal.icon)} aria-hidden="true" />;
  };

  /** Category-colored dot for event preview */
  const getEventDotColor = (event: CalendarEvent) => {
    return EVENT_CATEGORY_COLORS[event.type].dot;
  };

  /** Category-colored preview badge for desktop cells */
  const getEventPreviewColor = (event: CalendarEvent) => {
    // If event has a critical status, show status color; otherwise show category color
    if (event.status === "overdue") return "bg-red-50 text-red-700 border-red-200/60";
    if (event.status === "paid") return "bg-emerald-50 text-emerald-700 border-emerald-200/60";
    return EVENT_CATEGORY_COLORS[event.type].preview;
  };

  // Task 3.4: Arrow key navigation between day cells
  const gridRef = useRef<HTMLDivElement>(null);
  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, dayIndex: number, cols: number) => {
      let targetIndex: number | null = null;
      switch (e.key) {
        case "ArrowRight":
          targetIndex = dayIndex + 1;
          break;
        case "ArrowLeft":
          targetIndex = dayIndex - 1;
          break;
        case "ArrowDown":
          targetIndex = dayIndex + cols;
          break;
        case "ArrowUp":
          targetIndex = dayIndex - cols;
          break;
        default:
          return; // Don't prevent default for other keys
      }
      e.preventDefault();
      if (targetIndex !== null && gridRef.current) {
        const buttons = gridRef.current.querySelectorAll<HTMLButtonElement>('[role="gridcell"]');
        if (targetIndex >= 0 && targetIndex < buttons.length) {
          buttons[targetIndex].focus();
        }
      }
    },
    []
  );

  // Navigation title
  const navTitle = calendarView === "month"
    ? format(currentMonth, "MMMM yyyy", { locale: it })
    : (() => {
        const ws = startOfWeek(currentMonth, { weekStartsOn: 1 });
        const we = endOfWeek(currentMonth, { weekStartsOn: 1 });
        const sameMonth = ws.getMonth() === we.getMonth();
        if (sameMonth) {
          return `${format(ws, "d", { locale: it })} – ${format(we, "d MMMM yyyy", { locale: it })}`;
        }
        return `${format(ws, "d MMM", { locale: it })} – ${format(we, "d MMM yyyy", { locale: it })}`;
      })();

  if (isLoading) {
    return (
      <AppLayout>
        {isMobile && <MobileHeader title="Calendario" />}
        <PageContainer>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-[400px] sm:h-[500px] w-full" />
        </PageContainer>
      </AppLayout>
    );
  }

  const renderDayCell = (day: Date, dayIndex: number, opts: { isMonthView: boolean; totalCols: number }) => {
    const dayEvents = filteredGetEventsForDay(day);
    const isCurrentMonth = opts.isMonthView ? isSameMonth(day, currentMonth) : true;
    const isSelected = selectedDay && isSameDay(day, selectedDay);
    const todayClass = isToday(day);
    const dayLabel = `${format(day, "d MMMM yyyy", { locale: it })}, ${dayEvents.length === 0 ? "nessuna scadenza" : `${dayEvents.length} scadenz${dayEvents.length === 1 ? "a" : "e"}`}`;

    const cellHeight = opts.isMonthView
      ? "min-h-[48px] sm:min-h-[60px] md:min-h-[80px]"
      : "min-h-[100px] sm:min-h-[120px]";

    return (
      <button
        key={day.toISOString()}
        onClick={() => handleDayClick(day)}
        onKeyDown={(e) => handleGridKeyDown(e, dayIndex, opts.totalCols)}
        role="gridcell"
        aria-label={dayLabel}
        aria-selected={isSelected || undefined}
        className={cn(
          "relative p-1 sm:p-1.5 border rounded-md sm:rounded-lg transition-all text-left min-w-0",
          cellHeight,
          "hover:bg-accent/50 hover:border-primary/30",
          !isCurrentMonth && "opacity-40",
          isSelected && "ring-2 ring-primary bg-primary/5",
          todayClass && "border-primary bg-primary/10"
        )}
      >
        <span
          className={cn(
            "text-xs sm:text-sm font-medium",
            todayClass && "text-primary font-bold"
          )}
        >
          {format(day, "d")}
        </span>

        {/* Events preview */}
        {isMobile && !opts.isMonthView ? (
          /* Mobile week view: show short text */
          <div className="mt-1 space-y-0.5">
            {dayEvents.slice(0, 3).map((event) => (
              <div
                key={event.id}
                className="flex items-center gap-1"
              >
                <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", getEventDotColor(event))} />
                <span className="text-xs sm:text-sm truncate text-slate-600">{event.title}</span>
              </div>
            ))}
          </div>
        ) : isMobile ? (
          /* Mobile month: compact dot indicators */
          dayEvents.length > 0 && (
            <div className="mt-0.5 flex gap-0.5 justify-center flex-wrap">
              {dayEvents.slice(0, 3).map((event) => (
                <div
                  key={event.id}
                  className={cn("h-1.5 w-1.5 rounded-full", getEventDotColor(event))}
                  aria-label={`${event.title}, ${eventStatusLabel(event)}`}
                />
              ))}
            </div>
          )
        ) : (
          /* Desktop: text preview with category colors */
          <div className="mt-1 space-y-1">
            {dayEvents.slice(0, opts.isMonthView ? 2 : 4).map((event) => (
              <div
                key={event.id}
                className={cn(
                  "text-xs px-1.5 py-0.5 rounded border truncate",
                  getEventPreviewColor(event)
                )}
                aria-label={`${event.title}, ${event.amount !== undefined ? formatCurrency(event.amount) : ""}, ${eventStatusLabel(event)}`}
              >
                {event.type === "tax_deadline" ? (
                  <Receipt className="inline h-3 w-3 mr-0.5 -mt-0.5" aria-hidden="true" />
                ) : event.type === "google_event" ? (
                  <CalendarIcon className="inline h-3 w-3 mr-0.5 -mt-0.5" aria-hidden="true" />
                ) : (
                  <Wrench className="inline h-3 w-3 mr-0.5 -mt-0.5" aria-hidden="true" />
                )}
                {event.title}
              </div>
            ))}
            {dayEvents.length > (opts.isMonthView ? 2 : 4) && (
              <div className="text-xs text-muted-foreground px-1.5">
                +{dayEvents.length - (opts.isMonthView ? 2 : 4)} altri
              </div>
            )}
          </div>
        )}
      </button>
    );
  };

  return (
    <AppLayout>
      {isMobile && <MobileHeader title="Calendario" />}
      <PageContainer>
        {/* Header - desktop only */}
        <div className="hidden md:flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Calendario</h1>
            <p className="text-muted-foreground">
              Scadenze fiscali e rinnovi tool
            </p>
          </div>
        </div>

        {/* Calendar usage survey (Story 48.1) */}
        <CalendarSurveyBanner />

        {/* Google Calendar connection (Story 48.3) — Pro + Admin only */}
        {hasFullAccess && (
          <GoogleCalendarConnect denied={oauthDenied} onSync={handleManualSync} isSyncing={isSyncing} />
        )}

        {/* Calendar Card */}
        <Card>
          <CardHeader className="pb-4">
            {/* Toolbar row 1: Navigation + View switcher + Oggi */}
            <div className="flex items-center justify-between gap-2">
              {/* Left: Month/Week navigation */}
              <div className="flex items-center gap-2 sm:gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goToPrev}
                  aria-label={calendarView === "month" ? "Mese precedente" : "Settimana precedente"}
                  className="min-h-[44px] min-w-[44px]"
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </Button>
                <CardTitle className="text-base sm:text-xl font-semibold capitalize min-w-[100px] sm:min-w-[180px] text-center">
                  {navTitle}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goToNext}
                  aria-label={calendarView === "month" ? "Mese successivo" : "Settimana successiva"}
                  className="min-h-[44px] min-w-[44px]"
                >
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </Button>
              </div>

              {/* Right: View switcher + Oggi */}
              <div className="flex items-center gap-2">
                {/* View switcher — segmented control */}
                <div className="hidden sm:flex items-center squircle-md border border-slate-200 p-0.5 bg-slate-50">
                  <button
                    onClick={() => setCalendarView("week")}
                    className={cn(
                      "px-3 py-1.5 text-sm font-medium squircle-md transition-all",
                      calendarView === "week"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    )}
                    aria-pressed={calendarView === "week"}
                  >
                    Settimana
                  </button>
                  <button
                    onClick={() => setCalendarView("month")}
                    className={cn(
                      "px-3 py-1.5 text-sm font-medium squircle-md transition-all",
                      calendarView === "month"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    )}
                    aria-pressed={calendarView === "month"}
                  >
                    Mese
                  </button>
                </div>

                <Button variant="outline" size="sm" onClick={goToToday}>
                  <CalendarIcon className="h-4 w-4 mr-1.5" />
                  Oggi
                </Button>
              </div>
            </div>

            {/* Toolbar row 2: Category filters */}
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-100">
              {(Object.keys(EVENT_CATEGORY_COLORS) as CalendarEventType[]).map((type) => {
                // Hide google_event filter button — controlled via the Eye toggle instead
                if (type === "google_event") return null;
                const config = EVENT_CATEGORY_COLORS[type];
                const isActive = activeFilters.has(type);
                return (
                  <button
                    key={type}
                    onClick={() => toggleFilter(type)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 squircle-full text-sm font-medium border transition-all",
                      isActive ? config.filterActive : config.filterInactive
                    )}
                    aria-pressed={isActive}
                    aria-label={`${isActive ? "Nascondi" : "Mostra"} ${config.label}`}
                  >
                    <div className={cn(
                      "h-2.5 w-2.5 rounded-full transition-colors",
                      isActive ? EVENT_CATEGORY_COLORS[type].dot : "bg-slate-300"
                    )} />
                    {config.label}
                    {isActive && (
                      <span className="text-xs opacity-70 ml-0.5">
                        ({filteredEvents.filter((e) => e.type === type).length})
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Toggle Google Calendar events — only visible when connected */}
              {isConnected && (
                <button
                  onClick={() => {
                    const next = !showExternalEvents;
                    setShowExternalEvents(next);
                    try { localStorage.setItem("forfettino_show_external_events", String(next)); } catch { /* localStorage unavailable — safe to ignore */ }
                  }}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 squircle-full text-sm font-medium border transition-all",
                    showExternalEvents
                      ? EVENT_CATEGORY_COLORS.google_event.filterActive
                      : EVENT_CATEGORY_COLORS.google_event.filterInactive
                  )}
                  aria-pressed={showExternalEvents}
                  aria-label={showExternalEvents ? "Nascondi Google Calendar" : "Mostra Google Calendar"}
                >
                  {showExternalEvents ? (
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  Google Calendar
                </button>
              )}

              {/* Mobile view switcher */}
              <div className="flex sm:hidden items-center gap-1 ml-auto">
                <button
                  onClick={() => setCalendarView("week")}
                  aria-pressed={calendarView === "week"}
                  className={cn(
                    "px-2 py-1 text-xs font-medium rounded transition-all",
                    calendarView === "week"
                      ? "bg-slate-200 text-slate-900"
                      : "text-slate-500"
                  )}
                >
                  Sett
                </button>
                <button
                  onClick={() => setCalendarView("month")}
                  aria-pressed={calendarView === "month"}
                  className={cn(
                    "px-2 py-1 text-xs font-medium rounded transition-all",
                    calendarView === "month"
                      ? "bg-slate-200 text-slate-900"
                      : "text-slate-500"
                  )}
                >
                  Mese
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-1 sm:mb-2" role="row">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="text-center text-xs sm:text-sm font-medium text-muted-foreground py-1 sm:py-2"
                  role="columnheader"
                >
                  {isMobile ? day.charAt(0) : day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div
              className="grid grid-cols-7 gap-0.5 sm:gap-1"
              role="grid"
              aria-label={calendarView === "month" ? "Calendario mensile scadenze" : "Calendario settimanale scadenze"}
              ref={gridRef}
            >
              {(calendarView === "month" ? calendarDays : weekDays).map((day, dayIndex) =>
                renderDayCell(day, dayIndex, {
                  isMonthView: calendarView === "month",
                  totalCols: 7,
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Events for selected day */}
        {selectedDay && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Eventi del {format(selectedDay, "d MMMM yyyy", { locale: it })}
              </CardTitle>
              <CardDescription>
                {filteredGetEventsForDay(selectedDay).length === 0
                  ? "Nessun evento in questa data"
                  : `${filteredGetEventsForDay(selectedDay).length} eventi`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredGetEventsForDay(selectedDay).map((event) => (
                  <div
                    key={event.id}
                    className={cn(
                      "flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-lg border cursor-pointer gap-2",
                      "hover:shadow-md transition-shadow min-h-[44px]",
                      getEventStatusColor(event.status)
                    )}
                    onClick={() => setSelectedEvent(event)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedEvent(event);
                      }
                    }}
                    aria-label={`${event.title}, ${eventStatusLabel(event)}`}
                  >
                    <div className="flex items-center gap-3">
                      {getEventIcon(event)}
                      <div>
                        <p className="font-medium">{event.title}</p>
                        <p className="text-sm opacity-80">
                          {eventStatusLabel(event)}
                        </p>
                      </div>
                    </div>
                    {event.amount !== undefined && event.amount > 0 && (
                      <span className="font-bold">
                        {formatCurrency(event.amount)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upcoming events summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Prossimi Eventi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredEvents
                .filter((e) => e.date >= new Date() && e.status !== "paid")
                .sort((a, b) => a.date.getTime() - b.date.getTime())
                .slice(0, 5)
                .map((event) => (
                  <div
                    key={event.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg bg-muted/50 gap-2"
                  >
                    <div className="flex items-center gap-3">
                      {getEventIcon(event)}
                      <div>
                        <p className="font-medium">{event.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(event.date, "d MMMM yyyy", { locale: it })}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      {event.amount !== undefined && event.amount > 0 && (
                        <span className="font-bold">{formatCurrency(event.amount)}</span>
                      )}
                      {(event.type === "tax_deadline" || event.type === "google_event") && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedEvent(event)}
                          className="w-full sm:w-auto min-h-[44px] sm:min-h-0"
                        >
                          Dettaglio
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              {filteredEvents.filter((e) => e.date >= new Date() && e.status !== "paid").length === 0 && (
                <p className="text-muted-foreground text-center py-4">
                  Nessun evento in programma
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </PageContainer>

      {/* Event Detail Sheet */}
      <Sheet open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <SheetContent>
          {selectedEvent && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {getEventIcon(selectedEvent)}
                  {selectedEvent.title}
                </SheetTitle>
                <SheetDescription>
                  {format(selectedEvent.date, "EEEE d MMMM yyyy", { locale: it })}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-4">
                {/* Google event detail — flat slate style */}
                {selectedEvent.type === "google_event" && (
                  <>
                    <div className="p-4 rounded-lg bg-slate-50">
                      <p className="text-sm text-slate-500 mb-1">Data e ora</p>
                      <p className="font-medium text-slate-800">
                        {selectedEvent.allDay
                          ? "Tutto il giorno"
                          : format(selectedEvent.date, "HH:mm", { locale: it })}
                      </p>
                    </div>
                    {selectedEvent.location && (
                      <div className="p-4 rounded-lg bg-slate-50">
                        <p className="text-sm text-slate-500 mb-1 flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                          Luogo
                        </p>
                        <p className="font-medium text-slate-800">{selectedEvent.location}</p>
                      </div>
                    )}
                    {selectedEvent.details && (
                      <div className="p-4 rounded-lg bg-slate-50">
                        <p className="text-sm text-slate-500 mb-1">Dettagli</p>
                        <p className="text-sm text-slate-700">{selectedEvent.details}</p>
                      </div>
                    )}
                  </>
                )}

                {/* Tax/tool event details */}
                {selectedEvent.type !== "google_event" && (
                  <>
                {/* Tipo rata */}
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground mb-1">Tipo</p>
                  <p className="font-medium">
                    {selectedEvent.type === "tax_deadline" && selectedEvent.bucket
                      ? `${bucketToLabel(selectedEvent.bucket, format(selectedEvent.date, "yyyy-MM-dd"))} — ${rataTypeLabel(deriveRataType(selectedEvent.bucket))}`
                      : selectedEvent.type === "tax_deadline"
                        ? "Scadenza Fiscale"
                        : "Rinnovo Subscription"
                    }
                  </p>
                </div>

                {/* Stato */}
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground mb-1">Stato</p>
                  <Badge className={getEventStatusColor(selectedEvent.status)}>
                    {getEventIcon(selectedEvent)}
                    <span className="ml-1">{STATUS_LABEL[selectedEvent.status || "upcoming"]}</span>
                  </Badge>
                </div>

                {/* Data scadenza */}
                {selectedEvent.type === "tax_deadline" && selectedEvent.scheduleRow && (
                  <div className="p-4 rounded-lg bg-muted">
                    <p className="text-sm text-muted-foreground mb-1">Data scadenza</p>
                    <p className="font-medium">{formatDateIT(selectedEvent.scheduleRow.due_date)}</p>
                  </div>
                )}

                {/* Importi dettagliati */}
                {selectedEvent.type === "tax_deadline" && selectedEvent.totalExpected !== undefined && (
                  <div className="p-4 rounded-lg bg-muted space-y-2">
                    <p className="text-sm text-muted-foreground mb-1">Importi</p>
                    <div className="flex justify-between">
                      <span className="text-sm">Importo previsto</span>
                      <span className="font-medium">{formatCurrency(selectedEvent.totalExpected)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Importo pagato</span>
                      <span className="font-medium">{formatCurrency(selectedEvent.totalPaid ?? 0)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-sm font-medium">Residuo</span>
                      <span className="text-lg font-bold">{formatCurrency(selectedEvent.amount ?? 0)}</span>
                    </div>
                  </div>
                )}

                {/* Breakdown */}
                {selectedEvent.type === "tax_deadline" && selectedEvent.scheduleRow && (() => {
                  const breakdown = getRataBreakdown(selectedEvent.scheduleRow);
                  if (breakdown.length === 0) return null;
                  return (
                    <div className="p-4 rounded-lg bg-muted space-y-2">
                      <p className="text-sm text-muted-foreground mb-1">Composizione</p>
                      {breakdown.map((item, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span className="text-sm">{item.label}</span>
                          <span className="font-medium">{formatCurrency(item.value)}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Tool renewal details */}
                {selectedEvent.type === "tool_renewal" && selectedEvent.amount !== undefined && (
                  <div className="p-4 rounded-lg bg-muted">
                    <p className="text-sm text-muted-foreground mb-1">Importo</p>
                    <p className="text-2xl font-bold">{formatCurrency(selectedEvent.amount)}</p>
                  </div>
                )}

                {selectedEvent.type === "tool_renewal" && selectedEvent.details && (
                  <div className="p-4 rounded-lg bg-muted">
                    <p className="text-sm text-muted-foreground mb-1">Dettagli</p>
                    <p className="font-medium">{selectedEvent.details}</p>
                  </div>
                )}
                  </>
                )}

                {/* Actions — only for tax/tool events */}
                {selectedEvent.type !== "google_event" && (
                <div className="flex flex-col gap-2 pt-4">
                  {selectedEvent.type === "tax_deadline" &&
                    selectedEvent.status !== "paid" &&
                    selectedEvent.scheduleRow && (
                      <MarkAsPaidButton
                        schedule={selectedEvent.scheduleRow}
                        onConfirm={(paymentDate, payload) => {
                          markAsPaidMutation.mutate({
                            schedule: selectedEvent.scheduleRow!,
                            paymentDate,
                            amountPaidCents: payload.amountPaidCents,
                            reasonCode: payload.reasonCode,
                            note: payload.note,
                            paymentWindow: payload.paymentWindow,
                            surchargeCents: payload.surchargeCents,
                            engineSnapshot: buildEngineSnapshot(selectedEvent.scheduleRow!, fiscalSettings ?? null),
                            trackingContext: payload.context,
                          });
                        }}
                        isPending={markAsPaidMutation.isPending}
                      />
                    )}
                  {selectedEvent.type === "tax_deadline" && (
                    <Button
                      variant="outline"
                      className="w-full min-h-[44px]"
                      onClick={() => {
                        setSelectedEvent(null);
                        navigate("/scadenziario");
                      }}
                    >
                      Vai allo Scadenziario
                    </Button>
                  )}
                  {selectedEvent.type === "tool_renewal" && (
                    <Button
                      variant="outline"
                      className="w-full min-h-[44px]"
                      onClick={() => {
                        setSelectedEvent(null);
                        navigate("/tool");
                      }}
                    >
                      Gestisci Tool
                    </Button>
                  )}
                </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
