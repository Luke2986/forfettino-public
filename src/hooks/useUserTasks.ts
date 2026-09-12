import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// user_tasks table may not exist in generated types yet — use manual interface
export interface UserTaskRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  completed_at: string | null;
  position: number;
  labels: string[];
  created_at: string;
  updated_at: string;
}

export type KanbanStatus = "in_attesa" | "da_fare" | "in_corso" | "completato";

export const KANBAN_COLUMNS: { id: KanbanStatus; title: string; emoji: string }[] = [
  { id: "in_attesa", title: "Backlog", emoji: "\u270D\uFE0F" },
  { id: "da_fare", title: "Da fare", emoji: "\u26AB" },
  { id: "in_corso", title: "In corso", emoji: "\uD83D\uDE80" },
  { id: "completato", title: "Completato", emoji: "\uD83C\uDF1F" },
];

export const LABEL_COLORS = [
  { id: "red", color: "#ef4444", name: "Rosso" },
  { id: "orange", color: "#f97316", name: "Arancione" },
  { id: "amber", color: "#f59e0b", name: "Ambra" },
  { id: "green", color: "#22c55e", name: "Verde" },
  { id: "blue", color: "#3b82f6", name: "Blu" },
  { id: "purple", color: "#8b5cf6", name: "Viola" },
] as const;

// Cast to any to bypass generated types not including user_tasks
const db = supabase as any;

/** Calculate a position value between two existing positions */
function midPosition(before: number | null, after: number | null): number {
  const low = before ?? 0;
  const high = after ?? low + 2000;
  return Math.round((low + high) / 2);
}

export function useUserTasks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const tasksQuery = useQuery({
    queryKey: ["user_tasks", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await db
        .from("user_tasks")
        .select("*")
        .eq("user_id", user.id)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((t: any) => ({
        ...t,
        labels: Array.isArray(t.labels) ? t.labels : [],
      })) as UserTaskRow[];
    },
    enabled: !!user,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["user_tasks"] });
    queryClient.invalidateQueries({ queryKey: ["user_tasks_overdue_count"] });
  };

  const createTask = useMutation({
    mutationFn: async (
      task: {
        title: string;
        description?: string | null;
        due_date?: string | null;
        priority?: string;
        status?: string;
        labels?: string[];
        position?: number;
      }
    ) => {
      if (!user) throw new Error("Non autenticato");
      // Default position: end of column
      const status = task.status ?? "da_fare";
      const existingTasks = tasksQuery.data?.filter(t => t.status === status) ?? [];
      const maxPos = existingTasks.length > 0
        ? Math.max(...existingTasks.map(t => t.position))
        : 0;
      const position = task.position ?? maxPos + 1000;

      const { data, error } = await db
        .from("user_tasks")
        .insert({
          title: task.title,
          description: task.description ?? null,
          due_date: task.due_date ?? null,
          priority: task.priority ?? "media",
          status,
          labels: task.labels ?? [],
          position,
          user_id: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data as UserTaskRow;
    },
    onSuccess: invalidate,
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<UserTaskRow> & { id: string }) => {
      if (!user) throw new Error("Non autenticato");
      const { data, error } = await db
        .from("user_tasks")
        .update(updates)
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();
      if (error) throw error;
      return data as UserTaskRow;
    },
    onSuccess: invalidate,
  });

  /** Move a task to a new column and/or new position within that column */
  const moveTask = useMutation({
    mutationFn: async ({
      taskId,
      newStatus,
      newPosition,
    }: {
      taskId: string;
      newStatus: KanbanStatus;
      newPosition: number;
    }) => {
      if (!user) throw new Error("Non autenticato");
      const updates: Record<string, unknown> = {
        status: newStatus,
        position: newPosition,
      };
      // Auto-set completed_at
      if (newStatus === "completato") {
        updates.completed_at = new Date().toISOString();
      } else {
        updates.completed_at = null;
      }
      const { data, error } = await db
        .from("user_tasks")
        .update(updates)
        .eq("id", taskId)
        .eq("user_id", user.id)
        .select()
        .single();
      if (error) throw error;
      return data as UserTaskRow;
    },
    onSuccess: invalidate,
  });

  const toggleComplete = useMutation({
    mutationFn: async (task: UserTaskRow) => {
      if (!user) throw new Error("Non autenticato");
      const isCompleted = task.status === "completato";
      const updates = isCompleted
        ? { status: "da_fare", completed_at: null }
        : { status: "completato", completed_at: new Date().toISOString() };
      const { data, error } = await db
        .from("user_tasks")
        .update(updates)
        .eq("id", task.id)
        .eq("user_id", user.id)
        .select()
        .single();
      if (error) throw error;
      return data as UserTaskRow;
    },
    onSuccess: invalidate,
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Non autenticato");
      const { error } = await db
        .from("user_tasks")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  /** Get tasks grouped by column status */
  const tasksByColumn = (tasksQuery.data ?? []).reduce<Record<KanbanStatus, UserTaskRow[]>>(
    (acc, task) => {
      const status = task.status as KanbanStatus;
      if (acc[status]) {
        acc[status].push(task);
      } else {
        // Fallback for unknown status
        acc.da_fare.push(task);
      }
      return acc;
    },
    { in_attesa: [], da_fare: [], in_corso: [], completato: [] }
  );

  // Sort each column by position
  for (const col of Object.values(tasksByColumn)) {
    col.sort((a, b) => a.position - b.position);
  }

  return {
    tasks: tasksQuery.data ?? [],
    tasksByColumn,
    isLoading: tasksQuery.isLoading,
    error: tasksQuery.error,
    createTask,
    updateTask,
    moveTask,
    toggleComplete,
    deleteTask,
    midPosition,
  };
}
