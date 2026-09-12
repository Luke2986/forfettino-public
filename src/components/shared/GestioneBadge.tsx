import { Badge } from "@/components/ui/badge";
import type { GestioneINPS } from "@/lib/fiscal-engine";

const GESTIONE_LABELS: Record<GestioneINPS, string> = {
  separata: "Separata",
  artigiani: "Artigiani",
  commercianti: "Commercianti",
};

interface GestioneBadgeProps {
  gestione: GestioneINPS;
  className?: string;
}

export function GestioneBadge({ gestione, className }: GestioneBadgeProps) {
  return (
    <Badge variant="outline" className={className}>
      {GESTIONE_LABELS[gestione]}
    </Badge>
  );
}
