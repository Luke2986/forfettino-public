import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import {
  Inbox,
  CalendarDays,
  LayoutDashboard,
  TableProperties,
  ListTodo,
  Loader2,
  Plus,
  Lock,
  Mail,
  Chrome,
  Smartphone,
  MessageSquare,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  useUserTasks,
  type UserTaskRow,
  type KanbanStatus,
} from "@/hooks/useUserTasks";
import { KanbanBoard } from "@/components/task/KanbanBoard";
import { CardDetailModal } from "@/components/task/CardDetailModal";
import { TaskItem } from "@/components/task/TaskItem";
import { ProGateOverlay } from "@/components/subscription/ProGateOverlay";
import { TaskBoardDemo } from "@/components/task/TaskBoardDemo";
import { useSubscription } from "@/hooks/useSubscription";
import { useUserRole } from "@/hooks/useUserRole";

// ─── View types ────────────────────────────────────────────
type ViewMode = "bacheca" | "tabella" | "planner" | "inbox";

const VIEWS: { id: ViewMode; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "planner", label: "Planner", icon: CalendarDays },
  { id: "bacheca", label: "Bacheca", icon: LayoutDashboard },
  { id: "tabella", label: "Tabella", icon: TableProperties },
];

// ─── List view status filters ──────────────────────────────
const PRIORITY_ORDER = { alta: 3, media: 2, bassa: 1 } as const;
const STATUS_FILTERS = [
  { value: "da_fare", label: "Da fare" },
  { value: "in_corso", label: "In corso" },
  { value: "completato", label: "Completati" },
  { value: "tutti", label: "Tutti" },
] as const;

// ─── Main page (gate: Pro/Admin → full, Free → demo + overlay) ───
export default function TaskPage() {
  const { isPro, isLoading: subLoading } = useSubscription();
  const { data: userRole, isLoading: roleLoading } = useUserRole();
  const isAdmin = userRole === "admin";
  const hasFullAccess = isPro || isAdmin;
  const isMobile = useIsMobile();

  // Fail-closed durante loading
  if (subLoading || roleLoading) {
    return <AppLayout fullBleed>{null}</AppLayout>;
  }

  if (!hasFullAccess) {
    return (
      <AppLayout fullBleed>
        {isMobile && <MobileHeader title="Task Board" />}
        <ProGateOverlay
          featureName="Task Board"
          featureDescription="Organizza i tuoi task e progetti in una bacheca visuale. Trascina, prioritizza, completa."
        >
          <TaskBoardDemo />
        </ProGateOverlay>
      </AppLayout>
    );
  }

  return <TaskBoardFull />;
}

