import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { startOfMonth, endOfMonth, addMonths, subMonths, format, isSameDay, parseISO, isWithinInterval, isBefore } from "date-fns";
import { bucketToLabel, getScheduleStatus, type ScheduleDisplayStatus } from "@/lib/schedule-helpers";
import { formatCurrency } from "@/lib/money";
import type { Database } from "@/integrations/supabase/types";
import type { GoogleCalendarEvent } from "@/hooks/useGoogleCalendarSync";

type TaxScheduleRow = Database["public"]["Tables"]["tax_schedule"]["Row"];

export type CalendarEventType = "tax_deadline" | "tool_renewal" | "google_event";

export interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: CalendarEventType;
  status?: "upcoming" | "due_soon" | "overdue" | "paid";
  relatedId: string;
  amount?: number;
  details?: string;
  /** Original bucket from tax_schedule (e.g. "inps_q1", "june", "acconto_tax_2") */
  bucket?: string;
  /** Full TaxScheduleRow — available for tax_deadline events, used by MarkAsPaidButton */
  scheduleRow?: TaxScheduleRow;
  /** Total expected amount from schedule */
  totalExpected?: number;
  /** Total already paid amount */
  totalPaid?: number;
  /** Location string (Google Calendar events) */
  location?: string;
  /** True for all-day events (Google Calendar) */
  allDay?: boolean;
}

/** Maps getScheduleStatus() Italian output to CalendarEvent status */
const STATUS_MAP: Record<ScheduleDisplayStatus, CalendarEvent["status"]> = {
  pagata: "paid",
  scaduta: "overdue",
  imminente: "due_soon",
  da_pagare: "upcoming",
};

/**
 * Given a renewal_date and frequency, generate all occurrence dates
 * that fall within [rangeStart, rangeEnd].
 * Monthly: same day each month from renewal_date onward.
 * Quarterly: every 3 months from renewal_date onward.
 * Yearly: same month/day each year from renewal_date onward.
 */
function expandRecurringDates(
  renewalDate: Date,
  frequency: string,
  rangeStart: Date,
  rangeEnd: Date
): Date[] {
  const step = frequency === "quarterly" ? 3 : frequency === "yearly" ? 12 : 1;
  const dates: Date[] = [];

  // Start from renewalDate and step forward
  let current = renewalDate;
  while (isBefore(current, rangeStart) || isSameDay(current, rangeStart) || isBefore(current, rangeEnd)) {
    if (isBefore(current, rangeStart)) {
      current = addMonths(current, step);
      continue;
    }
    if (isWithinInterval(current, { start: rangeStart, end: rangeEnd })) {
      dates.push(current);
    }
    if (!isBefore(current, rangeEnd)) break;
    current = addMonths(current, step);
  }

  return dates;
}

