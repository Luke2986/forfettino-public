import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  BellRing,
  Send,
  Loader2,
  Eye,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { formatEuro } from "@/lib/deadline-notifications";
import {
  useDeadlineReminderTrigger,
  type DeadlineDryRunResult,
  type DeadlineRealRunResult,
} from "@/hooks/useDeadlineReminderTrigger";

/**
 * Story 84-4 — Pannello admin per il trigger manuale dell'email di promemoria scadenza.
 * Orchestra la EF `send-deadline-reminder-email` (84-3) con un flusso operativo sicuro:
 * dry-run preview OBBLIGATORIO → conferma esplicita → invio reale → batchId ispezionabile.
 *
 * Guardrail forzati nel codice (non affidati alla disciplina dell'operatore):
 * - "Invia reale" disabilitato finché un dry-run non ha restituito un risultato (AC#2).
 * - Guardrail anti-anomalia: recipients oltre ANOMALY_THRESHOLD → warning + conferma rinforzata (AC#7).
 * - Idempotenza 84-3 comunicata: un re-run identico risulta sent:0 (non è un errore).
 */

/** Oltre questo numero di destinatari per una singola scadenza, scatta il guardrail anomalia. */
const ANOMALY_THRESHOLD = 50;

/** Parse di una CSV di interi (thresholds). Filtra valori non interi. */
function parseThresholds(raw: string): number[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n));
}

/** Token CSV scartati perché non interi (per feedback all'admin — L3). */
function findInvalidThresholdTokens(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .filter((s) => !Number.isInteger(Number(s)));
}

