import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlignLeft, Clock } from "lucide-react";
import { formatDateIT, daysUntil } from "@/lib/schedule-helpers";
import { LABEL_COLORS, type UserTaskRow } from "@/hooks/useUserTasks";
import { cn } from "@/lib/utils";

interface KanbanCardProps {
  task: UserTaskRow;
  onClick: () => void;
  /** True when rendered inside DragOverlay */
  isOverlay?: boolean;
}

const PRIORITY_DOT: Record<string, string> = {
  alta: "bg-red-500",
  media: "bg-amber-400",
  bassa: "bg-slate-300",
};

export function KanbanCard({ task, onClick, isOverlay }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `card-${task.id}`,
    data: { type: "Card", task },
  });

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
  };

  const isCompleted = task.status === "completato";
  const hasDueDate = !!task.due_date;
  const isOverdue = hasDueDate && !isCompleted && daysUntil(task.due_date!) < 0;
  const isUrgent =
    hasDueDate &&
    !isCompleted &&
    task.priority === "alta" &&
    daysUntil(task.due_date!) <= 3 &&
    daysUntil(task.due_date!) >= 0;

  const labelColors = (task.labels ?? [])
    .map((id) => LABEL_COLORS.find((l) => l.id === id))
    .filter(Boolean);

  const cardEl = (
    <div
      onClick={onClick}
      className={cn(
        "group relative bg-white rounded-xl p-3",
        "shadow-[0_1px_2px_rgba(0,0,0,0.06),0_2px_8px_rgba(0,0,0,0.04)]",
        "border border-black/[0.05]",
        "cursor-grab active:cursor-grabbing",
        "hover:shadow-[0_4px_16px_rgba(0,0,0,0.10)] hover:-translate-y-0.5 hover:border-primary/20 transition-all duration-200",
        isDragging && "opacity-30 scale-[1.02] shadow-xl rotate-1 z-50",
        isOverlay && "shadow-2xl rotate-[3deg] scale-105 ring-2 ring-primary/40 bg-white",
        isCompleted && "opacity-55"
      )}
    >
      {/* Color labels strip */}
      {labelColors.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {labelColors.map((label) => (
            <span
              key={label!.id}
              className="h-2 w-10 rounded-full"
              style={{ backgroundColor: label!.color }}
              title={label!.name}
            />
          ))}
        </div>
      )}

      {/* Title */}
      <h4
        className={cn(
          "text-sm font-medium text-foreground leading-snug mb-2",
          isCompleted && "line-through text-muted-foreground"
        )}
      >
        {task.title}
      </h4>

      {/* Meta row */}
      <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
        {hasDueDate && (
          <div
            className={cn(
              "flex items-center gap-1 px-1.5 py-0.5 rounded",
              isOverdue && "bg-destructive/10 text-destructive",
              isUrgent && "bg-amber-100 text-amber-700",
              !isOverdue && !isUrgent && "bg-muted"
            )}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{formatDateIT(task.due_date!)}</span>
          </div>
        )}

        {task.description && <AlignLeft className="w-4 h-4" />}

        {/* Priority dot */}
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            PRIORITY_DOT[task.priority] ?? PRIORITY_DOT.media
          )}
        />
      </div>
    </div>
  );

  // Overlay version: no sortable ref needed
  if (isOverlay) return cardEl;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {cardEl}
    </div>
  );
}
