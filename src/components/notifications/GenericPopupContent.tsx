import { Link } from "react-router-dom";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

interface GenericPopupContentProps {
  notification: NotificationRow;
  onDismiss: () => void;
}

/**
 * Contenuto generico per pop-up modali bloccanti (Story 25.2).
 *
 * Renderizza: body + action link (opzionale) + bottone "Ho capito" dismiss.
 * Usato per tipi admin_broadcast, admin_individual, annunci — tutto tranne feedback_request.
 *
 * URL interni (/) → React Router Link (SPA navigation)
 * URL esterni (http) → <a> con target="_blank"
 */
export function GenericPopupContent({ notification, onDismiss }: GenericPopupContentProps) {
  const { body, action_url, action_label } = notification;
  const isExternal = action_url?.startsWith("http");

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground text-center leading-relaxed">
        {body}
      </p>

      <div className="flex flex-col gap-2">
        {action_url && action_label && (
          isExternal ? (
            <Button variant="outline" asChild>
              <a href={action_url} target="_blank" rel="noopener noreferrer">
                {action_label}
              </a>
            </Button>
          ) : (
            <Button variant="outline" asChild>
              <Link to={action_url}>{action_label}</Link>
            </Button>
          )
        )}
        <Button onClick={onDismiss}>Ho capito</Button>
      </div>
    </div>
  );
}
