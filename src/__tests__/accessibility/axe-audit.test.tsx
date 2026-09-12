/**
 * axe-audit.test.tsx
 *
 * Automated accessibility audit using vitest-axe (axe-core).
 * Tests key dashboard and interactive components for zero
 * critical/serious WCAG 2.1 AA violations.
 *
 * Epic 32, Story 32-6 — Audit finale axe-core e fix residui
 *
 * NOTE: axe-core in jsdom does NOT test CSS contrast, layout, or
 * touch targets — only DOM/ARIA structure.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "vitest-axe";

// ── Mocks ──

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

vi.mock("@/lib/money", () => ({
  formatCurrency: (v: number) => `€ ${v}`,
  sumMoney: (a: number, b: number) => a + b,
}));

vi.mock("@/lib/schedule-helpers", () => ({
  bucketToLabel: (b: string) => b,
  daysUntil: (d: string) => {
    const diff = Math.round(
      (new Date(d + "T00:00:00").getTime() - Date.now()) / 86400000,
    );
    return diff;
  },
  formatDateIT: (d: string) => d,
}));

// ── Imports (after mocks) ──

import { ScadenzeInline } from "@/components/dashboard/ScadenzeInline";
import { SpendibileHero } from "@/components/dashboard/SpendibileHero";
import { NotificationItem } from "@/components/notifications/NotificationItem";
import { MilestoneProgress } from "@/components/classifica/MilestoneProgress";

// ── Fixtures ──

const futureDate = "2099-06-15";
const nearDate = "2026-03-07"; // ~3 days from "today" in test

const deadlines = [
  { id: "d1", bucket: "irpef_saldo", dueDate: nearDate, remaining: 500, paymentYear: 2026, totalExpected: 1000, totalPaid: 500 },
  { id: "d2", bucket: "inps_q1", dueDate: futureDate, remaining: 1200, paymentYear: 2026, totalExpected: 1200, totalPaid: 0 },
];

const spendibileProps = {
  spendable: 5000,
  sogliaIncassi: 40000,
  sogliaLimite: 85000,
  helpText: "Netto disponibile dopo tasse e contributi.",
};

const notification = {
  id: "n1",
  user_id: "u1",
  title: "Scadenza IRPEF imminente",
  body: "La scadenza IRPEF è tra 3 giorni.",
  category: "scadenze",
  type: "deadline_reminder",
  read_at: null as string | null,
  created_at: "2026-03-01T10:00:00Z",
  updated_at: "2026-03-01T10:00:00Z",
  action_url: "/scadenziario",
  action_label: "Vai",
  delivery_channel: "sidebar",
  dismissed_at: null as string | null,
  email_sent_at: null as string | null,
  sms_sent_at: null as string | null,
  metadata: null as any,
};

const milestones = [
  {
    id: "m1",
    level: 1,
    name: "Supporter",
    pointsRequired: 150,
    rewardType: "badge",
    rewardLabel: "Badge Supporter",
  },
  {
    id: "m2",
    level: 2,
    name: "Contributor",
    pointsRequired: 500,
    rewardType: "badge",
    rewardLabel: "Badge Contributor",
  },
];

// ── Tests ──

describe("Accessibility — axe-core audit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ScadenzeInline has no axe violations", async () => {
    const { container } = render(
      <ScadenzeInline deadlines={deadlines} />,
    );
    const results = await axe(container, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } });
    expect(results).toHaveNoViolations();
  });

  it("ScadenzeInline (empty) has no axe violations", async () => {
    const { container } = render(
      <ScadenzeInline deadlines={[]} />,
    );
    const results = await axe(container, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } });
    expect(results).toHaveNoViolations();
  });

  it("SpendibileHero has no axe violations", async () => {
    const { container } = render(
      <SpendibileHero {...spendibileProps} />,
    );
    const results = await axe(container, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } });
    expect(results).toHaveNoViolations();
  });

  it("NotificationItem (unread) has no axe violations", async () => {
    const { container } = render(
      <ul>
        <NotificationItem
          notification={notification}
          onMarkRead={vi.fn()}
        />
      </ul>,
    );
    const results = await axe(container, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } });
    expect(results).toHaveNoViolations();
  });

  it("NotificationItem (read) has no axe violations", async () => {
    const { container } = render(
      <ul>
        <NotificationItem
          notification={{ ...notification, read_at: "2026-03-02T08:00:00Z" }}
          onMarkRead={vi.fn()}
        />
      </ul>,
    );
    const results = await axe(container, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } });
    expect(results).toHaveNoViolations();
  });

  it("MilestoneProgress has no axe violations", async () => {
    const { container } = render(
      <MilestoneProgress milestones={milestones} totalPts={200} />,
    );
    const results = await axe(container, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } });
    expect(results).toHaveNoViolations();
  });

  it("MilestoneProgress (all reached) has no axe violations", async () => {
    const { container } = render(
      <MilestoneProgress milestones={milestones} totalPts={1000} />,
    );
    const results = await axe(container, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } });
    expect(results).toHaveNoViolations();
  });
});
