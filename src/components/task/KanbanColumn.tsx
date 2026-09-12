import { useState, useRef } from "react";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { Plus, MoreHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanCard } from "./KanbanCard";
import { cn } from "@/lib/utils";
import type { UserTaskRow, KanbanStatus } from "@/hooks/useUserTasks";

interface KanbanColumnProps {
  id: KanbanStatus;
  title: string;
  emoji: string;
  tasks: UserTaskRow[];
  onCardClick: (task: UserTaskRow) => void;
  onAddCard: (title: string, status: KanbanStatus) => void;
}

export function KanbanColumn({
  id,
  title,
  emoji,
  tasks,
  onCardClick,
  onAddCard,
}: KanbanColumnProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { setNodeRef, isOver } = useDroppable({
    id: `column-${id}`,
    data: { type: "Column", status: id },
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setIsAdding(false);
      return;
    }
    onAddCard(newTitle.trim(), id);
    setNewTitle("");
    // Keep open for rapid entry
  };

  const cardIds = tasks.map((t) => `card-${t.id}`);

  return (
    <div
      className={cn(
        "flex flex-col w-[280px] shrink-0 max-h-full glass-panel rounded-2xl transition-colors",
        isOver && "ring-2 ring-primary/40"
      )}
    >
      {/* Column header */}
      <div className="p-3 pb-2 flex items-center justify-between">
        <h3 className="font-bold text-sm text-foreground uppercase tracking-wide px-1 flex-1">
          {emoji} {title}{" "}
          <span className="text-muted-foreground font-normal">
            ({tasks.length})
          </span>
        </h3>

        {/* "..." menu */}
        <div className="relative" ref={menuRef}>
          <button
            className="p-1.5 hover:bg-black/5 rounded-md text-muted-foreground transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu((v) => !v);
            }}
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {showMenu && (
            <div
              className="absolute right-0 top-8 z-50 bg-white rounded-xl shadow-lg border p-1 w-40"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  setIsAdding(true);
                  setShowMenu(false);
                }}
                className="flex items-center gap-2 w-full text-sm px-3 py-2 hover:bg-muted rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Aggiungi scheda
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Scrollable card area */}
      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto px-3 py-1 space-y-3 min-h-[50px]"
      >
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <KanbanCard
              key={task.id}
              task={task}
              onClick={() => onCardClick(task)}
            />
          ))}
        </SortableContext>
      </div>

      {/* Add card area */}
      <div className="p-3 pt-2">
        {isAdding ? (
          <form
            onSubmit={handleAddSubmit}
            className="bg-white p-2 rounded-xl shadow-sm border space-y-2"
          >
            <textarea
              autoFocus
              placeholder="Inserisci il titolo per questa scheda..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleAddSubmit(e);
                }
                if (e.key === "Escape") {
                  setIsAdding(false);
                  setNewTitle("");
                }
              }}
              className="w-full text-sm resize-none outline-none p-1 placeholder:text-muted-foreground bg-transparent"
              rows={2}
            />
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" className="flex-1">
                Aggiungi
              </Button>
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setNewTitle("");
                }}
                className="p-1.5 rounded hover:bg-slate-100 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-black/5 w-full p-2 rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" /> Aggiungi una scheda
          </button>
        )}
      </div>
    </div>
  );
}
