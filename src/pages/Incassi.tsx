import { useState, useMemo, useEffect } from "react";
import { useAvailableYears } from "@/hooks/useAvailableYears";
import { usePrefetchAdjacentYears } from "@/hooks/usePrefetchAdjacentYears";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveClientId } from "@/lib/clients";
import { ClientCombobox } from "@/components/shared/ClientCombobox";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/hooks/useFiscalCalculations";
import { useIncomeStats } from "@/hooks/useIncomeStats";
import { sanitizeMoney, multiplyByPercent, subtractMoney } from "@/lib/money";
import { track } from "@/lib/analytics";
import { PageErrorBoundary } from "@/components/shared/PageErrorBoundary";
import { AppLayout } from "@/components/layout/AppLayout";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, Receipt, MoreHorizontal, Pencil, Trash2, CalendarIcon, Loader2, FileUp, FileDown, Lock, MoreVertical, Tags, X } from "lucide-react";
import { ImportFattureDialog } from "@/components/import/ImportFattureDialog";
import { useExportCommercialista } from "@/hooks/useExportCommercialista";
import { useSubscription } from "@/hooks/useSubscription";
import { UsageCounter } from "@/components/subscription/UsageCounter";
import { ReceiptLimitBanner } from "@/components/subscription/ReceiptLimitBanner";
import { ProBanner } from "@/components/subscription/ProBanner";
import { ReceiptLimitDialog } from "@/components/subscription/ReceiptLimitDialog";
import { useRegenerateSchedule } from "@/hooks/useRegenerateSchedule";
import { useServiceCategories } from "@/hooks/useServiceCategories";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { TaxSliceBar, type TaxSliceBarProps } from "@/components/receipts/TaxSliceBar";
import { useInstallmentPlans, type InstallmentPlanWithProgress } from "@/hooks/useInstallmentPlans";
import { breakdownFromTotale, isGestioneSeparata } from "@/lib/rivalsa-inps";
import { MARCA_BOLLO_IMPORTO, estraiBollo, isBolloDovuto } from "@/lib/marca-bollo";
import { Switch } from "@/components/ui/switch";
import { InstallmentPlanCard } from "@/components/incassi/InstallmentPlanCard";
import { InstallmentPlanSheet } from "@/components/incassi/InstallmentPlanSheet";
import { RegisterPaymentDialog } from "@/components/incassi/RegisterPaymentDialog";

interface ReceiptRow {
  id: string;
  receipt_date: string;
  client_name: string | null;
  gross_amount: number;
  tax_amount: number | null;
  inps_amount: number | null;
  net_spendable: number | null;
  notes: string | null;
  fiscal_year: number;
  service_category_id: string | null;
  rivalsa_inps_applied?: boolean;
  rivalsa_inps_amount?: number;
  marca_bollo_applied?: boolean;
  marca_bollo_amount?: number;
}

const currentCalendarYear = new Date().getFullYear();

