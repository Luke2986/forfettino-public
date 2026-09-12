import { useCallback, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useNotificationCount } from "@/hooks/useNotificationCount";
import { useIsMobile } from "@/hooks/use-mobile";
import { NotificationList } from "./NotificationList";
import { cn } from "@/lib/utils";

function formatBadgeCount(count: number): string {
  if (count <= 0) return "";
  if (count > 99) return "99+";
  return String(count);
}

interface NotificationBellProps {
  /** Variante sidebar collassata: icona più piccola, badge compatto */
  collapsed?: boolean;
}

export function NotificationBell({ collapsed = false }: NotificationBellProps) {
  const { data: count = 0 } = useNotificationCount();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  const handleClose = useCallback(() => setOpen(false), []);

  const badgeText = formatBadgeCount(count);
  const ariaLabel =
    count > 0
      ? `Notifiche, ${count} non lette`
      : "Notifiche, nessuna non letta";

  // FINDING-8: touch target SEMPRE ≥ 44px (WCAG 2.5.5), anche in collapsed.
  // In collapsed il button è visivamente più compatto ma il touch area resta 44px.
  const bellButton = (
    <Button
      variant="ghost"
      size="icon"
      className="relative min-h-[44px] min-w-[44px]"
      aria-label={ariaLabel}
      data-testid="notification-bell"
    >
      <Bell className={cn("h-5 w-5", collapsed && "h-4 w-4")} />
      {count > 0 && (
        <span
          className={cn(
            "absolute flex items-center justify-center rounded-full bg-destructive text-destructive-foreground font-bold leading-none",
            collapsed
              ? "top-0.5 right-0.5 h-4 min-w-[16px] px-0.5 text-xs"
              : "top-1 right-1 h-4 min-w-[16px] px-1 text-xs"
          )}
          data-testid="notification-badge"
          aria-hidden="true"
        >
          {badgeText}
        </span>
      )}
    </Button>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{bellButton}</SheetTrigger>
        <SheetContent
          side="right"
          className="w-full p-0"
          aria-label="Centro notifiche"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Centro notifiche</SheetTitle>
            <SheetDescription>Le tue notifiche recenti</SheetDescription>
          </SheetHeader>
          <NotificationList onClose={handleClose} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{bellButton}</PopoverTrigger>
      <PopoverContent
        className="w-80 p-0"
        align="end"
        aria-label="Centro notifiche"
      >
        <NotificationList onClose={handleClose} />
      </PopoverContent>
    </Popover>
  );
}
