import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlignLeft, Calendar, Tag, Trash2, X, Flag } from "lucide-react";
import {
  KANBAN_COLUMNS,
  LABEL_COLORS,
  type UserTaskRow,
  type KanbanStatus,
} from "@/hooks/useUserTasks";
import { cn } from "@/lib/utils";

interface CardDetailModalProps {
  task: UserTaskRow | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<UserTaskRow>) => void;
  onDelete: (id: string) => void;
}

export function CardDetailModal({
  task,
  open,
  onClose,
  onUpdate,
  onDelete,
}: CardDetailModalProps) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [dueInput, setDueInput] = useState("");
  const [priority, setPriority] = useState("media");
  const [status, setStatus] = useState<string>("da_fare");
  const [labels, setLabels] = useState<string[]>([]);
  const [showLabelPicker, setShowLabelPicker] = useState(false);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDesc(task.description ?? "");
      setDueInput(task.due_date ?? "");
      setPriority(task.priority);
      setStatus(task.status);
      setLabels(task.labels ?? []);
      setShowLabelPicker(false);
    }
  }, [task, open]);

  if (!task) return null;

  const handleTitleBlur = () => {
    if (title.trim() && title !== task.title) {
      onUpdate(task.id, { title: title.trim() });
    }
  };

  const handleDescBlur = () => {
    const newDesc = desc.trim() || null;
    if (newDesc !== (task.description ?? null)) {
      onUpdate(task.id, { description: newDesc });
    }
  };

  const handleDueDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDueInput(val);
    onUpdate(task.id, { due_date: val || null });
  };

  const handlePriorityChange = (val: string) => {
    setPriority(val);
    onUpdate(task.id, { priority: val });
  };

  const handleStatusChange = (val: string) => {
    setStatus(val);
    const updates: Partial<UserTaskRow> = { status: val };
    if (val === "completato") {
      updates.completed_at = new Date().toISOString();
    } else {
      updates.completed_at = null;
    }
    onUpdate(task.id, updates);
  };

  const toggleLabel = (labelId: string) => {
    const newLabels = labels.includes(labelId)
      ? labels.filter((l) => l !== labelId)
      : [...labels, labelId];
    setLabels(newLabels);
    onUpdate(task.id, { labels: newLabels });
  };

  const handleDelete = () => {
    if (confirm("Sei sicuro di voler eliminare questa scheda?")) {
      onDelete(task.id);
      onClose();
    }
  };

  const cardLabelSet = new Set(labels);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle asChild>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              aria-label="Titolo scheda"
              className="text-xl font-bold border-none outline-none focus:ring-2 focus:ring-primary/20 rounded px-1 -ml-1 w-full bg-transparent"
            />
          </DialogTitle>
          <DialogDescription className="sr-only">
            Dettaglio e modifica della scheda
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-2">
          {/* Quick metadata row */}
          <div className="flex flex-wrap gap-4">
            {/* Due date */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase">
                Scadenza
              </p>
              <div className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-md">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <input
                  type="date"
                  value={dueInput}
                  onChange={handleDueDateChange}
                  className="text-sm bg-transparent outline-none"
                />
                {dueInput && (
                  <button
                    onClick={() => {
                      setDueInput("");
                      onUpdate(task.id, { due_date: null });
                    }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Priority */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase">
                Priorita'
              </p>
              <Select value={priority} onValueChange={handlePriorityChange}>
                <SelectTrigger className="w-[130px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bassa">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-slate-300" /> Bassa
                    </span>
                  </SelectItem>
                  <SelectItem value="media">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-amber-400" /> Media
                    </span>
                  </SelectItem>
                  <SelectItem value="alta">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-red-500" /> Alta
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Column / Status */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase">
                Colonna
              </p>
              <Select value={status} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KANBAN_COLUMNS.map((col) => (
                    <SelectItem key={col.id} value={col.id}>
                      {col.emoji} {col.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Labels */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase">
              Etichette
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {labels.map((id) => {
                const label = LABEL_COLORS.find((l) => l.id === id);
                if (!label) return null;
                return (
                  <button
                    key={id}
                    onClick={() => toggleLabel(id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-white shadow-sm"
                    style={{ backgroundColor: label.color }}
                  >
                    {label.name} <X className="w-3 h-3" />
                  </button>
                );
              })}
              <div className="relative">
                <button
                  onClick={() => setShowLabelPicker((v) => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
                >
                  <Tag className="w-4 h-4" /> Aggiungi
                </button>
                {showLabelPicker && (
                  <div className="absolute z-50 top-10 left-0 bg-white rounded-xl shadow-lg border p-2 w-48 space-y-1">
                    {LABEL_COLORS.map((l) => (
                      <button
                        key={l.id}
                        onClick={() => toggleLabel(l.id)}
                        className={cn(
                          "flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-sm transition-colors",
                          cardLabelSet.has(l.id)
                            ? "ring-2 ring-primary/40"
                            : "hover:bg-muted"
                        )}
                      >
                        <span
                          className="w-4 h-4 rounded-sm"
                          style={{ backgroundColor: l.color }}
                        />
                        {l.name}
                        {cardLabelSet.has(l.id) && (
                          <span className="ml-auto text-primary text-xs">
                            ✓
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-base font-semibold">
              <AlignLeft className="w-5 h-5" /> Descrizione
            </div>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              onBlur={handleDescBlur}
              placeholder="Aggiungi una descrizione piu' dettagliata..."
              className="w-full min-h-[100px] p-3 rounded-xl border bg-muted/30 focus:bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-y text-sm"
            />
          </div>

          {/* Delete */}
          <div className="pt-2 flex justify-end border-t">
            <Button
              variant="destructive"
              onClick={handleDelete}
              className="gap-2"
            >
              <Trash2 className="w-4 h-4" /> Elimina scheda
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
