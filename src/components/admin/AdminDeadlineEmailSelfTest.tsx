import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, MailCheck, Send, Eye, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  useDeadlineReminderTrigger,
  type DeadlineDryRunResult,
  type DeadlineRealRunResult,
} from "@/hooks/useDeadlineReminderTrigger";

/**
 * Invio di test a sé stessi — wrapper "un clic" sopra la EF `send-deadline-reminder-email`
 * (84-3), pensato per rispondere a "le email funzionano?" senza compilare il pannello 84-4.
 *
 * Differenza con `AdminDeadlineEmailTrigger` (84-4): qui NON si scelgono soglia/data/utenti.
 * Si usa SEMPRE l'account admin loggato come unico destinatario e si passano TUTTE le soglie
 * 0..370 (≈ un anno) così qualunque rata aperta dell'admin viene catturata → l'admin riceve
 * il/i promemoria reale/i nella propria inbox. Riusa l'hook (dry-run → conferma → invio reale),
 * non ricostruisce la logica d'invio.
 *
 * Caveat idempotenza (84-3): se hai già ricevuto oggi il reminder per quella rata/soglia, un
 * nuovo invio dà `sent: 0` (dedup `deadline_email_sent`) — è corretto, non è un errore.
 */

/**
 * Tutte le soglie 0..370: cattura qualsiasi rata aperta dell'admin entro ~un anno.
 * Abbinato a `ignoreUserThresholds: true` (84-10): senza, il filtro per-utente
 * `reminder_thresholds` (default [30,7,3,0]) scarterebbe le rate fuori da quelle 4 soglie,
 * vanificando lo sweep e mostrando un falso "nessuna rata aperta".
 */
const ALL_THRESHOLDS = Array.from({ length: 371 }, (_, i) => i);

/**
 * Estrae il messaggio d'errore REALE da un fallimento di `supabase.functions.invoke`.
 * Su risposta non-2xx l'errore è un `FunctionsHttpError` con `.message` generico
 * ("...non-2xx status code"): il body vero `{ error: "..." }` sta in `.context` (Response).
 * Qui lo si legge per mostrare la causa effettiva (auth/secret/crash EF) a schermo.
 */
async function readEdgeError(err: unknown): Promise<string> {
  if (err && typeof err === "object" && "context" in err) {
    const ctx = (err as { context?: unknown }).context;
    if (ctx && typeof (ctx as Response).json === "function") {
      try {
        const body = (await (ctx as Response).json()) as { error?: unknown };
        if (body && body.error != null) return String(body.error);
      } catch {
        // body non-JSON o già consumato → fallback al message generico
      }
    }
  }
  return err instanceof Error ? err.message : "Errore sconosciuto";
}

export function AdminDeadlineEmailSelfTest() {
  const [dryRun, setDryRun] = useState<DeadlineDryRunResult | null>(null);
  const [result, setResult] = useState<DeadlineRealRunResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resolvingUid, setResolvingUid] = useState(false);
  const queryClient = useQueryClient();
  const { runDryRun, runReal, dryRunLoading, sendLoading } = useDeadlineReminderTrigger();

  const getMyUid = useCallback(async (): Promise<string | null> => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return data.user.id;
  }, []);

  const handlePreview = useCallback(async () => {
    setResult(null);
    setErrorMsg(null);
    setResolvingUid(true);
    const uid = await getMyUid();
    setResolvingUid(false);
    if (!uid) {
      setErrorMsg("Impossibile leggere il tuo account (sessione scaduta?). Rifai login.");
      return;
    }
    try {
      const res = await runDryRun({
        thresholds: ALL_THRESHOLDS,
        userIds: [uid],
        ignoreUserThresholds: true,
      });
      setDryRun(res);
      if ((res.candidates ?? 0) === 0) {
        sonnerToast.info("Non hai rate aperte da ricordare — niente da inviare come test.");
      }
    } catch (err: unknown) {
      setDryRun(null);
      const msg = await readEdgeError(err);
      setErrorMsg(msg);
      sonnerToast.error("Errore nell'anteprima", { description: msg });
    }
  }, [getMyUid, runDryRun]);

  const handleSend = useCallback(async () => {
    setErrorMsg(null);
    setResolvingUid(true);
    const uid = await getMyUid();
    setResolvingUid(false);
    if (!uid) {
      setErrorMsg("Impossibile leggere il tuo account (sessione scaduta?). Rifai login.");
      return;
    }
    try {
      const res = await runReal({
        thresholds: ALL_THRESHOLDS,
        userIds: [uid],
        ignoreUserThresholds: true,
      });
      setResult(res);
      setDryRun(null);
      queryClient.invalidateQueries({ queryKey: ["email-log"] });
      if ((res.sent ?? 0) > 0) {
        sonnerToast.success(`Email di test inviata (${res.sent}). Controlla la tua inbox.`);
      } else {
        sonnerToast.info("Nessun invio (sent: 0 — idempotenza o nessuna rata aperta).");
      }
    } catch (err: unknown) {
      const msg = await readEdgeError(err);
      setErrorMsg(msg);
      sonnerToast.error("Errore nell'invio", { description: msg });
    }
  }, [getMyUid, runReal, queryClient]);

  const recipients = dryRun?.recipients ?? 0;
  const canSend = dryRun !== null && recipients > 0 && !sendLoading && !resolvingUid;
  const previewBusy = dryRunLoading || resolvingUid;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MailCheck className="h-5 w-5 text-teal-600" />
          Invia email di test a me stesso
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-600">
          Un clic: usa il tuo account, cerca le tue rate aperte e ti invia l'email di promemoria
          reale. Serve a verificare che il canale email funzioni (recapito in inbox). Nessun campo
          da compilare. <strong>Anteprima</strong> mostra cosa riceverai, <strong>Invia a me</strong>{" "}
          la spedisce solo a te.
        </p>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreview}
            disabled={previewBusy}
            data-testid="selftest-preview-btn"
          >
            {previewBusy ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Eye className="h-4 w-4 mr-1" />
            )}
            Anteprima
          </Button>
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!canSend}
            data-testid="selftest-send-btn"
          >
            {sendLoading ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-1" />
            )}
            Invia a me
          </Button>
        </div>

        {errorMsg && (
          <div
            className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 flex items-start gap-2"
            data-testid="selftest-error"
          >
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              <strong>Errore dalla Edge Function:</strong>{" "}
              <code className="break-all">{errorMsg}</code>
            </span>
          </div>
        )}

        {dryRun && (
          <div
            className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2 text-sm text-slate-700"
            data-testid="selftest-preview"
          >
            {(dryRun.candidates ?? 0) === 0 ? (
              <p>{dryRun.message ?? "Nessuna rata aperta da ricordare."}</p>
            ) : (
              <>
                <p>
                  Rate trovate: <strong>{dryRun.candidates}</strong> · Email che riceverai:{" "}
                  <strong data-testid="selftest-recipients">{recipients}</strong>
                </p>
                {dryRun.sample && (
                  <p className="text-slate-600">
                    <span className="font-medium">Oggetto:</span> {dryRun.sample.subject}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {result && (
          <div
            className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 flex items-center gap-2"
            data-testid="selftest-result"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>
              Inviata a te: <strong>{result.sent}</strong>. Controlla l'inbox (anche spam).
              {(result.sent ?? 0) === 0 && (
                <> <code>sent: 0</code> = già ricevuta oggi (idempotenza) o nessuna rata aperta.</>
              )}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
