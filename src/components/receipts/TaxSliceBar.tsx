import { formatCurrency, sumMoney } from "@/lib/money";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";

export interface TaxSliceBarProps {
  grossAmount: number;
  taxAmount: number | null;
  inpsAmount: number | null;
  netSpendable: number | null;
  gestione?: "separata" | "artigiani" | "commercianti";
  compact?: boolean;
}

export function TaxSliceBar({
  grossAmount,
  taxAmount,
  inpsAmount,
  netSpendable,
  gestione,
  compact = false,
}: TaxSliceBarProps) {
  // Graceful fallback: don't render if fiscal fields are null
  if (taxAmount == null || inpsAmount == null || netSpendable == null) {
    return null;
  }

  // Don't render for zero gross
  if (grossAmount <= 0) {
    return null;
  }

  // Calculate segment percentages, clamped to [0, 100] for safety
  const clamp = (v: number) => Math.max(0, Math.min(100, v));

  const rawNetPercent = (netSpendable / grossAmount) * 100;
  const rawTaxPercent = (taxAmount / grossAmount) * 100;
  const rawInpsPercent = (inpsAmount / grossAmount) * 100;

  // Adjust for rounding: assign residual to net (largest segment)
  const totalPercent = rawNetPercent + rawTaxPercent + rawInpsPercent;
  const adjustedRawNet =
    totalPercent !== 100
      ? rawNetPercent + (100 - totalPercent)
      : rawNetPercent;

  const netPercent = clamp(adjustedRawNet);
  const taxPercent = clamp(rawTaxPercent);
  const inpsPercent = clamp(rawInpsPercent);

  const isArtComm = gestione === "artigiani" || gestione === "commercianti";

  const ariaLabel = `Ripartizione: ${Math.round(netPercent)}% spendibile, ${Math.round(taxPercent)}% imposta, ${Math.round(inpsPercent)}% INPS`;

  return (
    <div
      className={compact ? "w-full min-w-[120px]" : "w-full"}
      data-gestione={gestione || "none"}
      data-has-inps-note={isArtComm}
    >
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              {/* Segmented bar */}
              <div
                className="flex h-4 w-full rounded-full overflow-hidden"
                role="img"
                aria-label={ariaLabel}
              >
                <div
                  className="bg-success"
                  style={{ width: `${netPercent}%` }}
                />
                <div
                  className="bg-slate-600"
                  style={{ width: `${taxPercent}%` }}
                />
                <div
                  className="bg-slate-300"
                  style={{ width: `${inpsPercent}%` }}
                />
              </div>

              {/* Labels below bar (non-compact only) */}
              {!compact && (
                <div className="flex justify-between max-[375px]:flex-col max-[375px]:gap-0.5 text-xs text-muted-foreground mt-1">
                  <span className="text-success tabular-nums">
                    {formatCurrency(netSpendable)}
                  </span>
                  <span className="text-slate-500 tabular-nums">
                    {formatCurrency(sumMoney(taxAmount, inpsAmount))}
                  </span>
                </div>
              )}

              {/* Compact percentage labels for mobile touch */}
              {compact && (
                <div className="flex justify-between text-xs text-muted-foreground mt-0.5" data-testid="compact-labels">
                  <span className="text-success">{Math.round(netPercent)}%</span>
                  <span className="text-slate-600">{Math.round(taxPercent)}%</span>
                  <span className="text-slate-500">{Math.round(inpsPercent)}%</span>
                </div>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs" role="tooltip">
            <div className="space-y-1 text-sm">
              <p>
                <span className="inline-block w-3 h-3 rounded-sm bg-success mr-1 align-middle" />
                Verde = quello che puoi spendere
              </p>
              <p>
                <span className="inline-block w-3 h-3 rounded-sm bg-slate-600 mr-1 align-middle" />
                Grigio scuro = imposta sostitutiva
              </p>
              <p>
                <span className="inline-block w-3 h-3 rounded-sm bg-slate-300 mr-1 align-middle" />
                Grigio chiaro = INPS proporzionale
              </p>
              {isArtComm && (
                <p className="text-xs text-muted-foreground pt-1 border-t">
                  <Info className="inline h-3 w-3 mr-1 align-middle" />
                  I contributi INPS fissi (minimale trimestrale) sono indipendenti dal singolo incasso e non sono inclusi in questa barra.
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
