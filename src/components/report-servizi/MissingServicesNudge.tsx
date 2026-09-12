import { Info } from "lucide-react";
import { Link } from "react-router-dom";
import type { ServiceRevenue } from "@/hooks/useServiceRevenueReport";

interface MissingServicesNudgeProps {
  data: ServiceRevenue[];
}

export function MissingServicesNudge({ data }: MissingServicesNudgeProps) {
  const nullEntry = data.find((d) => d.serviceId === null);
  if (!nullEntry || nullEntry.percentage <= 30) return null;

  const totalReceipts = data.reduce((sum, d) => sum + d.receiptCount, 0);

  return (
    <div className="flex items-start gap-3 rounded-lg px-4 py-3 bg-amber-50 border border-amber-200/60">
      <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
      <p className="text-sm text-amber-800">
        {nullEntry.receiptCount} incass{nullEntry.receiptCount === 1 ? "o" : "i"} su {totalReceipts} non {nullEntry.receiptCount === 1 ? "ha" : "hanno"} una categoria servizio ({Math.round(nullEntry.percentage)}%).{" "}
        <Link
          to="/incassi"
          className="font-medium underline underline-offset-2 hover:text-amber-900"
        >
          Categorizzali per un report completo
        </Link>
      </p>
    </div>
  );
}
