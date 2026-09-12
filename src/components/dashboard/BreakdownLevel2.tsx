import { Info, CheckCircle2 } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DisclaimerBanner } from "@/components/shared/DisclaimerBanner";
import { bucketToLabel } from "@/lib/schedule-helpers";
import { sanitizeMoney, subtractMoney, sumMoney } from "@/lib/money";
import type { GestioneINPS } from "@/lib/fiscal-engine";
import type { FiscalMetrics } from "@/hooks/useFiscalCalculations";
import { formatCurrency } from "@/hooks/useFiscalCalculations";

// ── Spiegazioni termini tecnici ──

const TERM_EXPLANATIONS: Record<string, string> = {
  coefficienteRedditivita:
    "Percentuale fissa basata sul tuo codice ATECO. Determina quale parte dei ricavi è considerata reddito.",
  aliquotaINPS:
    "Percentuale applicata al reddito imponibile per calcolare i contributi previdenziali INPS.",
  // Story 40-2: dati granulari ora disponibili in FiscalMetrics
  // (impostaConDeducibilita, inpsMinimale, inpsVariabile, inpsTotale)
};

// ── Helper: riga info con Popover ──

function InfoPopover({ termKey }: { termKey: string }) {
  const explanation = TERM_EXPLANATIONS[termKey];
  if (!explanation) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Informazioni"
        >
          <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-64 text-xs text-muted-foreground">
        <p>{explanation}</p>
      </PopoverContent>
    </Popover>
  );
}

// ── Helper: riga formula ──

interface FormulaRowProps {
  operator?: string; // "×", "−", "="
  label: string;
  value?: string;
  infoKey?: string;
  isBold?: boolean;
  isResult?: boolean;
  note?: string;
  indent?: boolean;
}

function FormulaRow({
  operator,
  label,
  value,
  infoKey,
  isBold = false,
  isResult = false,
  note,
  indent = false,
}: FormulaRowProps) {
  return (
    <>
      <div
        className={cn(
          "flex justify-between items-center",
          indent ? "pl-4 text-xs" : "text-sm",
          isResult && "pt-1",
        )}
      >
        <dt
          className={cn(
            "flex items-center gap-1",
            isBold ? "font-bold" : isResult ? "font-medium" : "text-muted-foreground",
          )}
        >
          {operator && (
            <span className="text-muted-foreground text-xs w-3 inline-block">{operator}</span>
          )}
          {!operator && <span className="w-3 inline-block" />}
          {label}
          {infoKey && <InfoPopover termKey={infoKey} />}
        </dt>
        {value !== undefined && (
          <dd className={cn("tabular-nums", isBold ? "font-bold" : isResult ? "font-medium" : "")}>
            {value}
          </dd>
        )}
      </div>
      {note && (
        <div className="pl-7 text-xs text-muted-foreground italic">{note}</div>
      )}
    </>
  );
}

// ── Sezione INPS ──

function InpsSectionSeparata({ metrics }: { metrics: FiscalMetrics }) {
  return (
    <div className="space-y-1.5">
      <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        INPS
      </h5>
      <dl className="space-y-1">
        <FormulaRow
          label="Reddito imponibile"
          value={formatCurrency(metrics.taxableAmount)}
        />
        <FormulaRow
          operator="×"
          label={`Aliquota INPS (${metrics.settings.inpsRate}%)`}
          infoKey="aliquotaINPS"
        />
        <FormulaRow
          operator="="
          label="Contributi INPS"
          value={formatCurrency(metrics.inpsTotale)}
          isResult
        />
      </dl>
    </div>
  );
}

function InpsSectionArtComm({ metrics }: { metrics: FiscalMetrics }) {
  const gestioneLabel =
    metrics.inpsManagement === "artigiani" ? "Artigiani" : "Commercianti";

  return (
    <div className="space-y-1.5">
      <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        INPS {gestioneLabel}
      </h5>
      <dl className="space-y-1">
        <FormulaRow
          label="Minimale fisso annuo"
          value={formatCurrency(metrics.inpsMinimale)}
          note="Rate trimestrali obbligatorie (nello Scadenziario)"
        />
        <FormulaRow
          operator="+"
          label="Variabile su eccedenza"
          value={formatCurrency(metrics.inpsVariabile)}
          note={metrics.inpsVariabile === 0 ? "Reddito sotto soglia minimale" : undefined}
        />
        <FormulaRow
          operator="="
          label={`Totale INPS ${gestioneLabel}`}
          value={formatCurrency(metrics.inpsTotale)}
          isBold
        />
      </dl>
    </div>
  );
}

