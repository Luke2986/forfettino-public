import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyState {
  text: string;
  cta?: {
    label: string;
    onClick: () => void;
  };
}

interface ExpandableDashboardCardProps {
  title: string;
  value: string;
  description: string;
  icon: React.ElementType;
  iconColor?: string;
  breakdownContent: React.ReactNode;
  onClick?: () => void;
  action?: React.ReactNode;
  isHero?: boolean;
  className?: string;
  alwaysVisibleContent?: React.ReactNode;
  emptyState?: EmptyState;
  isEmpty?: boolean;
  persistKey?: string;
  helpTrigger?: React.ReactNode;
  /** When true, shows a 2-second highlight pulse then auto-removes */
  highlight?: boolean;
  /** @deprecated Legacy border-l accent. Ignored — design system now uses diagonal gradient on KpiCard. */
  accentBorder?: string;
}

export function ExpandableDashboardCard({
  title,
  value,
  description,
  icon: Icon,
  iconColor = "text-primary",
  breakdownContent,
  onClick,
  action,
  isHero = false,
  className,
  alwaysVisibleContent,
  emptyState,
  isEmpty = false,
  persistKey,
  helpTrigger,
  highlight = false,
  accentBorder: _accentBorder,
}: ExpandableDashboardCardProps) {
  const [isExpanded, setIsExpanded] = useState(() => {
    if (persistKey && typeof window !== "undefined") {
      return localStorage.getItem(persistKey) === "true";
    }
    return false;
  });

  // Highlight pulse: auto-remove after 2 seconds
  const [showHighlight, setShowHighlight] = useState(false);
  useEffect(() => {
    if (highlight) {
      setShowHighlight(true);
      const timer = setTimeout(() => setShowHighlight(false), 2000);
      return () => clearTimeout(timer);
    }
    setShowHighlight(false);
  }, [highlight]);

  // Persist state when it changes
  useEffect(() => {
    if (persistKey) {
      localStorage.setItem(persistKey, String(isExpanded));
    }
  }, [isExpanded, persistKey]);

  const handleCardClick = (e: React.MouseEvent) => {
    if (onClick) {
      onClick();
      return;
    }
    setIsExpanded(!isExpanded);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (onClick) {
        onClick();
      } else {
        setIsExpanded(!isExpanded);
      }
    }
  };

  const handleHeaderClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  return (
    <Card
      className={cn(
        "transition-all duration-200 hover:shadow-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "cursor-pointer",
        isExpanded && "ring-1 ring-primary/20",
        // Legacy backward-compat card (replaced by KpiCard).
        // border-l accents removed per design system (accento ora via gradiente diagonale).
        isHero && "bg-primary/[0.02] shadow-elevated",
        showHighlight && "ring-2 ring-emerald-400 shadow-lg shadow-emerald-100 motion-safe:animate-pulse",
        className
      )}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-expanded={isExpanded}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div
          className="flex items-center justify-between flex-1 cursor-pointer"
          onClick={handleHeaderClick}
        >
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {title}
            </CardTitle>
            {helpTrigger && (
              <div
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                  }
                }}
                role="button"
                tabIndex={0}
                className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-help"
                aria-label="Informazioni aggiuntive"
              >
                {helpTrigger}
              </div>
            )}
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200 ml-2",
              isExpanded && "rotate-180"
            )}
          />
        </div>
        <div className={cn(
          "flex items-center justify-center rounded-lg ml-2",
          isHero ? "h-10 w-10 bg-primary/10" : "h-8 w-8 bg-primary/10"
        )}>
          <Icon className={cn(
            isHero ? "h-5 w-5" : "h-4 w-4",
            iconColor
          )} />
        </div>
      </CardHeader>
      <CardContent>
        {isEmpty && emptyState ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">{emptyState.text}</p>
            {emptyState.cta && (
              <Button
                variant="link"
                size="sm"
                className="mt-2 text-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  emptyState.cta?.onClick();
                }}
              >
                {emptyState.cta.label}
              </Button>
            )}
          </div>
        ) : (
          <>
            <p className={cn(
              "font-bold tabular-nums",
              isHero ? "text-2xl font-display" : "text-xl"
            )}>{value}</p>
            <p className="text-sm text-muted-foreground">{description}</p>
            {alwaysVisibleContent}
            {action}
          </>
        )}

        {/* Expandable Breakdown Section */}
        <div
          className={cn(
            "overflow-hidden transition-all duration-300 ease-in-out",
            isExpanded ? "mt-4 max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
          )}
        >
          <div className="border-t border-border pt-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Come viene calcolato
            </h4>
            <div className="text-sm space-y-2 text-foreground">
              {breakdownContent}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
