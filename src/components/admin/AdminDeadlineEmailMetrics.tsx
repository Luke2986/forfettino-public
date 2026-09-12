/**
 * AdminDeadlineEmailMetrics — dashboard admin metriche email scadenza (Story 84.9).
 *
 * Pattern: AdminMarkPaidNsmCard (Card/CardContent + Skeleton + isError) + AdminActivityChart
 * (recharts via ui/chart) + AdminEmailLog (tabella drill-down + export CSV).
 *
 * §Onestà delle sorgenti (AC#6) — TRE nature etichettate, mai un numero fuorviante come fatto:
 *  - RECAPITO (delivered/bounced/complained, da email_events) — completo, non consent-gated.
 *  - CLICK (da PostHog, EF) — reale ma CONSENT-GATED → metrica primaria engagement.
 *  - APERTURA opened (da email_events) — predisposta/dormiente (~0), disclaimer Apple MPP.
 */
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, Download, Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { buildCsv, downloadCsv } from "@/lib/csv";
import {
  useDeadlineEmailMetrics,
  type EmailMetricsWindow,
  type EmailRecipientRow,
} from "@/hooks/useDeadlineEmailMetrics";

const RECIPIENT_LIMIT = 500;
const RECIPIENTS_PAGE_SIZE = 10;

const WINDOW_OPTIONS: { key: EmailMetricsWindow; label: string }[] = [
  { key: "7d", label: "7g" },
  { key: "30d", label: "30g" },
  { key: "90d", label: "90g" },
  { key: "all", label: "Tutto" },
];

const EVENT_FILTER_OPTIONS: { key: string | null; label: string }[] = [
  { key: null, label: "Tutti" },
  { key: "email.delivered", label: "Recapitate" },
  { key: "email.bounced", label: "Bounce" },
  { key: "email.complained", label: "Reclami" },
  { key: "email.sent", label: "Inviate" },
];

function formatInt(n: number | undefined | null): string {
  if (n == null) return "—";
  return n.toLocaleString("it-IT");
}