/** Parse di una CSV di userId. Trim + drop vuoti. */
function parseUserIds(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function AdminDeadlineEmailTrigger() {
  const [thresholdsInput, setThresholdsInput] = useState("");
  const [userIdsInput, setUserIdsInput] = useState("");
  const [todayInput, setTodayInput] = useState("");

  const [dryRunResult, setDryRunResult] = useState<DeadlineDryRunResult | null>(null);
  const [realResult, setRealResult] = useState<DeadlineRealRunResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [anomalyAck, setAnomalyAck] = useState(false);

  const queryClient = useQueryClient();
  const { runDryRun, runReal, dryRunLoading, sendLoading } =
    useDeadlineReminderTrigger();

  const thresholds = useMemo(() => parseThresholds(thresholdsInput), [thresholdsInput]);
  const droppedThresholds = useMemo(
    () => findInvalidThresholdTokens(thresholdsInput),
    [thresholdsInput],
  );
  const userIds = useMemo(() => parseUserIds(userIdsInput), [userIdsInput]);
  const todayTrimmed = todayInput.trim();
  const todayValid = todayTrimmed === "" || /^\d{4}-\d{2}-\d{2}$/.test(todayTrimmed);

  const canDryRun = thresholds.length > 0 && todayValid && !dryRunLoading;

  const recipients = dryRunResult?.recipients ?? 0;
  const isAnomaly = recipients > ANOMALY_THRESHOLD;
  // Invio reale: solo dopo un dry-run con risultato e con almeno un destinatario.
  const canSend = dryRunResult !== null && recipients > 0 && !sendLoading;

  /** Costruisce il body comune (thresholds obbligatori, userIds/todayISO opzionali). */
  const buildRequest = useCallback(() => {
    // 84-10: invio admin esplicito → bypassa il filtro per-utente delle soglie. L'admin
    // sceglie una soglia precisa (es. 24gg) per coprire una scadenza che le soglie utente
    // non includono; il filtro `reminder_thresholds` governa solo lo sweep automatico del cron.
    const req: {
      thresholds: number[];
      userIds?: string[];
      todayISO?: string;
      ignoreUserThresholds: boolean;
    } = {
      thresholds,
      ignoreUserThresholds: true,
    };
    if (userIds.length > 0) req.userIds = userIds;
    if (todayTrimmed !== "") req.todayISO = todayTrimmed;
    return req;
  }, [thresholds, userIds, todayTrimmed]);

  /** Reset dei risultati quando cambiano gli input → forza un nuovo dry-run prima dell'invio. */
  const invalidateResults = useCallback(() => {
    setDryRunResult(null);
    setRealResult(null);
    setAnomalyAck(false);
  }, []);

  const handleDryRun = useCallback(async () => {
    setRealResult(null);
    setAnomalyAck(false);
    try {
      const res = await runDryRun(buildRequest());
      setDryRunResult(res);
      if ((res.candidates ?? 0) === 0) {
        sonnerToast.info("Nessuna rata non pagata nelle soglie indicate");
      }
    } catch (err: unknown) {
      setDryRunResult(null);
      sonnerToast.error("Errore nel dry-run", {
        description: err instanceof Error ? err.message : "Errore sconosciuto",
      });
    }
  }, [runDryRun, buildRequest]);

  const handleSend = useCallback(async () => {
    setConfirmOpen(false);
    try {
      const res = await runReal(buildRequest());
      setRealResult(res);
      // M2: il dry-run è ora stale (dedup scritto, destinatari già serviti). Azzeralo
      // così "Invia reale" si ri-disabilita e il conteggio mostrato non mente su un
      // eventuale secondo click (che per idempotenza darebbe sent:0).
      setDryRunResult(null);
      queryClient.invalidateQueries({ queryKey: ["email-log"] });
      if ((res.sent ?? 0) > 0) {
        const failedPart = res.failed && res.failed > 0 ? `, ${res.failed} falliti` : "";
        sonnerToast.success(`Inviata a ${res.sent} destinatari${failedPart}`);
      } else {
        // sent:0 NON è un errore: è l'idempotenza di 84-3 (re-run identico) o "nessuna rata".
        sonnerToast.info("Nessun invio effettuato (sent: 0 — idempotenza o nessuna rata)");
      }
    } catch (err: unknown) {
      sonnerToast.error("Errore nell'invio", {
        description: err instanceof Error ? err.message : "Errore sconosciuto",
      });
    } finally {
      setAnomalyAck(false);
    }
  }, [runReal, buildRequest, queryClient]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="h-5 w-5" />
          Promemoria Scadenza — Invio Manuale
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-600">
          Trigger one-shot della scadenza email (84-3) su una scadenza specifica.
          Passa una <strong>soglia esplicita</strong> = <code>daysUntil(due_date)</code>{" "}
          della rata da coprire (le soglie di default <code>[7,3,0]</code> NON catturano una
          scadenza a 4/24 giorni). Esegui sempre il <strong>dry-run</strong> prima dell'invio.
        </p>

        {/* Thresholds */}
        <div className="space-y-1.5">
          <Label htmlFor="deadline-thresholds">
            Soglie (giorni, CSV) <span className="text-red-600">*</span>
          </Label>
          <Input
            id="deadline-thresholds"
            placeholder="es. 24  oppure  7,3,0"
            value={thresholdsInput}
            onChange={(e) => {
              setThresholdsInput(e.target.value);
              invalidateResults();
            }}
            data-testid="deadline-thresholds"
          />
          <p className="text-sm text-slate-500">
            Una scadenza è "in soglia" solo se <code>daysUntil(due_date)</code> è esattamente
            uno di questi valori.
          </p>
          {droppedThresholds.length > 0 && (
            <p className="text-sm text-amber-700" data-testid="deadline-thresholds-dropped">
              Ignorati (non interi): {droppedThresholds.join(", ")}
            </p>
          )}
        </div>

        {/* userIds opzionale */}
        <div className="space-y-1.5">
          <Label htmlFor="deadline-userids">
            Utenti di test (userIds, CSV — opzionale)
          </Label>
          <Input
            id="deadline-userids"
            placeholder="uuid1, uuid2 — vuoto = tutti gli idonei"
            value={userIdsInput}
            onChange={(e) => {
              setUserIdsInput(e.target.value);
              invalidateResults();
            }}
            data-testid="deadline-userids"
          />
          <p className="text-sm text-slate-500">
            Test-first (AC#3): inserisci l'uuid del tuo account per inviare solo a te e
            verificare la consegna in inbox.
          </p>
        </div>

        {/* todayISO opzionale */}
        <div className="space-y-1.5">
          <Label htmlFor="deadline-today">Data di riferimento (YYYY-MM-DD — opzionale)</Label>
          <Input
            id="deadline-today"
            placeholder="default = oggi (Europe/Rome)"
            value={todayInput}
            onChange={(e) => {
              setTodayInput(e.target.value);
              invalidateResults();
            }}
            data-testid="deadline-today"
          />
          {!todayValid && (
            <p className="text-sm text-red-600" data-testid="deadline-today-error">
              Formato non valido. Usa YYYY-MM-DD.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!canDryRun}
            onClick={handleDryRun}
            data-testid="deadline-dryrun-btn"
          >
            {dryRunLoading ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Eye className="h-4 w-4 mr-1" />
            )}
            Anteprima (dry-run)
          </Button>

          <Button
            size="sm"
            disabled={!canSend}
            onClick={() => {
              setAnomalyAck(false);
              setConfirmOpen(true);
            }}
            data-testid="deadline-send-btn"
          >
            {sendLoading ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-1" />
            )}
            Invia reale
          </Button>
        </div>

        {/* DRY-RUN PREVIEW */}
        {dryRunResult && (
          <div
            className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3"
            data-testid="deadline-preview"
          >
            {dryRunResult.message && (dryRunResult.candidates ?? 0) === 0 ? (
              <p className="text-sm text-slate-600" data-testid="deadline-preview-empty">
                {dryRunResult.message}
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-700">
                  <span>
                    Candidati: <strong>{dryRunResult.candidates}</strong>
                  </span>
                  <span>
                    Idonei: <strong>{dryRunResult.eligible ?? 0}</strong>
                  </span>
                  <span>
                    Saltati (preferenze): <strong>{dryRunResult.skipped_prefs ?? 0}</strong>
                  </span>
                  <span>
                    Destinatari:{" "}
                    <strong data-testid="deadline-recipients-count">{recipients}</strong>
                  </span>
                </div>

                {/* Guardrail anomalia */}
                {isAnomaly && (
                  <div
                    className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700"
                    data-testid="deadline-anomaly-warning"
                  >
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>
                      <strong>Anomalia:</strong> {recipients} destinatari superano la soglia di
                      sicurezza ({ANOMALY_THRESHOLD}). Per una singola scadenza è un numero
                      sospetto. STOP — verifica le soglie prima di procedere.
                    </span>
                  </div>
                )}

                {/* Lista mascherata */}
                {dryRunResult.recipientsPreview &&
                  dryRunResult.recipientsPreview.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-slate-700">
                        Anteprima destinatari (max 20):
                      </p>
                      <ul className="space-y-0.5">
                        {dryRunResult.recipientsPreview.map((r, i) => (
                          <li
                            key={`${r.to}-${i}`}
                            className="text-sm text-slate-600 tabular-nums"
                          >
                            {r.to} · {r.bucket} · {r.threshold}gg · {formatEuro(r.amountEuro)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                {/* Sample render */}
                {dryRunResult.sample && (
                  <div className="space-y-1 border-t border-slate-200 pt-2">
                    <p className="text-sm font-medium text-slate-700">
                      Anteprima email:
                    </p>
                    <p className="text-sm text-slate-600">
                      <span className="font-medium">Oggetto:</span>{" "}
                      {dryRunResult.sample.subject}
                    </p>
                    <p className="text-sm text-slate-600 whitespace-pre-wrap">
                      {dryRunResult.sample.textPreview}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ESITO INVIO */}
        {realResult && (
          <div
            className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 space-y-1 text-sm text-emerald-800"
            data-testid="deadline-send-result"
          >
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="h-4 w-4" />
              Invio completato
            </div>
            <p>
              Inviate: <strong>{realResult.sent}</strong>
              {typeof realResult.failed === "number" && (
                <>
                  {" "}
                  · Fallite: <strong>{realResult.failed}</strong>
                </>
              )}
            </p>
            {realResult.batchId && (
              <p className="tabular-nums">
                batchId:{" "}
                <code data-testid="deadline-batch-id">{realResult.batchId}</code>{" "}
                — ricercabile nel log email qui sopra.
              </p>
            )}
            {(realResult.sent ?? 0) === 0 && (
              <p className="text-emerald-700">
                <code>sent: 0</code> è normale su un re-run identico: l'idempotenza di 84-3
                evita i doppioni.
              </p>
            )}
          </div>
        )}

        {/* Conferma invio */}
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Conferma invio reale</AlertDialogTitle>
              <AlertDialogDescription>
                Stai per inviare l'email di promemoria a{" "}
                <strong>{recipients}</strong> destinatari (soglie:{" "}
                {thresholds.join(", ")}). L'invio è <strong>irreversibile</strong>: le email
                non si annullano.
              </AlertDialogDescription>
            </AlertDialogHeader>

            {isAnomaly && (
              <div className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="space-y-2">
                  <p>
                    <strong>Numero destinatari sospetto.</strong> Conferma rinforzata richiesta.
                  </p>
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={anomalyAck}
                      onCheckedChange={(v) => setAnomalyAck(v === true)}
                      data-testid="deadline-anomaly-ack"
                    />
                    <span>Ho verificato le soglie, procedi comunque.</span>
                  </label>
                </div>
              </div>
            )}

            <AlertDialogFooter>
              <AlertDialogCancel data-testid="deadline-confirm-cancel">
                Annulla
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleSend}
                disabled={isAnomaly && !anomalyAck}
                data-testid="deadline-confirm-send"
              >
                Conferma invio
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
