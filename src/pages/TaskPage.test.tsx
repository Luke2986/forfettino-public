/**
 * Test per TaskPage
 * Story 61.2 — Task Board Personale (Kanban + Lista views)
 *
 * Copertura: render con mock hook, view switcher, filtri stato (lista),
 * empty state, loading state, kanban board render
 */

import { createElement } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock layout components (AppLayout requires many providers)
vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) =>
    createElement("div", { "data-testid": "app-layout" }, children),
}));
// MobileHeader and useIsMobile no longer imported by TaskPage (Epic 62)

// Mock KanbanBoard to avoid DnD context issues in tests
vi.mock("@/components/task/KanbanBoard", () => ({
  KanbanBoard: ({ tasksByColumn, isLoading }: any) => {
    if (isLoading) return createElement("div", { className: "animate-spin" }, "Loading");
    const totalTasks = Object.values(tasksByColumn as Record<string, any[]>).flat();
    return createElement(
      "div",
      { "data-testid": "kanban-board" },
      totalTasks.map((t: any) =>
        createElement("div", { key: t.id }, t.title)
      )
    );
  },
}));

// Mock CardDetailModal
vi.mock("@/components/task/CardDetailModal", () => ({
  CardDetailModal: () => null,
}));

// Mock useUserTasks — mutable state per test
const baseMockReturn = {
  tasks: [] as any[],
  tasksByColumn: { in_attesa: [], da_fare: [], in_corso: [], completato: [] },
  isLoading: false,
  error: null,
  createTask: { mutate: vi.fn() },
  updateTask: { mutate: vi.fn() },
  moveTask: { mutate: vi.fn() },
  toggleComplete: { mutate: vi.fn() },
  deleteTask: { mutate: vi.fn() },
  midPosition: (a: number | null, b: number | null) => 1000,
};

let mockReturnValue = { ...baseMockReturn };

vi.mock("@/hooks/useUserTasks", () => ({
  useUserTasks: () => mockReturnValue,
  KANBAN_COLUMNS: [
    { id: "in_attesa", title: "Backlog", emoji: "\u270D\uFE0F" },
    { id: "da_fare", title: "Da fare", emoji: "\u26AB" },
    { id: "in_corso", title: "In corso", emoji: "\uD83D\uDE80" },
    { id: "completato", title: "Completato", emoji: "\uD83C\uDF1F" },
  ],
  LABEL_COLORS: [],
}));

vi.mock("@/lib/schedule-helpers", () => ({
  formatDateIT: (d: string) => d,
  daysUntil: () => 999, // default: not urgent
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ isPro: true, isLoading: false, tier: "pro" }),
  SubscriptionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: () => ({ data: "admin", isLoading: false }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "test-user", email: "test@example.com" } }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/components/subscription/ProGateOverlay", () => ({
  ProGateOverlay: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/components/task/TaskBoardDemo", () => ({
  TaskBoardDemo: () => null,
}));

const mockTasks = [
  {
    id: "task-1",
    user_id: "test-user-id",
    title: "Task da fare",
    description: null,
    due_date: "2026-04-01",
    priority: "alta",
    status: "da_fare",
    completed_at: null,
    position: 1000,
    labels: [],
    created_at: "2026-03-20T10:00:00Z",
    updated_at: "2026-03-20T10:00:00Z",
  },
  {
    id: "task-2",
    user_id: "test-user-id",
    title: "Task in corso",
    description: null,
    due_date: null,
    priority: "media",
    status: "in_corso",
    completed_at: null,
    position: 1000,
    labels: [],
    created_at: "2026-03-19T10:00:00Z",
    updated_at: "2026-03-19T10:00:00Z",
  },
  {
    id: "task-3",
    user_id: "test-user-id",
    title: "Task completato",
    description: null,
    due_date: null,
    priority: "bassa",
    status: "completato",
    completed_at: "2026-03-22T15:00:00Z",
    position: 1000,
    labels: [],
    created_at: "2026-03-18T10:00:00Z",
    updated_at: "2026-03-22T15:00:00Z",
  },
];

function buildTasksByColumn(tasks: any[]) {
  const cols: Record<string, any[]> = {
    in_attesa: [],
    da_fare: [],
    in_corso: [],
    completato: [],
  };
  for (const t of tasks) {
    if (cols[t.status]) cols[t.status].push(t);
  }
  return cols;
}

// Must use dynamic import because the module uses the mock
async function renderTaskPage() {
  const TaskPage = (await import("./TaskPage")).default;
  return render(<TaskPage />);
}

