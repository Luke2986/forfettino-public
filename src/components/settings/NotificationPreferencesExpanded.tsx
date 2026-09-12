import { Bell } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotificationSettings } from "@/hooks/useNotificationSettings";
import { useToast } from "@/hooks/use-toast";
import type { Tone } from "@/hooks/useNotificationSettings";

const TONE_OPTIONS: Array<{ value: Tone; label: string; description: string }> = [
  { value: "rassicurante", label: "Rassicurante", description: "Spiegazioni dettagliate, tono amichevole" },
  { value: "neutro", label: "Neutro", description: "Fatti chiari, senza enfasi" },
  { value: "minimalista", label: "Minimalista", description: "Solo numeri e date" },
];

const NOTIFICATION_TYPES: Array<{ key: string; label: string; description: string }> = [
  { key: "scadenze_enabled", label: "Scadenze fiscali", description: "Avvisi sulle scadenze imminenti" },
  { key: "feedback_enabled", label: "Feedback post-scadenza", description: "Chiedi com'è andata dopo ogni scadenza" },
  { key: "insights_enabled", label: "Insights e riepiloghi", description: "Riepilogo incassi e suggerimenti" },
  { key: "aggiornamenti_enabled", label: "Aggiornamenti prodotto", description: "Novità e miglioramenti dell'app" },
];

// Story 84-7: "Email" è ora un canale attivo (toggle scadenze_email_enabled). Resta solo WhatsApp "In arrivo".
const FUTURE_CHANNELS = ["WhatsApp"];

// Story 84-10: soglie (giorni-prima) selezionabili per il canale email scadenze.
// Decisione B: ESATTAMENTE il superset cron {30,7,3,0} (4 opzioni, niente 14/1).
// L'ordine canonico [30,7,3,0] è mantenuto nell'array salvato (CHECK <@ ARRAY[30,7,3,0]).
const REMINDER_THRESHOLD_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 30, label: "30 giorni prima" },
  { value: 7, label: "7 giorni prima" },
  { value: 3, label: "3 giorni prima" },
  { value: 0, label: "Il giorno stesso" },
];

