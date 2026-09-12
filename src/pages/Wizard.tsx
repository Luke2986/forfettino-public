import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
// useUpdateProfile non più necessario — handleFinish usa upsert diretto
import { useFiscalRules } from "@/hooks/useFiscalRules";
import { useRegenerateSchedule } from "@/hooks/useRegenerateSchedule";
import { type GestioneINPS, getScadenzeFiscali } from "@/lib/fiscal-engine";
import { isValidManualCoefficient } from "@/lib/ateco-catalog";
import { AtecoCombobox } from "@/components/shared/AtecoCombobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { track, trackAnonymous, ANALYTICS_EVENTS } from "@/lib/analytics";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  ChevronRight,
  ChevronLeft,
  Check,
  User,
  FileText,
  Wallet,
  Calendar,
  CheckCircle,
  Info,
  Building2,
  ClipboardList,
  Percent,
  LogOut,
  BarChart3,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PageErrorBoundary } from "@/components/shared/PageErrorBoundary";
// Dialog rimosso — ATECO selector migrato a AtecoCombobox (Popover + Command)
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogContent, AlertDialogTitle,
  AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { useWizardDraft } from "@/hooks/useWizardDraft";
const VALID_GESTIONI: readonly GestioneINPS[] = ["separata", "artigiani", "commercianti"] as const;

/** Story 70-5: deterministic hash for A/B variant assignment */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

// Re-export from canonical source (src/lib/ateco-catalog.ts) — Story 2.5 review fix
export { isValidManualCoefficient } from "@/lib/ateco-catalog";

/** Runtime guard for GestioneINPS values from RadioGroup */
function isGestioneINPS(value: string): value is GestioneINPS {
  return (VALID_GESTIONI as readonly string[]).includes(value);
}

/** Maps GestioneINPS to legacy inps_type column values for backward compatibility */
export function mapGestioneToInpsType(gestione: GestioneINPS): string {
  const map: Record<GestioneINPS, string> = {
    separata: "gestione_separata",
    artigiani: "gestione_artigiani",
    commercianti: "gestione_commercianti",
  };
  return map[gestione];
}

/** Riduzione 35% scelta type and mapping — Story 2.4 */
export type Riduzione35Scelta = "si" | "no" | "non_lo_so";

const VALID_RIDUZIONE35: readonly Riduzione35Scelta[] = ["si", "no", "non_lo_so"] as const;

/** Runtime guard for Riduzione35Scelta values from RadioGroup */
function isRiduzione35Scelta(value: string): value is Riduzione35Scelta {
  return (VALID_RIDUZIONE35 as readonly string[]).includes(value);
}

/** Maps user choice to boolean value for DB storage. Only "si" → true. */
export function mapRiduzione35(scelta: Riduzione35Scelta): boolean {
  return scelta === "si";
}

// Import + re-export deriveAliquotaSostitutiva from canonical source (review fix M3)
import { deriveAliquotaSostitutiva } from "@/lib/fiscal-utils";
export { deriveAliquotaSostitutiva };

/**
 * Check if enrollment qualifies for the 50% INPS reduction (Legge Bilancio 2025, L. 207/2024 art. 1 co. 186-187).
 *
 * Requisiti normativi:
 * - Iscrizione alla gestione Art/Comm avvenuta NEL 2025 (anno specifico, non "dal 2025 in poi")
 * - Durata 36 mesi dall'iscrizione → copriamo per-fiscal-year interi [2025..2028]
 *
 * Chi si iscrive a gennaio 2025 perderebbe ~11 mesi di beneficio nel 2028 in modalità strict;
 * lo concediamo comunque per semplicità e coerenza col modello per-fiscal-year del sistema.
 */
export const RIDUZIONE_50_ENROLLMENT_YEAR = 2025;
export const RIDUZIONE_50_LAST_FISCAL_YEAR = 2028;

export function isEligibleRiduzione50(enrollmentYear: number | null, currentFiscalYear: number): boolean {
  if (enrollmentYear == null) return false;
  if (enrollmentYear !== RIDUZIONE_50_ENROLLMENT_YEAR) return false;
  return currentFiscalYear >= RIDUZIONE_50_ENROLLMENT_YEAR && currentFiscalYear <= RIDUZIONE_50_LAST_FISCAL_YEAR;
}

/** Compute riduzione 50% expiry date: end of (enrollmentYear + 3). Returns null if not eligible. */
export function computeRiduzione50Scadenza(enrollmentYear: number | null): string | null {
  if (enrollmentYear == null) return null;
  if (enrollmentYear !== RIDUZIONE_50_ENROLLMENT_YEAR) return null;
  return `${RIDUZIONE_50_LAST_FISCAL_YEAR}-12-31`;
}

interface WizardData {
  inpsManagement: GestioneINPS;
  firstName: string;
  lastName: string;
  taxRate: "5" | "15";
  profitCoefficient: number;
  inpsRate: number;
  inpsType: string; // Kept for backend compatibility — dual-write
  safetyBufferRate: number;
  deadlineWindowDays: number;
  bufferBase: "receipts" | "reserve";
  saldoInizialeCC: number;
  juneDueDate: string;
  novemberDueDate: string;
  // Story 27.3 — Date INPS Art/Comm
  inpsQ1DueDate: string;
  inpsQ2DueDate: string;
  inpsQ3DueDate: string;
  inpsQ4DueDate: string;
  // Story 2.3 — Anno Iscrizione e Riduzione 50%
  inpsEnrollmentYear: number | null;
  riduzione50Attiva: boolean;
  riduzione50Scadenza: string | null;
  // Story 2.4 — Riduzione 35%
  riduzione35Attiva: boolean;
  // Story 2.7 — Anno Apertura Partita IVA
  annoAperturaPiva: number | null;
  // Story 11.1 — Acconti già versati
  accontiResponse: "si" | "no" | "non_lo_so" | null;
  accontiImpostaVersati: number;
  accontiInpsEccedenzaVersati: number;
  // Catalogo ATECO completo
  atecoCode: string | null;
}

/** Step IDs — "gestione" + "annoIscrizione" + "riduzione35" + "acconti" (conditional) + original steps */
type StepId = "gestione" | "annoIscrizione" | "riduzione35" | "acconti" | "profilo" | "datiFiscali" | "prudenza" | "scadenze" | "conferma";

