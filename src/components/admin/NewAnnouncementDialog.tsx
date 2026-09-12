import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sparkles, Send, MessageCircle, Bell, Loader2, CheckCircle2, XCircle, RefreshCcw } from "lucide-react";
import { useSendAnnouncement, type SendAnnouncementPayload } from "@/hooks/useSendAnnouncement";
import { supabase } from "@/integrations/supabase/client";

export interface ResendDefaults {
  title: string;
  body: string;
  actionUrl: string;
  actionLabel: string;
  targetAudience: "all" | "pro" | "free";
}

interface NewAnnouncementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: ResendDefaults;
  resendTitle?: string;
}

const TITLE_MAX = 100;
const BODY_MAX = 1500;
const USER_CODE_MAX = 9;

function isValidActionUrl(url: string): boolean {
  if (!url.trim()) return true; // empty is OK (optional field)
  const trimmed = url.trim();
  return trimmed.startsWith("/") || trimmed.startsWith("http://") || trimmed.startsWith("https://");
}

export function NewAnnouncementDialog({ open, onOpenChange, defaultValues, resendTitle }: NewAnnouncementDialogProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [actionUrl, setActionUrl] = useState("");
  const [actionLabel, setActionLabel] = useState("");
  const [targetAudience, setTargetAudience] = useState<"all" | "pro" | "free">("all");
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Story 25.6: Individual message state
  const [targetType, setTargetType] = useState<"broadcast" | "individual">("broadcast");
  const [userCode, setUserCode] = useState("");
  const [resolvedUser, setResolvedUser] = useState<{ userId: string; name: string } | null>(null);
  const [userCodeError, setUserCodeError] = useState<string | null>(null);
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [deliveryType, setDeliveryType] = useState<"sidebar" | "popup">("sidebar");

  const { mutate: send, isPending } = useSendAnnouncement();

  // Pre-fill fields when opening in resend mode
  useEffect(() => {
    if (open && defaultValues) {
      setTitle(defaultValues.title);
      setBody(defaultValues.body);
      setActionUrl(defaultValues.actionUrl);
      setActionLabel(defaultValues.actionLabel);
      setTargetAudience(defaultValues.targetAudience);
      setTargetType("broadcast");
    }
  }, [open, defaultValues]);

  // Debounced user code validation
  useEffect(() => {
    if (targetType !== "individual" || userCode.trim().length < 5) {
      setResolvedUser(null);
      setUserCodeError(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsValidatingCode(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, user_code, first_name, last_name")
        .eq("user_code", userCode.trim().toUpperCase())
        .maybeSingle();

      if (error || !data) {
        setResolvedUser(null);
        setUserCodeError("Codice non trovato");
      } else {
        setResolvedUser({
          userId: (data as any).user_id,
          name: [data.first_name, data.last_name].filter(Boolean).join(" ") || (data as any).user_code,
        });
        setUserCodeError(null);
      }
      setIsValidatingCode(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [userCode, targetType]);

  const urlValid = isValidActionUrl(actionUrl);
  const isValid =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    urlValid &&
    (targetType === "broadcast" || (targetType === "individual" && resolvedUser !== null));

  const resetForm = useCallback(() => {
    setTitle("");
    setBody("");
    setActionUrl("");
    setActionLabel("");
    setTargetAudience("all");
    setTargetType("broadcast");
    setUserCode("");
    setResolvedUser(null);
    setUserCodeError(null);
    setDeliveryType("sidebar");
  }, []);

  const doSend = () => {
    if (!isValid || isPending) return;

    const payload: SendAnnouncementPayload = {
      title: title.trim(),
      body: body.trim(),
      target_audience: targetType === "broadcast" ? targetAudience : "all",
    };

    if (actionUrl.trim()) {
      payload.action_url = actionUrl.trim();
      payload.action_label = actionLabel.trim() || "Scopri di più";
    }

    // Always send delivery_type (broadcast + individual)
    payload.delivery_type = deliveryType;

    if (targetType === "individual" && resolvedUser) {
      payload.target_type = "individual";
      payload.target_user_id = resolvedUser.userId;
    }

    send(payload, {
      onSuccess: () => {
        resetForm();
        onOpenChange(false);
      },
    });
  };

  const handleSubmit = () => {
    if (!isValid || isPending) return;
    setConfirmOpen(true);
  };

  const handleTargetTypeChange = (value: string) => {
    setTargetType(value as "broadcast" | "individual");
    // Reset individual-specific state when switching
    if (value === "broadcast") {
      setUserCode("");
      setResolvedUser(null);
      setUserCodeError(null);
      setDeliveryType("sidebar");
    }
  };

  const confirmDescription = targetType === "individual" && resolvedUser
    ? `Stai per inviare un messaggio a ${userCode.trim().toUpperCase()} (${resolvedUser.name}). Confermi?`
    : resendTitle
      ? "Stai per re-inviare questo annuncio. Verrà creato un nuovo invio indipendente con statistiche separate."
      : `L'annuncio sarà inviato a tutti gli utenti con notifiche di aggiornamenti attive come ${deliveryType === "popup" ? "pop-up modale" : "notifica campanella"}. Questa azione non può essere annullata.`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {targetType === "individual" ? "Nuovo Messaggio Individuale" : "Nuovo Annuncio"}
          </DialogTitle>
        </DialogHeader>

        {resendTitle && (
          <div className="flex items-center gap-2 px-1 py-2 text-sm text-teal-700 bg-teal-50 rounded-md" data-testid="resend-banner">
            <RefreshCcw className="h-3.5 w-3.5 shrink-0" />
            <span>Re-invio di: <strong className="font-medium">{resendTitle}</strong></span>
          </div>
        )}

        <div className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="ann-title">Titolo</Label>
            <Input
              id="ann-title"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
              placeholder="Titolo dell'annuncio"
              maxLength={TITLE_MAX}
              data-testid="announcement-title"
            />
            <p className="text-xs text-muted-foreground text-right">
              {title.length}/{TITLE_MAX}
            </p>
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <Label htmlFor="ann-body">Corpo</Label>
            <Textarea
              id="ann-body"
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, BODY_MAX))}
              placeholder="Messaggio da inviare agli utenti..."
              maxLength={BODY_MAX}
              rows={3}
              data-testid="announcement-body"
            />
            <p className="text-xs text-muted-foreground text-right">
              {body.length}/{BODY_MAX}
            </p>
          </div>

          {/* Action URL (optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="ann-url">URL azione (opzionale)</Label>
            <Input
              id="ann-url"
              value={actionUrl}
              onChange={(e) => setActionUrl(e.target.value)}
              placeholder="/feedback o https://..."
              data-testid="announcement-url"
              className={!urlValid ? "border-destructive" : ""}
            />
            {!urlValid && (
              <p className="text-xs text-destructive" data-testid="url-error">
                L'URL deve iniziare con /, http:// o https://
              </p>
            )}
          </div>

          {/* Action Label (optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="ann-label">Label azione (opzionale)</Label>
            <Input
              id="ann-label"
              value={actionLabel}
              onChange={(e) => setActionLabel(e.target.value)}
              placeholder="Scopri di più"
              data-testid="announcement-label"
            />
          </div>

          {/* Target Type RadioGroup */}
          <div className="space-y-2">
            <Label>Tipo destinatario</Label>
            <RadioGroup
              value={targetType}
              onValueChange={handleTargetTypeChange}
              data-testid="target-type-radio"
            >
              <div className="flex items-center space-x-2 min-h-[44px]">
                <RadioGroupItem value="broadcast" id="target-broadcast" />
                <Label htmlFor="target-broadcast" className="font-normal cursor-pointer">
                  Broadcast (tutti/Pro/Free)
                </Label>
              </div>
              <div className="flex items-center space-x-2 min-h-[44px]">
                <RadioGroupItem value="individual" id="target-individual" />
                <Label htmlFor="target-individual" className="font-normal cursor-pointer">
                  Singolo utente
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Target Audience — only for broadcast */}
          {targetType === "broadcast" && (
            <div className="space-y-1.5">
              <Label>Destinatari</Label>
              <Select
                value={targetAudience}
                onValueChange={(v) => setTargetAudience(v as "all" | "pro" | "free")}
              >
                <SelectTrigger data-testid="announcement-audience">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti gli utenti</SelectItem>
                  <SelectItem value="pro">Solo Pro</SelectItem>
                  <SelectItem value="free">Solo Free</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Individual user fields */}
          {targetType === "individual" && (
            <>
              {/* User Code Input */}
              <div className="space-y-1.5">
                <Label htmlFor="ann-user-code">Codice utente</Label>
                <Input
                  id="ann-user-code"
                  value={userCode}
                  onChange={(e) => setUserCode(e.target.value.slice(0, USER_CODE_MAX).toUpperCase())}
                  placeholder="Es. LA26TEST1"
                  maxLength={USER_CODE_MAX}
                  data-testid="announcement-user-code"
                  className="font-mono tracking-wider"
                />
                {/* Validation feedback */}
                {isValidatingCode && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1" data-testid="user-code-validating">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Verifico...
                  </p>
                )}
                {!isValidatingCode && resolvedUser && (
                  <p className="text-xs text-emerald-600 flex items-center gap-1" data-testid="user-code-found">
                    <CheckCircle2 className="h-3 w-3" />
                    Trovato: {resolvedUser.name}
                  </p>
                )}
                {!isValidatingCode && userCodeError && (
                  <p className="text-xs text-destructive flex items-center gap-1" data-testid="user-code-error">
                    <XCircle className="h-3 w-3" />
                    {userCodeError}
                  </p>
                )}
              </div>
            </>
          )}

          {/* Delivery Type RadioGroup — available for both broadcast and individual */}
          <div className="space-y-2">
            <Label>Tipo consegna</Label>
            <RadioGroup
              value={deliveryType}
              onValueChange={(v) => setDeliveryType(v as "sidebar" | "popup")}
              data-testid="delivery-type-radio"
            >
              <div className="flex items-center space-x-2 min-h-[44px]">
                <RadioGroupItem value="sidebar" id="delivery-sidebar" />
                <Label htmlFor="delivery-sidebar" className="font-normal cursor-pointer flex items-center gap-1.5">
                  <Bell className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  Notifica campanella
                </Label>
              </div>
              <div className="flex items-center space-x-2 min-h-[44px]">
                <RadioGroupItem value="popup" id="delivery-popup" />
                <Label htmlFor="delivery-popup" className="font-normal cursor-pointer flex items-center gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  Pop-up modale
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Preview */}
          {(title.trim() || body.trim()) && (
            <div className="border rounded-lg p-3 bg-muted/30" role="region" aria-label="Anteprima notifica">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                {deliveryType === "popup"
                  ? "Anteprima pop-up modale"
                  : "Anteprima notifica"}
              </p>

              {deliveryType === "popup" ? (
                /* Pop-up modal preview */
                <div className="border rounded-lg p-4 bg-background text-center space-y-3">
                  <div className="mx-auto h-10 w-10 rounded-xl bg-teal-50 flex items-center justify-center">
                    <MessageCircle className="h-5 w-5 text-teal-600" aria-hidden="true" />
                  </div>
                  <p className="text-sm font-semibold leading-tight">
                    {title.trim() || "Titolo..."}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-3">
                    {body.trim() || "Corpo del messaggio..."}
                  </p>
                  {actionUrl.trim() && (
                    <p className="text-xs text-primary">
                      {actionLabel.trim() || "Scopri di più"} →
                    </p>
                  )}
                  <div className="pt-1">
                    <span className="text-xs text-muted-foreground border rounded px-2 py-0.5">Ho capito</span>
                  </div>
                </div>
              ) : (
                /* Sidebar notification card preview */
                <div className="flex gap-3">
                  <div className="shrink-0 mt-0.5">
                    {targetType === "individual" ? (
                      <MessageCircle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    ) : (
                      <Sparkles className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight">
                      {title.trim() || "Titolo..."}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {body.trim() || "Corpo del messaggio..."}
                    </p>
                    {actionUrl.trim() && (
                      <p className="text-xs text-primary mt-1">
                        {actionLabel.trim() || "Scopri di più"} →
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Annulla
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || isPending}
            data-testid="announcement-send"
          >
            <Send className="h-4 w-4 mr-1" />
            {isPending ? "Invio..." : "Invia"}
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confermi l'invio?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={doSend} data-testid="announcement-confirm-send">
              Conferma invio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
