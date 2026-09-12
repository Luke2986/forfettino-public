import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatDateIT, daysUntil } from "@/lib/schedule-helpers";
import type { UserTaskRow } from "@/hooks/useUserTasks";

const PRIORITY_LABELS: Record<string, { label: string; className: string }> = {
  alta: { label: "Alta", className: "bg-red-100 text-red-600" },
  media: { label: "Media", className: "bg-amber-100 text-amber-600" },
  bassa: { label: "Bassa", className: "bg-slate-100 text-slate-500" },
};

interface TaskItemProps {
  task: UserTaskRow;
  onToggleComplete: (task: UserTaskRow) => void;
  onEdit: (task: UserTaskRow) => void;
  onDelete: (id: string) => void;
}

export function TaskItem({
  task,
  onToggleComplete,
  onEdit,
  onDelete,
}: TaskItemProps) {
  const isCompleted = task.status === "completato";
  const priority = PRIORITY_LABELS[task.priority] ?? PRIORITY_LABELS.media;
  const isUrgent = task.priority === "alta"
    && !isCompleted
    && task.due_date != null
    && daysUntil(task.due_date) <= 3;

  return (
    <div
      className="flex items-center gap-3 min-h-[44px] px-4 py-3 border-b border-slate-100 last:border-b-0 group"
      role="listitem"
    >
      <Checkbox
        checked={isCompleted}
        onCheckedChange={() => onToggleComplete(task)}
        aria-label={`Segna "${task.title}" come ${isCompleted ? "da fare" : "completato"}`}
        className="shrink-0"
      />

      <button
        type="button"
        className={`flex-1 min-w-0 text-left cursor-pointer ${
          isCompleted ? "line-through text-slate-500" : ""
        }`}
        onClick={() => onEdit(task)}
        aria-label={`Modifica task "${task.title}"`}
      >
        <span className="text-sm font-medium block truncate">{task.title}</span>
        <span className="flex items-center gap-2 mt-0.5">
          {task.due_date && (
            <span className="text-sm text-slate-500">
              {formatDateIT(task.due_date)}
            </span>
          )}
          {isUrgent ? (
            <span className="bg-red-100 text-red-600 text-xs font-semibold rounded-full px-2 py-0.5">
              Urgente
            </span>
          ) : (
            <span
              className={`text-xs font-medium px-1.5 py-0.5 rounded ${priority.className}`}
            >
              {priority.label}
            </span>
          )}
        </span>
      </button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 min-h-[44px] min-w-[44px]"
            aria-label={`Elimina task "${task.title}"`}
          >
            <Trash2 className="h-4 w-4 text-slate-500" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Elimina task</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare questo task? L'azione non puo' essere
              annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => onDelete(task.id)}>
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