interface StepDef {
  id: StepId;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const ALL_STEPS: StepDef[] = [
  { id: "gestione", title: "Gestione INPS", icon: Building2 },
  { id: "annoIscrizione", title: "Anno e Iscrizione", icon: ClipboardList },
  { id: "riduzione35", title: "Riduzione contributiva", icon: Percent },
  { id: "acconti", title: "Acconti Versati", icon: FileText },
  { id: "profilo", title: "Profilo", icon: User },
  { id: "datiFiscali", title: "Dati Fiscali", icon: FileText },
  { id: "prudenza", title: "Saldo", icon: Wallet },
  { id: "scadenze", title: "Scadenze", icon: Calendar },
  { id: "conferma", title: "Conferma", icon: CheckCircle },
];

/** Validate enrollment year for annoIscrizione step — must be 2000..currentYear */
export function isValidEnrollmentYear(year: number | null, currentFiscalYear: number): boolean {
  return year != null && year >= 2000 && year <= currentFiscalYear;
}

/** Validate datiFiscali step — coefficient in range AND anno apertura P.IVA selected (Story 27.1) */
export function canProceedDatiFiscali(profitCoefficient: number, annoAperturaPiva: number | null): boolean {
  return profitCoefficient >= 40 && profitCoefficient <= 86 && annoAperturaPiva != null;
}

/** Return visible steps based on gestione and anno apertura — conditional steps hidden when not applicable */
export function getVisibleSteps(gestione: GestioneINPS, annoAperturaPiva?: number | null): StepDef[] {
  const currentYear = new Date().getFullYear();
  const isFirstYear = annoAperturaPiva == null || annoAperturaPiva >= currentYear;
  return ALL_STEPS.filter((s) => {
    if (s.id === "annoIscrizione" || s.id === "riduzione35") {
      return gestione !== "separata";
    }
    if (s.id === "acconti") {
      return !isFirstYear;
    }
    return true;
  });
}

/** Fallback INPS rates per gestione — used only when fiscal_rules hasn't loaded yet */
const INPS_RATE_FALLBACK: Record<GestioneINPS, number> = {
  separata: 26.07,
  artigiani: 24.00,
  commercianti: 24.48,
};

export default function WizardPage() {
  const currentYear = new Date().getFullYear();
  const paymentYear = currentYear + 1;

  const defaultScadenze = getScadenzeFiscali(paymentYear);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [analyticsOptIn, setAnalyticsOptIn] = useState(false);
  const [data, setData] = useState<WizardData>({
    inpsManagement: "separata",
    firstName: "",
    lastName: "",
    taxRate: "15",
    profitCoefficient: 78,
    inpsRate: 26.07,
    inpsType: "gestione_separata",
    safetyBufferRate: 5,
    deadlineWindowDays: 45,
    bufferBase: "receipts",
    saldoInizialeCC: 0,
    juneDueDate: defaultScadenze.taxGiugno,
    novemberDueDate: defaultScadenze.taxNovembre,
    // Story 27.3 — Date INPS Art/Comm (pre-compilate da normativa)
    inpsQ1DueDate: defaultScadenze.inpsFissoQ1,
    inpsQ2DueDate: defaultScadenze.inpsFissoQ2,
    inpsQ3DueDate: defaultScadenze.inpsFissoQ3,
    inpsQ4DueDate: defaultScadenze.inpsFissoQ4,
    // Story 2.3 — Anno Iscrizione e Riduzione 50%
    inpsEnrollmentYear: null,
    riduzione50Attiva: false,
    riduzione50Scadenza: null,
    // Story 2.4 — Riduzione 35%
    riduzione35Attiva: false,
    // Story 2.7 — Anno Apertura Partita IVA
    annoAperturaPiva: null,
    // Story 11.1 — Acconti già versati
    accontiResponse: null,
    accontiImpostaVersati: 0,
    accontiInpsEccedenzaVersati: 0,
    // Catalogo ATECO completo
    atecoCode: null,
  });

  // Load fiscal_rules for current year to get INPS rates per gestione (PRINCIPIO #0)
  const { data: fiscalRules, isLoading: fiscalRulesLoading } = useFiscalRules(currentYear);
  // Story 39-1: regenerate first-year INPS rates for Art/Comm
  const { regenerateForPaymentYear } = useRegenerateSchedule();

  // Visible steps — "annoIscrizione" is conditional: only for Art/Comm (Story 2.3)
  // useMemo: stable reference prevents useEffect re-fire on every render (Review 70-1 Fix #1)
  const visibleSteps = useMemo(
    () => getVisibleSteps(data.inpsManagement, data.annoAperturaPiva),
    [data.inpsManagement, data.annoAperturaPiva]
  );

  const currentStepId = visibleSteps[currentStepIndex]?.id;
  const totalSteps = visibleSteps.length;
  const isLastStep = currentStepIndex === totalSteps - 1;

  // Story 70-1 — Wizard analytics tracking refs
  const stepEnteredAtRef = useRef<number>(performance.now());
  const wizardStartedAtRef = useRef<number>(performance.now());
  const completedRef = useRef<boolean>(false);
  const lastStepIdRef = useRef<StepId | undefined>(currentStepId);
  const lastStepIndexRef = useRef<number>(currentStepIndex);
  const lastGestioneRef = useRef<GestioneINPS>(data.inpsManagement);
  const abandonedEmittedRef = useRef<boolean>(false); // Review Fix #2: guard double-fire

  // Story 70-5 — A/B variant state (effect after user declaration below)
  const [wizardVariant, setWizardVariant] = useState<string>("control");
  const wizardVariantRef = useRef<string>("control");
  const variantAssignedRef = useRef<boolean>(false);

  // Story 70-4 — Wizard draft save/resume
  const { draft, isLoading: draftLoading, saveDraft, clearDraft } = useWizardDraft();
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [draftHandled, setDraftHandled] = useState(false);
  const saveDraftTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup debounce timeout on unmount (M1 review fix)
  useEffect(() => {
    return () => {
      if (saveDraftTimeout.current) clearTimeout(saveDraftTimeout.current);
    };
  }, []);

  const STEP_LABELS: Record<string, string> = Object.fromEntries(
    ALL_STEPS.map((s) => [s.id, s.title])
  );

  // Show resume dialog when draft loads
  useEffect(() => {
    if (!draftLoading && draft && !draftHandled) {
      setShowResumeDialog(true);
    }
    if (!draftLoading && !draft && !draftHandled) {
      setDraftHandled(true);
    }
  }, [draft, draftLoading, draftHandled]);

  const handleResume = () => {
    if (!draft) return;
    // Preload data from draft, merging with defaults for schema evolution safety (M2 review fix)
    const draftData = draft.data as unknown as Partial<WizardData>;
    setData((prev) => ({ ...prev, ...draftData }));
    // Compute visibleSteps from DRAFT data, not current default state (H1 review fix)
    const mergedGestione = (draftData.inpsManagement as GestioneINPS) ?? data.inpsManagement;
    const mergedAnno = draftData.annoAperturaPiva ?? data.annoAperturaPiva;
    const draftVisibleSteps = getVisibleSteps(mergedGestione, mergedAnno);
    const draftVisibleIds = draftVisibleSteps.map((s) => s.id);
    const draftVisibleMatch =
      draft.visibleSteps.length === draftVisibleIds.length &&
      draft.visibleSteps.every((id, i) => id === draftVisibleIds[i]);
    if (draftVisibleMatch && draft.currentStepIndex < draftVisibleSteps.length) {
      setCurrentStepIndex(draft.currentStepIndex);
    } else {
      // visibleSteps diverged — reset to step 0 with preloaded data
      setCurrentStepIndex(0);
    }
    track("wizard_draft_resumed", {
      step_index: draft.currentStepIndex,
      days_since_last_update: Math.floor(
        (Date.now() - new Date(draft.updatedAt).getTime()) / 86400000
      ),
      variant: wizardVariant,
    });
    setShowResumeDialog(false);
    setDraftHandled(true);
  };

  const handleDiscard = () => {
    if (draft) {
      track("wizard_draft_discarded", { step_index: draft.currentStepIndex, variant: wizardVariant });
    }
    clearDraft().catch(() => {});
    setShowResumeDialog(false);
    setDraftHandled(true);
  };

  // AC1: emit wizard_step_entered on every step change (including first mount)
  // H2 review fix: skip tracking until draft decision is handled to avoid spurious step 0 event
  useEffect(() => {
    if (!draftHandled) return;
    const stepId = visibleSteps[currentStepIndex]?.id;
    if (!stepId) return;
    track("wizard_step_entered", {
      step_id: stepId,
      step_index: currentStepIndex,
      gestione: data.inpsManagement,
      total_visible_steps: visibleSteps.length,
      variant: wizardVariantRef.current,
    });
    stepEnteredAtRef.current = performance.now();
    lastStepIdRef.current = stepId;
    lastStepIndexRef.current = currentStepIndex;
    lastGestioneRef.current = data.inpsManagement;
  }, [currentStepIndex, visibleSteps, data.inpsManagement, draftHandled]);

  // AC4: emit wizard_abandoned on unmount or beforeunload (if not completed)
  useEffect(() => {
    const emitAbandoned = () => {
      if (completedRef.current || abandonedEmittedRef.current) return;
      abandonedEmittedRef.current = true;
      track("wizard_abandoned", {
        last_step_id: lastStepIdRef.current,
        last_step_index: lastStepIndexRef.current,
        total_time_seconds: Math.round((performance.now() - wizardStartedAtRef.current) / 1000),
        gestione: lastGestioneRef.current,
        variant: wizardVariantRef.current,
      });
    };
    window.addEventListener("beforeunload", emitAbandoned);
    return () => {
      window.removeEventListener("beforeunload", emitAbandoned);
      emitAbandoned();
    };
  }, []);

  // AC2: handler that emits wizard_step_completed then advances
  const handleAdvance = () => {
    track("wizard_step_completed", {
      step_id: currentStepId,
      step_index: currentStepIndex,
      gestione: data.inpsManagement,
      time_spent_seconds: Math.max(
        0,
        Math.round((performance.now() - stepEnteredAtRef.current) / 1000)
      ),
      variant: wizardVariant,
    });
    const newStepIndex = currentStepIndex + 1;
    setCurrentStepIndex(newStepIndex);

    // Story 70-4: auto-save draft debounced 500ms
    if (saveDraftTimeout.current) clearTimeout(saveDraftTimeout.current);
    saveDraftTimeout.current = setTimeout(() => {
      saveDraft({
        wizardData: data as unknown as Record<string, unknown>,
        stepIndex: newStepIndex,
        visibleSteps: visibleSteps.map((s) => s.id),
      });
    }, 500);
  };

  // AC3: handler that emits wizard_step_back then decrements
  const handleBack = () => {
    track("wizard_step_back", {
      from_step_id: currentStepId,
      from_step_index: currentStepIndex,
      to_step_id: visibleSteps[currentStepIndex - 1]?.id,
      to_step_index: currentStepIndex - 1,
      gestione: data.inpsManagement,
      variant: wizardVariant,
    });
    setCurrentStepIndex((s) => s - 1);
  };

  // Manual ATECO mode (for display label in AtecoCombobox)
  const [manualAtecoMode, setManualAtecoMode] = useState(false);

  // Story 2.4 — track which radio option user picked (for "Non lo so" info text)
  const [riduzione35Scelta, setRiduzione35Scelta] = useState<Riduzione35Scelta | null>(null);

  // Unified anno step — "L'iscrizione INPS è avvenuta nello stesso anno?"
  const [stessoAnnoIscrizione, setStessoAnnoIscrizione] = useState<boolean>(true);

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Story 70-5 — A/B variant assignment (must be after user declaration)
  useEffect(() => {
    if (!user || variantAssignedRef.current) return;
    variantAssignedRef.current = true;

    const assignVariant = async () => {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("wizard_variant")
          .eq("user_id", user.id)
          .single();
        if ((profile as any)?.wizard_variant) {
          setWizardVariant((profile as any).wizard_variant);
          wizardVariantRef.current = (profile as any).wizard_variant;
        } else {
          const variant = hashCode(user.id) % 2 === 0 ? "control" : "short";
          setWizardVariant(variant);
          wizardVariantRef.current = variant;
          // Fire-and-forget — graceful degradation if write fails
          await supabase
            .from("profiles")
            .update({ wizard_variant: variant } as any)
            .eq("user_id", user.id);
        }
      } catch {
        // Graceful degradation
      }
    };
    assignVariant();
  }, [user]);

