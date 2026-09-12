import { useState, useEffect, useRef, useMemo } from "react";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, Save, Loader2, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUpdateFiscalRules, type FiscalRulesRow } from "@/hooks/useFiscalRules";

// --- Zod schema ---
// INPS rates: DB è NUMERIC(6,4) → max 99.9999. Aliquote sostitutive: NUMERIC(5,2) → max 999.99.
// In pratica nessuna aliquota supera mai 99.99%, usiamo max coerente con il DB.
const rateSchema = z.number().min(0).max(99.9999, "Aliquota massima 99.9999%");
const fiscalRulesSchema = z.object({
  inps_rate_separata: rateSchema,
  massimale_separata: z.number().min(0),
  inps_rate_artigiani: rateSchema,
  inps_rate_artigiani_alta: rateSchema,
  minimale_artigiani: z.number().min(0),
  massimale_artigiani: z.number().min(0),
  inps_rate_commercianti: rateSchema,
  inps_rate_commercianti_alta: rateSchema,
  minimale_commercianti: z.number().min(0),
  massimale_commercianti: z.number().min(0),
  reddito_minimale: z.number().min(0),
  soglia_reddito_prima_fascia: z.number().min(0),
  maternita_annuale: z.number().min(0),
  aliquota_sostitutiva_5: rateSchema,
  aliquota_sostitutiva_15: rateSchema,
  soglia_forfettario: z.number().min(0),
  source_url_separata: z.string().url("URL non valido").or(z.literal("")),
  source_url_artigiani_commercianti: z.string().url("URL non valido").or(z.literal("")),
});

// Il DB memorizza le aliquote già in formato percentuale (26.07 per 26.07%).
// Nessuna conversione necessaria tra form e DB.

interface FieldDef {
  key: string;
  label: string;
  suffix?: string;
}

const SEPARATA_FIELDS: FieldDef[] = [
  { key: "inps_rate_separata", label: "Aliquota INPS", suffix: "%" },
  { key: "massimale_separata", label: "Massimale", suffix: "€" },
];

const ARTIGIANI_FIELDS: FieldDef[] = [
  { key: "inps_rate_artigiani", label: "Aliquota (prima fascia)", suffix: "%" },
  { key: "inps_rate_artigiani_alta", label: "Aliquota (sopra soglia)", suffix: "%" },
  { key: "minimale_artigiani", label: "Minimale annuo", suffix: "€" },
  { key: "massimale_artigiani", label: "Massimale", suffix: "€" },
];

const COMMERCIANTI_FIELDS: FieldDef[] = [
  { key: "inps_rate_commercianti", label: "Aliquota (prima fascia)", suffix: "%" },
  { key: "inps_rate_commercianti_alta", label: "Aliquota (sopra soglia)", suffix: "%" },
  { key: "minimale_commercianti", label: "Minimale annuo", suffix: "€" },
  { key: "massimale_commercianti", label: "Massimale", suffix: "€" },
];

const SHARED_FIELDS: FieldDef[] = [
  { key: "reddito_minimale", label: "Reddito minimale", suffix: "€" },
  { key: "soglia_reddito_prima_fascia", label: "Soglia prima fascia", suffix: "€" },
  { key: "maternita_annuale", label: "Maternità annuale", suffix: "€" },
];

const REGIME_FIELDS: FieldDef[] = [
  { key: "aliquota_sostitutiva_5", label: "Aliquota sostitutiva 5%", suffix: "%" },
  { key: "aliquota_sostitutiva_15", label: "Aliquota sostitutiva 15%", suffix: "%" },
  { key: "soglia_forfettario", label: "Soglia ricavi forfettario", suffix: "€" },
];

const ALL_NUMERIC_FIELDS = [
  ...SEPARATA_FIELDS,
  ...ARTIGIANI_FIELDS,
  ...COMMERCIANTI_FIELDS,
  ...SHARED_FIELDS,
  ...REGIME_FIELDS,
];

interface FiscalRulesFormProps {
  data: FiscalRulesRow;
}

