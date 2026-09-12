import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { Milestone, ActionConfig } from "@/lib/contribution-helpers";
import { MilestoneProgress } from "./MilestoneProgress";

interface HowItWorksSectionProps {
  milestones: Milestone[];
  totalPts: number;
  milestonesLoading?: boolean;
  configs: ActionConfig[];
}

export function HowItWorksSection({
  milestones,
  totalPts,
  milestonesLoading,
  configs,
}: HowItWorksSectionProps) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="bg-white rounded-2xl border border-slate-100 shadow-sm">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors rounded-xl">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-4.5 w-4.5 text-teal-500" />
              <span className="text-sm font-semibold text-slate-700">Come funziona?</span>
            </div>
            <ChevronDown
              className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${
                open ? "rotate-180" : ""
              }`}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4 space-y-5">
            {/* Actions & Points table (from DB config) */}
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">Guadagna punti</p>
              <div className="rounded-lg border border-slate-100 overflow-hidden">
                <table className="w-full text-sm">
                  <caption className="sr-only">Azioni e punteggi per contribuire</caption>
                  <thead>
                    <tr className="bg-slate-50 text-left">
                      <th className="px-3 py-2 text-xs font-medium text-slate-500 uppercase">Azione</th>
                      <th className="px-3 py-2 text-xs font-medium text-slate-500 uppercase text-right">Punti</th>
                      <th className="px-3 py-2 text-xs font-medium text-slate-500 uppercase hidden sm:table-cell">Frequenza</th>
                    </tr>
                  </thead>
                  <tbody>
                    {configs.map((cfg) => (
                      <tr key={cfg.actionType} className="border-t border-slate-50">
                        <td className="px-3 py-2 text-slate-700 flex items-center gap-2">
                          <span
                            className={`inline-block h-2 w-2 rounded-full shrink-0 ${cfg.colorBg}`}
                          />
                          {cfg.label}
                        </td>
                        <td className="px-3 py-2 text-right font-medium tabular-nums text-slate-800">
                          +{cfg.points}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500 hidden sm:table-cell">
                          {cfg.frequencyLabel}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Milestones progress */}
            <MilestoneProgress
              milestones={milestones}
              totalPts={totalPts}
              isLoading={milestonesLoading}
            />
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
