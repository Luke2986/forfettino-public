import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UserTaskRow } from "@/hooks/useUserTasks";

interface TaskSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: UserTaskRow | null;
  onSave: (data: {
    title: string;
    description: string | null;
    due_date: string | null;
    priority: string;
    status?: string;
  }) => void;
}

export function TaskSheet({ open, onOpenChange, task, onSave }: TaskSheetProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("media");

  const isEdit = task !== null;

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setDueDate(task.due_date ?? "");
      setPriority(task.priority);
    } else {
      setTitle("");
      setDescription("");
      setDueDate("");
      setPriority("media");
    }
  }, [task, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      description: description.trim() || null,
      due_date: dueDate || null,
      priority,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Modifica task" : "Nuovo task"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Modifica i dettagli del task"
              : "Crea un nuovo task personale"}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">Titolo *</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Cosa devi fare?"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-description">Descrizione</Label>
            <Textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Dettagli aggiuntivi..."
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-due-date">Data scadenza</Label>
            <Input
              id="task-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-priority">Priorita'</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger id="task-priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bassa">Bassa</SelectItem>
                <SelectItem value="media">Media</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annulla
            </Button>
            <Button type="submit" disabled={!title.trim()}>
              {isEdit ? "Salva" : "Crea"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
