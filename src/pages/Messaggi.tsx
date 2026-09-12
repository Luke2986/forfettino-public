import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CalendarClock, TrendingUp, Sparkles, ExternalLink, MessageCircle } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNotifications, type NotificationRow } from "@/hooks/useNotifications";
import { useNotificationCount } from "@/hooks/useNotificationCount";
import { useMarkNotificationRead } from "@/hooks/useMarkNotificationRead";
import { useMarkAllNotificationsRead } from "@/hooks/useMarkAllNotificationsRead";
import { useIsMobile } from "@/hooks/use-mobile";
import type { LucideIcon } from "lucide-react";

// ── Timezone-safe grouping (same logic as NotificationList.tsx) ──

function toLocalDay(isoString: string): Date {
  const d = new Date(isoString);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function groupNotificationsByDate(notifications: NotificationRow[]): {
  today: NotificationRow[];
  thisWeek: NotificationRow[];
  older: NotificationRow[];
} {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  const dayOfWeek = startOfWeek.getDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  startOfWeek.setDate(startOfWeek.getDate() - diff);

  return {
    today: notifications.filter((n) => toLocalDay(n.created_at) >= startOfToday),
    thisWeek: notifications.filter((n) => {
      const d = toLocalDay(n.created_at);
      return d >= startOfWeek && d < startOfToday;
    }),
    older: notifications.filter((n) => toLocalDay(n.created_at) < startOfWeek),
  };
}

// ── Category config ──

const categoryIcons: Record<string, LucideIcon> = {
  scadenze: CalendarClock,
  insights: TrendingUp,
  aggiornamenti: Sparkles,
  admin: MessageCircle,
};

const categoryLabels: Record<string, string> = {
  scadenze: "Scadenza",
  insights: "Insight",
  aggiornamenti: "Aggiornamento",
  admin: "Admin",
};

// ── Notification card with inline expand ──

interface NotificationCardProps {
  notification: NotificationRow;
  isExpanded: boolean;
  onToggle: () => void;
  onMarkRead: (id: string) => void;
}

function NotificationCard({ notification, isExpanded, onToggle, onMarkRead }: NotificationCardProps) {
  const navigate = useNavigate();
  const isUnread = !notification.read_at;
  // admin_individual messages use MessageCircle icon (AC #5 Story 25.6)
  const Icon = notification.type === "admin_individual"
    ? MessageCircle
    : (categoryIcons[notification.category] ?? CalendarClock);
  const categoryLabel = categoryLabels[notification.category] ?? "Notifica";

  const formattedDate = new Date(notification.created_at).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const handleClick = () => {
    if (isUnread) {
      onMarkRead(notification.id);
    }
    onToggle();
  };

  const handleActionClick = () => {
    if (notification.action_url) {
      navigate(notification.action_url);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      data-testid={`messaggi-card-${notification.id}`}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleClick(); } }}
      onClick={handleClick}
      className={cn(
        "transition-colors cursor-pointer",
        isUnread ? "bg-slate-50" : "bg-white",
        isExpanded && "rounded-lg ring-1 ring-primary/20",
      )}
    >
      <div className="flex gap-3 px-4 py-3">
        <div className="shrink-0 mt-0.5">
          <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm text-slate-500 font-medium uppercase tracking-wide">
              {categoryLabel}
            </span>
            <span className="text-sm text-slate-500">{formattedDate}</span>
          </div>
          <p className={cn("text-sm leading-tight", isUnread ? "font-semibold" : "font-normal")}>
            {notification.title}
          </p>
          {!isExpanded && (
            <p className="text-sm text-slate-600 mt-0.5 line-clamp-2">
              {notification.body}
            </p>
          )}
        </div>
        {isUnread && (
          <div className="shrink-0 mt-1.5">
            <div className="h-2 w-2 rounded-full bg-primary" aria-label="Non letta" />
          </div>
        )}
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-slate-100 mt-0" onClick={(e) => e.stopPropagation()}>
          <p className="text-sm text-foreground/80 whitespace-pre-line leading-relaxed pt-3">
            {notification.body}
          </p>
          {notification.action_url && (
            <Button
              variant="default"
              size="sm"
              className="mt-3 gap-2"
              onClick={handleActionClick}
              data-testid="messaggi-action-btn"
            >
              <ExternalLink className="h-4 w-4" />
              {notification.action_label || "Vai"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Group header ──

function GroupHeader({ label }: { label: string }) {
  return (
    <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2 mt-1">
      {label}
    </h2>
  );
}

// ── Main page ──

export default function Messaggi() {
  const isMobile = useIsMobile();
  const { data: notifications = [], isLoading } = useNotifications();
  const { data: unreadCount = 0 } = useNotificationCount();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleMarkRead = (id: string) => {
    markRead.mutate(id);
  };

  const handleMarkAllRead = () => {
    markAllRead.mutate();
  };

  const handleToggle = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const groups = groupNotificationsByDate(notifications);
  const hasNotifications = notifications.length > 0;

  return (
    <AppLayout>
      {isMobile && <MobileHeader title="Messaggi" />}
      <PageContainer>
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Messaggi</h1>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllRead}
              data-testid="mark-all-read-btn"
            >
              Segna tutte come lette
            </Button>
          )}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-pulse text-sm text-muted-foreground">Caricamento...</div>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !hasNotifications && (
          <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="messaggi-empty-state">
            <Bell className="h-12 w-12 text-muted-foreground/30 mb-4" aria-hidden="true" />
            <p className="text-base font-medium text-muted-foreground">Nessun messaggio</p>
            <p className="text-sm text-muted-foreground/70 mt-1 max-w-xs">
              Le notifiche sulle scadenze e gli aggiornamenti appariranno qui.
            </p>
          </div>
        )}

        {/* Grouped notifications */}
        {!isLoading && hasNotifications && (
          <div className="space-y-4">
            {groups.today.length > 0 && (
              <div>
                <GroupHeader label="Oggi" />
                <div className="divide-y divide-slate-100">
                  {groups.today.map((n) => (
                    <NotificationCard
                      key={n.id}
                      notification={n}
                      isExpanded={expandedId === n.id}
                      onToggle={() => handleToggle(n.id)}
                      onMarkRead={handleMarkRead}
                    />
                  ))}
                </div>
              </div>
            )}
            {groups.thisWeek.length > 0 && (
              <div>
                <GroupHeader label="Questa settimana" />
                <div className="divide-y divide-slate-100">
                  {groups.thisWeek.map((n) => (
                    <NotificationCard
                      key={n.id}
                      notification={n}
                      isExpanded={expandedId === n.id}
                      onToggle={() => handleToggle(n.id)}
                      onMarkRead={handleMarkRead}
                    />
                  ))}
                </div>
              </div>
            )}
            {groups.older.length > 0 && (
              <div>
                <GroupHeader label="Precedenti" />
                <div className="divide-y divide-slate-100">
                  {groups.older.map((n) => (
                    <NotificationCard
                      key={n.id}
                      notification={n}
                      isExpanded={expandedId === n.id}
                      onToggle={() => handleToggle(n.id)}
                      onMarkRead={handleMarkRead}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </PageContainer>
    </AppLayout>
  );
}
