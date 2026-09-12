import { AlertCircle, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { formatCurrency } from "@/hooks/useFiscalCalculations";
import { cn } from "@/lib/utils";

// ── Calibro 85k: inline gauge for "Entrate Lorde" card (v2 design) ──

interface Calibro85kProps {
  /** 0-to-1 progress toward the threshold */
  progress: number;
  /** Euros remaining before exceeding the threshold */
  remaining: number;
}

/**
 * Minimal, monocromo threshold gauge following Jony Ive principles.
 * - Thin line (2px, grows to 3px near limit)
 * - Positive framing: "Margine: €X" (how much you CAN still invoice)
 * - Font weight increases when margin < €10.000
 */
export function Calibro85k({ progress, remaining }: Calibro85kProps) {
  const percent = Math.round(progress * 100);
  const isLowMargin = remaining < 10000;
  const isExceeded = remaining <= 0;

  return (
    <div className="mt-3 space-y-1.5">
      {/* Gauge line — 4px, teal fill */}
      <div
        className="w-full rounded-full bg-v2-border"
        style={{ height: "4px" }}
        role="progressbar"
        aria-valuenow={Math.min(percent, 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Soglia forfettario: ${percent}% utilizzato`}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            isExceeded ? "bg-v2-accent-warm" : "bg-v2-accent-primary",
          )}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      {/* Positive framing with percentage */}
      <p className={cn(
        "text-xs",
        isLowMargin ? "text-v2-text-primary font-medium" : "text-v2-text-tertiary",
      )}>
        {isExceeded
          ? "Limite superato"
          : `Margine: ${formatCurrency(remaining)} · ${100 - percent}%`
        }
      </p>
    </div>
  );
}

// ── SogliaInline: single-row compact banner ──

interface SogliaInlineProps {
  incassiTotali: number;
  sogliaLimite?: number;
}

/** Thin single-row banner: title + percentage left, slim progress bar right */
export function SogliaInline({ incassiTotali, sogliaLimite = 85000 }: SogliaInlineProps) {
  const percentuale = Math.min((incassiTotali / sogliaLimite) * 100, 100);
  const rimanenti = Math.max(sogliaLimite - incassiTotali, 0);
  const superato = incassiTotali > sogliaLimite;

  const barColor = superato
    ? "bg-destructive"
    : percentuale >= 85
      ? "bg-destructive"
      : percentuale >= 70
        ? "bg-warning"
        : "bg-success";

  return (
    <div className="flex items-center justify-between py-2.5 px-4 bg-slate-50 border border-slate-200 squircle-md">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-xs font-medium text-slate-700 whitespace-nowrap">Soglia 85k</span>
        <span className="text-xs font-semibold text-slate-800 tabular-nums">{percentuale.toFixed(0)}%</span>
        {!superato && (
          <span className="text-xs text-slate-500 hidden sm:inline">
            Rimangono {formatCurrency(rimanenti)}
          </span>
        )}
        {superato && (
          <span className="text-xs text-destructive font-medium">Superato</span>
        )}
      </div>
      <div
        className="h-1.5 w-[200px] max-w-[200px] rounded-full bg-slate-200 shrink-0 ml-4"
        role="progressbar"
        aria-valuenow={Math.round(percentuale)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Soglia 85k: ${Math.round(percentuale)}% utilizzato`}
      >
        <div
          className={cn("h-full rounded-full transition-all duration-500", barColor)}
          style={{ width: `${Math.min(percentuale, 100)}%` }}
        />
      </div>
    </div>
  );
}

interface SogliaForfettarioBannerProps {
  incassiTotali: number;
  sogliaLimite?: number;
}

export function SogliaForfettarioBanner({
  incassiTotali,
  sogliaLimite = 85000
}: SogliaForfettarioBannerProps) {
  const percentuale = Math.min((incassiTotali / sogliaLimite) * 100, 100);
  const rimanenti = Math.max(sogliaLimite - incassiTotali, 0);
  const superato = incassiTotali > sogliaLimite;

  const getStato = () => {
    if (superato) {
      return {
        colore: "bg-destructive-muted border-destructive-muted",
        barraColore: "bg-destructive",
        iconaColore: "text-destructive",
        icona: XCircle,
        messaggio: "Hai superato il limite - uscirai dal regime forfettario",
        tono: "text-destructive"
      };
    }
    if (percentuale >= 85) {
      return {
        colore: "bg-destructive-muted border-destructive-muted",
        barraColore: "bg-destructive",
        iconaColore: "text-destructive",
        icona: AlertCircle,
        messaggio: "Quasi al limite! Valuta con attenzione i prossimi incassi",
        tono: "text-destructive"
      };
    }
    if (percentuale >= 70) {
      return {
        colore: "bg-warning-muted border-warning-muted",
        barraColore: "bg-warning",
        iconaColore: "text-warning",
        icona: AlertTriangle,
        messaggio: "Ti stai avvicinando al limite forfettario",
        tono: "text-warning"
      };
    }
    return {
      colore: "bg-success-muted border-success-muted",
      barraColore: "bg-success",
      iconaColore: "text-success",
      icona: CheckCircle,
      messaggio: "Sei tranquillo, ampio margine disponibile",
      tono: "text-success"
    };
  };

  const stato = getStato();
  const Icona = stato.icona;

  return (
    <div className={`rounded-2xl border p-6 ${stato.colore}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icona className={`h-5 w-5 ${stato.iconaColore}`} />
          <span className="font-medium text-foreground">Soglia Forfettario</span>
        </div>
        <span className="text-sm font-semibold text-foreground">
          {percentuale.toFixed(0)}%
        </span>
      </div>

      <div
        className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-4"
        role="progressbar"
        aria-valuenow={Math.round(percentuale)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Soglia forfettario: ${Math.round(percentuale)}% utilizzato su ${formatCurrency(sogliaLimite)}`}
      >
        <div
          className={`h-2.5 rounded-full transition-all duration-500 ${stato.barraColore}`}
          style={{ width: `${Math.min(percentuale, 100)}%` }}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-muted-foreground tabular-nums">
            {formatCurrency(incassiTotali)} di {formatCurrency(sogliaLimite)}
          </span>

          {!superato ? (
            <>
              <span className="font-medium text-foreground tabular-nums">
                Rimangono {formatCurrency(rimanenti)}
              </span>
              <span className={`text-xs ${stato.tono}`}>· {stato.messaggio}</span>
            </>
          ) : (
            <span className={`text-xs ${stato.tono}`}>· {stato.messaggio}</span>
          )}
        </div>
      </div>
    </div>
  );
}
