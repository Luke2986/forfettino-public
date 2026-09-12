import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Settings2, AlertTriangle, Loader2 } from "lucide-react";
import { useNpsCampaignConfig } from "@/hooks/useNpsCampaignConfig";
import { TRIGGER_LABELS, REPEAT_OPTIONS } from "@/lib/nps-constants";

function formatDateForInput(dateStr: string | null): string {
  if (!dateStr) return "";
  // Handle both ISO datetime and date-only
  return dateStr.split("T")[0];
}

export function NpsCampaignConfig() {
  const { campaign, isLoading, updateCampaign, isUpdating } =
    useNpsCampaignConfig();

  // Local form state
  const [isActive, setIsActive] = useState(false);
  const [enabledTriggers, setEnabledTriggers] = useState<string[]>([]);
  const [repeatInterval, setRepeatInterval] = useState("never");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Sync form state when campaign data arrives
  useEffect(() => {
    if (!campaign) return;
    setIsActive(campaign.is_active);
    setEnabledTriggers(
      Array.isArray(campaign.enabled_triggers)
        ? campaign.enabled_triggers
        : [],
    );
    setRepeatInterval(campaign.repeat_interval);
    setStartDate(formatDateForInput(campaign.start_date));
    setEndDate(formatDateForInput(campaign.end_date));
  }, [campaign]);

  // Date validation
  const dateError = useMemo(() => {
    if (startDate && endDate && endDate < startDate) {
      return "La data fine deve essere uguale o successiva alla data inizio";
    }
    return null;
  }, [startDate, endDate]);

  // Campaign out-of-range warning
  const outOfRangeWarning = useMemo(() => {
    if (!isActive) return null;
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (startDate && today < startDate) {
      return `La campagna e' abilitata ma non ancora iniziata (inizio: ${startDate})`;
    }
    if (endDate && today > endDate) {
      return `La campagna e' abilitata ma fuori dal periodo configurato (fine: ${endDate})`;
    }
    return null;
  }, [isActive, startDate, endDate]);

  function handleTriggerToggle(trigger: string, checked: boolean) {
    setEnabledTriggers((prev) =>
      checked ? [...prev, trigger] : prev.filter((t) => t !== trigger),
    );
  }

  async function handleSave() {
    if (!campaign) return;
    if (dateError) return;

    try {
      await updateCampaign({
        id: campaign.id,
        is_active: isActive,
        enabled_triggers: enabledTriggers,
        repeat_interval: repeatInterval,
        start_date: startDate || null,
        end_date: endDate || null,
      });
      toast.success("Configurazione salvata");
    } catch (err: any) {
      toast.error("Errore nel salvataggio: " + (err?.message ?? "errore sconosciuto"));
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!campaign) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-emerald-500" />
            <CardTitle className="text-base">
              Configurazione Campagna NPS
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Nessuna campagna NPS trovata. Crea la prima campagna dal database.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-emerald-500" />
          <CardTitle className="text-base">
            Configurazione Campagna NPS
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Out-of-range warning */}
        {outOfRangeWarning && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-800">{outOfRangeWarning}</p>
          </div>
        )}

        {/* Toggle on/off */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="nps-active-toggle" className="text-sm font-medium">
              Campagna attiva
            </Label>
            <p className="text-sm text-muted-foreground">
              Se disattivato, nessun utente vedra' il pop-up NPS ne' il bottone
              sidebar
            </p>
          </div>
          <Switch
            id="nps-active-toggle"
            checked={isActive}
            onCheckedChange={setIsActive}
          />
        </div>

        {/* Trigger selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Trigger attivi</Label>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(TRIGGER_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center gap-2">
                <Checkbox
                  id={`trigger-${key}`}
                  checked={enabledTriggers.includes(key)}
                  onCheckedChange={(checked) =>
                    handleTriggerToggle(key, checked === true)
                  }
                />
                <Label
                  htmlFor={`trigger-${key}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Repeat interval */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Intervallo ripetizione</Label>
          <RadioGroup
            value={repeatInterval}
            onValueChange={setRepeatInterval}
            className="grid gap-2 sm:grid-cols-2"
          >
            {REPEAT_OPTIONS.map((opt) => (
              <div key={opt.value} className="flex items-center gap-2">
                <RadioGroupItem
                  value={opt.value}
                  id={`repeat-${opt.value}`}
                />
                <Label
                  htmlFor={`repeat-${opt.value}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {opt.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        {/* Campaign dates */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">
            Periodo campagna{" "}
            <span className="font-normal text-muted-foreground">
              (opzionale — se vuoto, sempre attiva)
            </span>
          </Label>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="nps-start-date" className="text-sm">
                Data inizio
              </Label>
              <input
                id="nps-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nps-end-date" className="text-sm">
                Data fine (opzionale)
              </Label>
              <input
                id="nps-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
          </div>
          {dateError && (
            <p className="text-sm text-destructive">{dateError}</p>
          )}
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Stato attuale:</span>
          {isActive && !outOfRangeWarning ? (
            <Badge
              variant="outline"
              className="bg-emerald-50 text-emerald-700 border-emerald-200"
            >
              Attiva
            </Badge>
          ) : isActive && outOfRangeWarning ? (
            <Badge
              variant="outline"
              className="bg-amber-50 text-amber-700 border-amber-200"
            >
              Abilitata ma fuori periodo
            </Badge>
          ) : (
            <Badge variant="outline">Disattivata</Badge>
          )}
        </div>

        {/* Save button */}
        <Button onClick={handleSave} disabled={isUpdating || !!dateError}>
          {isUpdating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Salva configurazione
        </Button>
      </CardContent>
    </Card>
  );
}