export function NotificationPreferencesExpanded() {
  const { settings, isLoading, updateSetting } = useNotificationSettings();
  const { toast } = useToast();

  if (isLoading || !settings) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="space-y-1">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
              <Skeleton className="h-6 w-11 rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const masterEnabled = settings.master_enabled;
  const disabledByMaster = !masterEnabled;
  // Story 84-7 / M1: il canale email è inutile se il TIPO "Scadenze fiscali" è spento
  // (l'EF richiede scadenze_enabled ∧ scadenze_email_enabled). Rendiamo esplicita la dipendenza.
  const deadlineEmailMoot = !settings.scadenze_enabled;

  // Story 84-10: soglie per-utente. Mute (grigiate) se il canale email è off, il tipo
  // "Scadenze fiscali" è off, o le notifiche globali sono off (coerente con AC#6).
  const reminderThresholds = settings.reminder_thresholds ?? [30, 7, 3, 0];
  const reminderControlsDisabled =
    disabledByMaster || deadlineEmailMoot || !settings.scadenze_email_enabled;

  const toggleThreshold = (day: number) => {
    const isSelected = reminderThresholds.includes(day);
    if (isSelected) {
      // Almeno una soglia deve restare attiva: per spegnere il canale si usa il toggle Email.
      if (reminderThresholds.length === 1) {
        toast({
          title: "Almeno una soglia deve restare attiva",
          description: "Per non ricevere più email scadenze, disattiva «Email scadenze».",
          variant: "destructive",
        });
        return;
      }
      const next = reminderThresholds.filter((d) => d !== day);
      updateSetting("reminder_thresholds", next);
      toast({ title: "Preferenze aggiornate" });
    } else {
      // Reinserisce mantenendo l'ordine canonico [30,7,3,0].
      const next = REMINDER_THRESHOLD_OPTIONS.map((o) => o.value).filter(
        (d) => reminderThresholds.includes(d) || d === day,
      );
      updateSetting("reminder_thresholds", next);
      toast({ title: "Preferenze aggiornate" });
    }
  };

  const handleMasterToggle = (checked: boolean) => {
    updateSetting("master_enabled", checked);
    toast({
      title: checked ? "Notifiche riattivate" : "Tutte le notifiche disattivate",
    });
  };

  const handleUpdate = (key: string, value: unknown) => {
    updateSetting(key, value);
    toast({ title: "Preferenze aggiornate" });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Preferenze Notifiche
        </CardTitle>
        <CardDescription>
          Personalizza come e quando Forfettino ti comunica
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* ── Controllo Globale ── */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-3">Controllo Globale</h4>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Notifiche attive</Label>
              <p className="text-sm text-muted-foreground">
                Disattiva per silenziare tutte le comunicazioni
              </p>
            </div>
            <Switch
              checked={masterEnabled}
              onCheckedChange={handleMasterToggle}
              aria-label="Notifiche attive"
            />
          </div>
        </div>

        <Separator />

        {/* ── Personalizzazione ── */}
        <div className={disabledByMaster ? "opacity-50 pointer-events-none" : ""}>
          <h4 className="text-sm font-medium text-muted-foreground mb-3">Personalizzazione</h4>

          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Come vuoi che Forfettino ti parli?</Label>
              <RadioGroup
                value={settings.tone}
                onValueChange={(val) => handleUpdate("tone", val)}
                disabled={disabledByMaster}
                aria-label="Tono notifiche"
              >
                {TONE_OPTIONS.map((opt) => (
                  <div key={opt.value} className="flex items-start gap-3 py-1 min-h-[44px]">
                    <RadioGroupItem value={opt.value} id={`tone-${opt.value}`} />
                    <div>
                      <Label htmlFor={`tone-${opt.value}`} className="font-normal cursor-pointer">
                        {opt.label}
                      </Label>
                      <p className="text-xs text-muted-foreground">{opt.description}</p>
                    </div>
                  </div>
                ))}
              </RadioGroup>
              <p className="text-xs text-muted-foreground mt-2 italic">
                Il default è calcolato dalla tua anzianità P.IVA
              </p>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Ho un commercialista</Label>
                <p className="text-sm text-muted-foreground">
                  Aggiungeremo una nota nelle notifiche
                </p>
              </div>
              <Switch
                checked={settings.has_accountant}
                onCheckedChange={(val) => handleUpdate("has_accountant", val)}
                disabled={disabledByMaster}
                aria-label="Ho un commercialista"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* ── Tipi di Notifica ── */}
        <div className={disabledByMaster ? "opacity-50 pointer-events-none" : ""}>
          <h4 className="text-sm font-medium text-muted-foreground mb-3">Tipi di Notifica</h4>
          <div className="space-y-4">
            {NOTIFICATION_TYPES.map((type, idx) => (
              <div key={type.key}>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>{type.label}</Label>
                    <p className="text-sm text-muted-foreground">{type.description}</p>
                  </div>
                  <Switch
                    checked={settings[type.key as keyof typeof settings] as boolean ?? false}
                    onCheckedChange={(val) => handleUpdate(type.key, val)}
                    disabled={disabledByMaster}
                    aria-label={type.label}
                  />
                </div>
                {idx < NOTIFICATION_TYPES.length - 1 && <Separator className="mt-4" />}
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* ── Canali (prossimamente) ── */}
        <div className={disabledByMaster ? "opacity-50 pointer-events-none" : ""}>
          <h4 className="text-sm font-medium text-muted-foreground mb-3">Canali</h4>
          <div className="space-y-4">
            {/* In-app — active */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>In-app (sidebar)</Label>
              </div>
              <span className="text-sm font-medium text-green-600">Attivo</span>
            </div>

            <Separator />

            {/* Email scadenze — active (Story 84-7): canale email dei promemoria, GDPR 6.1.b */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Email scadenze</Label>
                <p className="text-sm text-muted-foreground">
                  {deadlineEmailMoot
                    ? "Attiva «Scadenze fiscali» nei Tipi di Notifica per ricevere queste email"
                    : "Promemoria delle scadenze fiscali via email"}
                </p>
              </div>
              <Switch
                checked={settings.scadenze_email_enabled ?? true}
                onCheckedChange={(val) => handleUpdate("scadenze_email_enabled", val)}
                disabled={disabledByMaster || deadlineEmailMoot}
                aria-label="Email scadenze"
              />
            </div>

            {/* Story 84-10: soglie per-utente — quando ricevere i promemoria (30/7/3/0) */}
            <div className={reminderControlsDisabled ? "opacity-50 pointer-events-none pl-1" : "pl-1"}>
              <Label className="text-sm">Quando ricevere i promemoria</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Scegli a quanti giorni dalla scadenza ricevere l'email (almeno una)
              </p>
              <div className="space-y-1">
                {REMINDER_THRESHOLD_OPTIONS.map((opt) => (
                  <div key={opt.value} className="flex items-center gap-3 min-h-[44px]">
                    <Checkbox
                      id={`reminder-threshold-${opt.value}`}
                      checked={reminderThresholds.includes(opt.value)}
                      onCheckedChange={() => toggleThreshold(opt.value)}
                      disabled={reminderControlsDisabled}
                      aria-label={opt.label}
                    />
                    <Label
                      htmlFor={`reminder-threshold-${opt.value}`}
                      className="font-normal cursor-pointer"
                    >
                      {opt.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Future channels — disabled */}
            {FUTURE_CHANNELS.map((channel, idx) => (
              <div key={channel}>
                <div className="flex items-center justify-between opacity-40 cursor-not-allowed pointer-events-none">
                  <div className="space-y-1">
                    <Label>{channel}</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">
                      In arrivo
                    </span>
                    <Switch checked={false} disabled aria-label={channel} />
                  </div>
                </div>
                {idx < FUTURE_CHANNELS.length - 1 && <Separator className="mt-4" />}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
