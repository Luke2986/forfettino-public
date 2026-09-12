import { useState, useCallback, useMemo } from "react";
import DOMPurify from "dompurify";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
import { Separator } from "@/components/ui/separator";
import { Mail, Send, Loader2, Eye } from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useEmailRecipientCount } from "@/hooks/useEmailRecipientCount";
import { useSendEmail } from "@/hooks/useSendEmail";
import type { SendEmailResponse } from "@/hooks/useSendEmail";
import { supabase } from "@/integrations/supabase/client";
import { AdminConsentedEmailList } from "@/components/admin/AdminConsentedEmailList";
import { AdminEmailLog } from "@/components/admin/AdminEmailLog";

const MAX_SUBJECT = 200;
const MAX_HTML = 50_000;
const BATCH_SIZE = 10;

export function AdminSendEmail() {
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [singleMode, setSingleMode] = useState(false);
  const [singleEmail, setSingleEmail] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [batchProgress, setBatchProgress] = useState("");

  const queryClient = useQueryClient();
  const { data: recipientCount = 0, isLoading: countLoading } =
    useEmailRecipientCount();
  const { mutateAsync: sendEmail } = useSendEmail();

  const isFormValid =
    subject.trim().length > 0 &&
    htmlBody.trim().length > 0 &&
    (!singleMode || singleEmail.trim().length > 0);

  const resetForm = useCallback(() => {
    setSubject("");
    setHtmlBody("");
    setSingleEmail("");
    setSingleMode(false);
    setBatchProgress("");
  }, []);

  const handleSend = useCallback(async () => {
    setConfirmOpen(false);
    setSending(true);
    setBatchProgress("");

    try {
      if (singleMode) {
        // Single email — one call
        await sendEmail({
          to: singleEmail.trim(),
          subject: subject.trim(),
          html: DOMPurify.sanitize(htmlBody.trim()),
        });
        queryClient.invalidateQueries({ queryKey: ["email-log"] });
        resetForm();
      } else {
        // Broadcast — fetch consented emails via RPC, then chunk
        setBatchProgress("Recupero destinatari...");
        const { data: rpcData, error: rpcError } = await supabase.rpc(
          "get_consented_email_list" as any,
        );
        if (rpcError) throw rpcError;

        const emails: string[] = ((rpcData as any[]) ?? []).map(
          (row: any) => row.email as string,
        );

        if (emails.length === 0) {
          setBatchProgress("");
          sonnerToast.error("Nessun destinatario con consenso email trovato");
          return;
        }

        // Chunk into batches of BATCH_SIZE
        const totalBatches = Math.ceil(emails.length / BATCH_SIZE);
        const aggregated: SendEmailResponse["summary"] = {
          sent: 0,
          skipped: 0,
          errors: 0,
        };

        for (let i = 0; i < totalBatches; i++) {
          const batch = emails.slice(
            i * BATCH_SIZE,
            (i + 1) * BATCH_SIZE,
          );
          setBatchProgress(
            `Invio batch ${i + 1}/${totalBatches} (${batch.length} email)...`,
          );

          const { data, error } = await supabase.functions.invoke(
            "send-email",
            {
              body: {
                to: batch,
                subject: subject.trim(),
                html: DOMPurify.sanitize(htmlBody.trim()),
              },
            },
          );

          if (error) {
            aggregated.errors += batch.length;
          } else {
            const res = data as SendEmailResponse;
            aggregated.sent += res.summary.sent;
            aggregated.skipped += res.summary.skipped;
            aggregated.errors += res.summary.errors;
          }
        }

        setBatchProgress("");
        queryClient.invalidateQueries({ queryKey: ["email-log"] });
        if (aggregated.sent > 0) {
          const parts: string[] = [];
          if (aggregated.skipped > 0)
            parts.push(`${aggregated.skipped} saltate`);
          if (aggregated.errors > 0)
            parts.push(`${aggregated.errors} errori`);
          sonnerToast.success(
            `Email inviata a ${aggregated.sent} utenti${parts.length > 0 ? ` (${parts.join(", ")})` : ""}`,
          );
        } else {
          sonnerToast.error("Nessuna email inviata");
        }
        resetForm();
      }
    } catch (err: any) {
      sonnerToast.error("Errore nell'invio", {
        description: err?.message ?? "Errore sconosciuto",
      });
    } finally {
      setSending(false);
      setBatchProgress("");
    }
  }, [singleMode, singleEmail, subject, htmlBody, sendEmail, resetForm, queryClient]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Invia Email (Resend)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Consented email list (collapsible) */}
        <AdminConsentedEmailList />

        {/* Recipient count */}
        <div className="text-sm text-muted-foreground">
          {countLoading ? (
            <span>Caricamento destinatari...</span>
          ) : (
            <span>
              <strong>{recipientCount}</strong> utenti con consenso email
            </span>
          )}
        </div>

        {/* Single mode toggle */}
        <div className="flex items-center gap-3">
          <Switch
            id="single-mode"
            checked={singleMode}
            onCheckedChange={setSingleMode}
            data-testid="single-mode-toggle"
          />
          <Label htmlFor="single-mode" className="text-sm">
            Invia a singolo utente
          </Label>
        </div>

        {/* Single email input */}
        {singleMode && (
          <div className="space-y-1.5">
            <Label htmlFor="single-email">Email destinatario</Label>
            <Input
              id="single-email"
              type="email"
              placeholder="utente@esempio.it"
              value={singleEmail}
              onChange={(e) => setSingleEmail(e.target.value)}
              data-testid="single-email-input"
            />
          </div>
        )}

        {/* Subject */}
        <div className="space-y-1.5">
          <Label htmlFor="email-subject">
            Oggetto{" "}
            <span className="text-muted-foreground font-normal">
              ({subject.length}/{MAX_SUBJECT})
            </span>
          </Label>
          <Input
            id="email-subject"
            placeholder="Oggetto dell'email"
            value={subject}
            onChange={(e) =>
              setSubject(e.target.value.slice(0, MAX_SUBJECT))
            }
            data-testid="email-subject"
          />
        </div>

        {/* HTML Body */}
        <div className="space-y-1.5">
          <Label htmlFor="email-body">
            Corpo HTML{" "}
            <span className="text-muted-foreground font-normal">
              ({htmlBody.length}/{MAX_HTML.toLocaleString("it-IT")})
            </span>
          </Label>
          <Textarea
            id="email-body"
            placeholder="<p>Contenuto dell'email in HTML...</p>"
            value={htmlBody}
            onChange={(e) =>
              setHtmlBody(e.target.value.slice(0, MAX_HTML))
            }
            rows={8}
            className="font-mono text-sm"
            data-testid="email-body"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          {/* Preview */}
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={htmlBody.trim().length === 0}
                data-testid="preview-btn"
              >
                <Eye className="h-4 w-4 mr-1" />
                Anteprima
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Anteprima Email</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-3">
                <div className="text-sm">
                  <span className="font-medium">Oggetto:</span>{" "}
                  {subject || "(vuoto)"}
                </div>
                <hr />
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(htmlBody) }}
                />
              </div>
            </SheetContent>
          </Sheet>

          {/* Send button */}
          <Button
            size="sm"
            disabled={!isFormValid || sending}
            onClick={() => setConfirmOpen(true)}
            data-testid="send-btn"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-1" />
            )}
            Invia
          </Button>
        </div>

        {/* Batch progress */}
        {batchProgress && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="batch-progress">
            <Loader2 className="h-4 w-4 animate-spin" />
            {batchProgress}
          </div>
        )}

        {/* Confirm dialog */}
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Conferma invio email</AlertDialogTitle>
              <AlertDialogDescription>
                {singleMode
                  ? `Stai per inviare un'email a ${singleEmail}. L'invio avverrà solo se l'utente ha dato il consenso.`
                  : `Stai per inviare un'email a ${recipientCount} utenti con consenso email. Confermi?`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="confirm-cancel">
                Annulla
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleSend}
                data-testid="confirm-send"
              >
                Conferma invio
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {/* Email log */}
        <Separator className="my-6" />
        <AdminEmailLog />
      </CardContent>
    </Card>
  );
}
