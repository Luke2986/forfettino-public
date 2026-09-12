import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock, TrendingUp, Sparkles, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NotificationRow } from "@/hooks/useNotifications";
import type { LucideIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const categoryIcons: Record<string, LucideIcon> = {
  scadenze: CalendarClock,
  insights: TrendingUp,
  aggiornamenti: Sparkles,
};

const categoryLabels: Record<string, string> = {
  scadenze: "Scadenza",
  insights: "Insight",
  aggiornamenti: "Aggiornamento",
};

interface NotificationItemProps {
  notification: NotificationRow;
  onMarkRead: (id: string) => void;
  /** Callback per chiudere il pannello dopo navigazione */
  onClose?: () => void;
}

export function NotificationItem({ notification, onMarkRead, onClose }: NotificationItemProps) {
  const navigate = useNavigate();
  const [detailOpen, setDetailOpen] = useState(false);
  const isUnread = !notification.read_at;
  const Icon = categoryIcons[notification.category] ?? CalendarClock;
  const categoryLabel = categoryLabels[notification.category] ?? "Notifica";

  const handleClick = () => {
    if (isUnread) {
      onMarkRead(notification.id);
    }
    setDetailOpen(true);
  };

  const handleActionClick = () => {
    if (notification.action_url) {
      setDetailOpen(false);
      onClose?.();
      navigate(notification.action_url);
    }
  };

  // Formatta data: "14 feb 2026", "2 gen 2026" ecc.
  const formattedDate = new Date(notification.created_at).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <>
      <li
        role="listitem"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleClick(); } }}
        data-testid={`notification-${notification.id}`}
        className={cn(
          "flex gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-accent/50",
          isUnread && "bg-primary/5"
        )}
        onClick={handleClick}
      >
        <div className="shrink-0 mt-0.5">
          <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm leading-tight", isUnread && "font-medium")}>
            {notification.title}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {notification.body}
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            {formattedDate}
          </p>
        </div>
        {isUnread && (
          <div className="shrink-0 mt-1.5">
            <div
              className="h-2 w-2 rounded-full bg-primary"
              aria-hidden="true"
            />
            <span className="sr-only">Non letta</span>
          </div>
        )}
      </li>

      {/* Dialog dettaglio notifica — scrollabile, adattivo */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent
          className="max-w-md p-0 overflow-hidden"
          data-testid={`notification-detail-${notification.id}`}
        >
          <div className="flex flex-col" style={{ maxHeight: "80vh" }}>
            {/* Header */}
            <div className="px-6 pt-6 pr-12 shrink-0">
              <div className="flex items-center gap-2 mb-1">
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  {categoryLabel}
                </span>
                <span className="text-xs text-muted-foreground/60 ml-auto">{formattedDate}</span>
              </div>
              <DialogTitle className="text-base font-semibold leading-snug">
                {notification.title}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Dettaglio notifica: {notification.title}
              </DialogDescription>
            </div>

            {/* Body scrollabile */}
            <div
              className="text-sm text-foreground/80 whitespace-pre-line leading-relaxed overflow-y-auto px-6 py-4"
              style={{ minHeight: 0, flex: "1 1 0%" }}
            >
              {notification.body}
            </div>

            {/* Action button se presente */}
            {notification.action_url && (
              <div className="px-6 pb-6 pt-3 border-t shrink-0">
                <Button
                  variant="default"
                  size="sm"
                  className="w-full gap-2"
                  onClick={handleActionClick}
                  data-testid="notification-detail-action"
                >
                  <ExternalLink className="h-4 w-4" />
                  {notification.action_label || "Vai"}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