// ── Sezione Tasse ──

function TasseSection({ metrics }: { metrics: FiscalMetrics }) {
  // Fix F1: deducibilità INPS applicata a TUTTE le gestioni (Separata inclusa).
  return (
    <div className="space-y-1.5">
      <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Tasse
      </h5>
      <dl className="space-y-1">
        <FormulaRow
          label="Ricavi lordi"
          value={formatCurrency(metrics.incassiYTD)}
        />
        <FormulaRow
          operator="×"
          label={`Coefficiente (${metrics.settings.profitCoeff}%)`}
          infoKey="coefficienteRedditivita"
        />
        <FormulaRow
          operator="="
          label="Reddito imponibile"
          value={formatCurrency(metrics.taxableAmount)}
          isResult
        />
        <FormulaRow
          operator="−"
          label="INPS deducibile"
          value={`−${formatCurrency(metrics.inpsTotale)}`}
        />
        <FormulaRow
          operator="="
          label="Base imponibile netta"
          value={formatCurrency(Math.max(0, metrics.taxableAmount - metrics.inpsTotale))}
          isResult
        />
        <FormulaRow
          operator="×"
          label={`Aliquota sostitutiva (${metrics.settings.taxRate}%)`}
        />
        <FormulaRow
          operator="="
          label="Imposta sostitutiva"
          value={formatCurrency(metrics.impostaConDeducibilita)}
          isBold
        />
      </dl>
    </div>
  );
}

// ── Sezione Obbligazioni Anno Corrente (Story 3.7 — AC5) ──

