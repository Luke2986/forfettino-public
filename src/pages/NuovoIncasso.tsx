import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveClientId } from "@/lib/clients";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, useFiscalCalculations } from "@/hooks/useFiscalCalculations";
import { sanitizeMoney, multiplyByPercent, subtractMoney, sumMoney } from "@/lib/money";
import { AppLayout } from "@/components/layout/AppLayout";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ClientCombobox } from "@/components/shared/ClientCombobox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { CalendarIcon, Loader2, ArrowLeft, Copy, AlertTriangle, ChevronDown } from "lucide-react";
import { format, addMonths } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { z } from "zod";
import { useSubscription } from "@/hooks/useSubscription";
import { ReceiptLimitDialog } from "@/components/subscription/ReceiptLimitDialog";
import { UpgradeCTA } from "@/components/subscription/UpgradeCTA";
import { track, trackAnonymous, ANALYTICS_EVENTS } from "@/lib/analytics";
import { useIncomeStats } from "@/hooks/useIncomeStats";
import { PageErrorBoundary } from "@/components/shared/PageErrorBoundary";
import { useRegenerateSchedule } from "@/hooks/useRegenerateSchedule";
import { useInstallmentPlans } from "@/hooks/useInstallmentPlans";
import { useServiceCategories } from "@/hooks/useServiceCategories";
import { breakdownFromCompenso, isGestioneSeparata } from "@/lib/rivalsa-inps";
import { MARCA_BOLLO_IMPORTO, isBolloDovuto, totaleConBollo } from "@/lib/marca-bollo";

// Schema di validazione con controlli più robusti
const receiptSchema = z.object({
  grossAmount: z
    .number({ invalid_type_error: "L'importo deve essere un numero" })
    .positive("L'importo deve essere positivo")
    .max(10000000, "Importo troppo alto (max 10M€)")
    .refine((val) => !isNaN(val) && isFinite(val), "Importo non valido"),
  clientName: z.string().max(200, "Nome cliente troppo lungo"),
  notes: z.string().max(1000, "Note troppo lunghe"),
  date: z.date().refine((d) => {
    // Data non può essere più di 1 anno nel futuro
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    return d <= oneYearFromNow;
  }, "La data non può essere più di un anno nel futuro"),
});

interface Installment {
  label: string;
  amount: string; // kept as string for input binding
  date: Date;
}

function generateInstallments(total: number, count: number, startDate: Date): Installment[] {
  const perRate = Math.floor((total / count) * 100) / 100; // round down to 2 decimals
  const remainder = Math.round((total - perRate * count) * 100) / 100;

  return Array.from({ length: count }, (_, i) => {
    const isFirst = i === 0;
    const isLast = i === count - 1;
    let label: string;
    if (isFirst) label = "Anticipo";
    else if (isLast) label = "Saldo";
    else label = `Rata ${i}`;

    // Last installment absorbs rounding remainder
    const amount = isLast ? perRate + remainder : perRate;

    return {
      label,
      amount: amount.toFixed(2),
      date: addMonths(startDate, i),
    };
  });
}

