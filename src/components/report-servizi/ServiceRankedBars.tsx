/**
 * Ranked Bar Chart per servizio — barre pill-shaped con gradiente blue degradante.
 * Dot colorato accanto al nome per identificare la categoria.
 * Stories: 55.3 (base), 55.5 (trend expansion + chevron + YoY toggle).
 */

import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/money";
import { formatDateIT } from "@/lib/schedule-helpers";
import { useIsMobile } from "@/hooks/use-mobile";
import { UpgradeCTA } from "@/components/subscription/UpgradeCTA";
import { ServiceMonthlyTrendChart } from "./ServiceMonthlyTrendChart";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { capitalizeFirst } from "@/lib/string-utils";
import type { ServiceRevenue } from "@/hooks/useServiceRevenueReport";

/* ── Palette gradiente blue degradante per posizione ranking ── */
const BLUE_GRADIENTS: [string, string][] = [
  ["#2563eb", "#60a5fa"], // blue-600 → blue-400
  ["#3b82f6", "#93c5fd"], // blue-500 → blue-300
  ["#60a5fa", "#bfdbfe"], // blue-400 → blue-200
  ["#93c5fd", "#dbeafe"], // blue-300 → blue-100
];
const SLATE_GRADIENT: [string, string] = ["#94a3b8", "#e2e8f0"]; // slate-400 → slate-200

const DEFAULT_VISIBLE = 7;
const FREE_VISIBLE = 3;
const NULL_SERVICE_KEY = "__null__";

interface ServiceRankedBarsProps {
  data: ServiceRevenue[];
  hasFullAccess: boolean;
  selectedPeriod: number | null;
}

function getGradient(index: number): [string, string] {
  if (index < BLUE_GRADIENTS.length) return BLUE_GRADIENTS[index];
  return SLATE_GRADIENT;
}

