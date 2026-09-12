/**
 * Ranked Bar Chart con barre pill-shaped e gradiente teal degradante.
 * Div HTML puri — nessuna libreria di charting.
 * Stories: 58.2 (base), 58.4 (trend), 59.1 (bugfix), 59.2 (hero), 59.3 (chevron/hover/tipografia).
 */

import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/money";
import { formatDateIT } from "@/lib/schedule-helpers";
import { useIsMobile } from "@/hooks/use-mobile";
import { UpgradeCTA } from "@/components/subscription/UpgradeCTA";
import { ClientMonthlyTrendChart } from "./ClientMonthlyTrendChart";
import { cn } from "@/lib/utils";
import { capitalizeFirst } from "@/lib/string-utils";
import { ChevronDown } from "lucide-react";
import type { ClientRevenue } from "@/lib/client-analytics";

/* ── Palette gradiente teal degradante per posizione ranking ── */
const TEAL_GRADIENTS: [string, string][] = [
  ["#0d9488", "#2dd4bf"], // teal-600 → teal-400
  ["#14b8a6", "#5eead4"], // teal-500 → teal-300
  ["#2dd4bf", "#99f6e4"], // teal-400 → teal-200
  ["#5eead4", "#ccfbf1"], // teal-300 → teal-100
];
const SLATE_GRADIENT: [string, string] = ["#94a3b8", "#e2e8f0"]; // slate-400 → slate-200
const NULL_CLIENT_GRADIENT: [string, string] = ["#cbd5e1", "#f1f5f9"]; // slate-300 → slate-100

const DEFAULT_VISIBLE = 7;
const FREE_VISIBLE = 3;

interface ClientRankedBarsProps {
  data: ClientRevenue[];
  hasFullAccess: boolean;
  dormantClientIds: Set<string | null>;
  selectedPeriod: number | null;
}

function getGradient(index: number, isNullClient: boolean): [string, string] {
  if (isNullClient) return NULL_CLIENT_GRADIENT;
  if (index < TEAL_GRADIENTS.length) return TEAL_GRADIENTS[index];
  return SLATE_GRADIENT;
}

export function ClientRankedBars({
  data,
  hasFullAccess,
  dormantClientIds,
  selectedPeriod,
}: ClientRankedBarsProps) {
  const isMobile = useIsMobile();
  const [showAll, setShowAll] = useState(false);
  const [animated, setAnimated] = useState(false);
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);

  useEffect(() => {
    setAnimated(false);
    const raf = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(raf);
  }, [data]);

  // Reset espansione al cambio periodo (anno o Totale)
  useEffect(() => {
    setExpandedClientId(null);
  }, [selectedPeriod]);

  const canExpand = hasFullAccess && selectedPeriod !== null;

  const handleBarClick = (clientKey: string) => {
    if (!canExpand) return;
    setExpandedClientId((prev) => (prev === clientKey ? null : clientKey));
  };

  // Ordina: "Senza cliente" sempre per ultimo
  const sorted = [...data].sort((a, b) => {
    if (a.clientId === null) return 1;
    if (b.clientId === null) return -1;
    return b.totalGross - a.totalGross;
  });

  // sorted[0] = max tra client con ID, sorted[last] = null-client (forzato in fondo)
  // Math.max copre il caso edge dove null-client ha gross superiore al primo client reale
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
      {visibleBars.map((client, i) => {
        const isNullClient = client.clientId === null;
        const [from, to] = getGradient(i, isNullClient);
        const barWidthPct = maxGross > 0 ? (client.totalGross / maxGross) * 100 : 0;
        const isDormant = dormantClientIds.has(client.clientId);
        const isFreeBlurred = !hasFullAccess && i >= FREE_VISIBLE;

        const clientKey = client.clientId ?? "__null__";
        const isExpanded = expandedClientId === clientKey;
        const isClickable = canExpand && !isFreeBlurred;
        const displayName = isNullClient ? "Senza cliente" : capitalizeFirst(client.clientName);

        return (
          <div
            key={client.clientId ?? "__null__"}
            className={cn("relative", isFreeBlurred && "blur-[4px] select-none")}
            data-testid={`bar-row-${i}`}
          >
            {/* Clickable wrapper */}
            <div
              className={cn(
                "rounded-xl",
                isClickable && "cursor-pointer group outline-none focus-visible:ring-2 focus-visible:ring-teal-300 focus-visible:ring-offset-2"
              )}
              onClick={() => isClickable && handleBarClick(clientKey)}
              role={isClickable ? "button" : undefined}
              aria-expanded={isClickable ? isExpanded : undefined}
              aria-label={isClickable ? `Espandi trend mensile per ${displayName}` : undefined}
              tabIndex={isClickable ? 0 : undefined}
              onKeyDown={isClickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleBarClick(clientKey); } } : undefined}
            >
              {/* Label row — sempre sopra la barra */}
              <div className="flex items-center justify-between mb-1">
                <span className="flex items-center gap-2 text-sm font-medium text-slate-800 truncate min-w-0">
                  {displayName}
                  {isDormant && (
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 shrink-0">
                      Dormiente
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span className="text-sm font-semibold text-slate-700">
                    {formatCurrency(client.totalGross)}
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
                  {client.percentage.toFixed(1)}%
                </span>
                <span className="text-sm text-slate-500">
                  · {client.receiptCount} {client.receiptCount === 1 ? "incasso" : "incassi"} · ultimo {formatDateIT(client.lastReceiptDate)}
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
                    data-testid={`trend-expansion-${client.clientId ?? "__null__"}`}
                  >
                    <ClientMonthlyTrendChart
                      clientId={client.clientId}
                      clientName={displayName}
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
          <UpgradeCTA feature="Sblocca tutti i clienti nel ranking" variant="inline" />
        </div>
      )}

      {/* Mostra tutti */}
      {hasMore && (
        <button
          onClick={() => setShowAll(true)}
          className="text-sm font-medium text-teal-700 hover:text-teal-800 mt-2"
        >
          Mostra tutti ({sorted.length})
        </button>
      )}
    </div>
  );
}
