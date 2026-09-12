/**
 * Test per TaskItem componente
 * Story 61.2 — Task Board Personale
 *
 * Copertura: checkbox toggle, click edit, delete con conferma, priority badge, completato style
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TaskItem } from "./TaskItem";
import type { UserTaskRow } from "@/hooks/useUserTasks";

vi.mock("@/lib/schedule-helpers", () => ({
  formatDateIT: (d: string) => d, // pass-through per test
  daysUntil: (d: string) => {
    // Simulate days until: parse date and diff from "now" (controlled by vi.setSystemTime)
    const due = new Date(`${d}T00:00:00`);
    const now = new Date();
    return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  },
}));

const baseMockTask: UserTaskRow = {
  id: "task-1",
  user_id: "test-user-id",
  title: "Comprare latte",
  description: null,
  due_date: "2026-04-01",
  priority: "alta",
  status: "da_fare",
  completed_at: null,
  position: 1000,
  labels: [],
  created_at: "2026-03-20T10:00:00Z",
  updated_at: "2026-03-20T10:00:00Z",
};

const completedTask: UserTaskRow = {
  ...baseMockTask,
  id: "task-2",
  title: "Task completato",
  status: "completato",
  completed_at: "2026-03-22T15:00:00Z",
};

describe("TaskItem", () => {
  // Pin system time so baseMockTask.due_date (2026-04-01) is in the future
  // relative to "now" — otherwise the "Alta" badge flips to "Urgente".
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-20T00:00:00"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders task title and due date", () => {
    render(
      <TaskItem
        task={baseMockTask}
        onToggleComplete={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText("Comprare latte")).toBeInTheDocument();
    expect(screen.getByText("2026-04-01")).toBeInTheDocument();
  });

  it("renders priority badge", () => {
    render(
      <TaskItem
        task={baseMockTask}
        onToggleComplete={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText("Alta")).toBeInTheDocument();
  });

  it("calls onToggleComplete when checkbox clicked", () => {
    const onToggle = vi.fn();
    render(
      <TaskItem
        task={baseMockTask}
        onToggleComplete={onToggle}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);
    expect(onToggle).toHaveBeenCalledWith(baseMockTask);
  });

  it("calls onEdit when task row clicked", () => {
    const onEdit = vi.fn();
    render(
      <TaskItem
        task={baseMockTask}
        onToggleComplete={vi.fn()}
        onEdit={onEdit}
        onDelete={vi.fn()}
      />
    );

    const editButton = screen.getByRole("button", {
      name: /modifica task/i,
    });
    fireEvent.click(editButton);
    expect(onEdit).toHaveBeenCalledWith(baseMockTask);
  });

  it("calls onDelete after confirmation dialog", () => {
    const onDelete = vi.fn();
    render(
      <TaskItem
        task={baseMockTask}
        onToggleComplete={vi.fn()}
        onEdit={vi.fn()}
        onDelete={onDelete}
      />
    );

    // Click trash button to open dialog
    const deleteBtn = screen.getByRole("button", { name: /elimina task/i });
    fireEvent.click(deleteBtn);

    // Confirm deletion
    const confirmBtn = screen.getByRole("button", { name: "Elimina" });
    fireEvent.click(confirmBtn);

    expect(onDelete).toHaveBeenCalledWith("task-1");
  });

  it("shows line-through for completed tasks", () => {
    render(
      <TaskItem
        task={completedTask}
        onToggleComplete={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const editButton = screen.getByRole("button", {
      name: /modifica task/i,
    });
    expect(editButton.className).toContain("line-through");
  });

  it("checkbox is checked for completed tasks", () => {
    render(
      <TaskItem
        task={completedTask}
        onToggleComplete={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAttribute("data-state", "checked");
  });

  // ── Badge "Urgente" (Story 61.3) ──
  describe("badge Urgente", () => {
    beforeEach(() => {
      // Fix system time to 2026-03-25
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-25T00:00:00"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("mostra badge Urgente per task alta priorita' con due_date <= 3 giorni e non completato", () => {
      const urgentTask: UserTaskRow = {
        ...baseMockTask,
        priority: "alta",
        due_date: "2026-03-27", // 2 days from now
        status: "da_fare",
      };
      render(
        <TaskItem
          task={urgentTask}
          onToggleComplete={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      expect(screen.getByText("Urgente")).toBeInTheDocument();
      // Should NOT show "Alta" badge when urgent
      expect(screen.queryByText("Alta")).not.toBeInTheDocument();
    });

    it("mostra badge Urgente per task scaduto oggi", () => {
      const todayTask: UserTaskRow = {
        ...baseMockTask,
        priority: "alta",
        due_date: "2026-03-25", // today
        status: "da_fare",
      };
      render(
        <TaskItem
          task={todayTask}
          onToggleComplete={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      expect(screen.getByText("Urgente")).toBeInTheDocument();
    });

    it("NON mostra badge Urgente per task completato", () => {
      const completedUrgent: UserTaskRow = {
        ...baseMockTask,
        priority: "alta",
        due_date: "2026-03-25",
        status: "completato",
        completed_at: "2026-03-24T10:00:00Z",
      };
      render(
        <TaskItem
          task={completedUrgent}
          onToggleComplete={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      expect(screen.queryByText("Urgente")).not.toBeInTheDocument();
    });

    it("NON mostra badge Urgente per priorita' media con due_date imminente", () => {
      const mediaTask: UserTaskRow = {
        ...baseMockTask,
        priority: "media",
        due_date: "2026-03-26",
        status: "da_fare",
      };
      render(
        <TaskItem
          task={mediaTask}
          onToggleComplete={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      expect(screen.queryByText("Urgente")).not.toBeInTheDocument();
      expect(screen.getByText("Media")).toBeInTheDocument();
    });

    it("NON mostra badge Urgente per task alta priorita' con due_date > 3 giorni", () => {
      const farTask: UserTaskRow = {
        ...baseMockTask,
        priority: "alta",
        due_date: "2026-04-10", // 16 days from now
        status: "da_fare",
      };
      render(
        <TaskItem
          task={farTask}
          onToggleComplete={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      expect(screen.queryByText("Urgente")).not.toBeInTheDocument();
      expect(screen.getByText("Alta")).toBeInTheDocument();
    });
  });
});
