/**
 * Story 64.4 — Test pagine gated con ProGateOverlay
 *
 * Benchmark: ProGateOverlay wrappa contenuto reale (free → overlay, pro/admin → pass-through)
 * TaskBoard: Free → TaskBoardDemo + overlay, Pro/Admin → contenuto reale
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { FREE_SUBSCRIPTION, PRO_SUBSCRIPTION } from "@/test/mock-subscription";

// ─── Shared mock state ──────────────────────────────────────

const mockUseSubscription = vi.fn(() => PRO_SUBSCRIPTION);
const mockUseUserRole = vi.fn(() => ({ data: "user" as string | null, isLoading: false }));
const mockUseProWaitlist = vi.fn(() => ({ isJoined: false, isLoading: false, join: vi.fn(), revoke: vi.fn() }));
const mockUseIsMobile = vi.fn(() => false);

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => mockUseSubscription(),
}));
vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: () => mockUseUserRole(),
}));
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mockUseIsMobile(),
}));

// ─── ProGateOverlay mock (simulates real behavior) ──────────

vi.mock("@/hooks/useProWaitlist", () => ({
  useProWaitlist: () => mockUseProWaitlist(),
}));

vi.mock("@/components/subscription/ProGateOverlay", () => ({
  ProGateOverlay: ({
    featureName,
    featureDescription,
    children,
  }: {
    featureName: string;
    featureDescription: string;
    children: ReactNode;
  }) => {
    const sub = mockUseSubscription();
    const role = mockUseUserRole();
    const waitlist = mockUseProWaitlist();
    const isAdmin = role.data === "admin";
    if (sub.isLoading || role.isLoading || waitlist.isLoading) return null;
    if (sub.isPro || isAdmin)
      return createElement("div", null, children);
    return createElement(
      "div",
      { "data-testid": "pro-gate-overlay" },
      createElement("div", { "data-testid": "pro-gate-feature" }, featureName),
      createElement("button", { "data-testid": "pro-gate-cta" }, "Scopri PRO"),
      createElement(
        "a",
        { href: "/impostazioni?tab=abbonamento", "data-testid": "pro-gate-link" },
        "Vedi cosa include PRO"
      ),
      createElement("div", { className: "blur-sm", "aria-hidden": "true" }, children)
    );
  },
}));

// ─── Layout mocks ───────────────────────────────────────────

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: ReactNode }) =>
    createElement("div", { "data-testid": "app-layout" }, children),
}));
vi.mock("@/components/layout/MobileHeader", () => ({
  MobileHeader: ({ title }: { title: string }) =>
    createElement("div", { "data-testid": "mobile-header" }, title),
}));
vi.mock("@/components/layout/PageContainer", () => ({
  PageContainer: ({ children }: { children: ReactNode }) =>
    createElement("div", { "data-testid": "page-container" }, children),
}));

// ─── Benchmark-specific mocks ───────────────────────────────

vi.mock("@/hooks/useFiscalCalculations", () => ({
  useFiscalCalculations: () => ({ metrics: { incassiYTD: 0 }, isLoading: false }),
  formatCurrency: (v: number) => `€${(v / 100).toFixed(2)}`,
}));
vi.mock("@/contexts/FiscalYearContext", () => ({
  useFiscalYear: () => ({ selectedYear: 2026, setSelectedYear: vi.fn() }),
}));
vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
}));
vi.mock("@/data/benchmark-aggregated.json", () => ({
  default: {
    meta: { totalRecords: 100, validRecords: 90, generatedAt: "2026-03-18", jobTitles: ["backend_developer"], provinces: ["Milano"], source: "Test" },
    data: { backend_developer: { _all: { _all: { median: 38000, p25: 30000, p75: 48000, count: 50 } } } },
  },
}));

// ─── TaskBoard-specific mocks ───────────────────────────────

const mockUseUserTasks = vi.fn(() => ({
  tasks: [],
  tasksByColumn: { da_fare: [], in_corso: [], completato: [] },
  isLoading: false,
  createTask: { mutate: vi.fn() },
  updateTask: { mutate: vi.fn() },
  moveTask: { mutate: vi.fn() },
  toggleComplete: { mutate: vi.fn() },
  deleteTask: { mutate: vi.fn() },
}));
vi.mock("@/hooks/useUserTasks", () => ({
  useUserTasks: () => mockUseUserTasks(),
  LABEL_COLORS: [],
}));

// Mock KanbanBoard and other task components to avoid @dnd-kit deps in test
vi.mock("@/components/task/KanbanBoard", () => ({
  KanbanBoard: () => createElement("div", { "data-testid": "kanban-board" }, "KanbanBoard"),
}));
vi.mock("@/components/task/CardDetailModal", () => ({
  CardDetailModal: () => null,
}));
vi.mock("@/components/task/TaskItem", () => ({
  TaskItem: () => createElement("div", null, "TaskItem"),
}));

// ─── Import components after mocks ──────────────────────────

import Benchmark from "../Benchmark";
import TaskPage from "../TaskPage";

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

// ─── Reset ──────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockUseSubscription.mockReturnValue(PRO_SUBSCRIPTION);
  mockUseUserRole.mockReturnValue({ data: "user", isLoading: false });
  mockUseProWaitlist.mockReturnValue({ isJoined: false, isLoading: false, join: vi.fn(), revoke: vi.fn() });
  mockUseIsMobile.mockReturnValue(false);
  mockUseUserTasks.mockReturnValue({
    tasks: [],
    tasksByColumn: { da_fare: [], in_corso: [], completato: [] },
    isLoading: false,
    createTask: { mutate: vi.fn() },
    updateTask: { mutate: vi.fn() },
    moveTask: { mutate: vi.fn() },
    toggleComplete: { mutate: vi.fn() },
    deleteTask: { mutate: vi.fn() },
  });
});

// ═══════════════════════════════════════════════════════════════
// BENCHMARK TESTS
// ═══════════════════════════════════════════════════════════════

describe("Benchmark — Gated Page", () => {
  it("free user sees ProGateOverlay with feature name", () => {
    mockUseSubscription.mockReturnValue(FREE_SUBSCRIPTION);
    renderWithRouter(<Benchmark />);

    expect(screen.getByTestId("pro-gate-overlay")).toBeInTheDocument();
    expect(screen.getByTestId("pro-gate-feature")).toHaveTextContent("Comparatore Tariffe");
  });

  it("free user sees blurred content (not empty page)", () => {
    mockUseSubscription.mockReturnValue(FREE_SUBSCRIPTION);
    renderWithRouter(<Benchmark />);

    // Content is present (blurred) — page title appears twice:
    // once in the overlay feature name, once in the blurred content
    const matches = screen.getAllByText("Comparatore Tariffe");
    expect(matches.length).toBeGreaterThanOrEqual(2); // overlay label + h1
    // Blurred zone should contain the form
    expect(screen.getByText("Ruolo")).toBeInTheDocument();
  });

  it("pro user sees content without overlay", () => {
    mockUseSubscription.mockReturnValue(PRO_SUBSCRIPTION);
    renderWithRouter(<Benchmark />);

    expect(screen.queryByTestId("pro-gate-overlay")).not.toBeInTheDocument();
    expect(screen.getByText("Comparatore Tariffe")).toBeInTheDocument();
  });

  it("admin user sees content without overlay (even if free)", () => {
    mockUseSubscription.mockReturnValue(FREE_SUBSCRIPTION);
    mockUseUserRole.mockReturnValue({ data: "admin", isLoading: false });
    renderWithRouter(<Benchmark />);

    expect(screen.queryByTestId("pro-gate-overlay")).not.toBeInTheDocument();
    expect(screen.getByText("Comparatore Tariffe")).toBeInTheDocument();
  });

  it("UpgradeCTA no longer appears (replaced by ProGateOverlay)", () => {
    mockUseSubscription.mockReturnValue(FREE_SUBSCRIPTION);
    renderWithRouter(<Benchmark />);

    expect(screen.queryByTestId("upgrade-cta")).not.toBeInTheDocument();
  });

  it("CTA button and link are present for free user", () => {
    mockUseSubscription.mockReturnValue(FREE_SUBSCRIPTION);
    renderWithRouter(<Benchmark />);

    expect(screen.getByTestId("pro-gate-cta")).toHaveTextContent("Scopri PRO");
    const link = screen.getByTestId("pro-gate-link");
    expect(link).toHaveTextContent("Vedi cosa include PRO");
    expect(link).toHaveAttribute("href", "/impostazioni?tab=abbonamento");
  });
});

// ═══════════════════════════════════════════════════════════════
// TASKBOARD TESTS
// ═══════════════════════════════════════════════════════════════

describe("TaskBoard — Gated Page", () => {
  it("free user sees ProGateOverlay with 'Task Board' feature name", () => {
    mockUseSubscription.mockReturnValue(FREE_SUBSCRIPTION);
    renderWithRouter(<TaskPage />);

    expect(screen.getByTestId("pro-gate-overlay")).toBeInTheDocument();
    expect(screen.getByTestId("pro-gate-feature")).toHaveTextContent("Task Board");
  });

  it("free user sees TaskBoardDemo content under blur (3 columns)", () => {
    mockUseSubscription.mockReturnValue(FREE_SUBSCRIPTION);
    renderWithRouter(<TaskPage />);

    // Demo columns (text includes emoji + count, use regex)
    expect(screen.getByText(/Da fare/)).toBeInTheDocument();
    expect(screen.getByText(/In corso/)).toBeInTheDocument();
    expect(screen.getByText(/Completato/)).toBeInTheDocument();

    // Demo cards
    expect(screen.getByText("Inviare fattura Q1")).toBeInTheDocument();
    expect(screen.getByText("Revisione contratto")).toBeInTheDocument();
  });

  it("free user does NOT trigger useUserTasks (no DB query)", () => {
    mockUseSubscription.mockReturnValue(FREE_SUBSCRIPTION);
    renderWithRouter(<TaskPage />);

    expect(mockUseUserTasks).not.toHaveBeenCalled();
  });

  it("admin user sees real TaskBoard without overlay", () => {
    mockUseSubscription.mockReturnValue(FREE_SUBSCRIPTION);
    mockUseUserRole.mockReturnValue({ data: "admin", isLoading: false });
    renderWithRouter(<TaskPage />);

    expect(screen.queryByTestId("pro-gate-overlay")).not.toBeInTheDocument();
    expect(screen.getByTestId("kanban-board")).toBeInTheDocument();
  });

  it("pro user sees real TaskBoard without overlay", () => {
    mockUseSubscription.mockReturnValue(PRO_SUBSCRIPTION);
    renderWithRouter(<TaskPage />);

    expect(screen.queryByTestId("pro-gate-overlay")).not.toBeInTheDocument();
    expect(screen.getByTestId("kanban-board")).toBeInTheDocument();
  });

  it("CTA button and link are present for free user", () => {
    mockUseSubscription.mockReturnValue(FREE_SUBSCRIPTION);
    renderWithRouter(<TaskPage />);

    expect(screen.getByTestId("pro-gate-cta")).toHaveTextContent("Scopri PRO");
    const link = screen.getByTestId("pro-gate-link");
    expect(link).toHaveTextContent("Vedi cosa include PRO");
    expect(link).toHaveAttribute("href", "/impostazioni?tab=abbonamento");
  });
});