export default function NuovoIncassoPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const { canAddReceipt, isPro } = useSubscription();
  const { regenerateForPaymentYear } = useRegenerateSchedule();
  const [limitDialogOpen, setLimitDialogOpen] = useState(false);
  const [copyingSettings, setCopyingSettings] = useState(false);

  const [date, setDate] = useState<Date>(new Date());
  const [grossAmount, setGrossAmount] = useState("");
  const [clientName, setClientName] = useState("");
  const [notes, setNotes] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [serviceCategoryId, setServiceCategoryId] = useState<string>("");
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  // Rivalsa INPS 4% (Gestione Separata) — default OFF
  const [rivalsaApplied, setRivalsaApplied] = useState(false);
  // Marca da bollo 2 € addebitata al cliente — default OFF
  const [bolloApplied, setBolloApplied] = useState(false);

  // Service categories
  const { activeCategories } = useServiceCategories();

  // Installments state
  const [useInstallments, setUseInstallments] = useState(false);
  const [installmentCount, setInstallmentCount] = useState("3");
  const [installmentDateOpen, setInstallmentDateOpen] = useState<number | null>(null);
  const [installments, setInstallments] = useState<Installment[]>([]);

  // Fetch current fiscal metrics to show "after this income" preview
  const { metrics } = useFiscalCalculations();
  const { data: incomeStats } = useIncomeStats();

  // L'anno fiscale per le impostazioni segue la data della ricevuta, non il context globale
  const settingsYear = date.getFullYear();

  // Installment plans hook for installment flow
  const { createPlanMutation } = useInstallmentPlans(settingsYear);

  // Track page open
  useEffect(() => {
    track("add_income_modal_opened", { source: "nuovo_incasso_page" });
  }, []);

  // Rivalsa breakdown: input utente = compenso (se toggle ON) oppure totale (se OFF)
  const rivalsaBreakdown = useMemo(() => {
    const parsed = parseFloat(grossAmount);
    if (isNaN(parsed) || parsed <= 0) {
      return { compenso: 0, rivalsa: 0, totale: 0 };
    }
    if (rivalsaApplied) {
      // L'utente sta digitando il compenso puro; calcoliamo rivalsa 4% e totale
      return breakdownFromCompenso(parsed);
    }
    // Nessuna rivalsa: il valore digitato e' gia' il totale fattura
    return { compenso: parsed, rivalsa: 0, totale: parsed };
  }, [grossAmount, rivalsaApplied]);

  // Visibilita' toggle bollo: fattura sopra soglia normativa 77,47 €
  // (calcolata sul subtotale compenso+rivalsa) e NON nel flusso rateale
  // (il bollo e' per-fattura, non per-rata — fuori scope v1, story 85-1)
  const showBolloToggle = !useInstallments && isBolloDovuto(rivalsaBreakdown.totale);

  // Safety: se il toggle bollo non e' piu' visibile (importo sceso sotto
  // soglia o flusso rateale attivato), resetta il flag
  useEffect(() => {
    if (!showBolloToggle && bolloApplied) {
      setBolloApplied(false);
    }
  }, [showBolloToggle, bolloApplied]);

  // Totale fattura effettivo (cio' che finira' in DB come gross_amount).
  // Ordine di composizione: compenso → + rivalsa 4% → + bollo 2 €.
  // Il bollo addebitato e' reddito imponibile (interpello AdE 428/2022),
  // quindi entra nel gross come la rivalsa.
  const effectiveGross = bolloApplied
    ? totaleConBollo(rivalsaBreakdown.totale)
    : rivalsaBreakdown.totale;

  // Regenerate installments when amount, count, or date changes
  const regenerateInstallments = useCallback(() => {
    const count = parseInt(installmentCount);
    if (effectiveGross > 0 && !isNaN(count) && count >= 2) {
      setInstallments(generateInstallments(effectiveGross, count, date));
    }
  }, [effectiveGross, installmentCount, date]);

  useEffect(() => {
    if (useInstallments) {
      regenerateInstallments();
    }
  }, [useInstallments, regenerateInstallments]);

  // Fetch only active clients for autocomplete
  const { data: clients } = useQuery({
    queryKey: ["clients_active", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("user_id", user.id)
        .eq("active", true)
        .order("display_name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch fiscal settings for calculations
  const { data: settings } = useQuery({
    queryKey: ["fiscal_year_settings", user?.id, settingsYear],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("fiscal_year_settings")
        .select("*")
        .eq("user_id", user.id)
        .eq("fiscal_year", settingsYear)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!user,
  });

  // Anno accessibile per utenti Free: solo corrente e precedente
  const currentRealYear = new Date().getFullYear();
  const isYearAccessible = isPro ||
    settingsYear === currentRealYear ||
    settingsYear === currentRealYear - 1;

  // Fetch nearest year settings when current year has no settings
  const { data: nearestSettings } = useQuery({
    queryKey: ["fiscal_year_settings_nearest", user?.id, settingsYear],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("fiscal_year_settings")
        .select("*")
        .eq("user_id", user.id)
        .order("fiscal_year", { ascending: false })
        .limit(5);
      if (error) throw error;
      if (!data || data.length === 0) return null;
      // Find the closest year to settingsYear
      return data.reduce((closest, row) =>
        Math.abs(row.fiscal_year - settingsYear) < Math.abs(closest.fiscal_year - settingsYear)
          ? row
          : closest
      );
    },
    enabled: !!user && !settings && isYearAccessible,
  });

  const handleCopySettings = async () => {
    if (!user || !nearestSettings) return;
    setCopyingSettings(true);
    try {
      const { error } = await supabase
        .from("fiscal_year_settings")
        .upsert({
          user_id: user.id,
          fiscal_year: settingsYear,
          tax_rate: nearestSettings.tax_rate,
          profit_coefficient: nearestSettings.profit_coefficient,
          inps_rate: nearestSettings.inps_rate,
          inps_type: nearestSettings.inps_type,
          safety_buffer_rate: nearestSettings.safety_buffer_rate,
          deadline_window_days: nearestSettings.deadline_window_days,
          buffer_base: nearestSettings.buffer_base,
          reserve_amount: nearestSettings.reserve_amount,
        }, { onConflict: "user_id,fiscal_year" });
      if (error) throw error;
      queryClient.invalidateQueries({
        queryKey: ["fiscal_year_settings", user.id, settingsYear],
      });
      toast({
        title: `Impostazioni ${settingsYear} create`,
        description: `Copiate dal ${nearestSettings.fiscal_year}. Puoi verificarle nelle Impostazioni.`,
      });
    } catch {
      toast({
        title: "Errore",
        description: "Impossibile creare le impostazioni.",
        variant: "destructive",
      });
    } finally {
      setCopyingSettings(false);
    }
  };

  // Calculate breakdown - usando money.ts per precisione
  // `gross` qui e' sempre il TOTALE FATTURA (include rivalsa se applicata):
  // la rivalsa e' reddito imponibile, quindi concorre a imposta/INPS.
  const breakdown = useMemo(() => {
    const gross = sanitizeMoney(effectiveGross);
    if (gross <= 0 || !settings) return null;

    const profitCoeff = sanitizeMoney(settings.profit_coefficient) || 78;
    const taxRate = sanitizeMoney(settings.tax_rate) || 15;
    const inpsRate = sanitizeMoney(settings.inps_rate) || 26.07;

    const taxable = multiplyByPercent(gross, profitCoeff);
    const tax = multiplyByPercent(taxable, taxRate);
    const inps = multiplyByPercent(taxable, inpsRate);
    const netSpendable = subtractMoney(subtractMoney(gross, tax), inps);

    return {
      gross,
      taxable,
      tax,
      inps,
      netSpendable,
      profitCoeff,
      taxRate,
      inpsRate,
    };
  }, [effectiveGross, settings]);

  // Visibilita' toggle rivalsa: solo se inps_type = gestione_separata
  const showRivalsaToggle = isGestioneSeparata(settings?.inps_type);

  // Safety: se il toggle non e' piu' visibile (es. settings diventa null o
  // cambia gestione), resetta il flag per evitare salvataggi "invisibili"
  useEffect(() => {
    if (!showRivalsaToggle && rivalsaApplied) {
      setRivalsaApplied(false);
    }
  }, [showRivalsaToggle, rivalsaApplied]);

  // Validate installment amounts sum to total
  const installmentSumValid = useMemo(() => {
    if (!useInstallments || !breakdown) return true;
    const sum = installments.reduce((s, inst) => s + (parseFloat(inst.amount) || 0), 0);
    return Math.abs(sum - breakdown.gross) < 0.02; // tolerance for rounding
  }, [useInstallments, installments, breakdown]);

  const updateInstallment = (index: number, field: "amount" | "date", value: string | Date) => {
    setInstallments((prev) => prev.map((inst, i) => {
      if (i !== index) return inst;
      if (field === "amount") return { ...inst, amount: value as string };
      return { ...inst, date: value as Date };
    }));
  };

  const handleSubmit = async () => {
    // Check receipt limit for Free users
    if (!canAddReceipt) {
      setLimitDialogOpen(true);
      return;
    }

    const gross = parseFloat(grossAmount);

    // Validazione robusta con controllo NaN
    if (isNaN(gross) || !isFinite(gross)) {
      toast({
        title: "Errore di validazione",
        description: "L'importo inserito non è un numero valido",
        variant: "destructive",
      });
      return;
    }

    // Validate con schema Zod includendo la data
    const result = receiptSchema.safeParse({
      grossAmount: gross,
      clientName,
      notes,
      date,
    });

    if (!result.success) {
      toast({
        title: "Errore di validazione",
        description: result.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    if (!user || !breakdown) return;

    // Installment-specific validation
    if (useInstallments) {
      if (!installmentSumValid) {
        toast({
          title: "Errore di validazione",
          description: "La somma delle rate non corrisponde all'importo totale.",
          variant: "destructive",
        });
        return;
      }
      const firstAmount = parseFloat(installments[0]?.amount);
      if (isNaN(firstAmount) || firstAmount <= 0) {
        toast({
          title: "Errore di validazione",
          description: "L'importo dell'anticipo deve essere positivo.",
          variant: "destructive",
        });
        return;
      }
    }

    setSaving(true);
    try {
      if (useInstallments) {
        // --- INSTALLMENT FLOW: create plan + deadlines + first payment ---
        const firstPaymentAmount = parseFloat(installments[0].amount);

        const deadlines = installments.map((inst) => ({
          label: inst.label,
          expectedAmount: parseFloat(inst.amount),
          dueDate: inst.date,
        }));

        await createPlanMutation.mutateAsync({
          totalAmount: breakdown.gross,
          clientName: clientName.trim() || null,
          description: notes.trim() || null,
          startDate: date,
          fiscalYear: date.getFullYear(),
          deadlines,
          firstPayment: {
            amount: firstPaymentAmount,
            date: installments[0].date,
            profitCoefficient: breakdown.profitCoeff,
            taxRate: breakdown.taxRate,
            inpsRate: breakdown.inpsRate,
          },
          invoiceNumber: invoiceNumber.trim() || undefined,
          rivalsaApplied,
        });

        // Track events
        const countBefore = incomeStats?.count_total ?? 0;
        track("income_created", { source: "nuovo_incasso_page", gross_amount: breakdown.gross, mode: "installments", installment_count: installments.length, incassi_count_before: countBefore, is_first: countBefore === 0 });
        trackAnonymous(ANALYTICS_EVENTS.INCASSO_CREATO, { skipPosthog: true });

        toast({
          title: "Incasso a rate registrato!",
          description: `Anticipo di ${formatCurrency(firstPaymentAmount)} incassato. Le rate successive le trovi nello Scadenziario e nella sezione rate in Incassi.`,
        });

        const isFirstIncome = countBefore === 0;
        if (isFirstIncome) {
          navigate(`/dashboard?highlight=spendibile&first=true`);
        } else {
          navigate("/incassi");
        }
      } else {
        // --- DIRECT FLOW: existing single receipt ---
        // Check if client exists, create if new
        const clientId = await resolveClientId(user.id, clientName);

        // Insert receipt — se rivalsa attiva, il gross include la rivalsa (e' reddito imponibile)
        const receiptData = {
          user_id: user.id,
          client_id: clientId,
          receipt_date: format(date, "yyyy-MM-dd"),
          gross_amount: breakdown.gross,
          client_name: clientName.trim() || null,
          notes: notes.trim() || null,
          taxable_amount: breakdown.taxable,
          tax_amount: breakdown.tax,
          inps_amount: breakdown.inps,
          net_spendable: breakdown.netSpendable,
          fiscal_year: date.getFullYear(),
          source: "manual",
          service_category_id: serviceCategoryId || null,
          rivalsa_inps_applied: rivalsaApplied,
          rivalsa_inps_amount: rivalsaApplied ? rivalsaBreakdown.rivalsa : 0,
          marca_bollo_applied: bolloApplied,
          marca_bollo_amount: bolloApplied ? MARCA_BOLLO_IMPORTO : 0,
        };
        const { error } = await supabase.from("receipts").insert(receiptData);

        if (error) throw error;

        // Invalidate queries
        queryClient.invalidateQueries({ queryKey: ["receipts"] });
        queryClient.invalidateQueries({ queryKey: ["receipts_ytd"] });
        queryClient.invalidateQueries({ queryKey: ["receipts_ytd_prev"] });
        queryClient.invalidateQueries({ queryKey: ["fiscal_year_settings_prev"] });
        queryClient.invalidateQueries({ queryKey: ["clients"] });
        queryClient.invalidateQueries({ queryKey: ["due_soon_schedules"] });
        queryClient.invalidateQueries({ queryKey: ["next_deadline"] });
        queryClient.invalidateQueries({ queryKey: ["income_stats"] });
        queryClient.invalidateQueries({ queryKey: ["receipt_count_limit"] });
        queryClient.invalidateQueries({ queryKey: ["current_year_schedules"] });

        // Auto-rigenera tax_schedule per l'anno di pagamento corrispondente
        const receiptFiscalYear = date.getFullYear();
        const receiptPaymentYear = receiptFiscalYear + 1;
        try {
          const regenResult = await regenerateForPaymentYear(receiptPaymentYear);
          if (!regenResult.success) {
            console.warn("[NuovoIncasso] Schedule regeneration skipped:", regenResult.reason);
          }
        } catch (err) {
          console.warn("[NuovoIncasso] Schedule regeneration failed (non-blocking):", err);
        }

        // Track events
        const countBefore = incomeStats?.count_total ?? 0;
        track("income_created", { source: "nuovo_incasso_page", gross_amount: breakdown.gross, mode: "direct", incassi_count_before: countBefore, is_first: countBefore === 0 });
        track("redirected_to_dashboard_after_income", {});
        trackAnonymous(ANALYTICS_EVENTS.INCASSO_CREATO, { skipPosthog: true });

        toast({
          title: "Incasso registrato!",
          description: `Nuovo incasso di ${formatCurrency(breakdown.gross)} aggiunto.`,
        });

        const isFirstIncome = countBefore === 0;
        navigate(`/dashboard?highlight=spendibile${isFirstIncome ? "&first=true" : ""}`);
      }
    } catch (error) {
      toast({
        title: "Errore",
        description: "Impossibile salvare l'incasso. Riprova.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      {isMobile && <MobileHeader title="Nuovo Incasso" showBackButton backPath="/incassi" />}
      <PageErrorBoundary>
      <div className="p-6 mx-auto max-w-2xl space-y-6">
        {/* Header - desktop only */}
        <div className="hidden md:flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/incassi")} aria-label="Torna agli incassi">
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Nuovo Incasso</h1>
            <p className="text-muted-foreground">Registra un nuovo incasso</p>
          </div>
        </div>

        {/* Form */}
        <Card>
          <CardContent className="space-y-6 pt-6">
            {/* Amount — primary field */}
            <div className="space-y-2">
              <Label htmlFor="amount">
                {rivalsaApplied ? "Compenso (€)" : "Importo Lordo (€)"}
              </Label>
              <Input
                id="amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="1000.00"
                value={grossAmount}
                onChange={(e) => setGrossAmount(e.target.value)}
                autoFocus
              />
              {(rivalsaApplied || bolloApplied) && rivalsaBreakdown.totale > 0 && (
                <div className="rounded-lg border border-teal-100 bg-teal-50/60 p-3 text-sm space-y-1">
                  <div className="flex justify-between text-slate-700">
                    <span>Compenso</span>
                    <span className="tabular-nums">{formatCurrency(rivalsaBreakdown.compenso)}</span>
                  </div>
                  {rivalsaApplied && (
                    <div className="flex justify-between text-slate-700">
                      <span>Rivalsa INPS 4%</span>
                      <span className="tabular-nums">+ {formatCurrency(rivalsaBreakdown.rivalsa)}</span>
                    </div>
                  )}
                  {bolloApplied && (
                    <div className="flex justify-between text-slate-700">
                      <span>Marca da bollo</span>
                      <span className="tabular-nums">+ {formatCurrency(MARCA_BOLLO_IMPORTO)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold text-slate-900 border-t border-teal-200/60 pt-1">
                    <span>Totale fattura</span>
                    <span className="tabular-nums">{formatCurrency(effectiveGross)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Rivalsa INPS 4% — solo per Gestione Separata */}
            {showRivalsaToggle && (
              <div className="flex items-start justify-between rounded-lg border p-4 gap-4">
                <div className="space-y-0.5 min-w-0">
                  <Label htmlFor="rivalsa-toggle" className="cursor-pointer">
                    Ho addebitato la rivalsa INPS 4%
                  </Label>
                  <p className="text-xs text-slate-600">
                    Attivalo se hai aggiunto il 4% in fattura come rimborso parziale INPS.{" "}
                    <Link
                      to="/guide-per-te?fisco=gestione-separata#rivalsa"
                      className="text-teal-700 hover:underline"
                    >
                      Cos&apos;&egrave;?
                    </Link>
                  </p>
                </div>
                <Switch
                  id="rivalsa-toggle"
                  checked={rivalsaApplied}
                  onCheckedChange={setRivalsaApplied}
                />
              </div>
            )}

            {/* Marca da bollo 2 € — fatture no-IVA sopra 77,47 € (non rateale) */}
            {showBolloToggle && (
              <div className="flex items-start justify-between rounded-lg border p-4 gap-4">
                <div className="space-y-0.5 min-w-0">
                  <Label htmlFor="bollo-toggle" className="cursor-pointer">
                    Ho addebitato la marca da bollo (2 €)
                  </Label>
                  <p className="text-xs text-slate-600">
                    Attivalo se hai girato al cliente il bollo da 2 € in fattura.{" "}
                    <Link
                      to="/guide-per-te?fisco=marca-bollo#bollo"
                      className="text-teal-700 hover:underline"
                    >
                      Cos&apos;&egrave;?
                    </Link>
                  </p>
                </div>
                <Switch
                  id="bollo-toggle"
                  checked={bolloApplied}
                  onCheckedChange={setBolloApplied}
                />
              </div>
            )}

            {/* Date — precompiled to today */}
            <div className="space-y-2">
              <Label>{useInstallments ? "Data Primo Incasso" : "Data Incasso"}</Label>
              <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                    aria-label={date ? `Data incasso: ${format(date, "PPP", { locale: it })}` : "Seleziona data incasso"}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                    {date ? format(date, "PPP", { locale: it }) : "Seleziona data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={date} onSelect={(d) => { if (d) { setDate(d); setDatePopoverOpen(false); } }} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            {/* Installments toggle */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="installments-toggle" className="cursor-pointer">Fraziona in rate</Label>
                <p className="text-xs text-muted-foreground">
                  Dividi l'incasso in anticipo, rate e saldo
                </p>
              </div>
              <Switch
                id="installments-toggle"
                checked={useInstallments}
                onCheckedChange={setUseInstallments}
              />
            </div>

            {/* Installments configurator */}
            {useInstallments && parseFloat(grossAmount) > 0 && (
              <div className="space-y-4 rounded-lg border p-4">
                <div className="flex items-center gap-4">
                  <Label htmlFor="installment-count" className="whitespace-nowrap">Numero rate</Label>
                  <Select value={installmentCount} onValueChange={(v) => setInstallmentCount(v)}>
                    <SelectTrigger id="installment-count" className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                        <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  {installments.map((inst, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-16 shrink-0">{inst.label}</span>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        className="w-28"
                        value={inst.amount}
                        onChange={(e) => updateInstallment(i, "amount", e.target.value)}
                      />
                      <span className="text-xs text-muted-foreground">€</span>
                      <Popover open={installmentDateOpen === i} onOpenChange={(open) => setInstallmentDateOpen(open ? i : null)}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn("flex-1 justify-start text-left font-normal text-xs h-9")}
                          >
                            <CalendarIcon className="mr-1 h-3 w-3" />
                            {format(inst.date, "dd/MM/yyyy")}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={inst.date}
                            onSelect={(d) => { if (d) { updateInstallment(i, "date", d); setInstallmentDateOpen(null); } }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  ))}
                </div>

                {!installmentSumValid && breakdown && (
                  <p className="text-xs text-destructive">
                    La somma delle rate ({formatCurrency(installments.reduce((s, inst) => s + (parseFloat(inst.amount) || 0), 0))}) non corrisponde all'importo totale ({formatCurrency(breakdown.gross)}).
                  </p>
                )}

                <p className="text-xs text-muted-foreground">
                  Solo l'anticipo verrà registrato come incasso ora. Le rate successive le troverai nello Scadenziario e nella sezione rate in Incassi.
                </p>
              </div>
            )}

            {/* Live preview: after this income */}
            {breakdown && metrics && !useInstallments && (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Dopo questo incasso</p>
                <div className="flex justify-between text-sm">
                  <span>Accantonamento stimato</span>
                  <span className="font-semibold">
                    {formatCurrency(sumMoney(metrics.totalWithholding, breakdown.tax + breakdown.inps))}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Spendibile oggi</span>
                  <span className="font-semibold text-emerald-600">
                    {formatCurrency(Math.max(0, sumMoney(metrics.spendable, breakdown.netSpendable)))}
                  </span>
                </div>
              </div>
            )}

            {/* Live preview for installment mode: shows first payment impact */}
            {breakdown && metrics && useInstallments && installments.length > 0 && (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Dopo l'anticipo di {formatCurrency(parseFloat(installments[0]?.amount) || 0)}</p>
                {(() => {
                  const firstAmt = sanitizeMoney(parseFloat(installments[0]?.amount) || 0);
                  const taxable = multiplyByPercent(firstAmt, breakdown.profitCoeff);
                  const tax = multiplyByPercent(taxable, breakdown.taxRate);
                  const inps = multiplyByPercent(taxable, breakdown.inpsRate);
                  const net = subtractMoney(subtractMoney(firstAmt, tax), inps);
                  return (
                    <>
                      <div className="flex justify-between text-sm">
                        <span>Accantonamento stimato</span>
                        <span className="font-semibold">
                          {formatCurrency(sumMoney(metrics.totalWithholding, tax + inps))}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Spendibile oggi</span>
                        <span className="font-semibold text-emerald-600">
                          {formatCurrency(Math.max(0, sumMoney(metrics.spendable, net)))}
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Optional details — collapsible */}
            <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between px-0 text-muted-foreground hover:text-foreground">
                  <span className="text-sm">Dettagli (opzionali)</span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", detailsOpen && "rotate-180")} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-2">
                {/* Invoice Number */}
                <div className="space-y-2">
                  <Label htmlFor="invoice-number">Numero Fattura</Label>
                  <Input
                    id="invoice-number"
                    placeholder="Es. 2026/001"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                  />
                </div>

                {/* Client */}
                <div className="space-y-2">
                  <Label htmlFor="nuovo-incasso-client">Cliente</Label>
                  <ClientCombobox
                    id="nuovo-incasso-client"
                    value={clientName}
                    onChange={setClientName}
                    clients={clients}
                  />
                </div>

                {/* Service Category */}
                <div className="space-y-2">
                  <Label>Categoria Servizio</Label>
                  {activeCategories.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      <Link to="/impostazioni?tab=categorie" className="text-teal-700 hover:underline">
                        Crea le tue categorie in Impostazioni
                      </Link>
                    </p>
                  ) : (
                    <Select value={serviceCategoryId || "none"} onValueChange={(v) => setServiceCategoryId(v === "none" ? "" : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Nessuna categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nessuna categoria</SelectItem>
                        {activeCategories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            <span className="flex items-center gap-2">
                              <span
                                className="inline-block w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: cat.color ?? "#94a3b8" }}
                              />
                              {cat.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes">Note</Label>
                  <Textarea
                    id="notes"
                    placeholder="Descrizione del lavoro..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>

        {/* Feature non disponibile nel piano attuale */}
        {!isYearAccessible && (
          <UpgradeCTA feature="Navigazione Multi-anno" variant="banner" />
        )}

        {isYearAccessible && !settings && parseFloat(grossAmount) > 0 && (
          <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
            <CardContent className="py-4 space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium text-amber-900 dark:text-amber-200">
                    Impostazioni fiscali mancanti per il {settingsYear}
                  </p>
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    Per calcolare correttamente tasse e INPS servono le impostazioni fiscali del {settingsYear}.
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 ml-8">
                {nearestSettings && (
                  <Button
                    size="sm"
                    onClick={handleCopySettings}
                    disabled={copyingSettings}
                  >
                    {copyingSettings ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Copy className="h-4 w-4 mr-2" />
                    )}
                    Copia da {nearestSettings.fiscal_year}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/impostazioni?year=${settingsYear}`)}
                >
                  Configura manualmente
                </Button>
              </div>
              {nearestSettings && (
                <p className="text-xs text-amber-700 dark:text-amber-400 ml-8">
                  Aliquota {nearestSettings.tax_rate}%, Coeff. {nearestSettings.profit_coefficient}%, INPS {nearestSettings.inps_rate}%
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Breakdown Preview */}
        {breakdown && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-lg">
                Riepilogo Incasso
              </CardTitle>
              <CardDescription>Calcoli basati sulle tue impostazioni fiscali</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(rivalsaApplied || bolloApplied) && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Compenso</span>
                    <span>{formatCurrency(rivalsaBreakdown.compenso)}</span>
                  </div>
                )}
                {rivalsaApplied && rivalsaBreakdown.rivalsa > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Rivalsa INPS 4%</span>
                    <span>+ {formatCurrency(rivalsaBreakdown.rivalsa)}</span>
                  </div>
                )}
                {bolloApplied && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Marca da bollo</span>
                    <span>+ {formatCurrency(MARCA_BOLLO_IMPORTO)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {rivalsaApplied || bolloApplied ? "Totale fattura (imponibile)" : "Importo Lordo"}
                  </span>
                  <span className="font-medium">{formatCurrency(breakdown.gross)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Imponibile ({breakdown.profitCoeff}%)</span>
                  <span>{formatCurrency(breakdown.taxable)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">− Imposta ({breakdown.taxRate}%)</span>
                  <span className="text-destructive">-{formatCurrency(breakdown.tax)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">− INPS ({breakdown.inpsRate}%)</span>
                  <span className="text-destructive">-{formatCurrency(breakdown.inps)}</span>
                </div>
                <div className="flex justify-between border-t pt-3">
                  <span className="font-medium">Netto dopo tasse e INPS</span>
                  <span className="text-lg font-bold text-primary">{formatCurrency(breakdown.netSpendable)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          <Button variant="outline" className="flex-1" onClick={() => navigate("/incassi")}>
            Annulla
          </Button>
          <Button
            className="flex-1"
            onClick={handleSubmit}
            disabled={saving || !breakdown || !isYearAccessible || (useInstallments && !installmentSumValid)}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {useInstallments ? "Salva Incasso a Rate" : "Salva Incasso"}
          </Button>
        </div>
        {/* Receipt Limit Dialog */}
        <ReceiptLimitDialog open={limitDialogOpen} onOpenChange={setLimitDialogOpen} />
      </div>
      </PageErrorBoundary>
    </AppLayout>
  );
}
