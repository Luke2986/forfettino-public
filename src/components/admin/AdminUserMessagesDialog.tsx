import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Bell, MessageCircle, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { useAdminUserMessages, type AdminUserMessage } from "@/hooks/useAdminUserMessages";
import { formatDateIT } from "@/lib/schedule-helpers";

interface AdminUserMessagesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  userCode: string;
  userName: string;
}

function getStatusBadge(msg: AdminUserMessage) {
  if (msg.suppressed) {
    return (
      <Badge variant="outline" className="text-xs text-amber-600 border-amber-300" data-testid="status-suppressed">
        Soppresso
      </Badge>
    );
  }
  if (msg.read_at || msg.dismissed_at) {
    return (
      <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300" data-testid="status-read">
        Letto
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs" data-testid="status-unread">
      Non letto
    </Badge>
  );
}

function DeliveryBadge({ type }: { type: string }) {
  if (type === "popup") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" data-testid="delivery-popup">
        <MessageCircle className="h-3 w-3" />
        Pop-up
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" data-testid="delivery-sidebar">
      <Bell className="h-3 w-3" />
      Campanella
    </span>
  );
}

function MessageRow({ msg }: { msg: AdminUserMessage }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="border-b last:border-0"
      data-testid={`message-row-${msg.id}`}
    >
      {/* Row header — clickable */}
      <button
        type="button"
        className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-accent/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
        data-testid={`message-toggle-${msg.id}`}
      >
        {/* Chevron */}
        <span className="shrink-0 text-muted-foreground">
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </span>

        {/* Date */}
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums w-[80px]">
          {msg.published_at ? formatDateIT(msg.published_at) : "—"}
        </span>

        {/* Delivery type */}
        <span className="shrink-0 w-[90px]">
          <DeliveryBadge type={msg.delivery_type} />
        </span>

        {/* Title */}
        <span className="flex-1 min-w-0 text-sm font-medium truncate">
          {msg.title}
        </span>

        {/* Status */}
        <span className="shrink-0">
          {getStatusBadge(msg)}
        </span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 pl-10" data-testid={`message-expanded-${msg.id}`}>
          <p className="text-sm text-foreground/80 whitespace-pre-line leading-relaxed">
            {msg.body}
          </p>
          {msg.action_url && (
            <p className="text-xs text-primary mt-2 flex items-center gap-1">
              <ExternalLink className="h-3 w-3" />
              {msg.action_label || msg.action_url}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function AdminUserMessagesDialog({
  open,
  onOpenChange,
  userId,
  userCode,
  userName,
}: AdminUserMessagesDialogProps) {
  const { data: messages = [], isLoading } = useAdminUserMessages(userId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto" data-testid="user-messages-sheet">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Messaggi inviati
          </SheetTitle>
          <SheetDescription>
            <span className="font-mono tracking-wider">{userCode}</span>
            {userName && <> — {userName}</>}
          </SheetDescription>
        </SheetHeader>

        {isLoading && (
          <p className="text-sm text-muted-foreground" data-testid="messages-loading">
            Caricamento...
          </p>
        )}

        {!isLoading && messages.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center" data-testid="messages-empty">
            Nessun messaggio inviato a questo utente
          </p>
        )}

        {!isLoading && messages.length > 0 && (
          <div className="border rounded-lg" data-testid="messages-list">
            {messages.map((msg) => (
              <MessageRow key={msg.id} msg={msg} />
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
