import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationItem } from "./NotificationItem";
import { useNotifications, type NotificationRow } from "@/hooks/useNotifications";
import { useMarkNotificationRead } from "@/hooks/useMarkNotificationRead";
import { useMarkAllNotificationsRead } from "@/hooks/useMarkAllNotificationsRead";

/**
 * Converte una stringa TIMESTAMPTZ in data locale (inizio giornata) per confronti timezone-safe.
 * Evita mismatch UTC vs local: "2026-02-16T23:30:00Z" in UTC+1 → 17 feb locale.
 */
function toLocalDay(isoString: string): Date {
  const d = new Date(isoString);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Raggruppa le notifiche in: Oggi, Questa settimana, Precedenti.
 * Usa date locali normalizzate per evitare problemi di timezone (FINDING-5).
 */
function groupNotificationsByDate(notifications: NotificationRow[]): {
  today: NotificationRow[];
  thisWeek: NotificationRow[];
  older: NotificationRow[];
} {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  // Lunedì come inizio settimana (convenzione italiana)
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

function GroupHeader({ label }: { label: string }) {
  return (
    <li role="presentation" className="px-4 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide bg-muted/30">
      {label}
    </li>
  );
}

interface NotificationListProps {
  /** Callback per chiudere il pannello (Popover/Sheet) dopo navigazione */
  onClose?: () => void;
}

export function NotificationList({ onClose }: NotificationListProps) {
  const { data: notifications = [], isLoading, isFetching } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const hasUnread = notifications.some((n) => !n.read_at);

  const handleMarkRead = (id: string) => {
    markRead.mutate(id);
  };

  const handleMarkAllRead = () => {
    markAllRead.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12" aria-busy="true" aria-label="Caricamento notifiche in corso">
        <div className="motion-safe:animate-pulse text-sm text-muted-foreground">Caricamento...</div>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center" role="status" aria-label="Nessuna notifica" data-testid="notification-empty-state">
        <Bell className="h-10 w-10 text-muted-foreground/40 mb-3" aria-hidden="true" />
        <p className="text-sm font-medium text-muted-foreground">Nessuna notifica</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Le notifiche sulle scadenze appariranno qui
        </p>
      </div>
    );
  }

  const groups = groupNotificationsByDate(notifications);

  return (
    <div className="flex flex-col">
      {/* Header: titolo + segna tutte come lette */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="text-sm font-semibold">Notifiche</h2>
        {hasUnread && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 px-2"
            onClick={handleMarkAllRead}
            data-testid="mark-all-read-btn"
          >
            Segna tutte come lette
          </Button>
        )}
      </div>

      {/* Lista raggruppata — max-h-[400px] desktop, scroll interno */}
      {/* TODO: Per >50 notifiche considerare virtualizzazione o "Mostra di più" (FINDING-9) */}
      <ul role="list" aria-label="Centro notifiche" aria-live="polite" aria-busy={isFetching} className="max-h-[400px] overflow-y-auto">
        {groups.today.length > 0 && (
          <>
            <GroupHeader label="Oggi" />
            {groups.today.map((n) => (
              <NotificationItem key={n.id} notification={n} onMarkRead={handleMarkRead} onClose={onClose} />
            ))}
          </>
        )}
        {groups.thisWeek.length > 0 && (
          <>
            <GroupHeader label="Questa settimana" />
            {groups.thisWeek.map((n) => (
              <NotificationItem key={n.id} notification={n} onMarkRead={handleMarkRead} onClose={onClose} />
            ))}
          </>
        )}
        {groups.older.length > 0 && (
          <>
            <GroupHeader label="Precedenti" />
            {groups.older.map((n) => (
              <NotificationItem key={n.id} notification={n} onMarkRead={handleMarkRead} onClose={onClose} />
            ))}
          </>
        )}
      </ul>
    </div>
  );
}