// ─── Full TaskBoard (solo per Pro/Admin — contiene useUserTasks) ───
function TaskBoardFull() {
  const {
    tasks,
    tasksByColumn,
    isLoading,
    createTask,
    updateTask,
    moveTask,
    toggleComplete,
    deleteTask,
  } = useUserTasks();

  const isMobile = useIsMobile();
  const [viewMode, setViewMode] = useState<ViewMode>("bacheca");
  const [selectedTask, setSelectedTask] = useState<UserTaskRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("da_fare");

  // ─── List view: filtered + sorted ───────────────────────
  const filteredAndSorted = useMemo(() => {
    const filtered =
      statusFilter === "tutti"
        ? tasks
        : tasks.filter((t) => t.status === statusFilter);

    const notCompleted = filtered
      .filter((t) => t.status !== "completato")
      .sort((a, b) => {
        if (a.due_date && b.due_date)
          return a.due_date.localeCompare(b.due_date);
        if (a.due_date && !b.due_date) return -1;
        if (!a.due_date && b.due_date) return 1;
        return (
          (PRIORITY_ORDER[b.priority as keyof typeof PRIORITY_ORDER] ?? 0) -
          (PRIORITY_ORDER[a.priority as keyof typeof PRIORITY_ORDER] ?? 0)
        );
      });

    const completed = filtered
      .filter((t) => t.status === "completato")
      .sort((a, b) =>
        (b.completed_at ?? "").localeCompare(a.completed_at ?? "")
      );

    return [...notCompleted, ...completed];
  }, [tasks, statusFilter]);

  // ─── Handlers ───────────────────────────────────────────
  const handleCardClick = (task: UserTaskRow) => {
    setSelectedTask(task);
    setModalOpen(true);
  };

  const handleAddCard = (title: string, status: KanbanStatus) => {
    createTask.mutate({ title, status });
  };

  const handleMoveTask = (
    taskId: string,
    newStatus: KanbanStatus,
    newPosition: number
  ) => {
    moveTask.mutate({ taskId, newStatus, newPosition });
  };

  const handleUpdate = (id: string, updates: Partial<UserTaskRow>) => {
    updateTask.mutate({ id, ...updates });
  };

  const handleDelete = (id: string) => {
    deleteTask.mutate(id);
  };

  const handleCreateNew = () => {
    const title = prompt("Titolo della nuova scheda:");
    if (title?.trim()) {
      createTask.mutate({ title: title.trim(), status: "da_fare" });
    }
  };

  // ─── Render ─────────────────────────────────────────────
  return (
    <AppLayout fullBleed>
      <div className="flex flex-col h-full min-h-0">
        {/* ─── Mobile header with hamburger menu ─── */}
        {isMobile && <MobileHeader title="Task Board" />}

        {/* ─── Header bar with view switcher (desktop full, mobile no hamburger) ─── */}
        <header className="h-12 bg-white/80 backdrop-blur-md border-b border-white/40 flex items-center justify-between px-3 sm:px-5 z-20 shrink-0">

          {/* Center: view switcher tabs */}
          <nav className="flex items-center gap-0.5 bg-black/[0.04] squircle-md p-0.5">
            {VIEWS.map((v) => {
              const Icon = v.icon;
              const isActive = viewMode === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setViewMode(v.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 squircle-md text-xs font-medium transition-all duration-150",
                    isActive
                      ? "bg-white text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" strokeWidth={isActive ? 2.5 : 2} />
                  <span className="hidden sm:inline">{v.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right: actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Button onClick={handleCreateNew} size="sm" variant="default" className="h-8 min-h-[44px] sm:min-h-0 gap-1.5 text-xs px-3">
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Nuova scheda</span>
              <span className="sm:hidden">Nuova</span>
            </Button>
          </div>
        </header>

        {/* ─── Content area ─── */}
        <main className="flex-1 overflow-hidden relative min-h-0">
          {/* BACHECA (Kanban board with sky background) */}
          {viewMode === "bacheca" && (
            <>
              {/* Sky background — full bleed, no tint */}
              <div
                className="absolute inset-0 z-0"
                style={{
                  backgroundImage: `url('/images/sky-bg.png')`,
                  backgroundSize: "cover",
                  backgroundPosition: "center bottom",
                }}
              />

              <div className="h-full w-full relative z-10 flex flex-col p-3 sm:p-5 overflow-hidden">
                <KanbanBoard
                  tasksByColumn={tasksByColumn}
                  isLoading={isLoading}
                  onCardClick={handleCardClick}
                  onAddCard={handleAddCard}
                  onMoveTask={handleMoveTask}
                />
              </div>
            </>
          )}

          {/* TABELLA (table/list view) */}
          {viewMode === "tabella" && (
            <div className="px-4 sm:px-6 pb-4 pt-4 max-w-4xl mx-auto space-y-4 overflow-y-auto h-full bg-slate-50/80">
              <div
                className="flex gap-1 squircle-md bg-slate-100 p-1 w-fit"
                role="tablist"
              >
                {STATUS_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    role="tab"
                    aria-selected={statusFilter === f.value}
                    className={cn(
                      "px-3 py-1.5 text-sm font-medium squircle-md transition-colors min-h-[36px]",
                      statusFilter === f.value
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                    onClick={() => setStatusFilter(f.value)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
                </div>
              ) : filteredAndSorted.length === 0 ? (
                <div className="text-center py-16">
                  <ListTodo className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  {statusFilter === "tutti" || tasks.length === 0 ? (
                    <>
                      <p className="text-sm font-medium text-slate-700 mb-1">
                        Nessun task
                      </p>
                      <p className="text-sm text-slate-500 mb-4">
                        Crea il tuo primo task per organizzare le tue attivita'
                      </p>
                      <Button size="sm" onClick={handleCreateNew}>
                        <Plus className="h-4 w-4 mr-1" /> Crea il tuo primo task
                      </Button>
                    </>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Nessun task con stato "
                      {STATUS_FILTERS.find((f) => f.value === statusFilter)?.label}"
                    </p>
                  )}
                </div>
              ) : (
                <div
                  className="bg-white rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.05),0_0_0_1px_rgba(23,23,23,0.05)] border-0"
                  role="list"
                >
                  {filteredAndSorted.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onToggleComplete={(t) => toggleComplete.mutate(t)}
                      onEdit={handleCardClick}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* INBOX (coming soon) */}
          {viewMode === "inbox" && (
            <div className="h-full bg-slate-50/80 flex flex-col items-center pt-8 px-4 overflow-y-auto">
              <div className="w-full max-w-2xl text-center mt-8">
                <img
                  src="/images/empty-inbox.png"
                  alt="Inbox vuota"
                  className="w-56 h-56 object-contain mb-6 drop-shadow-lg mx-auto"
                />
                <h2 className="text-xl font-bold text-foreground mb-2 tracking-tight">
                  Consolida le attivita' da svolgere
                </h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-8">
                  Raccogli rapidamente idee, email e attivita' in un unico posto
                  prima di organizzarle nella bacheca.
                </p>

                <div className="flex gap-3 justify-center mb-6">
                  {[Mail, Chrome, Smartphone, MessageSquare].map((Icon, i) => (
                    <div
                      key={i}
                      className="w-10 h-10 rounded-full bg-accent text-accent-foreground flex items-center justify-center shadow-inner"
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground bg-muted px-3 py-1.5 rounded-full w-fit mx-auto">
                  <Lock className="w-3 h-3" /> Disponibile prossimamente
                </div>
              </div>
            </div>
          )}

          {/* PLANNER (coming soon) */}
          {viewMode === "planner" && (
            <div className="h-full flex flex-col bg-slate-50/80 overflow-hidden">
              <div className="border-b px-6 py-4 flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary" /> Planner
                  </h2>
                </div>
                <Button variant="outline" size="sm" className="gap-2" disabled>
                  <img
                    src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                    className="w-4 h-4"
                    alt="Google"
                  />
                  Collega Google Calendar
                </Button>
              </div>
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <CalendarDays className="w-14 h-14 text-muted-foreground/20 mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Collega il tuo Google Calendar per vedere i tuoi impegni
                    fianco a fianco con i task. Disponibile prossimamente.
                  </p>
                </div>
              </div>
            </div>
          )}
        </main>

      </div>

      {/* Card detail modal */}
      <CardDetailModal
        task={selectedTask}
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedTask(null);
        }}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </AppLayout>
  );
}
