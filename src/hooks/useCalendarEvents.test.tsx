/**
 * Test per useCalendarEvents hook
 * Story 5.4 — Visualizzazione Scadenze nel Calendario Integrato
 *
 * Copertura:
 * - Task 1.1: bucketToLabel genera titoli corretti per tutti i bucket
 * - Task 1.2: getScheduleStatus → status mapping corretto
 * - Task 1.3-1.5: CalendarEvent arricchito con bucket, scheduleRow, totalExpected, totalPaid
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Mock auth
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "test-user-id" } }),
}));

// --- Mock chain for tax_schedule: .select().eq().gte().lte().order() ---
const mockTaxOrder = vi.fn();
const mockTaxLte = vi.fn(() => ({ order: mockTaxOrder }));
const mockTaxGte = vi.fn(() => ({ lte: mockTaxLte }));
const mockTaxEq = vi.fn(() => ({ gte: mockTaxGte }));
const mockTaxSelect = vi.fn(() => ({ eq: mockTaxEq }));

// --- Mock chain for tool_subscriptions: .select().eq().eq().order() ---
const mockToolOrder = vi.fn();
const mockToolEq2 = vi.fn(() => ({ order: mockToolOrder }));
const mockToolEq1 = vi.fn(() => ({ eq: mockToolEq2 }));
const mockToolSelect = vi.fn(() => ({ eq: mockToolEq1 }));

const mockFrom = vi.fn((table: string) => {
  if (table === "tax_schedule") {
    return { select: mockTaxSelect };
  }
  return { select: mockToolSelect };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...(args as [string])),
  },
}));

import { useCalendarEvents } from "./useCalendarEvents";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

function mockScheduleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "sched-1",
    user_id: "test-user-id",
    bucket: "june",
    due_date: "2026-06-30",
    payment_year: 2026,
    reference_year: 2025,
    tax_balance: 500,
    tax_advance: 300,
    inps_balance: 200,
    inps_advance: 100,
    total_expected: 1100,
    total_paid: 0,
    status: "open",
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

/** Sets up mock returns for a single test with given tax schedule rows and tool rows */
function setupMocks(
  taxRows: Record<string, unknown>[] = [],
  toolRows: Record<string, unknown>[] = []
) {
  mockTaxOrder.mockResolvedValue({ data: taxRows, error: null });
  mockToolOrder.mockResolvedValue({ data: toolRows, error: null });
}

function mockToolRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "tool-1",
    user_id: "test-user-id",
    name: "Notion",
    cost: 10,
    frequency: "monthly",
    category: "tool",
    is_active: true,
    is_recurring: true,
    renewal_date: "2026-01-15",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("useCalendarEvents", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-05-15T12:00:00"));
    vi.clearAllMocks();
    // Default: empty data for both tables
    setupMocks([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Task 1.1 — bucketToLabel titles (AC: 2)", () => {
    it("should use bucketToLabel for Art/Comm INPS Q1 bucket title", async () => {
      setupMocks([
        mockScheduleRow({
          id: "q1",
          bucket: "inps_q1",
          due_date: "2026-05-16",
          total_expected: 500,
          total_paid: 0,
          status: "open",
        }),
      ]);

      const { result } = renderHook(
        () => useCalendarEvents(new Date("2026-05-01")),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.events.length).toBeGreaterThan(0);
      });

      const event = result.current.events.find((e) => e.id === "tax-q1");
      expect(event).toBeDefined();
      expect(event!.title).toBe("Rata INPS Q1 (Feb)");
    });

    it("should use bucketToLabel for Separata june bucket title", async () => {
      setupMocks([
        mockScheduleRow({
          id: "j1",
          bucket: "june",
          due_date: "2026-06-30",
          total_expected: 1100,
          total_paid: 0,
          status: "open",
        }),
      ]);

      const { result } = renderHook(
        () => useCalendarEvents(new Date("2026-06-01")),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.events.length).toBeGreaterThan(0);
      });

      const event = result.current.events.find((e) => e.id === "tax-j1");
      expect(event).toBeDefined();
      expect(event!.title).toBe("Rata Giugno");
    });

    it("should use bucketToLabel for acconto_tax_2 bucket", async () => {
      setupMocks([
        mockScheduleRow({
          id: "at2",
          bucket: "acconto_tax_2",
          due_date: "2026-05-20",
          total_expected: 400,
          total_paid: 0,
          status: "open",
        }),
      ]);

      const { result } = renderHook(
        () => useCalendarEvents(new Date("2026-05-01")),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.events.length).toBeGreaterThan(0);
      });

      const event = result.current.events.find((e) => e.id === "tax-at2");
      expect(event).toBeDefined();
      expect(event!.title).toBe("II° Acconto Imposta");
    });
  });

  describe("Task 1.2 — status mapping via getScheduleStatus (AC: 1)", () => {
    it("should map paid status correctly", async () => {
      setupMocks([
        mockScheduleRow({
          id: "paid-1",
          bucket: "june",
          due_date: "2026-06-30",
          status: "paid",
          total_expected: 1100,
          total_paid: 1100,
        }),
      ]);

      const { result } = renderHook(
        () => useCalendarEvents(new Date("2026-06-01")),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.events.length).toBeGreaterThan(0);
      });

      const event = result.current.events.find((e) => e.id === "tax-paid-1");
      expect(event!.status).toBe("paid");
    });

    it("should map overdue status for past-due unpaid schedules", async () => {
      setupMocks([
        mockScheduleRow({
          id: "overdue-1",
          bucket: "inps_q1",
          due_date: "2026-04-01",
          status: "open",
          total_expected: 500,
          total_paid: 0,
        }),
      ]);

      const { result } = renderHook(
        () => useCalendarEvents(new Date("2026-05-01")),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.events.length).toBeGreaterThan(0);
      });

      const event = result.current.events.find((e) => e.id === "tax-overdue-1");
      expect(event!.status).toBe("overdue");
    });

    it("should map due_soon status for schedules due within 30 days", async () => {
      setupMocks([
        mockScheduleRow({
          id: "duesoon-1",
          bucket: "june",
          // 10 days from 2026-05-15 → imminente → due_soon
          due_date: "2026-05-25",
          status: "open",
          total_expected: 1100,
          total_paid: 0,
        }),
      ]);

      const { result } = renderHook(
        () => useCalendarEvents(new Date("2026-05-01")),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.events.length).toBeGreaterThan(0);
      });

      const event = result.current.events.find((e) => e.id === "tax-duesoon-1");
      expect(event!.status).toBe("due_soon");
    });

    it("should map upcoming status for schedules due in >30 days", async () => {
      setupMocks([
        mockScheduleRow({
          id: "upcoming-1",
          bucket: "november",
          // Far future → da_pagare → upcoming
          due_date: "2026-11-30",
          status: "open",
          total_expected: 800,
          total_paid: 0,
        }),
      ]);

      const { result } = renderHook(
        () => useCalendarEvents(new Date("2026-05-01")),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.events.length).toBeGreaterThan(0);
      });

      const event = result.current.events.find((e) => e.id === "tax-upcoming-1");
      expect(event!.status).toBe("upcoming");
    });
  });

  describe("Recurring tool expansion — monthly/quarterly/yearly", () => {
    it("should generate a monthly tool event for the viewed month", async () => {
      // renewal_date = Jan 15, frequency = monthly → should appear on May 15
      setupMocks([], [mockToolRow({ id: "monthly-1", renewal_date: "2026-01-15", frequency: "monthly" })]);

      const { result } = renderHook(
        () => useCalendarEvents(new Date("2026-05-01T00:00:00")),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.events.length).toBeGreaterThan(0);
      });

      const toolEvents = result.current.events.filter((e) => e.type === "tool_renewal");
      // Should have occurrence on May 15
      const mayEvent = toolEvents.find((e) => e.date.getMonth() === 4 && e.date.getDate() === 15);
      expect(mayEvent).toBeDefined();
      expect(mayEvent!.title).toContain("Notion");
    });

    it("should generate monthly tool events for adjacent months in view range", async () => {
      // Calendar view for May also buffers April and June
      setupMocks([], [mockToolRow({ id: "monthly-2", renewal_date: "2026-01-15", frequency: "monthly" })]);

      const { result } = renderHook(
        () => useCalendarEvents(new Date("2026-05-01T00:00:00")),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.events.length).toBeGreaterThan(0);
      });

      const toolEvents = result.current.events.filter((e) => e.type === "tool_renewal");
      // Should have occurrences in April, May, and June (buffer months)
      expect(toolEvents.length).toBeGreaterThanOrEqual(2);
    });

    it("should generate quarterly tool events every 3 months from renewal_date", async () => {
      // renewal_date = Jan 15, frequency = quarterly → Jan 15, Apr 15, Jul 15, Oct 15
      // Viewing July → should see Jul 15 occurrence
      setupMocks([], [mockToolRow({ id: "quarterly-1", renewal_date: "2026-01-15", frequency: "quarterly" })]);

      const { result } = renderHook(
        () => useCalendarEvents(new Date("2026-07-01T00:00:00")),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.events.length).toBeGreaterThan(0);
      });

      const toolEvents = result.current.events.filter((e) => e.type === "tool_renewal");
      const julEvent = toolEvents.find((e) => e.date.getMonth() === 6 && e.date.getDate() === 15);
      expect(julEvent).toBeDefined();
    });

    it("should NOT generate quarterly tool event in non-matching month", async () => {
      // renewal_date = Jan 15, frequency = quarterly → next: Apr 15, Jul 15
      // Viewing May → no quarterly occurrence (May is not a quarterly month from Jan)
      setupMocks([], [mockToolRow({ id: "quarterly-2", renewal_date: "2026-01-15", frequency: "quarterly" })]);

      const { result } = renderHook(
        () => useCalendarEvents(new Date("2026-05-01T00:00:00")),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const toolEvents = result.current.events.filter((e) => e.type === "tool_renewal");
      // May is NOT a quarter from Jan (Jan+3=Apr, +6=Jul) — but buffer includes Apr and Jun
      // Apr 15 could be in range (startDate = Apr 1). Check no May 15 event:
      const mayEvent = toolEvents.find((e) => e.date.getMonth() === 4);
      expect(mayEvent).toBeUndefined();
    });

    it("should generate yearly tool event only on the renewal month", async () => {
      // renewal_date = Mar 15, frequency = yearly → only Mar 15 each year
      // Viewing March → should see event
      setupMocks([], [mockToolRow({ id: "yearly-1", renewal_date: "2026-03-15", frequency: "yearly" })]);

      const { result } = renderHook(
        () => useCalendarEvents(new Date("2026-03-01T00:00:00")),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.events.length).toBeGreaterThan(0);
      });

      const toolEvents = result.current.events.filter((e) => e.type === "tool_renewal");
      expect(toolEvents.length).toBe(1);
      expect(toolEvents[0].date.getMonth()).toBe(2); // March
      expect(toolEvents[0].date.getDate()).toBe(15);
    });

    it("should NOT generate yearly tool event in non-renewal month", async () => {
      // renewal_date = Mar 15, frequency = yearly → only March
      // Viewing August → no event
      setupMocks([], [mockToolRow({ id: "yearly-2", renewal_date: "2026-03-15", frequency: "yearly" })]);

      const { result } = renderHook(
        () => useCalendarEvents(new Date("2026-08-01T00:00:00")),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const toolEvents = result.current.events.filter((e) => e.type === "tool_renewal");
      expect(toolEvents.length).toBe(0);
    });

    it("should use created_at as fallback when renewal_date is null", async () => {
      // Tool without renewal_date → uses created_at (Jan 10) as start, frequency monthly
      setupMocks([], [mockToolRow({
        id: "no-renewal",
        renewal_date: null,
        created_at: "2026-01-10T00:00:00Z",
        frequency: "monthly",
      })]);

      const { result } = renderHook(
        () => useCalendarEvents(new Date("2026-05-01T00:00:00")),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.events.length).toBeGreaterThan(0);
      });

      const toolEvents = result.current.events.filter((e) => e.type === "tool_renewal");
      const mayEvent = toolEvents.find((e) => e.date.getMonth() === 4 && e.date.getDate() === 10);
      expect(mayEvent).toBeDefined();
      expect(mayEvent!.title).toContain("Notion");
    });

    it("should not generate events before the renewal_date", async () => {
      // renewal_date = Jun 15, frequency = monthly → should NOT appear in May (before start)
      setupMocks([], [mockToolRow({ id: "future-1", renewal_date: "2026-06-15", frequency: "monthly" })]);

      const { result } = renderHook(
        () => useCalendarEvents(new Date("2026-04-01T00:00:00")),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const toolEvents = result.current.events.filter((e) => e.type === "tool_renewal");
      expect(toolEvents.length).toBe(0);
    });
  });

  describe("Task 1.3-1.5 — CalendarEvent enrichment (AC: 3)", () => {
    it("should include bucket field in CalendarEvent", async () => {
      setupMocks([
        mockScheduleRow({
          id: "enrich-1",
          bucket: "inps_q2",
          due_date: "2026-05-16",
        }),
      ]);

      const { result } = renderHook(
        () => useCalendarEvents(new Date("2026-05-01")),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.events.length).toBeGreaterThan(0);
      });

      const event = result.current.events.find((e) => e.id === "tax-enrich-1");
      expect(event).toBeDefined();
      expect(event!.bucket).toBe("inps_q2");
    });

    it("should include scheduleRow in CalendarEvent for tax_deadline events", async () => {
      const row = mockScheduleRow({
        id: "row-1",
        bucket: "june",
        due_date: "2026-06-30",
        total_expected: 1100,
        total_paid: 200,
      });
      setupMocks([row]);

      const { result } = renderHook(
        () => useCalendarEvents(new Date("2026-06-01")),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.events.length).toBeGreaterThan(0);
      });

      const event = result.current.events.find((e) => e.id === "tax-row-1");
      expect(event!.scheduleRow).toBeDefined();
      expect(event!.scheduleRow!.id).toBe("row-1");
      expect(event!.scheduleRow!.total_expected).toBe(1100);
    });

    it("should include totalExpected and totalPaid amounts", async () => {
      setupMocks([
        mockScheduleRow({
          id: "amt-1",
          bucket: "june",
          due_date: "2026-06-30",
          total_expected: 1100,
          total_paid: 300,
        }),
      ]);

      const { result } = renderHook(
        () => useCalendarEvents(new Date("2026-06-01")),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.events.length).toBeGreaterThan(0);
      });

      const event = result.current.events.find((e) => e.id === "tax-amt-1");
      expect(event!.totalExpected).toBe(1100);
      expect(event!.totalPaid).toBe(300);
      // amount = remaining = 1100 - 300 = 800
      expect(event!.amount).toBe(800);
    });
  });

  describe("Story 48.5 — Google Calendar event merge", () => {
    const mockGoogleEvents = [
      {
        id: "cache-1",
        external_id: "goog-abc",
        title: "Riunione commercialista",
        start_at: "2026-05-20T14:00:00Z",
        end_at: "2026-05-20T15:00:00Z",
        all_day: false,
        location: "Via Roma 10, Milano",
        description: "Discussione fatture Q1",
        calendar_name: "Lavoro",
        color: null,
      },
      {
        id: "cache-2",
        external_id: "goog-def",
        title: "Conferenza freelancer",
        start_at: "2026-05-22T00:00:00",
        end_at: "2026-05-22T23:59:59",
        all_day: true,
        location: null,
        description: null,
        calendar_name: "Personale",
        color: null,
      },
    ];

    it("should convert GoogleCalendarEvent to CalendarEvent with correct fields", async () => {
      setupMocks([]);

      const { result } = renderHook(
        () => useCalendarEvents(new Date("2026-05-01T00:00:00"), mockGoogleEvents),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.events.length).toBeGreaterThan(0);
      });

      const googleEvt = result.current.events.find((e) => e.id === "google-goog-abc");
      expect(googleEvt).toBeDefined();
      expect(googleEvt!.title).toBe("Riunione commercialista");
      expect(googleEvt!.type).toBe("google_event");
      expect(googleEvt!.status).toBeUndefined();
      expect(googleEvt!.relatedId).toBe("goog-abc");
      expect(googleEvt!.amount).toBeUndefined();
      expect(googleEvt!.allDay).toBe(false);
      expect(googleEvt!.location).toBe("Via Roma 10, Milano");
      expect(googleEvt!.details).toBe("Discussione fatture Q1");
    });

    it("should set allDay=true for all-day Google events", async () => {
      setupMocks([]);

      const { result } = renderHook(
        () => useCalendarEvents(new Date("2026-05-01T00:00:00"), mockGoogleEvents),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.events.length).toBeGreaterThan(0);
      });

      const allDayEvt = result.current.events.find((e) => e.id === "google-goog-def");
      expect(allDayEvt).toBeDefined();
      expect(allDayEvt!.allDay).toBe(true);
      expect(allDayEvt!.location).toBeUndefined();
      expect(allDayEvt!.details).toBeUndefined();
    });

    it("should merge Google events with tax events sorted chronologically", async () => {
      setupMocks([
        mockScheduleRow({
          id: "tax-merge",
          bucket: "inps_q2",
          due_date: "2026-05-16",
          total_expected: 500,
          total_paid: 0,
        }),
      ]);

      const { result } = renderHook(
        () => useCalendarEvents(new Date("2026-05-01T00:00:00"), mockGoogleEvents),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.events.length).toBeGreaterThanOrEqual(3);
      });

      // Verify chronological order: tax May 16 < google May 20 < google May 22
      const types = result.current.events.map((e) => ({ id: e.id, date: e.date.getDate() }));
      const taxIdx = types.findIndex((t) => t.id === "tax-tax-merge");
      const googleIdx = types.findIndex((t) => t.id === "google-goog-abc");
      const allDayIdx = types.findIndex((t) => t.id === "google-goog-def");
      expect(taxIdx).toBeLessThan(googleIdx);
      expect(googleIdx).toBeLessThan(allDayIdx);
    });

    it("should skip Google events with invalid dates (isNaN guard)", async () => {
      setupMocks([]);
      const badEvent = [{
        id: "cache-bad",
        external_id: "goog-bad",
        title: "Evento corrotto",
        start_at: "not-a-date",
        end_at: "not-a-date",
        all_day: false,
        location: null,
        description: null,
        calendar_name: "Test",
        color: null,
      }];

      const { result } = renderHook(
        () => useCalendarEvents(new Date("2026-05-01T00:00:00"), badEvent),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const badEvt = result.current.events.find((e) => e.id === "google-goog-bad");
      expect(badEvt).toBeUndefined();
    });

    it("should work with undefined googleEvents (no Google connection)", async () => {
      setupMocks([
        mockScheduleRow({
          id: "no-google",
          bucket: "june",
          due_date: "2026-06-30",
          total_expected: 1100,
          total_paid: 0,
        }),
      ]);

      const { result } = renderHook(
        () => useCalendarEvents(new Date("2026-06-01T00:00:00"), undefined),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.events.length).toBeGreaterThan(0);
      });

      // Only tax events, no google events
      const googleEvts = result.current.events.filter((e) => e.type === "google_event");
      expect(googleEvts.length).toBe(0);
    });

    it("should return Google events via getEventsForDay", async () => {
      setupMocks([]);

      const { result } = renderHook(
        () => useCalendarEvents(new Date("2026-05-01T00:00:00"), mockGoogleEvents),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.events.length).toBeGreaterThan(0);
      });

      const may22Events = result.current.getEventsForDay(new Date("2026-05-22T00:00:00"));
      expect(may22Events.length).toBe(1);
      expect(may22Events[0].type).toBe("google_event");
      expect(may22Events[0].title).toBe("Conferenza freelancer");
    });
  });
});