export default function IncassiPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [yearFilter, setYearFilter] = useState(currentCalendarYear.toString());
  const { availableYears } = useAvailableYears();
  usePrefetchAdjacentYears(parseInt(yearFilter), availableYears);
  const { data: incomeStats } = useIncomeStats(parseInt(yearFilter));
  const countTotal = incomeStats?.count_total ?? 0;
  const countYear = incomeStats?.count_year ?? 0;
  const [searchTerm, setSearchTerm] = useState("");

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<ReceiptRow | null>(null);
  const [editDate, setEditDate] = useState<Date | undefined>();
  const [editAmount, setEditAmount] = useState("");
  const [editClientName, setEditClientName] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editServiceCategoryId, setEditServiceCategoryId] = useState<string>("");
  // Rivalsa flag: solo toggle (non ricalcola gross_amount)
  const [editRivalsaApplied, setEditRivalsaApplied] = useState(false);
  // Marca da bollo flag: solo toggle (non ricalcola gross_amount)
  const [editBolloApplied, setEditBolloApplied] = useState(false);

  // Service categories
  const { activeCategories, categories: allCategories } = useServiceCategories();
  const categoriesById = useMemo(() => {
    const map = new Map<string, { name: string; color: string | null }>();
    for (const cat of allCategories) {
      map.set(cat.id, { name: cat.name, color: cat.color });
    }
    return map;
  }, [allCategories]);

  // Category filter
  const [categoryFilter, setCategoryFilter] = useState("");

  // Batch selection
  const [selectedReceiptIds, setSelectedReceiptIds] = useState<Set<string>>(new Set());
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batchCategoryId, setBatchCategoryId] = useState("");
  const [categorizeTipDismissed, setCategorizeTipDismissed] = useState(false);

  // Batch marca da bollo (85-2): retro-tagging assistito
  const [bolloBatchDialogOpen, setBolloBatchDialogOpen] = useState(false);
  const [bolloBatchPending, setBolloBatchPending] = useState(false);

  // Nudge bollo one-shot: dismiss permanente e globale via localStorage
  const bolloNudgeKey = user ? `bollo_nudge_dismissed_${user.id}` : "";
  const [bolloNudgeDismissed, setBolloNudgeDismissed] = useState(() =>
    bolloNudgeKey ? localStorage.getItem(bolloNudgeKey) === "true" : false
  );
  const handleDismissBolloNudge = () => {
    if (bolloNudgeKey) localStorage.setItem(bolloNudgeKey, "true");
    setBolloNudgeDismissed(true);
  };

  // Education banner dismiss (permanent via localStorage)
  const eduBannerKey = user ? `categories_edu_dismissed_${user.id}` : "";
  const [eduBannerDismissed, setEduBannerDismissed] = useState(() =>
    eduBannerKey ? localStorage.getItem(eduBannerKey) === "true" : false
  );
  const handleDismissEduBanner = () => {
    if (eduBannerKey) localStorage.setItem(eduBannerKey, "true");
    setEduBannerDismissed(true);
  };

  // Reset batch selection when filters change
  useEffect(() => {
    setSelectedReceiptIds(new Set());
  }, [yearFilter, categoryFilter]);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingReceiptId, setDeletingReceiptId] = useState<string | null>(null);

  // Import dialog state
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Export commercialista
  const { handleExport, isExporting, isReady: isExportReady } = useExportCommercialista(parseInt(yearFilter));

  // Subscription gating
  const { canImport, canExport, canAddReceipt, isPro, importsUsed, importsLimit } = useSubscription();
  const [limitDialogOpen, setLimitDialogOpen] = useState(false);
  const { regenerateForPaymentYear } = useRegenerateSchedule();

  // Installment plans state
  const {
    activePlans,
    registerPaymentMutation,
    deletePlanMutation,
  } = useInstallmentPlans(parseInt(yearFilter));

  const [planSheetOpen, setPlanSheetOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<InstallmentPlanWithProgress | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentPlan, setPaymentPlan] = useState<InstallmentPlanWithProgress | null>(null);
  const [deletePlanDialogOpen, setDeletePlanDialogOpen] = useState(false);
  const [deletingPlan, setDeletingPlan] = useState<InstallmentPlanWithProgress | null>(null);

  // Fetch fiscal settings for recalculation
  const { data: settings } = useQuery({
    queryKey: ["fiscal_year_settings", user?.id, parseInt(yearFilter)],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("fiscal_year_settings")
        .select("*")
        .eq("user_id", user.id)
        .eq("fiscal_year", parseInt(yearFilter))
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: receipts, isLoading } = useQuery({
    queryKey: ["receipts", user?.id, yearFilter],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("receipts")
        .select("*")
        .eq("user_id", user.id)
        .eq("fiscal_year", parseInt(yearFilter))
        .order("receipt_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    refetchOnMount: "always",
  });

  // Story 86-1: catalogo clienti per il combobox del dialog di modifica.
  // Stessa query key di NuovoIncasso -> cache condivisa.
  const { data: activeClients } = useQuery({
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

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingReceipt || !user) throw new Error("Invalid state");

      const gross = sanitizeMoney(parseFloat(editAmount));
      if (gross <= 0) throw new Error("L'importo deve essere positivo");

      const profitCoeff = sanitizeMoney(settings?.profit_coefficient) || 78;
      const taxRate = sanitizeMoney(settings?.tax_rate) || 15;
      const inpsRate = sanitizeMoney(settings?.inps_rate) || 26.07;

      const taxable = multiplyByPercent(gross, profitCoeff);
      const tax = multiplyByPercent(taxable, taxRate);
      const inps = multiplyByPercent(taxable, inpsRate);
      const netSpendable = subtractMoney(subtractMoney(gross, tax), inps);

      const oldFiscalYear = editingReceipt.fiscal_year;
      const newFiscalYear = editDate ? editDate.getFullYear() : editingReceipt.fiscal_year;

      // Bollo: importo fisso 2 € incluso nel gross se il flag e' attivo
      // (gross invariato al toggle, come per la rivalsa)
      const { bollo: bolloAmount, resto: grossSenzaBollo } = estraiBollo(
        gross,
        editBolloApplied
      );

      // Rivalsa: se attiva, ricaviamo la quota dal gross (4/104);
      // se l'utente disattiva il flag, azzeriamo l'importo (gross invariato).
      // ATTENZIONE: la formula 4/104 assume totale = compenso × 1.04, quindi
      // il bollo (fisso, non percentuale) va sottratto PRIMA dell'estrazione.
      const rivalsaAmount = editRivalsaApplied
        ? breakdownFromTotale(grossSenzaBollo).rivalsa
        : 0;

      // Story 86-1: risolve (o crea) il cliente e scrive client_id insieme a
      // client_name. Prima di questo fix l'update scriveva solo il nome: il
      // report clienti raggruppa per client_id, quindi l'incasso restava in
      // "Senza cliente" anche col nome compilato.
      const editClientId = await resolveClientId(user.id, editClientName);

      const { error } = await supabase
        .from("receipts")
        .update({
          receipt_date: editDate ? format(editDate, "yyyy-MM-dd") : editingReceipt.receipt_date,
          gross_amount: gross,
          client_id: editClientId,
          client_name: editClientName.trim() || null,
          notes: editNotes.trim() || null,
          taxable_amount: taxable,
          tax_amount: tax,
          inps_amount: inps,
          net_spendable: netSpendable,
          fiscal_year: newFiscalYear,
          service_category_id: editServiceCategoryId || null,
          rivalsa_inps_applied: editRivalsaApplied,
          rivalsa_inps_amount: rivalsaAmount,
          marca_bollo_applied: editBolloApplied,
          marca_bollo_amount: bolloAmount,
        })
        .eq("id", editingReceipt.id);

      if (error) throw error;

      return { oldFiscalYear, newFiscalYear };
    },
    onSuccess: async (data) => {
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
      // Story 86-1: il ranking clienti e il catalogo devono riflettere subito
      // la nuova associazione, altrimenti il fix sembra non aver funzionato.
      queryClient.invalidateQueries({ queryKey: ["client-revenue-report"] });
      queryClient.invalidateQueries({ queryKey: ["clients_active"] });
      setEditDialogOpen(false);
      setEditingReceipt(null);
      toast({ title: "Incasso aggiornato!" });

      // Regenerate tax_schedule for affected payment year(s)
      const paymentYears = new Set([data.oldFiscalYear + 1, data.newFiscalYear + 1]);
      for (const py of paymentYears) {
        try {
          await regenerateForPaymentYear(py);
        } catch (err) {
          console.warn(`[Incassi] Schedule regeneration for ${py} after update failed (non-blocking):`, err);
        }
      }
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile aggiornare l'incasso.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Capture fiscal_year before deleting so we can regenerate the schedule
      const receipt = receipts?.find((r) => r.id === id);
      const fiscalYear = receipt?.fiscal_year ?? parseInt(yearFilter);

      const { error } = await supabase.from("receipts").delete().eq("id", id);
      if (error) throw error;

      return { fiscalYear };
    },
    onSuccess: async (data) => {
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
      setDeleteDialogOpen(false);
      setDeletingReceiptId(null);
      toast({ title: "Incasso eliminato!" });

      // Regenerate tax_schedule for the payment year (fiscal_year + 1)
      const paymentYear = data.fiscalYear + 1;
      try {
        await regenerateForPaymentYear(paymentYear);
      } catch (err) {
        console.warn("[Incassi] Schedule regeneration after delete failed (non-blocking):", err);
      }
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile eliminare l'incasso.", variant: "destructive" });
    },
  });

  const openEditDialog = (receipt: ReceiptRow) => {
    setEditingReceipt(receipt);
    setEditDate(new Date(receipt.receipt_date + "T00:00:00"));
    setEditAmount(receipt.gross_amount.toString());
    setEditClientName(receipt.client_name || "");
    setEditNotes(receipt.notes || "");
    setEditServiceCategoryId(receipt.service_category_id ?? "");
    setEditRivalsaApplied(Boolean(receipt.rivalsa_inps_applied));
    setEditBolloApplied(Boolean(receipt.marca_bollo_applied));
    setEditDialogOpen(true);
  };

  const showRivalsaEdit = isGestioneSeparata(settings?.inps_type);
  // Toggle bollo visibile se l'importo supera la soglia normativa (77,47 €)
  // oppure se il flag e' gia' attivo (per poterlo disattivare)
  const showBolloEdit =
    editBolloApplied || isBolloDovuto(sanitizeMoney(parseFloat(editAmount)));

  const openDeleteDialog = (id: string) => {
    setDeletingReceiptId(id);
    setDeleteDialogOpen(true);
  };

  const filteredReceipts = receipts?.filter((receipt) => {
    if (categoryFilter && categoryFilter !== "all" && receipt.service_category_id !== categoryFilter) return false;
    if (!searchTerm.trim()) return true;
    const search = searchTerm.toLowerCase();
    return (
      receipt.client_name?.toLowerCase().includes(search) ||
      receipt.notes?.toLowerCase().includes(search)
    );
  });

  // Batch tagging tip: show if >50% of filtered receipts have no category
  const showCategorizeTip = !categorizeTipDismissed && activeCategories.length > 0 &&
    filteredReceipts && filteredReceipts.length > 0 &&
    filteredReceipts.filter((r) => !r.service_category_id).length > filteredReceipts.length * 0.5;

  // Righe eleggibili al retro-tag bollo (85-2): sopra soglia normativa
  // (77,47 €) e non ancora flaggate. Calcolate sulle righe visibili, così
  // nudge, pre-selezione CTA e batch operano sullo stesso insieme.
  const bolloEligibleReceipts = (filteredReceipts ?? []).filter(
    (r) => isBolloDovuto(sanitizeMoney(r.gross_amount)) && !r.marca_bollo_applied
  );
  const bolloEligibleSelectedIds = bolloEligibleReceipts
    .filter((r) => selectedReceiptIds.has(r.id))
    .map((r) => r.id);
  const bolloSkippedCount = selectedReceiptIds.size - bolloEligibleSelectedIds.length;
  const showBolloNudge = !bolloNudgeDismissed && bolloEligibleReceipts.length > 0;

  // Batch bollo: flagga le sole righe eleggibili selezionate.
  // gross_amount INVARIATO (stessa semantica del retro-toggle edit 85-1) e
  // NESSUN ricalcolo di rivalsa_inps_amount: la discrepanza max (~0,08 €/riga
  // sulla quota rivalsa salvata) si corregge al prossimo edit, dove la rivalsa
  // viene estratta da gross − 2 (vedi updateMutation). Update di massa della
  // rivalsa = rischio > beneficio.
  const handleBolloBatchApply = async () => {
    if (!user || bolloEligibleSelectedIds.length === 0) return;
    setBolloBatchPending(true);
    try {
      const { error } = await supabase
        .from("receipts")
        .update({
          marca_bollo_applied: true,
          marca_bollo_amount: MARCA_BOLLO_IMPORTO,
        })
        .in("id", bolloEligibleSelectedIds)
        .eq("user_id", user.id);
      if (error) throw error;
      // Solo receipts + bollo_total: il gross non cambia, nessun dato
      // fiscale (income_stats, receipts_ytd, ...) è toccato dal flag.
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      queryClient.invalidateQueries({ queryKey: ["bollo_total"] });
      toast({
        title: `Marca da bollo segnata su ${bolloEligibleSelectedIds.length} incass${bolloEligibleSelectedIds.length === 1 ? "o" : "i"}`,
      });
      setSelectedReceiptIds(new Set());
      setBolloBatchDialogOpen(false);
    } catch {
      toast({ title: "Errore", description: "Impossibile aggiornare gli incassi.", variant: "destructive" });
    } finally {
      setBolloBatchPending(false);
    }
  };

  const totalGross = filteredReceipts?.reduce((sum, r) => sum + sanitizeMoney(r.gross_amount), 0) || 0;

  // Installment plan handlers
  const handleViewPlanDetail = (plan: InstallmentPlanWithProgress) => {
    setSelectedPlan(plan);
    setPlanSheetOpen(true);
  };

  const handleRegisterPlanPayment = (plan: InstallmentPlanWithProgress) => {
    setPaymentPlan(plan);
    setPaymentDialogOpen(true);
  };

  const handleConfirmPlanPayment = (planId: string, deadlineId: string, importo: number, dataIncasso: Date, note?: string) => {
    const profitCoeff = sanitizeMoney(settings?.profit_coefficient) || 78;
    const taxRate = sanitizeMoney(settings?.tax_rate) || 15;
    const inpsRate = sanitizeMoney(settings?.inps_rate) || 26.07;

    registerPaymentMutation.mutate(
      {
        planId,
        deadlineId,
        importo,
        dataIncasso,
        note,
        profitCoefficient: profitCoeff,
        taxRate,
        inpsRate,
      },
      {
        onSuccess: () => {
          setPaymentDialogOpen(false);
          setPaymentPlan(null);
          toast({ title: `Pagamento di ${formatCurrency(sanitizeMoney(importo))} registrato` });
        },
        onError: (err) => {
          toast({ title: "Errore", description: err instanceof Error ? err.message : "Impossibile registrare il pagamento.", variant: "destructive" });
        },
      }
    );
  };

  const handleDeletePlan = (plan: InstallmentPlanWithProgress) => {
    setDeletingPlan(plan);
    setDeletePlanDialogOpen(true);
  };

  const confirmDeletePlan = () => {
    if (!deletingPlan) return;
    deletePlanMutation.mutate(deletingPlan.id, {
      onSuccess: () => {
        setDeletePlanDialogOpen(false);
        setDeletingPlan(null);
        toast({ title: "Piano rate eliminato" });
      },
      onError: (err) => {
        toast({ title: "Errore", description: err instanceof Error ? err.message : "Impossibile eliminare il piano.", variant: "destructive" });
      },
    });
  };

  const mobileRightAction = (
    <div className="flex items-center gap-1">
      {countTotal >= 1 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Altre azioni">
              <MoreVertical className="h-5 w-5" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canExport ? (
              <DropdownMenuItem
                onClick={handleExport}
                disabled={!isExportReady || isExporting}
              >
                {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                Esporta Excel
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem disabled>
                <Lock className="mr-2 h-4 w-4" />
                Esporta Excel (limite)
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {canImport ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            track("import_xml_click", { source: "incassi_page_mobile" });
            setImportDialogOpen(true);
          }}
        >
          <FileUp className="h-5 w-5 text-indigo-600" />
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          disabled
        >
          <Lock className="h-5 w-5 text-muted-foreground" />
        </Button>
      )}
      {canAddReceipt ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            track("add_income_click", { source: "incassi_page_mobile" });
            navigate("/incassi/nuovo");
          }}
        >
          <Plus className="h-5 w-5" />
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLimitDialogOpen(true)}
        >
          <Lock className="h-5 w-5 text-muted-foreground" />
        </Button>
      )}
    </div>
  );

  return (
    <AppLayout>
      <PageErrorBoundary>
      {isMobile && (
        <MobileHeader
          title="Incassi"
          rightAction={mobileRightAction}
        />
      )}
      <PageContainer>
        {/* Header - desktop only */}
        <div className="hidden md:flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Incassi</h1>
            <p className="text-muted-foreground">
              Registra i tuoi incassi e monitora lo spendibile
            </p>
          </div>
          <div className="flex items-center gap-2">
            {countTotal >= 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <MoreVertical className="h-4 w-4" />
                    Altro
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canExport ? (
                    <DropdownMenuItem
                      onClick={handleExport}
                      disabled={!isExportReady || isExporting}
                    >
                      {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                      Esporta Excel
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem disabled>
                      <Lock className="mr-2 h-4 w-4" />
                      Esporta Excel (limite)
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {canImport ? (
              <Button variant="outline" onClick={() => {
                track("import_xml_click", { source: "incassi_page" });
                setImportDialogOpen(true);
              }} className="gap-2 bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300">
                <FileUp className="h-4 w-4" />
                Importa XML
              </Button>
            ) : (
              <Button variant="outline" disabled className="gap-2 opacity-60">
                <Lock className="h-4 w-4" />
                Importa XML (limite)
              </Button>
            )}
            {canAddReceipt ? (
              <Button onClick={() => {
                track("add_income_click", { source: "incassi_page" });
                navigate("/incassi/nuovo");
              }} className="gap-2">
                <Plus className="h-4 w-4" />
                Nuovo Incasso
              </Button>
            ) : (
              <Button onClick={() => setLimitDialogOpen(true)} variant="outline" className="gap-2">
                <Lock className="h-4 w-4" />
                Nuovo Incasso
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 sm:flex-row">
              {countYear >= 5 ? (
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <label htmlFor="search-income" className="sr-only">Cerca per cliente o note</label>
                  <Input
                    id="search-income"
                    placeholder="Cerca per cliente o note..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
              ) : (
                <div className="flex-1 flex items-center">
                  <p className="text-sm text-muted-foreground">
                    Registra i tuoi incassi per calcolare tasse e spendibile.
                  </p>
                </div>
              )}
              {activeCategories.length > 0 && (
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-40" aria-label="Filtra per categoria servizio">
                    <SelectValue placeholder="Tutti i servizi" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutti i servizi</SelectItem>
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
              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger className="w-32" aria-label="Seleziona anno fiscale">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                Totale Incassi
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold tabular-nums">{formatCurrency(totalGross)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                Numero Incassi
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold tabular-nums">{filteredReceipts?.length || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                Media Incasso
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold tabular-nums">
                {formatCurrency(filteredReceipts?.length ? totalGross / filteredReceipts.length : 0)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Subscription Limits */}
        <ReceiptLimitBanner />
        {!canAddReceipt && !isPro && (
          <ProBanner
            triggerId="receipt-limit"
            title="Con PRO, incassi illimitati"
            description="Registra tutti i tuoi incassi senza limiti, tutto l'anno."
          />
        )}
        {!canImport && !isPro && (
          <ProBanner
            triggerId="import-limit"
            title="Hai raggiunto il limite di import XML"
            description="Con PRO, importa tutte le fatture XML che vuoi."
          />
        )}
        <UsageCounter />

        {/* Active Installment Plans */}
        {activePlans.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Incassi a rate in corso</CardTitle>
              <p className="text-sm text-slate-600">
                Ogni rata registrata aggiorna i tuoi calcoli fiscali.
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {activePlans.map((plan) => (
                <InstallmentPlanCard
                  key={plan.id}
                  plan={plan}
                  onViewDetail={handleViewPlanDetail}
                  onRegisterPayment={handleRegisterPlanPayment}
                  onEdit={handleViewPlanDetail}
                  onDelete={handleDeletePlan}
                />
              ))}
            </CardContent>
          </Card>
        )}

        {/* Batch toolbar — selezione indipendente dalle categorie (85-2) */}
        {selectedReceiptIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-teal-200 bg-teal-50/50 px-4 py-3">
            <span className="text-sm font-medium text-slate-700">
              {selectedReceiptIds.size} selezionat{selectedReceiptIds.size === 1 ? "o" : "i"}
            </span>
            {activeCategories.length > 0 && (
              <Button size="sm" onClick={() => setBatchDialogOpen(true)}>
                Assegna categoria
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setBolloBatchDialogOpen(true)}>
              Marca da bollo
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedReceiptIds(new Set())}>
              Deseleziona
            </Button>
          </div>
        )}

        {/* Categorize tip banner */}
        {showCategorizeTip && (
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
            <p className="text-sm text-slate-600">Categorizza i tuoi incassi per report più dettagliati</p>
            <Button variant="ghost" size="sm" onClick={() => setCategorizeTipDismissed(true)}>
              Chiudi
            </Button>
          </div>
        )}

        {/* Education banner: zero categories + enough receipts */}
        {!eduBannerDismissed && activeCategories.length === 0 && (receipts?.length ?? 0) >= 5 && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 rounded-lg bg-slate-50 px-4 py-3">
            <Tags className="h-5 w-5 text-slate-500 shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700">Organizza i tuoi incassi per tipo di servizio</p>
              <p className="text-sm text-slate-600">Scopri qual è il servizio che ti rende di più. Crea le tue categorie e taggali quando li registri.</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={() => navigate("/impostazioni?tab=categorie")}>
                Crea categorie
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDismissEduBanner} aria-label="Chiudi banner">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Nudge bollo one-shot (85-2): invita al retro-tag degli incassi storici */}
        {showBolloNudge && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 squircle-md bg-amber-50 border border-amber-200/60 px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-900">
                Hai {bolloEligibleReceipts.length} incass{bolloEligibleReceipts.length === 1 ? "o" : "i"} sopra 77,47 € senza marca da bollo. L'hai addebitata ai clienti?
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setSelectedReceiptIds(new Set(bolloEligibleReceipts.map((r) => r.id)))
                }
              >
                Rivedi e applica
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleDismissBolloNudge}
                aria-label="Chiudi avviso marca da bollo"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Receipts Table */}
        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="space-y-3 py-4" data-testid="skeleton-loading">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-20 ml-auto" />
                  </div>
                ))}
              </div>
            ) : filteredReceipts && filteredReceipts.length > 0 ? (
              <div className="overflow-x-auto">
              <Table>
                <TableCaption className="sr-only">Elenco incassi registrati</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={filteredReceipts.length > 0 && selectedReceiptIds.size === filteredReceipts.length}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedReceiptIds(new Set(filteredReceipts.map((r) => r.id)));
                          } else {
                            setSelectedReceiptIds(new Set());
                          }
                        }}
                        aria-label="Seleziona tutti gli incassi"
                      />
                    </TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    {activeCategories.length > 0 && (
                    <TableHead className="hidden md:table-cell">Servizio</TableHead>
                    )}
                    <TableHead className="text-right">Importo Lordo</TableHead>
                    <TableHead className="hidden md:table-cell">Ripartizione</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Netto dopo tasse e INPS</TableHead>
                    <TableHead className="hidden md:table-cell">Note</TableHead>
                    <TableHead className="w-10"><span className="sr-only">Azioni</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReceipts.map((receipt) => {
                    const cat = receipt.service_category_id ? categoriesById.get(receipt.service_category_id) : null;
                    return (
                    <TableRow key={receipt.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedReceiptIds.has(receipt.id)}
                          onCheckedChange={(checked) => {
                            setSelectedReceiptIds((prev) => {
                              const next = new Set(prev);
                              if (checked) next.add(receipt.id);
                              else next.delete(receipt.id);
                              return next;
                            });
                          }}
                          aria-label={`Seleziona incasso ${receipt.client_name || ""}`}
                        />
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm">
                        {new Date(receipt.receipt_date + "T00:00:00").toLocaleDateString("it-IT")}
                      </TableCell>
                      <TableCell className="font-medium text-xs sm:text-sm max-w-[120px] truncate">
                        {receipt.client_name || "-"}
                      </TableCell>
                      {activeCategories.length > 0 && (
                      <TableCell className="hidden md:table-cell">
                        {cat ? (
                          <span className="flex items-center gap-1.5 text-sm">
                            <span
                              className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: cat.color ?? "#94a3b8" }}
                            />
                            <span className="truncate max-w-[100px]">{cat.name}</span>
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </TableCell>
                      )}
                      <TableCell className="text-right text-xs sm:text-sm">
                        <div className="flex items-center justify-end gap-1.5">
                          <span>{formatCurrency(Number(receipt.gross_amount))}</span>
                          {receipt.rivalsa_inps_applied && (
                            <span
                              className="text-xs font-medium rounded px-1.5 py-0.5 bg-teal-50 text-teal-700 border border-teal-100"
                              title="Rivalsa INPS 4% applicata"
                            >
                              +4%
                            </span>
                          )}
                          {receipt.marca_bollo_applied && (
                            <span
                              className="text-xs font-medium rounded px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-100"
                              title="Marca da bollo 2 € addebitata al cliente"
                            >
                              +2€
                            </span>
                          )}
                        </div>
                        <div className="md:hidden mt-1">
                          <TaxSliceBar
                            grossAmount={receipt.gross_amount}
                            taxAmount={receipt.tax_amount}
                            inpsAmount={receipt.inps_amount}
                            netSpendable={receipt.net_spendable}
                            gestione={settings?.inps_management as TaxSliceBarProps["gestione"]}
                            compact
                          />
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <TaxSliceBar
                          grossAmount={receipt.gross_amount}
                          taxAmount={receipt.tax_amount}
                          inpsAmount={receipt.inps_amount}
                          netSpendable={receipt.net_spendable}
                          gestione={settings?.inps_management as TaxSliceBarProps["gestione"]}
                        />
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground hidden md:table-cell">
                        {receipt.net_spendable
                          ? formatCurrency(Number(receipt.net_spendable))
                          : "-"}
                      </TableCell>
                      <TableCell className="max-w-48 truncate text-muted-foreground hidden md:table-cell" title={receipt.notes || undefined}>
                        {receipt.notes || "-"}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={`Azioni per incasso di ${receipt.client_name || "sconosciuto"}`}>
                              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(receipt)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Modifica
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openDeleteDialog(receipt.id)}
                              className="text-destructive"
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Elimina
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            ) : searchTerm.trim() ? (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-3" data-testid="empty-search-state">
                <Search className="h-12 w-12 text-muted-foreground/50" aria-hidden="true" />
                <h2 className="mt-4 text-lg font-medium">Nessun risultato per «{searchTerm.trim()}»</h2>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Prova a modificare i termini di ricerca.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setSearchTerm("")}
                  className="gap-2"
                >
                  <Search className="h-4 w-4" />
                  Cancella ricerca
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-3" data-testid="empty-state">
                <Receipt className="h-12 w-12 text-muted-foreground/50" aria-hidden="true" />
                <h2 className="mt-4 text-lg font-medium">Nessun incasso registrato per quest'anno</h2>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Registra il primo incasso per vedere spendibile e accantonamenti in dashboard.
                </p>
                <Button
                  onClick={() => {
                    track("add_income_click", { source: "incassi_empty_state" });
                    navigate("/incassi/nuovo");
                  }}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Registra il primo incasso
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Receipt Dialog */}
        <Dialog
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            // Reset completo dei campi alla chiusura (igiene, evita stale state)
            if (!open) {
              setEditingReceipt(null);
              setEditDate(undefined);
              setEditAmount("");
              setEditClientName("");
              setEditNotes("");
              setEditServiceCategoryId("");
              setEditRivalsaApplied(false);
              setEditBolloApplied(false);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Modifica Incasso</DialogTitle>
              <DialogDescription>
                Modifica i dati dell'incasso selezionato.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Data</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !editDate && "text-muted-foreground"
                      )}
                      aria-label={editDate ? `Data incasso: ${format(editDate, "PPP", { locale: it })}` : "Seleziona data incasso"}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                      {editDate ? format(editDate, "PPP", { locale: it }) : "Seleziona data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={editDate}
                      onSelect={setEditDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-amount">Importo Lordo (€)</Label>
                <Input
                  id="edit-amount"
                  type="number"
                  step="0.01"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                />
                {(showRivalsaEdit || showBolloEdit) && (
                  <p className="text-xs text-slate-500">
                    Il totale fattura non cambia: i toggle sotto sono solo tracciamento.
                  </p>
                )}
              </div>
              {showRivalsaEdit && (
                <div className="flex items-start justify-between rounded-lg border p-3 gap-4">
                  <div className="space-y-0.5 min-w-0">
                    <Label htmlFor="edit-rivalsa" className="cursor-pointer">
                      Rivalsa INPS 4% applicata
                    </Label>
                    <p className="text-xs text-slate-600">
                      Attivalo se in fattura hai addebitato il 4% di rivalsa.
                    </p>
                  </div>
                  <Switch
                    id="edit-rivalsa"
                    checked={editRivalsaApplied}
                    onCheckedChange={setEditRivalsaApplied}
                  />
                </div>
              )}
              {showBolloEdit && (
                <div className="flex items-start justify-between rounded-lg border p-3 gap-4">
                  <div className="space-y-0.5 min-w-0">
                    <Label htmlFor="edit-bollo" className="cursor-pointer">
                      Marca da bollo (2 €) addebitata
                    </Label>
                    <p className="text-xs text-slate-600">
                      Attivalo se in fattura hai girato al cliente il bollo da 2 €.
                    </p>
                  </div>
                  <Switch
                    id="edit-bollo"
                    checked={editBolloApplied}
                    onCheckedChange={setEditBolloApplied}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="edit-client">Cliente</Label>
                <ClientCombobox
                  id="edit-client"
                  value={editClientName}
                  onChange={setEditClientName}
                  clients={activeClients}
                />
              </div>
              <div className="space-y-2">
                <Label>Categoria Servizio</Label>
                <Select value={editServiceCategoryId || "none"} onValueChange={(v) => setEditServiceCategoryId(v === "none" ? "" : v)}>
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
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-notes">Note</Label>
                <Textarea
                  id="edit-notes"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Annulla
              </Button>
              <Button
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending || !editAmount}
              >
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salva
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Import Dialog */}
        <ImportFattureDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          yearOverride={parseInt(yearFilter)}
        />

        {/* Delete Receipt Confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminare l'incasso?</AlertDialogTitle>
              <AlertDialogDescription>
                Questa azione non può essere annullata. L'incasso verrà eliminato permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deletingReceiptId && deleteMutation.mutate(deletingReceiptId)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Elimina
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Receipt Limit Dialog */}
        <ReceiptLimitDialog
          open={limitDialogOpen}
          onOpenChange={setLimitDialogOpen}
        />

        {/* Delete Plan Confirmation */}
        <AlertDialog open={deletePlanDialogOpen} onOpenChange={setDeletePlanDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminare il piano rate?</AlertDialogTitle>
              <AlertDialogDescription>
                Il piano rate{deletingPlan?.client_name ? ` per ${deletingPlan.client_name}` : ""} verrà eliminato permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeletePlan}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deletePlanMutation.isPending}
              >
                {deletePlanMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Elimina
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Batch Assign Category Dialog */}
        <Dialog open={batchDialogOpen} onOpenChange={setBatchDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assegna Categoria</DialogTitle>
              <DialogDescription>
                Assegna una categoria a {selectedReceiptIds.size} incass{selectedReceiptIds.size === 1 ? "o" : "i"} selezionat{selectedReceiptIds.size === 1 ? "o" : "i"}.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Select value={batchCategoryId} onValueChange={setBatchCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona categoria" />
                </SelectTrigger>
                <SelectContent>
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
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBatchDialogOpen(false)}>
                Annulla
              </Button>
              <Button
                disabled={!batchCategoryId}
                onClick={async () => {
                  if (!batchCategoryId || !user) return;
                  try {
                    const { error } = await supabase
                      .from("receipts")
                      .update({ service_category_id: batchCategoryId })
                      .in("id", [...selectedReceiptIds])
                      .eq("user_id", user.id);
                    if (error) throw error;
                    queryClient.invalidateQueries({ queryKey: ["receipts"] });
                    toast({ title: `Categoria assegnata a ${selectedReceiptIds.size} incassi` });
                    setSelectedReceiptIds(new Set());
                    setBatchDialogOpen(false);
                    setBatchCategoryId("");
                  } catch {
                    toast({ title: "Errore", description: "Impossibile assegnare la categoria.", variant: "destructive" });
                  }
                }}
              >
                Assegna
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Batch Marca da Bollo Dialog (85-2) */}
        <Dialog open={bolloBatchDialogOpen} onOpenChange={setBolloBatchDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Marca da bollo addebitata</DialogTitle>
              <DialogDescription>
                {bolloEligibleSelectedIds.length} di {selectedReceiptIds.size} incass
                {selectedReceiptIds.size === 1 ? "o" : "i"} selezionat
                {selectedReceiptIds.size === 1 ? "o" : "i"} verr
                {bolloEligibleSelectedIds.length === 1 ? "à aggiornato" : "anno aggiornati"}
                {bolloSkippedCount > 0 &&
                  `; ${bolloSkippedCount} saltat${bolloSkippedCount === 1 ? "o" : "i"} (sotto 77,47 € o già flaggat${bolloSkippedCount === 1 ? "o" : "i"})`}
                .
              </DialogDescription>
            </DialogHeader>
            <div className="py-2 space-y-2">
              <p className="text-sm text-slate-700">
                Il totale dei tuoi incassi non cambia: stai solo indicando che la marca
                da bollo da 2 € era inclusa in fattura. Nessun impatto su tasse o soglia.
              </p>
              <p className="text-sm text-slate-600">
                Puoi correggere ogni singolo incasso in qualsiasi momento da Modifica.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBolloBatchDialogOpen(false)}>
                Annulla
              </Button>
              <Button
                disabled={bolloEligibleSelectedIds.length === 0 || bolloBatchPending}
                onClick={handleBolloBatchApply}
              >
                {bolloBatchPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Applica
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Installment Plan Detail Sheet */}
        <InstallmentPlanSheet
          open={planSheetOpen}
          onOpenChange={setPlanSheetOpen}
          plan={selectedPlan}
          onRegisterPayment={(plan) => {
            setPlanSheetOpen(false);
            handleRegisterPlanPayment(plan);
          }}
        />

        {/* Register Installment Payment Dialog */}
        <RegisterPaymentDialog
          open={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
          plan={paymentPlan}
          onConfirm={handleConfirmPlanPayment}
          isPending={registerPaymentMutation.isPending}
        />
      </PageContainer>
      </PageErrorBoundary>
    </AppLayout>
  );
}