export function ServiceRankedBars({
  data,
  hasFullAccess,
  selectedPeriod,
}: ServiceRankedBarsProps) {
  const isMobile = useIsMobile();
  const [showAll, setShowAll] = useState(false);
  const [animated, setAnimated] = useState(false);
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);

  useEffect(() => {
    setAnimated(false);
    const raf = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(raf);
  }, [data]);

  // Reset espansione al cambio periodo (anno o Totale)
  useEffect(() => {
    setExpandedServiceId(null);
  }, [selectedPeriod]);

  const canExpand = hasFullAccess && selectedPeriod !== null;

  const handleBarClick = (serviceKey: string) => {
    if (!canExpand) return;
    setExpandedServiceId((prev) => (prev === serviceKey ? null : serviceKey));
  };

  // Ordina: "Non categorizzato" (serviceId === null) sempre per ultimo
  const sorted = [...data].sort((a, b) => {
    if (a.serviceId === null) return 1;
    if (b.serviceId === null) return -1;
    return b.totalGross - a.totalGross;
  });

  // sorted[0] = max tra servizi con ID, sorted[last] = null-service (forzato in fondo)
  // Math.max copre il caso edge dove null-service ha gross superiore al primo servizio reale
  const maxGross = sorted.length > 0
    ? Math.max(sorted[0].totalGross, sorted[sorted.length - 1].totalGross) || 1
    : 1;

  const visibleLimit = hasFullAccess
    ? showAll
      ? sorted.length
      : Math.min(DEFAULT_VISIBLE, sorted.length)
    : sorted.length; // Free: mostra tutte ma blurra dalla 4a

  const visibleBars = sorted.slice(0, visibleLimit);
  const hasMore = hasFullAccess && sorted.length > DEFAULT_VISIBLE && !showAll;

  return (
    <div className="space-y-3">
      {visibleBars.map((service, i) => {
        const isNullService = service.serviceId === null;
        const [from, to] = getGradient(i);
        const barWidthPct = maxGross > 0 ? (service.totalGross / maxGross) * 100 : 0;
        const isFreeBlurred = !hasFullAccess && i >= FREE_VISIBLE;

        const serviceKey = service.serviceId ?? NULL_SERVICE_KEY;
        const isExpanded = expandedServiceId === serviceKey;
        const isClickable = canExpand && !isFreeBlurred;
        const displayName = isNullService ? "Non categorizzato" : capitalizeFirst(service.serviceName);

        return (
          <div
            key={service.serviceId ?? NULL_SERVICE_KEY}
            className={cn("relative", isFreeBlurred && "blur-[4px] select-none")}
            data-testid={`bar-row-${i}`}
          >
            {/* Clickable wrapper */}
            <div
              className={cn(
                "rounded-xl",
                isClickable && "cursor-pointer group outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2"
              )}
              onClick={() => isClickable && handleBarClick(serviceKey)}
              role={isClickable ? "button" : undefined}
              aria-expanded={isClickable ? isExpanded : undefined}
              aria-label={isClickable ? `Espandi trend mensile per ${displayName}` : undefined}
              tabIndex={isClickable ? 0 : undefined}
              onKeyDown={isClickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleBarClick(serviceKey); } } : undefined}
            >
              {/* Label row — sempre sopra la barra */}
              <div className="flex items-center justify-between mb-1">
                <span className="flex items-center gap-2 text-sm font-medium text-slate-800 truncate min-w-0">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: service.serviceColor }}
                    aria-hidden="true"
                  />
                  {displayName}
                </span>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span className="text-sm font-semibold text-slate-700">
                    {formatCurrency(service.totalGross)}
                  </span>
                  {/* Chevron — solo Pro con anno selezionato, nascosto su mobile */}
                  {isClickable && !isMobile && (
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-slate-500 transition-transform duration-200",
                        isExpanded && "rotate-180",
                        "group-hover:text-slate-700"
                      )}
                      aria-hidden="true"
                    />
                  )}
                </div>
              </div>

              {/* Barra gradiente sottile */}
              <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full",
                    isClickable && "group-hover:brightness-[1.05]"
                  )}
                  style={{
                    width: `${animated ? Math.max(barWidthPct, 2) : 0}%`,
                    background: `linear-gradient(to right, ${from}, ${to})`,
                    transition: "width 500ms ease-out, filter 200ms ease",
                    transitionDelay: `${i * 100}ms`,
                  }}
                  data-testid={`bar-${i}`}
                />
              </div>

              {/* Riga secondaria */}
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-sm font-medium text-slate-600">
                  {service.percentage.toFixed(1)}%
                </span>
                <span className={cn("text-sm", isNullService ? "text-slate-600" : "text-slate-500")}>
                  · {service.receiptCount} {service.receiptCount === 1 ? "incasso" : "incassi"} · ultimo {formatDateIT(service.lastReceiptDate)}
                </span>
              </div>
            </div>

            {/* Espansione trend mensile */}
            <div
              className="grid transition-[grid-template-rows] duration-300 ease-out"
              style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
            >
              <div className="overflow-hidden">
                {isExpanded && selectedPeriod !== null && (
                  <div
                    className="px-5 py-4 bg-slate-50/30 border-t border-slate-100 mt-1 rounded-b-2xl"
                    data-testid={`trend-expansion-${service.serviceId ?? NULL_SERVICE_KEY}`}
                  >
                    <ServiceMonthlyTrendChart
                      serviceId={service.serviceId}
                      serviceName={displayName}
                      fiscalYear={selectedPeriod}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Free tier overlay */}
      {!hasFullAccess && sorted.length > FREE_VISIBLE && (
        <div className="mt-2">
          <UpgradeCTA feature="Sblocca tutti i servizi nel ranking" variant="inline" />
        </div>
      )}

      {/* Mostra tutti */}
      {hasMore && (
        <button
          onClick={() => setShowAll(true)}
          className="text-sm font-medium text-blue-700 hover:text-blue-800 mt-2"
        >
          Mostra tutti ({sorted.length})
        </button>
      )}
    </div>
  );
}