  // ATECO handlers — catalogo completo statico (no Supabase query)
  const handleAtecoSelect = (code: string, coefficient: number) => {
    updateData({ profitCoefficient: coefficient, atecoCode: code });
    setManualAtecoMode(false);
  };

  const handleAtecoManualEntry = (code: string, coefficient: number) => {
    updateData({ profitCoefficient: coefficient, atecoCode: code || null });
    setManualAtecoMode(true);
  };

  const updateData = (updates: Partial<WizardData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  };

  /** Update INPS rate from fiscal_rules when gestione changes */
  const handleGestioneChange = (gestione: GestioneINPS) => {
    let inpsRate: number;
    if (fiscalRules) {
      switch (gestione) {
        case "separata":
          inpsRate = fiscalRules.inps_rate_separata;
          break;
        case "artigiani":
          inpsRate = fiscalRules.inps_rate_artigiani;
          break;
        case "commercianti":
          inpsRate = fiscalRules.inps_rate_commercianti;
          break;
      }
    } else {
      inpsRate = INPS_RATE_FALLBACK[gestione];
    }
    const resetRiduzione = gestione === "separata";
    // Story 27.3: sync default due dates when gestione changes.
    // Tutte le gestioni usano le date del motore (proroga forfettari + slittamento
    // working-day inclusi): il termine di giugno può slittare a luglio per proroga.
    const dateUpdates = { juneDueDate: defaultScadenze.taxGiugno, novemberDueDate: defaultScadenze.taxNovembre };
    updateData({
      inpsManagement: gestione,
      inpsType: mapGestioneToInpsType(gestione),
      inpsRate,
      ...dateUpdates,
      // Reset anno apertura (asked in different step depending on gestione)
      annoAperturaPiva: null,
      // Reset anno iscrizione, riduzione 50% & riduzione 35% when switching to Separata
      ...(resetRiduzione && {
        inpsEnrollmentYear: null,
        riduzione50Attiva: false,
        riduzione50Scadenza: null,
        riduzione35Attiva: false,
      }),
    });
    // Always reset riduzione35 radio state and anno unification when gestione changes
    setRiduzione35Scelta(null);
    setStessoAnnoIscrizione(true);
    // Reset to step 0 (gestione) to avoid index out-of-bounds when step count changes
    setCurrentStepIndex(0);
  };