export function useCalendarEvents(selectedDate: Date, googleEvents?: GoogleCalendarEvent[]) {
  const { user } = useAuth();

  // Get date range for current month view (with buffer for prev/next month days)
  const startDate = useMemo(() => subMonths(startOfMonth(selectedDate), 1), [selectedDate.getTime()]);
  const endDate = useMemo(() => addMonths(endOfMonth(selectedDate), 1), [selectedDate.getTime()]);

  // Fetch tax deadlines
  const { data: taxDeadlines, isLoading: taxLoading } = useQuery({
    queryKey: ["calendar_tax_deadlines", user?.id, format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd")],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("tax_schedule")
        .select("*")
        .eq("user_id", user.id)
        .gte("due_date", format(startDate, "yyyy-MM-dd"))
        .lte("due_date", format(endDate, "yyyy-MM-dd"))
        .order("due_date");
      if (error) throw error;
      return (data || []) as TaxScheduleRow[];
    },
    enabled: !!user,
  });

  // Fetch all active tool subscriptions (no date filter — we expand recurrences client-side)
  // Tools without renewal_date use created_at as fallback start date
  const { data: toolRenewals, isLoading: toolsLoading } = useQuery({
    queryKey: ["calendar_tool_renewals", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("tool_subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("renewal_date");
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Transform to calendar events - memoized to prevent unnecessary re-renders
  const events = useMemo(() => {
    const eventsList: CalendarEvent[] = [];

    // Tax deadlines — use schedule-helpers for titles and status
    taxDeadlines?.forEach((deadline) => {
      const dueDate = parseISO(deadline.due_date);
      const totalExpected = Number(deadline.total_expected);
      const totalPaid = Number(deadline.total_paid);
      const remaining = totalExpected - totalPaid;

      // Task 1.2: Use getScheduleStatus from schedule-helpers (no duplicated logic)
      const displayStatus = getScheduleStatus(deadline);
      const status = STATUS_MAP[displayStatus];

      eventsList.push({
        id: `tax-${deadline.id}`,
        // Task 1.1: Use bucketToLabel for correct title across all gestioni
        // dueDate => label segue il mese reale (proroghe per-anno, es. june→Luglio 2026)
        title: bucketToLabel(deadline.bucket, deadline.due_date),
        date: dueDate,
        type: "tax_deadline",
        status,
        relatedId: deadline.id,
        amount: remaining,
        details: `Previsto: ${formatCurrency(totalExpected)} | Pagato: ${formatCurrency(totalPaid)}`,
        // Task 1.4: bucket field
        bucket: deadline.bucket,
        // Task 1.5: full schedule row for MarkAsPaidButton
        scheduleRow: deadline,
        // Task 1.3: separate amount fields for detailed Sheet view
        totalExpected,
        totalPaid,
      });
    });

    // Tool renewals - expand recurring dates into the visible range
    // If renewal_date is null, fall back to created_at (first day of tool)
    toolRenewals?.forEach((tool) => {
      const dateSource = tool.renewal_date || tool.created_at;
      if (!dateSource) return;

      const renewalDate = parseISO(dateSource);
      const frequency = tool.frequency || "monthly";
      const today = new Date();

      const occurrences = expandRecurringDates(renewalDate, frequency, startDate, endDate);

      occurrences.forEach((occDate, idx) => {
        eventsList.push({
          id: `tool-${tool.id}-${format(occDate, "yyyy-MM")}`,
          title: `Rinnovo: ${tool.name}`,
          date: occDate,
          type: "tool_renewal",
          status: occDate < today ? "overdue" : "upcoming",
          relatedId: tool.id,
          amount: Number(tool.cost),
          details: `${frequency === "yearly" ? "Annuale" : frequency === "quarterly" ? "Trimestrale" : "Mensile"} - ${formatCurrency(Number(tool.cost))}`,
        });
      });
    });

    // Google Calendar events — convert and merge
    googleEvents?.forEach((ge) => {
      // Timezone-safe parse: start_at already has T00:00:00 for all-day events
      const eventDate = parseISO(ge.start_at);
      if (isNaN(eventDate.getTime())) return;

      eventsList.push({
        id: `google-${ge.external_id}`,
        title: ge.title,
        date: eventDate,
        type: "google_event",
        status: undefined,
        relatedId: ge.external_id,
        amount: undefined,
        details: ge.description || undefined,
        location: ge.location || undefined,
        allDay: ge.all_day,
      });
    });

    // Sort all events by date
    eventsList.sort((a, b) => a.date.getTime() - b.date.getTime());

    return eventsList;
  }, [taxDeadlines, toolRenewals, startDate, endDate, googleEvents]);

  // Helper to get events for a specific day - memoized
  const getEventsForDay = useMemo(() => {
    return (day: Date): CalendarEvent[] => {
      return events.filter((event) => isSameDay(event.date, day));
    };
  }, [events]);

  return {
    events,
    getEventsForDay,
    isLoading: taxLoading || toolsLoading,
  };
}
