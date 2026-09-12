import { Info } from "lucide-react";
import { Link } from "react-router-dom";

interface MissingClientsNudgeProps {
  nullClientPercentage: number;
}

export function MissingClientsNudge({
  nullClientPercentage,
}: MissingClientsNudgeProps) {
  if (nullClientPercentage <= 30) return null;

  return (
    <div className="flex items-start gap-3 rounded-lg px-4 py-3 bg-amber-50 border border-amber-200/60">
      <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
      <p className="text-sm text-amber-800">
        Associa un cliente ai tuoi incassi per report più precisi.{" "}
        <Link
          to="/incassi"
          className="font-medium underline underline-offset-2 hover:text-amber-900"
        >
          Vai agli incassi
        </Link>
      </p>
    </div>
  );
}