  // Sync INPS rate when fiscalRules loads (covers case where user selected gestione before data arrived)
  // NOTE: Only update the rate — do NOT call handleGestioneChange which resets currentStepIndex to 0
  useEffect(() => {
    if (fiscalRules) {
      const rateMap: Record<GestioneINPS, number> = {
        separata: fiscalRules.inps_rate_separata,
        artigiani: fiscalRules.inps_rate_artigiani,
        commercianti: fiscalRules.inps_rate_commercianti,
      };
      updateData({ inpsRate: rateMap[data.inpsManagement] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when fiscalRules becomes available
  }, [fiscalRules]);

  // Anno Iscrizione step — computed values (avoids IIFE in JSX)
  const enrollmentEligible = isEligibleRiduzione50(data.inpsEnrollmentYear, currentYear);
  const hasSelectedEnrollmentYear = data.inpsEnrollmentYear != null;
  const enrollmentYearOptions: number[] = [];
  for (let y = currentYear; y >= currentYear - 20; y--) {
    enrollmentYearOptions.push(y);
  }

  // Story 2.7 — Derivazione aliquota sostitutiva
  const annoAperturaPivaOptions: number[] = [];
  for (let y = currentYear; y >= 1990; y--) {
    annoAperturaPivaOptions.push(y);
  }
  const derivazioneAliquota = deriveAliquotaSostitutiva(data.annoAperturaPiva, currentYear);
  const isAliquotaOverride = derivazioneAliquota != null && data.taxRate !== derivazioneAliquota.aliquota.toString();

  const canProceed = () => {
    switch (currentStepId) {
      case "gestione":
        return true; // Always has a default selection
      case "annoIscrizione":
        // Both anno apertura P.IVA and anno iscrizione INPS are required (unified step)
        return data.annoAperturaPiva != null && isValidEnrollmentYear(data.inpsEnrollmentYear, currentYear);
      case "riduzione35":
        return true; // All 3 options are valid — never blocks (AC #5)
      case "acconti":
        return true; // Always valid — fields are optional (Story 11.1)
      case "profilo":
        return data.firstName.trim().length > 0;
      case "datiFiscali":
        return canProceedDatiFiscali(data.profitCoefficient, data.annoAperturaPiva);
      case "prudenza":
        return true;
      case "scadenze":
        if (data.inpsManagement === "separata") {
          return !!(data.juneDueDate && data.novemberDueDate);
        }
        // Art/Comm: all 6 dates required (pre-filled with defaults)
        return !!(data.juneDueDate && data.novemberDueDate && data.inpsQ1DueDate && data.inpsQ2DueDate && data.inpsQ3DueDate && data.inpsQ4DueDate);
      case "conferma":
        return true;
      default:
        return false;
    }
  };

  const handleFinish = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Upsert profile — resiliente se il profilo non esiste ancora
      // (il trigger trg_set_user_code genera user_code automaticamente su INSERT)
      // select().single() per ottenere il profilo aggiornato e iniettarlo nella cache React Query
      // Story 35.3: include analytics consent if opted in
      const profilePayload = {
        user_id: user.id,
        user_code: `U-${user.id.slice(0, 6).toUpperCase()}`,
        first_name: data.firstName.trim(),
        last_name: data.lastName.trim() || null,
        onboarding_completed: true,
        ...(analyticsOptIn ? {
          analytics_consent: true,
          analytics_consent_at: new Date().toISOString(),
        } : {}),
      };
      const { data: savedProfile, error: profileError } = await supabase.from("profiles").upsert(
        [profilePayload],
        { onConflict: "user_id" }
      ).select().single();
      if (profileError) throw profileError;

      // Create fiscal year settings — dual-write inps_management + inps_type for backward compat
      const { error: settingsError } = await supabase.from("fiscal_year_settings").upsert({
        user_id: user.id,
        fiscal_year: currentYear,
        tax_rate: parseFloat(data.taxRate),
        profit_coefficient: data.profitCoefficient,
        ateco_code: data.atecoCode,
        inps_management: data.inpsManagement,
        inps_type: data.inpsType,
        inps_rate: data.inpsRate,
        safety_buffer_rate: data.safetyBufferRate,
        saldo_iniziale_cc: data.saldoInizialeCC,
        deadline_window_days: data.deadlineWindowDays,
        buffer_base: data.bufferBase,
        // Story 2.3 — Anno Iscrizione e Riduzione 50%
        inps_enrollment_year: data.inpsEnrollmentYear,
        riduzione_50_attiva: data.riduzione50Attiva,
        riduzione_50_scadenza: data.riduzione50Scadenza,
        // Story 2.4 — Riduzione 35%
        riduzione_35_attiva: data.riduzione35Attiva,
        // Story 2.7 — Anno Apertura Partita IVA
        anno_apertura_piva: data.annoAperturaPiva,
        // Story 11.1 — Acconti già versati
        acconti_imposta_versati: data.accontiImpostaVersati,
        acconti_inps_eccedenza_versati: data.accontiInpsEccedenzaVersati,
      });

      if (settingsError) throw settingsError;

      // Propagate structural fields to near-future years [currentYear+1..currentYear+3]
      // Garantisce che la Dashboard per anni successivi (rollover capodanno) trovi
      // settings coerenti senza richiedere azione manuale da parte dell'utente.
      // Enforcement scadenza rid50 per-anno: la riduzione 50% viene creata attiva solo
      // se l'anno rientra nella finestra [2025..2028] e l'enrollment è nel 2025.
      const futureYearsFromWizard = [currentYear + 1, currentYear + 2, currentYear + 3];
      const propagationErrorsWizard: string[] = [];
      for (const fy of futureYearsFromWizard) {
        const rid50EligibleForYear = data.riduzione50Attiva
          && data.inpsEnrollmentYear != null
          && isEligibleRiduzione50(data.inpsEnrollmentYear, fy);
        const { error: futureInsertError } = await supabase
          .from("fiscal_year_settings")
          .upsert({
            user_id: user.id,
            fiscal_year: fy,
            tax_rate: parseFloat(data.taxRate),
            profit_coefficient: data.profitCoefficient,
            ateco_code: data.atecoCode,
            inps_management: data.inpsManagement,
            inps_type: data.inpsType,
            inps_rate: data.inpsRate,
            safety_buffer_rate: data.safetyBufferRate,
            saldo_iniziale_cc: 0,
            deadline_window_days: data.deadlineWindowDays,
            buffer_base: data.bufferBase,
            inps_enrollment_year: data.inpsEnrollmentYear,
            riduzione_50_attiva: rid50EligibleForYear,
            riduzione_50_scadenza: rid50EligibleForYear ? data.riduzione50Scadenza : null,
            riduzione_35_attiva: data.riduzione35Attiva,
            anno_apertura_piva: data.annoAperturaPiva,
            acconti_imposta_versati: 0,
            acconti_inps_eccedenza_versati: 0,
          }, { onConflict: "user_id,fiscal_year", ignoreDuplicates: true });
        if (futureInsertError) propagationErrorsWizard.push(`${fy}: ${futureInsertError.message}`);
      }
      if (propagationErrorsWizard.length > 0) {
        console.warn("[Wizard] Future-year propagation warnings:", propagationErrorsWizard);
      }

      // Auto-generate tax_schedule entries for payment_year
      // Story 27.3: differentiate buckets by gestione INPS
      const scheduleEntries: Array<{ bucket: string; due_date: string }> = [];

      if (data.inpsManagement === "separata") {
        // Gestione Separata: 2 buckets (june + november)
        scheduleEntries.push(
          { bucket: "june", due_date: data.juneDueDate },
          { bucket: "november", due_date: data.novemberDueDate },
        );
      } else {
        // Artigiani/Commercianti: 6 buckets (4 INPS fisso + june tax/variabile + november tax)
        // Uses user-editable dates (pre-filled with defaults from getScadenzeFiscali)
        scheduleEntries.push(
          { bucket: "inps_q1", due_date: data.inpsQ1DueDate },
          { bucket: "inps_q2", due_date: data.inpsQ2DueDate },
          { bucket: "june", due_date: data.juneDueDate },
          { bucket: "inps_q3", due_date: data.inpsQ3DueDate },
          { bucket: "inps_q4", due_date: data.inpsQ4DueDate },
          { bucket: "november", due_date: data.novemberDueDate },
        );
      }

      for (const entry of scheduleEntries) {
        const { error: schedError } = await supabase.from("tax_schedule").upsert(
          {
            user_id: user.id,
            payment_year: paymentYear,
            reference_year: currentYear,
            bucket: entry.bucket,
            due_date: entry.due_date,
            tax_balance: 0,
            tax_advance: 0,
            inps_balance: 0,
            inps_advance: 0,
            total_expected: 0,
            total_paid: 0,
            status: "open",
          },
          {
            onConflict: "user_id,payment_year,bucket",
            ignoreDuplicates: false,
          },
        );

        if (schedError && !schedError.message.includes("duplicate")) {
          console.error(`Schedule error (${entry.bucket}):`, schedError);
        }
      }

      // Story 39-1: Generate first-year INPS quarterly rates for Art/Comm
      // Fire-and-forget: if it fails, rates will be generated on first Scadenziario visit
      const isFirstYearArtComm =
        (data.inpsManagement === "artigiani" || data.inpsManagement === "commercianti") &&
        data.annoAperturaPiva != null &&
        data.annoAperturaPiva >= currentYear;
      if (isFirstYearArtComm) {
        regenerateForPaymentYear(currentYear).catch((err) =>
          console.error("[Wizard] First-year INPS regen failed (non-blocking):", err)
        );
      }

      // Sincronizza la cache React Query con il profilo appena salvato
      // per evitare che ProtectedRoute veda stato stale e rimandi al wizard
      queryClient.setQueryData(["profile", user.id], savedProfile);

      // Fix funnel: l'ultimo step ("conferma") non passa da handleAdvance,
      // quindi wizard_step_completed va emesso esplicitamente qui.
      track("wizard_step_completed", {
        step_id: currentStepId,
        step_index: currentStepIndex,
        gestione: data.inpsManagement,
        time_spent_seconds: Math.max(
          0,
          Math.round((performance.now() - stepEnteredAtRef.current) / 1000)
        ),
        variant: wizardVariant,
      });

      // AC5: wizard_completed — track before legacy events and mark completedRef
      track("wizard_completed", {
        total_steps_shown: visibleSteps.length,
        total_time_seconds: Math.round((performance.now() - wizardStartedAtRef.current) / 1000),
        gestione: data.inpsManagement,
        piva_first_year: data.annoAperturaPiva != null && data.annoAperturaPiva >= currentYear,
        variant: wizardVariant,
      });
      completedRef.current = true;

      // `signup_completed` viveva qui: emesso subito dopo `wizard_completed`,
      // senza proprieta', quindi un duplicato esatto (su PostHog i due eventi
      // avevano conteggi e timestamp identici) che faceva sembrare la
      // registrazione un secondo step del funnel. La registrazione vera si
      // misura su persons.created_at / profiles.created_at, non da qui: al
      // momento della signup l'utente non e' ancora autenticato e track()
      // scarterebbe l'evento.
      trackAnonymous(ANALYTICS_EVENTS.ONBOARDING_COMPLETATO);

      // Story 70-4: cleanup draft after successful completion (fire-and-forget)
      clearDraft().catch(() => {});

      toast({
        title: "Configurazione completata!",
        description: "Benvenuto in Forfettino. Iniziamo!",
      });

      navigate("/dashboard", { replace: true });
    } catch (error) {
      console.error("Wizard error:", error);
      toast({
        title: "Errore",
        description: "Impossibile salvare la configurazione. Riprova.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageErrorBoundary>
    {/* Story 70-4: Resume Dialog */}
    <AlertDialog open={showResumeDialog}>
      <AlertDialogContent>
        <AlertDialogTitle>Riprendi il wizard</AlertDialogTitle>
        <AlertDialogDescription asChild>
          <div>
            Hai un wizard in corso. Ultimo step:{" "}
            <strong>
              {draft
                ? STEP_LABELS[draft.visibleSteps[draft.currentStepIndex] ?? ""] ?? "Sconosciuto"
                : ""}
            </strong>
            . Ultimo aggiornamento:{" "}
            <strong>
              {draft
                ? formatDistanceToNow(new Date(draft.updatedAt), {
                    addSuffix: true,
                    locale: it,
                  })
                : ""}
            </strong>
            .
          </div>
        </AlertDialogDescription>
        <div className="flex justify-end gap-3 mt-4">
          <AlertDialogCancel onClick={handleDiscard}>Ricomincia</AlertDialogCancel>
          <AlertDialogAction onClick={handleResume}>Riprendi</AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="sr-only">Configurazione iniziale</h1>
        {/* Progress Steps */}
        <div className="mb-8">
          {/* Icone + connettori: occupano l'intera larghezza in modo uniforme */}
          <div className="flex items-center">
            {visibleSteps.map((step, index) => (
              <div key={step.id} className={cn("flex items-center", index < visibleSteps.length - 1 && "flex-1")}>
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors shrink-0",
                    currentStepIndex === index
                      ? "border-primary bg-primary text-primary-foreground"
                      : currentStepIndex > index
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-muted-foreground/30 text-muted-foreground",
                  )}
                  title={step.title}
                  aria-label={step.title}
                >
                  {currentStepIndex > index ? <Check className="h-5 w-5" /> : <step.icon className="h-5 w-5" />}
                </div>
                {index < visibleSteps.length - 1 && (
                  <div
                    className={cn(
                      "mx-2 h-0.5 flex-1 transition-colors",
                      currentStepIndex > index ? "bg-primary" : "bg-muted-foreground/30",
                    )}
                  />
                )}
              </div>
            ))}
          </div>
          {/* Label: solo step corrente, formato "Step N di M · Titolo" — evita accalcamento */}
          <div className="mt-3 text-center">
            <span className="text-sm font-medium text-primary">
              Step {currentStepIndex + 1} di {visibleSteps.length} · {visibleSteps[currentStepIndex]?.title}
            </span>
          </div>
        </div>

        {/* Step Content */}
        <Card className="border-0 shadow-lg">
          {currentStepId === "gestione" && (
            <>
              <CardHeader>
                <CardTitle>Qual è la tua gestione INPS?</CardTitle>
                <CardDescription>
                  Seleziona la gestione previdenziale a cui sei iscritto. Determina come vengono calcolati i tuoi contributi.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={data.inpsManagement}
                  onValueChange={(v) => { if (isGestioneINPS(v)) handleGestioneChange(v); }}
                  className="space-y-4"
                  aria-label="Seleziona la tua gestione INPS"
                >
                  <div className="flex items-start space-x-3 rounded-lg border p-4 hover:bg-accent/50 transition-colors">
                    <RadioGroupItem value="separata" id="gestione-separata" className="mt-0.5" />
                    <div>
                      <Label htmlFor="gestione-separata" className="cursor-pointer font-medium text-base">
                        Gestione Separata
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Per professionisti senza cassa previdenziale (sviluppatori, consulenti, designer...)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 rounded-lg border p-4 hover:bg-accent/50 transition-colors">
                    <RadioGroupItem value="artigiani" id="gestione-artigiani" className="mt-0.5" />
                    <div>
                      <Label htmlFor="gestione-artigiani" className="cursor-pointer font-medium text-base">
                        Artigiani
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Per chi svolge attività artigianale (parrucchieri, elettricisti, idraulici...)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 rounded-lg border p-4 hover:bg-accent/50 transition-colors">
                    <RadioGroupItem value="commercianti" id="gestione-commercianti" className="mt-0.5" />
                    <div>
                      <Label htmlFor="gestione-commercianti" className="cursor-pointer font-medium text-base">
                        Commercianti
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Per chi svolge attività commerciale (e-commerce, negozi, agenti di commercio...)
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </CardContent>
            </>
          )}

          {currentStepId === "annoIscrizione" && (
            <>
              <CardHeader>
                <CardTitle>Anno Apertura e Iscrizione INPS</CardTitle>
                <CardDescription>
                  Inserisci l'anno di apertura della tua partita IVA e di iscrizione alla gestione INPS.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 1. Anno apertura P.IVA (unified — moved from datiFiscali for Art/Comm) */}
                <div className="space-y-2">
                  <Label htmlFor="anno-apertura-piva-step2">Anno apertura Partita IVA *</Label>
                  <Select
                    value={data.annoAperturaPiva?.toString() ?? ""}
                    onValueChange={(v) => {
                      const anno = parseInt(v, 10);
                      if (isNaN(anno)) return;
                      const derivazione = deriveAliquotaSostitutiva(anno, currentYear);
                      const baseUpdate: Partial<WizardData> = {
                        annoAperturaPiva: anno,
                        ...(derivazione ? { taxRate: derivazione.aliquota.toString() as "5" | "15" } : {}),
                      };
                      // If "same year" is selected, auto-sync enrollment year
                      if (stessoAnnoIscrizione) {
                        const newEligible = isEligibleRiduzione50(anno, currentYear);
                        baseUpdate.inpsEnrollmentYear = anno;
                        baseUpdate.riduzione50Attiva = newEligible;
                        baseUpdate.riduzione50Scadenza = newEligible ? computeRiduzione50Scadenza(anno) : null;
                        if (newEligible) baseUpdate.riduzione35Attiva = false;
                      }
                      updateData(baseUpdate);
                    }}
                  >
                    <SelectTrigger id="anno-apertura-piva-step2" aria-label="Anno di apertura della partita IVA">
                      <SelectValue placeholder="Seleziona l'anno" />
                    </SelectTrigger>
                    <SelectContent>
                      {annoAperturaPivaOptions.map((y) => (
                        <SelectItem key={y} value={y.toString()}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 2. "Same year?" radio — only after P.IVA year is selected */}
                {data.annoAperturaPiva != null && (
                  <div className="space-y-2">
                    <Label>L'iscrizione INPS è avvenuta nello stesso anno?</Label>
                    <RadioGroup
                      value={stessoAnnoIscrizione ? "si" : "no"}
                      onValueChange={(v) => {
                        const isSameYear = v === "si";
                        setStessoAnnoIscrizione(isSameYear);
                        if (isSameYear && data.annoAperturaPiva != null) {
                          const newEligible = isEligibleRiduzione50(data.annoAperturaPiva, currentYear);
                          updateData({
                            inpsEnrollmentYear: data.annoAperturaPiva,
                            riduzione50Attiva: newEligible,
                            riduzione50Scadenza: newEligible ? computeRiduzione50Scadenza(data.annoAperturaPiva) : null,
                            ...(newEligible ? { riduzione35Attiva: false } : {}),
                          });
                        } else {
                          updateData({
                            inpsEnrollmentYear: null,
                            riduzione50Attiva: false,
                            riduzione50Scadenza: null,
                          });
                        }
                      }}
                      className="flex gap-4"
                      aria-label="L'iscrizione INPS è avvenuta nello stesso anno della P.IVA?"
                    >
                      <div className="flex items-center space-x-2 min-h-[44px]">
                        <RadioGroupItem value="si" id="stesso-anno-si" />
                        <Label htmlFor="stesso-anno-si" className="cursor-pointer">Sì, stesso anno ({data.annoAperturaPiva})</Label>
                      </div>
                      <div className="flex items-center space-x-2 min-h-[44px]">
                        <RadioGroupItem value="no" id="stesso-anno-no" />
                        <Label htmlFor="stesso-anno-no" className="cursor-pointer">No, anno diverso</Label>
                      </div>
                    </RadioGroup>
                  </div>
                )}

                {/* 3. Enrollment year selector — only if different year */}
                {data.annoAperturaPiva != null && !stessoAnnoIscrizione && (
                  <div className="space-y-2">
                    <Label htmlFor="enrollment-year">Anno di iscrizione INPS *</Label>
                    <Select
                      value={data.inpsEnrollmentYear?.toString() ?? ""}
                      onValueChange={(v) => {
                        const year = parseInt(v, 10);
                        if (!isNaN(year) && year >= 2000 && year <= currentYear) {
                          const newEligible = isEligibleRiduzione50(year, currentYear);
                          updateData({
                            inpsEnrollmentYear: year,
                            riduzione50Attiva: newEligible,
                            riduzione50Scadenza: newEligible ? computeRiduzione50Scadenza(year) : null,
                            ...(newEligible ? { riduzione35Attiva: false } : {}),
                          });
                        }
                      }}
                    >
                      <SelectTrigger id="enrollment-year" aria-label="Anno di iscrizione alla gestione INPS">
                        <SelectValue placeholder="Seleziona l'anno di iscrizione" />
                      </SelectTrigger>
                      <SelectContent>
                        {enrollmentYearOptions.map((y) => (
                          <SelectItem key={y} value={y.toString()}>
                            {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div id="riduzione50-info" className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help shrink-0" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>La riduzione 50% è riservata a chi si iscrive alla gestione artigiani/commercianti nel 2025 (Legge Bilancio 2025). Vale per i successivi 36 mesi.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <span>Serve per la riduzione 50% contributi.</span>
                    </div>
                  </div>
                )}

                {/* Info leggera: l'eleggibilità vera si attiva al prossimo step "Riduzione contributiva". */}
                {hasSelectedEnrollmentYear && enrollmentEligible && (
                  <p className="text-sm text-teal-700">
                    Hai i requisiti per la riduzione 50% (Legge Bilancio 2025). La potrai attivare nello step successivo.
                  </p>
                )}
                {hasSelectedEnrollmentYear && !enrollmentEligible && (
                  <p className="text-sm text-muted-foreground">
                    Nello step successivo potrai gestire la riduzione contributiva.
                  </p>
                )}

                <p className="text-xs text-muted-foreground mt-2">* Campo obbligatorio</p>
              </CardContent>
            </>
          )}

          {currentStepId === "riduzione35" && (
            <>
              <CardHeader>
                <CardTitle>Riduzione contributiva</CardTitle>
                <CardDescription>
                  Due possibili agevolazioni INPS per Artigiani/Commercianti: la riduzione 50% (solo nuove iscrizioni nel 2025) e la riduzione 35% (regime forfettario). Non sono cumulabili.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Riduzione 50% — visibile solo se enrollment eleggibile (Legge Bilancio 2025) */}
                {enrollmentEligible && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-amber-800 dark:text-amber-200">
                          Riduzione 50% (nuova iscrizione)
                        </p>
                        <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                          Riservata a chi si iscrive alla gestione nel 2025 (Legge Bilancio 2025). Si applica ai fiscal year 2025-2028.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Switch
                        id="riduzione50-switch"
                        checked={data.riduzione50Attiva}
                        onCheckedChange={(checked) => {
                          updateData({
                            riduzione50Attiva: checked,
                            riduzione50Scadenza: checked
                              ? computeRiduzione50Scadenza(data.inpsEnrollmentYear)
                              : null,
                            // Mutual exclusivity: attivando 50% disattiva 35%
                            ...(checked ? { riduzione35Attiva: false } : {}),
                          });
                          if (checked) setRiduzione35Scelta("no");
                        }}
                        aria-label="Attiva riduzione 50% nuova iscrizione"
                      />
                      <Label htmlFor="riduzione50-switch" className="cursor-pointer font-medium text-amber-800 dark:text-amber-200">
                        Attiva la riduzione 50%
                      </Label>
                    </div>
                  </div>
                )}

                {/* Riduzione 35% — nascosta quando 50% è attiva (mutual exclusivity) */}
                {data.riduzione50Attiva ? (
                  <p className="text-sm text-muted-foreground">
                    La riduzione 35% è disattivata perché hai attivato la 50%. Le due non sono cumulabili.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <p className="font-medium">Riduzione 35% (regime forfettario)</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Agevolazione da richiedere all'INPS per i contribuenti in regime forfettario. Riduce rate fisse e contributi variabili.
                      </p>
                    </div>
                    <RadioGroup
                      value={riduzione35Scelta ?? (data.riduzione35Attiva ? "si" : "no")}
                      onValueChange={(v) => {
                        if (!isRiduzione35Scelta(v)) return;
                        updateData({ riduzione35Attiva: mapRiduzione35(v) });
                        setRiduzione35Scelta(v);
                      }}
                      className="space-y-3"
                      aria-label="Hai richiesto la riduzione contributiva del 35%?"
                    >
                      <div className="flex items-start space-x-3 rounded-lg border p-4 hover:bg-accent/50 transition-colors">
                        <RadioGroupItem value="si" id="riduzione35-si" className="mt-0.5" />
                        <Label htmlFor="riduzione35-si" className="cursor-pointer font-medium text-base">
                          Sì, l'ho richiesta
                        </Label>
                      </div>
                      <div className="flex items-start space-x-3 rounded-lg border p-4 hover:bg-accent/50 transition-colors">
                        <RadioGroupItem value="no" id="riduzione35-no" className="mt-0.5" />
                        <Label htmlFor="riduzione35-no" className="cursor-pointer font-medium text-base">
                          No, non l'ho richiesta
                        </Label>
                      </div>
                      <div className="flex items-start space-x-3 rounded-lg border p-4 hover:bg-accent/50 transition-colors">
                        <RadioGroupItem value="non_lo_so" id="riduzione35-non-lo-so" className="mt-0.5" />
                        <Label htmlFor="riduzione35-non-lo-so" className="cursor-pointer font-medium text-base">
                          Non lo so
                        </Label>
                      </div>
                    </RadioGroup>

                    {riduzione35Scelta === "non_lo_so" && (
                      <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">
                        <Info className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
                        Nessun problema! Calcoleremo senza riduzione, in modo prudente. Puoi attivarla in qualsiasi momento nelle Impostazioni.
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </>
          )}

          {/* Story 11.1 — Step Acconti Già Versati */}
          {currentStepId === "acconti" && (
            <>
              <CardHeader>
                <CardTitle>Hai versato acconti l'anno scorso?</CardTitle>
                <CardDescription>
                  Gli acconti d'imposta e INPS versati riducono il saldo da pagare quest'anno.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <RadioGroup
                  value={data.accontiResponse ?? ""}
                  onValueChange={(v) => {
                    const response = v as "si" | "no" | "non_lo_so";
                    updateData({
                      accontiResponse: response,
                      ...(response !== "si" && {
                        accontiImpostaVersati: 0,
                        accontiInpsEccedenzaVersati: 0,
                      }),
                    });
                  }}
                  className="space-y-3"
                  aria-label="Hai versato acconti l'anno scorso?"
                >
                  <div className="flex items-start space-x-3 rounded-lg border p-4 hover:bg-accent/50 transition-colors">
                    <RadioGroupItem value="si" id="acconti-si" className="mt-0.5" />
                    <Label htmlFor="acconti-si" className="cursor-pointer font-medium text-base">
                      Sì, inserisco gli importi
                    </Label>
                  </div>
                  <div className="flex items-start space-x-3 rounded-lg border p-4 hover:bg-accent/50 transition-colors">
                    <RadioGroupItem value="no" id="acconti-no" className="mt-0.5" />
                    <Label htmlFor="acconti-no" className="cursor-pointer font-medium text-base">
                      No, non ho versato acconti
                    </Label>
                  </div>
                  <div className="flex items-start space-x-3 rounded-lg border p-4 hover:bg-accent/50 transition-colors">
                    <RadioGroupItem value="non_lo_so" id="acconti-non-lo-so" className="mt-0.5" />
                    <Label htmlFor="acconti-non-lo-so" className="cursor-pointer font-medium text-base">
                      Non lo so
                    </Label>
                  </div>
                </RadioGroup>

                {data.accontiResponse === "si" && (
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="wizard-acconti-imposta">
                        Acconti imposta sostitutiva versati (cod. 1790 + 1791)
                      </Label>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">€</span>
                        <Input
                          id="wizard-acconti-imposta"
                          type="text"
                          inputMode="decimal"
                          placeholder="0"
                          value={data.accontiImpostaVersati || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "" || /^\d+([.,]\d{0,2})?$/.test(val)) {
                              const parsed = parseFloat(val.replace(",", "."));
                              updateData({ accontiImpostaVersati: isNaN(parsed) ? 0 : parsed });
                            }
                          }}
                          className="flex-1"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="wizard-acconti-inps">
                        Acconti INPS eccedenza versati
                      </Label>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">€</span>
                        <Input
                          id="wizard-acconti-inps"
                          type="text"
                          inputMode="decimal"
                          placeholder="0"
                          value={data.accontiInpsEccedenzaVersati || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "" || /^\d+([.,]\d{0,2})?$/.test(val)) {
                              const parsed = parseFloat(val.replace(",", "."));
                              updateData({ accontiInpsEccedenzaVersati: isNaN(parsed) ? 0 : parsed });
                            }
                          }}
                          className="flex-1"
                        />
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      <Info className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
                      <span className="font-medium">Dove trovo questi importi?</span> Nel tuo cassetto fiscale su AdE, oppure chiedi al commercialista.
                    </p>
                  </div>
                )}

                {data.accontiResponse === "non_lo_so" && (
                  <p className="text-sm text-muted-foreground" aria-live="polite">
                    <Info className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
                    Nessun problema, il saldo sarà calcolato al lordo. Puoi sempre aggiornare nelle Impostazioni.
                  </p>
                )}
              </CardContent>
            </>
          )}

          {currentStepId === "profilo" && (
            <>
              <CardHeader>
                <CardTitle>Come ti chiami?</CardTitle>
                <CardDescription>
                  Iniziamo con le informazioni di base per personalizzare la tua esperienza.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Nome *</Label>
                  <Input
                    id="firstName"
                    placeholder="Mario"
                    value={data.firstName}
                    onChange={(e) => updateData({ firstName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Cognome</Label>
                  <Input
                    id="lastName"
                    placeholder="Rossi"
                    value={data.lastName}
                    onChange={(e) => updateData({ lastName: e.target.value })}
                  />
                </div>
              </CardContent>
            </>
          )}

          {currentStepId === "datiFiscali" && (
            <>
              <CardHeader>
                <CardTitle>I tuoi dati fiscali</CardTitle>
                <CardDescription>Configura i parametri del tuo Regime Forfettario.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Anno Apertura P.IVA — only for Separata (Art/Comm ask it in annoIscrizione step) */}
                {data.inpsManagement === "separata" && (
                  <div className="space-y-2">
                    <Label htmlFor="anno-apertura-piva">Anno apertura Partita IVA *</Label>
                    <Select
                      value={data.annoAperturaPiva?.toString() ?? ""}
                      onValueChange={(v) => {
                        const anno = parseInt(v, 10);
                        if (isNaN(anno)) return;
                        const derivazione = deriveAliquotaSostitutiva(anno, currentYear);
                        updateData({
                          annoAperturaPiva: anno,
                          ...(derivazione ? { taxRate: derivazione.aliquota.toString() as "5" | "15" } : {}),
                        });
                      }}
                    >
                      <SelectTrigger id="anno-apertura-piva" aria-label="Anno di apertura della partita IVA">
                        <SelectValue placeholder="Seleziona l'anno" />
                      </SelectTrigger>
                      <SelectContent>
                        {annoAperturaPivaOptions.map((y) => (
                          <SelectItem key={y} value={y.toString()}>
                            {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {derivazioneAliquota && derivazioneAliquota.aliquota === 5 && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground" role="status">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help shrink-0" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>Hai aperto nel {data.annoAperturaPiva}: sei al {derivazioneAliquota.annoCorrente}° anno su 5 del regime agevolato al 5%.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <span>Aliquota agevolata 5% (anno {derivazioneAliquota.annoCorrente} di 5)</span>
                      </div>
                    )}
                    {derivazioneAliquota && derivazioneAliquota.aliquota === 15 && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground" role="status">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help shrink-0" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>Hai aperto nel {data.annoAperturaPiva}: hai superato i 5 anni di regime agevolato. L'aliquota ordinaria è 15%.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <span>Aliquota ordinaria 15%</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Label>Aliquota Imposta Sostitutiva</Label>
                    {derivazioneAliquota && !isAliquotaOverride && (
                      <Badge variant="secondary" className="text-xs">
                        {derivazioneAliquota.aliquota === 5
                          ? `Suggerito: 5% (anno ${derivazioneAliquota.annoCorrente} di 5)`
                          : "Suggerito: 15% — regime agevolato scaduto"}
                      </Badge>
                    )}
                    {derivazioneAliquota && isAliquotaOverride && (
                      <Badge variant="outline" className="text-xs">
                        Manuale — il sistema suggerisce {derivazioneAliquota.aliquota}%
                      </Badge>
                    )}
                  </div>
                  <RadioGroup
                    value={data.taxRate}
                    onValueChange={(v) => updateData({ taxRate: v as "5" | "15" })}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2 min-h-[44px]">
                      <RadioGroupItem value="5" id="tax-5" />
                      <Label htmlFor="tax-5" className="cursor-pointer">
                        5% (primi 5 anni)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 min-h-[44px]">
                      <RadioGroupItem value="15" id="tax-15" />
                      <Label htmlFor="tax-15" className="cursor-pointer">
                        15% (ordinaria)
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-3">
                  <Label>Coefficiente di Redditività</Label>
                  <AtecoCombobox
                    id="wizard-ateco"
                    value={data.atecoCode}
                    coefficient={data.profitCoefficient}
                    onSelect={handleAtecoSelect}
                    onManualEntry={handleAtecoManualEntry}
                    isManualMode={manualAtecoMode}
                  />
                  <p className="text-sm text-muted-foreground">
                    Attuale: <strong>{data.profitCoefficient}%</strong>
                  </p>
                </div>

                <div className="space-y-3">
                  <Label>
                    Aliquota INPS{" "}
                    {data.inpsManagement === "separata"
                      ? "Gestione Separata"
                      : data.inpsManagement === "artigiani"
                        ? "Artigiani"
                        : "Commercianti"}
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={data.inpsRate}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val) && val >= 0 && val <= 100) {
                        updateData({ inpsRate: val });
                      } else if (e.target.value === "") {
                        // Reset to correct rate for current gestione without resetting step
                        const rateMap: Record<GestioneINPS, number> = fiscalRules
                          ? { separata: fiscalRules.inps_rate_separata, artigiani: fiscalRules.inps_rate_artigiani, commercianti: fiscalRules.inps_rate_commercianti }
                          : INPS_RATE_FALLBACK;
                        updateData({ inpsRate: rateMap[data.inpsManagement] });
                      }
                    }}
                  />
                  <p className="text-sm text-muted-foreground">
                    Aliquota {currentYear}: {data.inpsRate}%. Range valido: 0-100%.
                  </p>
                </div>

                <p className="text-xs text-muted-foreground mt-2">* Campo obbligatorio</p>
              </CardContent>
            </>
          )}

          {currentStepId === "prudenza" && (
            <>
              <CardHeader>
                <CardTitle>Saldo Iniziale</CardTitle>
                <CardDescription>
                  Se hai già un saldo sul conto, inseriscilo per calcoli più precisi fin dal primo giorno.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="saldoInizialeCC">Saldo attuale del conto corrente</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">€</span>
                    <Input
                      id="saldoInizialeCC"
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={data.saldoInizialeCC || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "" || /^\d+$/.test(val)) {
                          updateData({ saldoInizialeCC: val ? parseInt(val, 10) : 0 });
                        }
                      }}
                      className="flex-1"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Il saldo del tuo conto corrente a inizio anno. Viene sommato agli incassi per calcolare il netto spendibile.
                  </p>
                </div>

                <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
                  <p>
                    <Info className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
                    Per personalizzare come Forfettino calcola il tuo spendibile consigliato (cuscinetto anti-imprevisti, blocco fondi pre-scadenze), vai in{" "}
                    <strong>Impostazioni &rarr; Prudenza</strong> dopo aver completato il wizard.
                  </p>
                </div>
              </CardContent>
            </>
          )}

          {currentStepId === "scadenze" && (
            <>
              <CardHeader>
                <CardTitle>Date Scadenze {paymentYear}</CardTitle>
                <CardDescription>
                  {data.inpsManagement === "separata"
                    ? "Configura le date di scadenza per i versamenti F24 del prossimo anno."
                    : "Ecco le date di scadenza per i tuoi versamenti del prossimo anno."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {data.inpsManagement === "separata" ? (
                  <>
                    <div className="space-y-3">
                      <Label htmlFor="june-date">Scadenza Giugno</Label>
                      <Input
                        id="june-date"
                        type="date"
                        value={data.juneDueDate}
                        onChange={(e) => updateData({ juneDueDate: e.target.value })}
                      />
                      <p className="text-sm text-muted-foreground">Saldo anno precedente + 1° acconto anno corrente</p>
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="november-date">Scadenza Novembre</Label>
                      <Input
                        id="november-date"
                        type="date"
                        value={data.novemberDueDate}
                        onChange={(e) => updateData({ novemberDueDate: e.target.value })}
                      />
                      <p className="text-sm text-muted-foreground">2° acconto anno corrente</p>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <Label htmlFor="inps-q1-date">INPS fisso — 1ª rata</Label>
                      <Input id="inps-q1-date" type="date" value={data.inpsQ1DueDate} onChange={(e) => updateData({ inpsQ1DueDate: e.target.value })} />
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="inps-q2-date">INPS fisso — 2ª rata</Label>
                      <Input id="inps-q2-date" type="date" value={data.inpsQ2DueDate} onChange={(e) => updateData({ inpsQ2DueDate: e.target.value })} />
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="june-date-ac">Tasse (saldo + 1° acconto) + INPS variabile</Label>
                      <Input id="june-date-ac" type="date" value={data.juneDueDate} onChange={(e) => updateData({ juneDueDate: e.target.value })} />
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="inps-q3-date">INPS fisso — 3ª rata</Label>
                      <Input id="inps-q3-date" type="date" value={data.inpsQ3DueDate} onChange={(e) => updateData({ inpsQ3DueDate: e.target.value })} />
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="inps-q4-date">INPS fisso (4ª rata) + INPS variabile</Label>
                      <Input id="inps-q4-date" type="date" value={data.inpsQ4DueDate} onChange={(e) => updateData({ inpsQ4DueDate: e.target.value })} />
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="november-date-ac">Tasse — 2° acconto</Label>
                      <Input id="november-date-ac" type="date" value={data.novemberDueDate} onChange={(e) => updateData({ novemberDueDate: e.target.value })} />
                    </div>
                  </div>
                )}

                <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
                  <p>
                    <strong>Nota:</strong> Gli importi verranno calcolati automaticamente in base ai tuoi incassi.
                    Potrai sempre modificare le date nelle Impostazioni.
                  </p>
                </div>
              </CardContent>
            </>
          )}

          {currentStepId === "conferma" && (
            <>
              <CardHeader>
                <CardTitle>Riepilogo Configurazione</CardTitle>
                <CardDescription>Verifica i dati prima di iniziare.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 rounded-lg bg-muted/50 p-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Nome</p>
                      <p className="font-medium">
                        {data.firstName} {data.lastName}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Anno apertura P.IVA</p>
                      <p className="font-medium">{data.annoAperturaPiva}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Aliquota</p>
                      <p className="font-medium">
                        {data.taxRate}%
                        {derivazioneAliquota && !isAliquotaOverride && " (derivata)"}
                        {isAliquotaOverride && " (manuale)"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Codice ATECO / Coefficiente</p>
                      <p className="font-medium">{data.atecoCode ? `${data.atecoCode} (${data.profitCoefficient}%)` : `${data.profitCoefficient}%`}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Gestione INPS</p>
                      <p className="font-medium">
                        {data.inpsManagement === "separata"
                          ? "Gestione Separata"
                          : data.inpsManagement === "artigiani"
                            ? "Artigiani"
                            : "Commercianti"}
                      </p>
                    </div>
                    {/* Story 2.3 — Anno Iscrizione e Riduzione 50% (solo Art/Comm) */}
                    {data.inpsManagement !== "separata" && (
                      <div>
                        <p className="text-sm text-muted-foreground">Anno Iscrizione INPS</p>
                        <p className="font-medium">{data.inpsEnrollmentYear ?? "—"}</p>
                      </div>
                    )}
                    {data.inpsManagement !== "separata" && (
                      <div>
                        <p className="text-sm text-muted-foreground">Riduzione 50%</p>
                        <p className="font-medium">
                          {data.riduzione50Attiva
                            ? `Attiva (scade ${data.riduzione50Scadenza?.slice(0, 4) ?? "—"})`
                            : "Non attiva"}
                        </p>
                      </div>
                    )}
                    {data.inpsManagement !== "separata" && (
                      <div>
                        <p className="text-sm text-muted-foreground">Riduzione 35%</p>
                        <p className="font-medium">
                          {data.riduzione35Attiva ? "Attiva" : "Non attiva"}
                        </p>
                      </div>
                    )}
                    {data.saldoInizialeCC > 0 && (
                      <div>
                        <p className="text-sm text-muted-foreground">Saldo Iniziale CC</p>
                        <p className="font-medium">€ {data.saldoInizialeCC.toLocaleString("it-IT")}</p>
                      </div>
                    )}
                    {data.inpsManagement === "separata" ? (
                      <>
                        <div>
                          <p className="text-sm text-muted-foreground">Scadenza Giugno {paymentYear}</p>
                          <p className="font-medium">{new Date(data.juneDueDate + "T00:00:00").toLocaleDateString("it-IT")}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Scadenza Novembre {paymentYear}</p>
                          <p className="font-medium">{new Date(data.novemberDueDate + "T00:00:00").toLocaleDateString("it-IT")}</p>
                        </div>
                      </>
                    ) : (
                      <div className="sm:col-span-2">
                        <p className="text-sm text-muted-foreground mb-2">Scadenze {paymentYear}</p>
                        <div className="space-y-1">
                          {[
                            { date: data.inpsQ1DueDate, label: "INPS fisso 1ª rata" },
                            { date: data.inpsQ2DueDate, label: "INPS fisso 2ª rata" },
                            { date: data.juneDueDate, label: "Tasse + INPS variabile" },
                            { date: data.inpsQ3DueDate, label: "INPS fisso 3ª rata" },
                            { date: data.inpsQ4DueDate, label: "INPS fisso 4ª rata + variabile" },
                            { date: data.novemberDueDate, label: "Tasse 2° acconto" },
                          ].map((d) => (
                            <p key={d.date + d.label} className="font-medium text-sm">
                              {new Date(d.date + "T00:00:00").toLocaleDateString("it-IT", { day: "numeric", month: "long" })}
                              {" — "}
                              <span className="font-normal text-muted-foreground">{d.label}</span>
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Story 35.3: Analytics opt-in (opzionale, non bloccante) */}
                <div className="mt-4 rounded-lg border border-border p-4">
                  <div className="flex items-start gap-3">
                    <BarChart3 className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start gap-2">
                        <Checkbox
                          id="analytics-opt-in"
                          checked={analyticsOptIn}
                          onCheckedChange={(checked) => setAnalyticsOptIn(checked === true)}
                          className="mt-0.5"
                        />
                        <label htmlFor="analytics-opt-in" className="text-sm text-muted-foreground leading-snug cursor-pointer">
                          Acconsento all&apos;analisi del mio utilizzo dell&apos;app per migliorare il servizio
                        </label>
                      </div>
                      <a
                        href="/privacy-policy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary underline-offset-4 hover:underline"
                      >
                        Maggiori informazioni →
                      </a>
                    </div>
                  </div>
                </div>
              </CardContent>
            </>
          )}

          {/* Disclaimer — comune a tutti gli step tranne conferma */}
          {currentStepId !== "conferma" && (
            <p className="px-6 pb-2 text-xs text-muted-foreground text-center italic">
              Tutte le impostazioni potrai modificarle in seguito
            </p>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between p-6 pt-0">
            {currentStepIndex === 0 ? (
              <Button
                variant="ghost"
                onClick={async () => {
                  sessionStorage.removeItem("otp_pending");
                  sessionStorage.removeItem("was_password_login");
                  await supabase.auth.signOut();
                  navigate("/");
                }}
                disabled={loading}
                className="text-muted-foreground"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Esci
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={loading}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Indietro
              </Button>
            )}

            {!isLastStep ? (
              <Button onClick={handleAdvance} disabled={!canProceed()}>
                Avanti
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleFinish} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Inizia a usare Forfettino
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
    </PageErrorBoundary>
  );
}
