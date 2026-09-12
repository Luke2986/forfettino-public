import { useCallback, useEffect, useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { Loader2 } from "lucide-react";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCard } from "./KanbanCard";
import {
  KANBAN_COLUMNS,
  type KanbanStatus,
  type UserTaskRow,
} from "@/hooks/useUserTasks";

interface ColumnData {
  id: KanbanStatus;
  title: string;
  emoji: string;
  tasks: UserTaskRow[];
}

interface KanbanBoardProps {
  tasksByColumn: Record<KanbanStatus, UserTaskRow[]>;
  isLoading: boolean;
  onCardClick: (task: UserTaskRow) => void;
  onAddCard: (title: string, status: KanbanStatus) => void;
  onMoveTask: (taskId: string, newStatus: KanbanStatus, newPosition: number) => void;
}

export function KanbanBoard({
  tasksByColumn,
  isLoading,
  onCardClick,
  onAddCard,
  onMoveTask,
}: KanbanBoardProps) {
  // Local state for optimistic drag updates (like the external repo pattern)
  const [columns, setColumns] = useState<ColumnData[]>([]);
  const [activeTask, setActiveTask] = useState<UserTaskRow | null>(null);

  // Sync from server data
  useEffect(() => {
    setColumns(
      KANBAN_COLUMNS.map((col) => ({
        ...col,
        tasks: tasksByColumn[col.id] ?? [],
      }))
    );
  }, [tasksByColumn]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (event: DragStartEvent) => {
    const task = event.active.data.current?.task as UserTaskRow | undefined;
    if (task) setActiveTask(task);
  };

  // Optimistic cross-column movement during drag (live preview)
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id.toString();
    const overId = over.id.toString();
    if (activeId === overId) return;

    const isActiveCard = active.data.current?.type === "Card";
    if (!isActiveCard) return;

    const isOverCard = over.data.current?.type === "Card";
    const isOverColumn = over.data.current?.type === "Column";

    setColumns((prev) => {
      // Find which column contains the active card
      let activeColIdx = -1;
      let activeCardIdx = -1;

      prev.forEach((col, i) => {
        const cIdx = col.tasks.findIndex((t) => `card-${t.id}` === activeId);
        if (cIdx > -1) {
          activeColIdx = i;
          activeCardIdx = cIdx;
        }
      });

      if (activeColIdx === -1) return prev;

      let overColIdx = -1;
      let overCardIdx = -1;

      if (isOverCard) {
        prev.forEach((col, i) => {
          const cIdx = col.tasks.findIndex((t) => `card-${t.id}` === overId);
          if (cIdx > -1) {
            overColIdx = i;
            overCardIdx = cIdx;
          }
        });
      } else if (isOverColumn) {
        overColIdx = prev.findIndex(
          (col) => `column-${col.id}` === overId
        );
        overCardIdx = prev[overColIdx]?.tasks.length ?? 0;
      }

      // Only handle cross-column moves here
      if (activeColIdx !== overColIdx && overColIdx !== -1) {
        const newCols = [...prev];
        const cardToMove = newCols[activeColIdx].tasks[activeCardIdx];

        // Remove from source
        newCols[activeColIdx] = {
          ...newCols[activeColIdx],
          tasks: [...newCols[activeColIdx].tasks],
        };
        newCols[activeColIdx].tasks.splice(activeCardIdx, 1);

        // Insert into target
        newCols[overColIdx] = {
          ...newCols[overColIdx],
          tasks: [...newCols[overColIdx].tasks],
        };
        newCols[overColIdx].tasks.splice(overCardIdx, 0, {
          ...cardToMove,
          status: newCols[overColIdx].id,
        });

        return newCols;
      }

      return prev;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);

    const { active, over } = event;
    if (!over) return;

    const activeId = active.id.toString();
    const overId = over.id.toString();
    if (activeId === overId) return;

    const taskId = activeId.replace("card-", "");

    // Handle same-column reorder
    setColumns((prev) => {
      let activeColIdx = -1;
      let activeCardIdx = -1;
      let overColIdx = -1;
      let overCardIdx = -1;

      prev.forEach((col, i) => {
        const aIdx = col.tasks.findIndex((t) => `card-${t.id}` === activeId);
        if (aIdx > -1) { activeColIdx = i; activeCardIdx = aIdx; }

        const oIdx = col.tasks.findIndex((t) => `card-${t.id}` === overId);
        if (oIdx > -1) { overColIdx = i; overCardIdx = oIdx; }
      });

      // Same column reorder
      if (activeColIdx === overColIdx && activeColIdx !== -1) {
        const newCols = [...prev];
        const newTasks = arrayMove(
          newCols[activeColIdx].tasks,
          activeCardIdx,
          overCardIdx
        );
        newCols[activeColIdx] = { ...newCols[activeColIdx], tasks: newTasks };

        // Persist: calculate position
        const targetStatus = newCols[activeColIdx].id;
        const targetTasks = newTasks;
        const idx = targetTasks.findIndex((t) => t.id === taskId);
        const newPosition = calculatePosition(targetTasks, idx);
        onMoveTask(taskId, targetStatus, newPosition);

        return newCols;
      }

      // Cross-column: already moved optimistically in handleDragOver
      // Just persist the final position
      const targetCol = prev.find((col) =>
        col.tasks.some((t) => t.id === taskId)
      );
      if (targetCol) {
        const idx = targetCol.tasks.findIndex((t) => t.id === taskId);
        const newPosition = calculatePosition(targetCol.tasks, idx);
        onMoveTask(taskId, targetCol.id, newPosition);
      }

      return prev;
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex-1 overflow-x-auto overflow-y-hidden flex items-start gap-4 pb-4 board-scroll">
        {columns.map((col) => (
          <KanbanColumn
            key={col.id}
            id={col.id}
            title={col.title}
            emoji={col.emoji}
            tasks={col.tasks}
            onCardClick={onCardClick}
            onAddCard={onAddCard}
          />
        ))}
      </div>

      {/* Drag overlay — floating card follows cursor */}
      <DragOverlay>
        {activeTask ? (
          <KanbanCard task={activeTask} onClick={() => {}} isOverlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

/** Calculate a gap-based position for a task at a given index */
function calculatePosition(tasks: UserTaskRow[], index: number): number {
  if (tasks.length <= 1) return 1000;
  if (index === 0) return (tasks[1]?.position ?? 2000) - 1000;
  if (index >= tasks.length - 1)
    return (tasks[tasks.length - 2]?.position ?? 0) + 1000;
  const before = tasks[index - 1]?.position ?? 0;
  const after = tasks[index + 1]?.position ?? before + 2000;
  return Math.round((before + after) / 2);
}
