import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface AdminStatCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  subLabel?: ReactNode;
  iconClassName?: string;
}

export function AdminStatCard({ icon, label, value, subLabel, iconClassName }: AdminStatCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10",
              iconClassName
            )}
            aria-hidden="true"
          >
            {icon}
          </div>
          <div className="space-y-0.5 overflow-hidden">
            <p className="text-2xl font-bold tracking-tight truncate">{value}</p>
            <p className="text-sm font-medium text-muted-foreground truncate">{label}</p>
            {subLabel && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="text-xs text-muted-foreground/80 truncate cursor-help">{subLabel}</p>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[250px] text-xs">
                  {subLabel}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