describe("TaskPage", () => {
  beforeEach(() => {
    mockReturnValue = { ...baseMockReturn };
  });

  it("shows loading spinner when isLoading in kanban view", async () => {
    mockReturnValue = {
      ...baseMockReturn,
      tasks: [],
      isLoading: true,
    };
    await renderTaskPage();

    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("renders new card button", async () => {
    mockReturnValue = {
      ...baseMockReturn,
      tasks: mockTasks,
      tasksByColumn: buildTasksByColumn(mockTasks) as any,
      isLoading: false,
    };
    await renderTaskPage();

    expect(screen.getByText("Nuova scheda")).toBeInTheDocument();
  });

  it("renders view switcher with Bacheca, Tabella, Planner, Inbox", async () => {
    mockReturnValue = { ...baseMockReturn, tasks: mockTasks, tasksByColumn: buildTasksByColumn(mockTasks) as any };
    await renderTaskPage();

    expect(screen.getByText("Bacheca")).toBeInTheDocument();
    expect(screen.getByText("Tabella")).toBeInTheDocument();
    expect(screen.getByText("Planner")).toBeInTheDocument();
    expect(screen.getByText("Inbox")).toBeInTheDocument();
  });

  it("default view is Bacheca (kanban board)", async () => {
    mockReturnValue = { ...baseMockReturn, tasks: mockTasks, tasksByColumn: buildTasksByColumn(mockTasks) as any };
    await renderTaskPage();

    expect(screen.getByTestId("kanban-board")).toBeInTheDocument();
  });

  it("shows all tasks in kanban board across columns", async () => {
    mockReturnValue = { ...baseMockReturn, tasks: mockTasks, tasksByColumn: buildTasksByColumn(mockTasks) as any };
    await renderTaskPage();

    expect(screen.getByText("Task da fare")).toBeInTheDocument();
    expect(screen.getByText("Task in corso")).toBeInTheDocument();
    expect(screen.getByText("Task completato")).toBeInTheDocument();
  });

  // ─── Tabella view tests ───────────────────────────────────
  describe("Tabella view", () => {
    async function renderListView() {
      await renderTaskPage();
      fireEvent.click(screen.getByText("Tabella"));
    }

    it("renders filter tabs in lista view", async () => {
      mockReturnValue = { ...baseMockReturn, tasks: mockTasks, tasksByColumn: buildTasksByColumn(mockTasks) as any };
      await renderListView();

      expect(screen.getByRole("tab", { name: "Da fare" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "In corso" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Completati" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Tutti" })).toBeInTheDocument();
    });

    it("shows only da_fare tasks by default in lista view", async () => {
      mockReturnValue = { ...baseMockReturn, tasks: mockTasks, tasksByColumn: buildTasksByColumn(mockTasks) as any };
      await renderListView();

      expect(screen.getByText("Task da fare")).toBeInTheDocument();
      expect(screen.queryByText("Task in corso")).not.toBeInTheDocument();
      expect(screen.queryByText("Task completato")).not.toBeInTheDocument();
    });

    it("shows all tasks when Tutti filter selected", async () => {
      mockReturnValue = { ...baseMockReturn, tasks: mockTasks, tasksByColumn: buildTasksByColumn(mockTasks) as any };
      await renderListView();

      fireEvent.click(screen.getByRole("tab", { name: "Tutti" }));

      expect(screen.getByText("Task da fare")).toBeInTheDocument();
      expect(screen.getByText("Task in corso")).toBeInTheDocument();
      expect(screen.getByText("Task completato")).toBeInTheDocument();
    });

    it("shows empty state with CTA when no tasks at all", async () => {
      mockReturnValue = { ...baseMockReturn, tasks: [], tasksByColumn: buildTasksByColumn([]) as any };
      await renderListView();

      expect(screen.getByText("Nessun task")).toBeInTheDocument();
      const ctaButtons = screen.getAllByText(/Crea il tuo primo task/i);
      expect(ctaButtons.length).toBeGreaterThanOrEqual(1);
    });

    it("shows empty state without CTA when filtered status has no results but tasks exist", async () => {
      const onlyDaFare = [mockTasks[0]];
      mockReturnValue = { ...baseMockReturn, tasks: onlyDaFare, tasksByColumn: buildTasksByColumn(onlyDaFare) as any };
      await renderListView();

      fireEvent.click(screen.getByRole("tab", { name: "In corso" }));

      expect(screen.getByText(/Nessun task con stato/i)).toBeInTheDocument();
      expect(screen.queryByText(/Crea il tuo primo task/i)).not.toBeInTheDocument();
    });
  });
});