function ObligationsSection({ metrics }: { metrics: FiscalMetrics }) {
  const { currentYearObligations, currentYearSchedules } = metrics;
  const paymentYear = currentYearObligations.paymentYear;
  const { creditoImposta, creditoInps } = currentYearObligations;

  // Story 3.7 fix — Righe e "Totale non pagato" derivano dalla STESSA fonte:
  // le schedule reali in DB (le stesse sommate da computeUnpaidCurrentYearTotal e
  // usate dallo "Spendibile oggi"). In passato le righe erano ricalcolate da
  // currentYearObligations mentre il totale sommava le schedule DB → il dettaglio
  // non quadrava col proprio totale (gap arbitrario visibile all'utente).
  const BUCKET_ORDER = [
    "saldo_tax",
    "saldo_inps",
    "acconto_tax_1",
    "acconto_tax_2",
    "acconto_inps_1",
    "acconto_inps_2",
    "inps_q1",
    "inps_q2",
    "inps_q3",
    "inps_q4",
    "june",
    "november",
  ];
  const orderIdx = (bucket: string) => {
    const i = BUCKET_ORDER.indexOf(bucket);
    return i === -1 ? BUCKET_ORDER.length : i;
  };
  const labelFor = (bucket: string, dueDate?: string | null) => {
    switch (bucket) {
      case "saldo_tax":
        return `Saldo Imposte ${paymentYear - 1}`;
      case "saldo_inps":
        return `Saldo INPS ${paymentYear - 1}`;
      case "acconto_tax_1":
        return `I° Acconto Imposta ${paymentYear}`;
      case "acconto_tax_2":
        return `II° Acconto Imposta ${paymentYear}`;
      case "acconto_inps_1":
        return `I° Acconto INPS ${paymentYear}`;
      case "acconto_inps_2":
        return `II° Acconto INPS ${paymentYear}`;
      default:
        return bucketToLabel(bucket, dueDate);
    }
  };

  type ObRow = {
    label: string;
    remaining: number;
    isPaid: boolean;
    isDeduction?: boolean;
  };

  const scheduleRows: ObRow[] = [...currentYearSchedules]
    .filter((s) => sanitizeMoney(s.total_expected) > 0)
    .sort((a, b) => orderIdx(a.bucket) - orderIdx(b.bucket))
    .map((s) => {
      const expected = sanitizeMoney(s.total_expected);
      const paid = sanitizeMoney(s.total_paid);
      return {
        label: labelFor(s.bucket, s.due_date),
        remaining: Math.max(0, subtractMoney(expected, paid)),
        isPaid: s.status === "paid",
      };
    });

  // Riconciliazione: il "Totale non pagato" mostrato è metrics.unpaidCurrentYearTotal
  // (la stessa fonte usata dallo "Spendibile oggi"). Quando è < della somma delle
  // righe non pagate, la differenza sono acconti già versati dall'utente (settings,
  // Story 11.1) che computeUnpaidCurrentYearTotal sottrae dal totale. La esponiamo
  // come UNA riga di detrazione, così le righe quadrano SEMPRE col totale per
  // costruzione (elimina il gap arbitrario righe↔totale segnalato dagli utenti).
  const scheduleUnpaidSum = scheduleRows
    .filter((r) => !r.isPaid)
    .reduce((sum, r) => sumMoney(sum, r.remaining), 0);
  const accontiDeduction = Math.max(
    0,
    subtractMoney(scheduleUnpaidSum, metrics.unpaidCurrentYearTotal),
  );

  const rows: ObRow[] = [...scheduleRows];
  if (accontiDeduction > 0) {
    rows.push({
      label: "Acconti già versati",
      remaining: accontiDeduction,
      isPaid: false,
      isDeduction: true,
    });
  }

  if (rows.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Obbligazioni {paymentYear}
      </h5>

      {/* Story 11.1 — credito quando gli acconti versati superano il dovuto */}
      {(creditoImposta > 0 || creditoInps > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {creditoImposta > 0 && (
            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
              Credito imposta: {formatCurrency(creditoImposta)}
            </Badge>
          )}
          {creditoInps > 0 && (
            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
              Credito INPS: {formatCurrency(creditoInps)}
            </Badge>
          )}
        </div>
      )}

      <dl className="space-y-1">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between items-center text-sm">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              {row.isPaid && (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              )}
              {row.isDeduction ? `− ${row.label}` : row.label}
            </dt>
            <dd className="flex items-center gap-2">
              {row.isPaid ? (
                <span className="text-emerald-600 dark:text-emerald-500 font-medium">
                  Pagato
                </span>
              ) : (
                <span
                  className={cn(
                    "font-medium tabular-nums",
                    row.isDeduction && "text-muted-foreground",
                  )}
                >
                  {row.isDeduction
                    ? `−${formatCurrency(row.remaining)}`
                    : formatCurrency(row.remaining)}
                </span>
              )}
            </dd>
          </div>
        ))}
        <div className="flex justify-between items-center font-medium text-sm pt-2 border-t border-border/50">
          <dt>Totale non pagato</dt>
          <dd className="text-amber-600 dark:text-amber-500 tabular-nums">
            {formatCurrency(metrics.unpaidCurrentYearTotal)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

// ── Componente principale ──

export interface BreakdownLevel2Props {
  gestione: GestioneINPS;
  metrics: FiscalMetrics;
  className?: string;
}

export function BreakdownLevel2({ gestione, metrics, className }: BreakdownLevel2Props) {
  const showObligations = metrics.currentYearObligations.hasData;

  return (
    <div className={cn("space-y-4 pt-3", className)}>
      {/* Disclaimer — in cima per visibilità anche se le sezioni sotto crashano */}
      <DisclaimerBanner />

      {/* Sezione INPS — prima, perché i contributi servono per capire la deducibilità */}
      {gestione === "separata" ? (
        <InpsSectionSeparata metrics={metrics} />
      ) : (
        <InpsSectionArtComm metrics={metrics} />
      )}

      <Separator />

      {/* Sezione Tasse */}
      <TasseSection metrics={metrics} />

      {/* Sezione Obbligazioni Anno Corrente (Story 3.7) */}
      {showObligations && (
        <>
          <Separator />
          <ObligationsSection metrics={metrics} />
        </>
      )}
    </div>
  );
}