function formatRate(rate: number | null | undefined): string {
  if (rate == null) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

function formatDateTime(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Tile KPI: valore (text-xl, design system) + label leggibile. */
function KpiTile({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white px-4 py-3">
      <p className="text-sm text-slate-600">{label}</p>
      <p className={cn("text-xl font-bold tabular-nums text-slate-900", valueClass)}>
        {value}
      </p>
    </div>
  );
}

/** Barra orizzontale label + count + % (riuso stile StatBar di AdminMarkPaidNsmCard). */
function StatBar({
  label,
  count,
  total,
  colorClass,
}: {
  label: string;
  count: number;
  total: number;
  colorClass: string;
}) {
  const percent = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium text-slate-700 truncate">{label}</span>
        <span className="tabular-nums shrink-0 text-slate-600">
          <span className="font-semibold text-slate-900">{count}</span>
          <span className="ml-2 text-xs text-muted-foreground">
            {percent.toFixed(1)}%
          </span>
        </span>
      </div>
      <div
        className="h-2 w-full rounded-full bg-slate-100 overflow-hidden"
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${Math.round(percent)} percento`}
      >
        <div
          className={cn("h-full rounded-full transition-all", colorClass)}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function Segmented<T extends string | null>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <Button
          key={String(o.key)}
          variant={value === o.key ? "default" : "outline"}
          size="sm"
          className="h-7 px-2.5 text-xs"
          onClick={() => onChange(o.key)}
          aria-pressed={value === o.key}
        >
          {o.label}
        </Button>
      ))}
    </div>
  );
}

const TREND_CONFIG: ChartConfig = {
  sent: { label: "Inviate", color: "hsl(160 84% 39%)" },
  delivered: { label: "Recapitate", color: "hsl(217 91% 60%)" },
  bounced: { label: "Bounce", color: "hsl(38 92% 50%)" },
};

export function AdminDeadlineEmailMetrics() {
  const [window, setWindow] = useState<EmailMetricsWindow>("30d");
  const [eventFilter, setEventFilter] = useState<string | null>(null);
  const [recipientsPage, setRecipientsPage] = useState(1);

  const {
    stats,
    statsLoading,
    statsError,
    trend,
    trendError,
    recipients,
    recipientsLoading,
    recipientsError,
    clicks,
    clicksLoading,
    clicksError,
  } = useDeadlineEmailMetrics({
    window,
    eventType: eventFilter,
    recipientLimit: RECIPIENT_LIMIT,
  });

  const recipientsTotalPages = Math.max(
    1,
    Math.ceil(recipients.length / RECIPIENTS_PAGE_SIZE),
  );
  const pagedRecipients = useMemo(
    () =>
      recipients.slice(
        (recipientsPage - 1) * RECIPIENTS_PAGE_SIZE,
        recipientsPage * RECIPIENTS_PAGE_SIZE,
      ),
    [recipients, recipientsPage],
  );

  // Cambio finestra/filtro rigenera il dataset → torna alla prima pagina.
  function handleWindowChange(w: EmailMetricsWindow) {
    setWindow(w);
    setRecipientsPage(1);
  }
  function handleEventFilterChange(f: string | null) {
    setEventFilter(f);
    setRecipientsPage(1);
  }

  const Header = (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <Mail className="h-5 w-5 text-teal-600" aria-hidden="true" />
        <h2 className="text-lg font-semibold">Email Scadenze · Metriche</h2>
      </div>
      <Segmented<EmailMetricsWindow>
        options={WINDOW_OPTIONS}
        value={window}
        onChange={handleWindowChange}
        ariaLabel="Finestra temporale"
      />
    </div>
  );

  const thresholdRows = useMemo(() => {
    if (!stats?.by_threshold) return [];
    return Object.entries(stats.by_threshold)
      .map(([threshold, c]) => ({ threshold, ...c }))
      .sort((a, b) => a.threshold.localeCompare(b.threshold));
  }, [stats]);

  const chartData = useMemo(
    () =>
      trend.map((p) => ({
        label: formatDayLabel(p.day),
        sent: p.sent,
        delivered: p.delivered,
        bounced: p.bounced,
      })),
    [trend],
  );
  const trendHasData = chartData.some((d) => d.sent + d.delivered + d.bounced > 0);

  function handleExportCsv() {
    const header = ["Data", "Email", "Tipo evento", "Soglia", "URL cliccato"];
    const rows = recipients.map((r: EmailRecipientRow) => [
      formatDateTime(r.occurred_at),
      r.recipient_email ?? "",
      r.event_type,
      r.threshold ?? "",
      r.clicked_url ?? "",
    ]);
    downloadCsv(
      `email-scadenze-${window}-${new Date().toISOString().slice(0, 10)}.csv`,
      buildCsv(header, rows),
    );
  }

  // ── Loading / error globali (KPI recapito = cuore della card) ──────────
  if (statsLoading) {
    return (
      <Card>
        <CardContent
          className="p-6 space-y-4"
          role="status"
          aria-busy="true"
          aria-label="Caricamento metriche email scadenze"
        >
          {Header}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
          <Skeleton className="h-4 w-72" />
        </CardContent>
      </Card>
    );
  }

  if (statsError || !stats) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="mb-2">{Header}</div>
          <p className="text-sm text-destructive">
            Impossibile caricare le metriche email. Riprova fra qualche minuto.
          </p>
        </CardContent>
      </Card>
    );
  }

  const isEmpty = stats.total === 0;

  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        {Header}

        {isEmpty ? (
          <p className="text-sm text-muted-foreground" data-testid="email-metrics-empty">
            Nessun evento email nella finestra selezionata.
          </p>
        ) : (
          <>
            {/* ── RECAPITO (segnali SMTP completi, non consent-gated) ── */}
            <section className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Recapito · segnali SMTP completi
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <KpiTile label="Inviate" value={formatInt(stats.sent)} />
                <KpiTile
                  label="Recapitate"
                  value={formatInt(stats.delivered)}
                  valueClass="text-blue-700"
                />
                <KpiTile
                  label="Bounce"
                  value={formatInt(stats.bounced)}
                  valueClass="text-amber-700"
                />
                <KpiTile
                  label="Reclami"
                  value={formatInt(stats.complained)}
                  valueClass="text-red-600"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                "Inviate" = eventi <code className="text-sm">email.sent</code> da email_events
                (per soglia) — distinto dal conteggio dello storico per-batch (email_log), che non
                ha la dimensione soglia.
              </p>
            </section>

            {/* ── ENGAGEMENT — click reale (PostHog) + opened predisposto ── */}
            <section className="space-y-3 pt-2 border-t border-slate-100">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider pt-2">
                Engagement
              </p>

              {/* Click reale (metrica primaria) */}
              <div
                className="rounded-xl border border-slate-100 bg-white px-4 py-3"
                data-testid="click-block"
              >
                {clicksLoading ? (
                  <Skeleton className="h-12 w-40" />
                ) : clicksError || !clicks ? (
                  <p className="text-sm text-amber-700" data-testid="click-error">
                    Tasso click non disponibile (PostHog non raggiungibile). Le metriche di
                    recapito qui sopra restano valide.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-baseline gap-3">
                      <span className="text-xl font-bold tabular-nums text-violet-700">
                        {formatRate(clicks.click_rate)}
                      </span>
                      <span className="text-sm text-slate-600">
                        tasso click ({formatInt(clicks.clicks)} click /{" "}
                        {formatInt(clicks.sends)} inviate)
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Fonte: click via PostHog · utenti con consenso analytics (sotto-conta chi
                      non ha dato il consenso — 84-6).
                    </p>
                    {clicks.by_threshold.length > 0 && (
                      <div className="space-y-2 pt-1">
                        {clicks.by_threshold.map((t) => (
                          <StatBar
                            key={t.threshold}
                            label={`Soglia ${t.threshold === "na" ? "—" : `${t.threshold}g`}`}
                            count={t.clicks}
                            total={t.sends}
                            colorClass="bg-violet-500"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Apertura predisposta (disclaimer MPP) */}
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-baseline gap-3">
                  <span className="text-xl font-bold tabular-nums text-slate-500">
                    {formatInt(stats.opened)}
                  </span>
                  <span className="text-sm text-slate-600">aperture (predisposto)</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Tracking apertura Resend OFF al lancio (84-1) → ~0. Inoltre Apple Mail Privacy
                  Protection gonfia gli open del +15-40% (falsi): non è una verità, è predisposto.
                </p>
              </div>
            </section>

            {/* ── BREAKDOWN PER SOGLIA (recapito) ── */}
            {thresholdRows.length > 0 && (
              <section className="space-y-2 pt-2 border-t border-slate-100">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider pt-2">
                  Recapito per soglia (giorni alla scadenza)
                </p>
                {thresholdRows.map((t) => (
                  <div key={t.threshold} className="space-y-1">
                    <StatBar
                      label={`Soglia ${t.threshold === "na" ? "—" : `${t.threshold}g`} · recapitate`}
                      count={t.delivered}
                      total={t.total}
                      colorClass="bg-blue-500"
                    />
                    {(t.bounced > 0 || t.complained > 0) && (
                      <p className="text-sm text-muted-foreground pl-1">
                        {t.bounced} bounce · {t.complained} reclami su {t.total} eventi
                      </p>
                    )}
                  </div>
                ))}
              </section>
            )}

            {/* ── TREND giornaliero recapito ── */}
            <section className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2 pt-2">
                <BarChart3 className="h-4 w-4 text-slate-500" aria-hidden="true" />
                <p className="text-sm font-semibold text-slate-700">Trend recapito</p>
              </div>
              {trendError ? (
                <p className="text-sm text-amber-700">Trend non disponibile.</p>
              ) : !trendHasData ? (
                <p className="text-sm text-muted-foreground">
                  Nessun dato nella finestra selezionata.
                </p>
              ) : (
                <div role="img" aria-label="Trend giornaliero recapito email">
                  <ChartContainer config={TREND_CONFIG} className="h-[200px] w-full">
                    <LineChart data={chartData} accessibilityLayer>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
                      <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line dataKey="sent" stroke="var(--color-sent)" strokeWidth={2} dot={false} />
                      <Line
                        dataKey="delivered"
                        stroke="var(--color-delivered)"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        dataKey="bounced"
                        stroke="var(--color-bounced)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ChartContainer>
                </div>
              )}
            </section>

            {/* ── DRILL-DOWN per-utente + export CSV ── */}
            <section className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between gap-3 flex-wrap pt-2">
                <p className="text-sm font-semibold text-slate-700">Destinatari (drill-down)</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <Segmented
                    options={EVENT_FILTER_OPTIONS}
                    value={eventFilter}
                    onChange={handleEventFilterChange}
                    ariaLabel="Filtro tipo evento"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportCsv}
                    disabled={recipients.length === 0}
                    data-testid="export-recipients-csv"
                  >
                    <Download className="h-3.5 w-3.5 mr-1" />
                    CSV
                  </Button>
                </div>
              </div>

              {recipients.length === RECIPIENT_LIMIT && (
                <p className="text-sm text-amber-700" data-testid="recipients-truncated">
                  Mostrate le prime {RECIPIENT_LIMIT} righe (possibile troncamento): restringi la
                  finestra o il filtro per vedere il resto.
                </p>
              )}

              {recipientsLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : recipientsError ? (
                <p className="text-sm text-destructive">Impossibile caricare i destinatari.</p>
              ) : recipients.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nessun destinatario per il filtro selezionato.
                </p>
              ) : (
                <>
                  <div className="border rounded-lg overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Evento</TableHead>
                          <TableHead>Soglia</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pagedRecipients.map((r, i) => (
                          <TableRow
                            key={`${r.user_id ?? "na"}-${r.occurred_at}-${
                              (recipientsPage - 1) * RECIPIENTS_PAGE_SIZE + i
                            }`}
                          >
                            <TableCell className="text-sm whitespace-nowrap">
                              {formatDateTime(r.occurred_at)}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {r.recipient_email ?? "—"}
                            </TableCell>
                            <TableCell className="text-sm">{r.event_type}</TableCell>
                            <TableCell className="text-sm">
                              {r.threshold ? `${r.threshold}g` : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Paginazione a blocchi di 10 (come AdminEmailLog) */}
                  {recipientsTotalPages > 1 && (
                    <div className="flex items-center justify-between pt-4">
                      <p className="text-sm text-slate-500">
                        Pagina {recipientsPage} di {recipientsTotalPages} (
                        {recipients.length} eventi totali)
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setRecipientsPage((p) => p - 1)}
                          disabled={recipientsPage === 1}
                        >
                          Precedente
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setRecipientsPage((p) => p + 1)}
                          disabled={recipientsPage === recipientsTotalPages}
                        >
                          Successiva
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Etichetta breve giorno (YYYY-MM-DD → DD/MM) per l'asse X del trend. */
function formatDayLabel(day: string): string {
  // `day` è una data locale "YYYY-MM-DD" già in Europe/Rome (lato SQL) → split diretto, NO new Date.
  const parts = day.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
  return day;
}