export function FiscalRulesForm({ data }: FiscalRulesFormProps) {
  const { toast } = useToast();
  const updateMutation = useUpdateFiscalRules();

  // Form state: stringa per ogni campo (permette input parziali come "26.")
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Dirty state: snapshot dei valori salvati + generazione per forzare ricalcolo useMemo
  const savedDataRef = useRef<Record<string, string>>({});
  const [saveGeneration, setSaveGeneration] = useState(0);

  // Sync form con dati dal DB (nessuna conversione — il DB usa già formato percentuale)
  useEffect(() => {
    const values: Record<string, string> = {};
    for (const field of ALL_NUMERIC_FIELDS) {
      const dbValue = (data as Record<string, unknown>)[field.key];
      values[field.key] = String(Number(dbValue) || 0);
    }
    values.source_url_separata = data.source_url_separata || "";
    values.source_url_artigiani_commercianti = data.source_url_artigiani_commercianti || "";
    setFormValues(values);
    savedDataRef.current = { ...values };
    setErrors({});
  }, [data]);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- saveGeneration forza ricalcolo dopo save riuscito
  const isDirty = useMemo(() => {
    const keys = Object.keys(savedDataRef.current);
    if (keys.length === 0) return false;
    return keys.some((k) => formValues[k] !== savedDataRef.current[k]);
  }, [formValues, saveGeneration]);

  const handleChange = (key: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
    // Pulisci errore quando l'utente modifica
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleSave = () => {
    // Parse valori numerici — raccoglie TUTTI gli errori NaN prima di uscire
    const parsed: Record<string, unknown> = {};
    const nanErrors: Record<string, string> = {};
    for (const field of ALL_NUMERIC_FIELDS) {
      const num = parseFloat(formValues[field.key] || "0");
      if (isNaN(num)) {
        nanErrors[field.key] = "Valore non valido";
      } else {
        parsed[field.key] = num;
      }
    }
    if (Object.keys(nanErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...nanErrors }));
      return;
    }
    parsed.source_url_separata = formValues.source_url_separata || "";
    parsed.source_url_artigiani_commercianti = formValues.source_url_artigiani_commercianti || "";

    // Valida con Zod
    const result = fiscalRulesSchema.safeParse(parsed);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as string;
        fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      toast({
        title: "Errore di validazione",
        description: "Correggi i campi evidenziati.",
        variant: "destructive",
      });
      return;
    }

    // Nessuna conversione — il DB memorizza le aliquote in formato percentuale (26.07)
    const dbUpdates: Record<string, unknown> = {};
    for (const field of ALL_NUMERIC_FIELDS) {
      dbUpdates[field.key] = result.data[field.key as keyof typeof result.data];
    }
    dbUpdates.source_url_separata = result.data.source_url_separata || null;
    dbUpdates.source_url_artigiani_commercianti = result.data.source_url_artigiani_commercianti || null;

    updateMutation.mutate(
      { fiscalYear: data.fiscal_year, updates: dbUpdates },
      {
        onSuccess: () => {
          savedDataRef.current = { ...formValues };
          setSaveGeneration((g) => g + 1);
          toast({ title: "Parametri aggiornati" });
        },
        onError: () => {
          toast({
            title: "Errore",
            description: "Errore nel salvataggio. Riprova.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const missingSourceUrl = !formValues.source_url_separata && !formValues.source_url_artigiani_commercianti;

  function renderField(field: FieldDef) {
    const value = formValues[field.key] ?? "";
    const error = errors[field.key];
    return (
      <div key={field.key} className="space-y-1.5">
        <Label htmlFor={field.key} className="text-sm">
          {field.label}
        </Label>
        <div className="relative">
          <Input
            id={field.key}
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(e) => handleChange(field.key, e.target.value)}
            className={error ? "border-destructive" : ""}
          />
          {field.suffix && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
              {field.suffix}
            </span>
          )}
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  function renderSection(title: string, fields: FieldDef[]) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map(renderField)}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Warning source URL mancante */}
      {missingSourceUrl && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Raccomandato: inserire almeno un URL della circolare INPS per tracciabilità (Principio Zero Approssimazione).
          </AlertDescription>
        </Alert>
      )}

      {renderSection("Gestione Separata", SEPARATA_FIELDS)}
      {renderSection("Artigiani", ARTIGIANI_FIELDS)}
      {renderSection("Commercianti", COMMERCIANTI_FIELDS)}

      <Separator />

      {renderSection("Parametri Condivisi", SHARED_FIELDS)}
      {renderSection("Regime Forfettario", REGIME_FIELDS)}

      <Separator />

      {/* Source URLs */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Fonti Normative</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: "source_url_separata", label: "URL Circolare INPS — Separata" },
            { key: "source_url_artigiani_commercianti", label: "URL Circolare INPS — Artigiani / Commercianti" },
          ].map(({ key, label }) => {
            const value = formValues[key] || "";
            const error = errors[key];
            return (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={key} className="text-sm">{label}</Label>
                <div className="flex gap-2">
                  <Input
                    id={key}
                    type="url"
                    placeholder="https://..."
                    value={value}
                    onChange={(e) => handleChange(key, e.target.value)}
                    className={error ? "border-destructive" : ""}
                  />
                  {value && (
                    <Button variant="ghost" size="icon" asChild>
                      <a href={value} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
                {error && <p className="text-xs text-destructive">{error}</p>}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Sticky save bar — margini negativi compensano il padding px-6 del parent CardContent in AdminFiscalRules */}
      <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t py-4 -mx-6 px-6 z-10">
        <div className="flex items-center justify-end gap-3">
          {isDirty && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Modifiche non salvate
            </span>
          )}
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending || !isDirty}
            size="lg"
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salva Modifiche
          </Button>
        </div>
      </div>
    </div>
  );
}
