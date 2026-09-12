import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMfa } from "@/hooks/useMfa";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { useIsMobile } from "@/hooks/use-mobile";
import { PricingCards } from "@/components/shared/PricingCards";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";

import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PageErrorBoundary } from "@/components/shared/PageErrorBoundary";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save, Shield, Copy, Check, ChevronRight, X, Info, AlertTriangle, CreditCard, Sparkles, Clock, User, Lock, KeyRound, RefreshCw, Mail, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { findAtecoByCode, getAtecoDisplayLabel } from "@/lib/ateco-catalog";
import { getCoeffFromAteco } from "@/lib/ateco-coefficienti";
import { ATECO_CODES } from "@/data/ateco-codes";
import { AtecoCombobox } from "@/components/shared/AtecoCombobox";
import {
  type GestioneINPS,
  type FiscalRulesParams,
  calcTotaleMultiGestione,
  computeBufferAmount,
  computeMonthlyToolCost,
  computeYearlyToolCost,
  computeUnpaidCurrentYearTotal,
  computePaidCurrentYearTotal,
  computeDaCopireAmount,
  computeNetSpendable,
} from "@/lib/fiscal-engine";
import { sumMoney, sanitizeMoney } from "@/lib/money";
import {
  isEligibleRiduzione50,
  computeRiduzione50Scadenza,
  mapGestioneToInpsType,
  isValidEnrollmentYear,
} from "@/pages/Wizard";
import { deriveAliquotaSostitutiva } from "@/lib/fiscal-utils";
import { useFiscalRules } from "@/hooks/useFiscalRules";
import { useRegenerateSchedule } from "@/hooks/useRegenerateSchedule";
import { useSubscription } from "@/hooks/useSubscription";
import { useServiceCategories } from "@/hooks/useServiceCategories";
import { getSuggestions } from "@/lib/category-suggestions";
import { FREE_CATEGORY_LIMIT } from "@/types/subscription";
import { useCheckout } from "@/hooks/useCheckout";
import { useNavigate, useSearchParams } from "react-router-dom";
import { track } from "@/lib/analytics";
import { CommercialistaFallbackAlert } from "@/components/shared/CommercialistaFallbackAlert";
import { strongPasswordSchema } from "@/lib/password-validation";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";
import { NotificationPreferencesExpanded } from "@/components/settings/NotificationPreferencesExpanded";
import { PrivacyDataSection } from "@/components/settings/PrivacyDataSection";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
};

// FREE_FEATURES, PRO_FEATURES, STUDIO_FEATURES removed — now in PricingCards shared component

/** Self-contained Change Password card for the Sicurezza tab */
function ChangePasswordCard() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleChangePassword = async () => {
    const result = strongPasswordSchema.safeParse(newPassword);
    if (!result.success) {
      toast({ title: "Errore", description: result.error.issues[0].message, variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Errore", description: "Le password non coincidono.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast({ title: "Errore", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Password aggiornata", description: "La tua password è stata modificata con successo." });
        setNewPassword("");
        setConfirmPassword("");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5" />
          Cambia Password
        </CardTitle>
        <CardDescription>
          Aggiorna la password del tuo account
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="change-new-password">Nuova password</Label>
          <PasswordInput
            id="change-new-password"
            placeholder="Minimo 8 caratteri"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={loading}
          />
          <PasswordStrengthIndicator password={newPassword} show={true} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="change-confirm-password">Conferma password</Label>
          <PasswordInput
            id="change-confirm-password"
            placeholder="Ripeti la password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
            onKeyDown={(e) => e.key === "Enter" && handleChangePassword()}
          />
        </div>
        <Button onClick={handleChangePassword} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          Aggiorna password
        </Button>
      </CardContent>
    </Card>
  );
}

/** Self-contained Change Email card for the Profilo tab */
function ChangeEmailCard({ currentEmail }: { currentEmail: string }) {
  const [isEditing, setIsEditing] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleChangeEmail = async () => {
    setValidationError(null);
    const trimmed = newEmail.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) {
      setValidationError("Inserisci un indirizzo email valido.");
      return;
    }
    if (trimmed.length > 255) {
      setValidationError("Email troppo lunga (massimo 255 caratteri).");
      return;
    }
    if (trimmed.toLowerCase() === currentEmail.toLowerCase()) {
      setValidationError("La nuova email è uguale a quella attuale.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: trimmed });
      if (error) {
        toast({ title: "Errore", description: error.message, variant: "destructive" });
      } else {
        toast({
          title: "Conferma richiesta",
          description: "Controlla la tua casella email per confermare il cambio.",
        });
        setNewEmail("");
        setIsEditing(false);
      }
    } catch {
      toast({ title: "Errore", description: "Impossibile aggiornare l'email. Riprova più tardi.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label>Email</Label>
      <div className="flex items-center gap-2">
        <Input value={currentEmail} disabled className="bg-muted" />
        {!isEditing && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="shrink-0 gap-1.5"
          >
            <Mail className="h-3.5 w-3.5" />
            Modifica
          </Button>
        )}
      </div>
      {isEditing && (
        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="change-email-new">Nuova email</Label>
            <Input
              id="change-email-new"
              type="email"
              placeholder="nuova@email.it"
              value={newEmail}
              onChange={(e) => {
                setNewEmail(e.target.value);
                if (validationError) setValidationError(null);
              }}
              disabled={loading}
              aria-describedby="change-email-help"
              aria-invalid={!!validationError}
              onKeyDown={(e) => e.key === "Enter" && handleChangeEmail()}
            />
            {validationError && (
              <p className="text-sm text-red-600" role="alert">{validationError}</p>
            )}
            <p id="change-email-help" className="text-sm text-slate-500">
              Riceverai un link di conferma sulla nuova email.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleChangeEmail} disabled={loading} size="sm" className="gap-1.5">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
              Conferma cambio email
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setIsEditing(false); setNewEmail(""); setValidationError(null); }}
              disabled={loading}
            >
              Annulla
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Helper: single summary row (label + value) for ProfileSummaryCard */
function SummaryField({ label, value, badge }: { label: string; value: string | number | null | undefined; badge?: string }) {
  return (
    <div>
      <dt className="text-sm text-slate-600">{label}</dt>
      <dd className="text-sm font-medium text-slate-900 mt-0.5 flex items-center gap-2">
        {value != null && value !== "" ? (
          value
        ) : (
          <span className="text-slate-500 font-normal">Non specificato</span>
        )}
        {badge && (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
            {badge}
          </span>
        )}
      </dd>
    </div>
  );
}

const GESTIONE_LABELS: Record<string, string> = {
  separata: "Gestione Separata",
  artigiani: "Artigiani",
  commercianti: "Commercianti",
};

/** Story 36.2 — Read-only summary card with editable P.IVA field */
function ProfileSummaryCard({
  user,
  profile,
  formData,
  isLoading,
  setActiveTab,
}: {
  user: { email?: string; app_metadata?: { provider?: string } } | null;
  profile: { first_name: string | null; last_name: string | null; partita_iva: string | null } | null;
  formData: {
    annoAperturaPiva: number | null;
    taxRate: string;
    profitCoefficient: number;
    inpsManagement: string;
    atecoCode: string | null;
    riduzione35Attiva: boolean;
    riduzione50Attiva: boolean;
    riduzione50Scadenza: string | null;
  };
  isLoading: boolean;
  setActiveTab: (tab: string) => void;
}) {
  const [partitaIva, setPartitaIva] = useState(profile?.partita_iva || "");
  const [pivaError, setPivaError] = useState<string | null>(null);
  const [savingPiva, setSavingPiva] = useState(false);
  const pivaInitialized = useRef(false);
  const updateProfile = useUpdateProfile();
  const { toast } = useToast();

  // Sync from profile ONLY on first load — avoids resetting user input
  // when profile refetches due to nome/cognome save in parent
  useEffect(() => {
    if (profile && !pivaInitialized.current) {
      setPartitaIva(profile.partita_iva || "");
      pivaInitialized.current = true;
    }
  }, [profile]);

  const handleSavePiva = async () => {
    setPivaError(null);
    const trimmed = partitaIva.trim();
    if (trimmed && !/^\d{11}$/.test(trimmed)) {
      setPivaError("La Partita IVA deve essere composta da 11 cifre.");
      return;
    }
    setSavingPiva(true);
    try {
      await updateProfile.mutateAsync({
        partita_iva: trimmed || null,
      });
      toast({ title: "Partita IVA aggiornata!" });
    } catch {
      toast({ title: "Errore", description: "Impossibile salvare la Partita IVA.", variant: "destructive" });
    } finally {
      setSavingPiva(false);
    }
  };

  const isGoogleOAuth = user?.app_metadata?.provider === "google";

  // Derive ATECO description from static catalog
  const atecoEntry = formData.atecoCode ? findAtecoByCode(formData.atecoCode) : null;
  const atecoDisplay = formData.atecoCode
    ? `${formData.atecoCode}${atecoEntry ? ` — ${atecoEntry.description}` : ""}`
    : null;

  // Derive riduzioni label
  const riduzioni: string[] = [];
  if (formData.riduzione35Attiva) riduzioni.push("Riduzione 35%");
  if (formData.riduzione50Attiva) {
    riduzioni.push(
      formData.riduzione50Scadenza
        ? `Riduzione 50% (scad. ${formData.riduzione50Scadenza})`
        : "Riduzione 50%"
    );
  }
  const riduzioniDisplay = riduzioni.length > 0 ? riduzioni.join(", ") : "Nessuna";

  const pivaHasChanged = (partitaIva.trim() || null) !== (profile?.partita_iva || null);

  if (isLoading) {
    return (
      <Card className="rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.05),0_0_0_1px_rgba(23,23,23,0.05)]">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.05),0_0_0_1px_rgba(23,23,23,0.05)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5 text-slate-500" />
          I tuoi dati
        </CardTitle>
        <CardDescription>Riepilogo dei tuoi dati personali e fiscali</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Sezione Dati personali */}
        <div>
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Dati personali</h3>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SummaryField label="Nome" value={profile?.first_name} />
            <SummaryField label="Cognome" value={profile?.last_name} />
            <SummaryField
              label="Email"
              value={user?.email}
              badge={isGoogleOAuth ? "Google" : "Password"}
            />
          </dl>
        </div>

        <Separator />

        {/* Sezione Dati fiscali */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900">Dati fiscali</h3>
            <button
              type="button"
              onClick={() => setActiveTab("fiscale")}
              className="text-sm text-teal-700 hover:text-teal-800 font-medium flex items-center gap-1"
            >
              Modifica parametri fiscali
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Partita IVA — editabile inline */}
            <div className="sm:col-span-2">
              <Label htmlFor="partita-iva" className="text-sm text-slate-600">
                Partita IVA
              </Label>
              <div className="flex items-center gap-2 mt-0.5">
                <Input
                  id="partita-iva"
                  value={partitaIva}
                  onChange={(e) => {
                    // Allow only digits, max 11
                    const v = e.target.value.replace(/\D/g, "").slice(0, 11);
                    setPartitaIva(v);
                    if (pivaError) setPivaError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && pivaHasChanged) handleSavePiva();
                  }}
                  placeholder="01234567890"
                  maxLength={11}
                  inputMode="numeric"
                  aria-describedby="partita-iva-hint"
                  aria-invalid={!!pivaError}
                  className="max-w-[200px]"
                />
                {pivaHasChanged && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSavePiva}
                    disabled={savingPiva}
                    className="shrink-0 gap-1.5"
                  >
                    {savingPiva ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    Salva
                  </Button>
                )}
              </div>
              {pivaError && (
                <p className="text-sm text-red-600 mt-1" role="alert">{pivaError}</p>
              )}
              <p id="partita-iva-hint" className="text-sm text-slate-500 mt-1">
                11 cifre numeriche (campo facoltativo).
              </p>
            </div>

            <SummaryField label="Anno apertura P.IVA" value={formData.annoAperturaPiva} />
            <SummaryField label="Codice ATECO" value={atecoDisplay} />
            <SummaryField
              label="Gestione INPS"
              value={GESTIONE_LABELS[formData.inpsManagement] || formData.inpsManagement}
            />
            <SummaryField label="Aliquota sostitutiva" value={`${formData.taxRate}%`} />
            <SummaryField label="Coefficiente di redditivita'" value={`${formData.profitCoefficient}%`} />
            <SummaryField label="Riduzioni attive" value={riduzioniDisplay} />
          </dl>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ImpostazioniPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const currentYear = new Date().getFullYear();
  const { regenerateForPaymentYear } = useRegenerateSchedule();
  const [saving, setSaving] = useState(false);
  const [copyBannerDismissed, setCopyBannerDismissed] = useState(false);
  const [activeTab, setActiveTab] = useState("fiscale");

  // Profile editing
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const [profileFirstName, setProfileFirstName] = useState("");
  const [profileLastName, setProfileLastName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Subscription & billing
  const { isPro, hasPaidPlan, tier, subscription, receiptsUsed, receiptsLimit, refetch: refetchSubscription } = useSubscription();
  const { checkout, openPortal, isLoading: portalLoading } = useCheckout();
  const [searchParams, setSearchParams] = useSearchParams();
  // Pricing constants removed — Free-only strategy (story 13-15)

  // ── Service Categories (Tab Categorie) ──
  const {
    categories: serviceCategories,
    activeCategories,
    categoriesUsed,
    canAddCategory,
    isLoading: categoriesLoading,
    createCategory,
    updateCategory,
    toggleActive,
  } = useServiceCategories();

  // Wrap createCategory to show appropriate toast (special on 0→1, standard otherwise)
  const createCategoryWithToast = useCallback(
    async (params: Parameters<typeof createCategory>[0]) => {
      const wasZero = categoriesUsed === 0;
      const result = await createCategory(params);
      if (wasZero) {
        toast({ title: "Categoria creata! Ora puoi selezionare il servizio quando registri un incasso." });
      } else {
        toast({ title: "Categoria creata", description: params.name });
      }
      return result;
    },
    [createCategory, categoriesUsed, toast]
  );

  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");

  // ATECO category for suggestions
  const { data: atecoCategory } = useQuery({
    queryKey: ["ateco_category", user?.id],
    queryFn: async () => {
      const { data: fys } = await supabase
        .from("fiscal_year_settings")
        .select("ateco_code")
        .eq("user_id", user!.id)
        .order("fiscal_year", { ascending: false })
        .limit(1)
        .single();
      if (!fys?.ateco_code) return null;
      const { data: preset } = await supabase
        .from("profit_coeff_presets")
        .select("category")
        .eq("ateco_code", fys.ateco_code)
        .limit(1)
        .single();
      return preset?.category ?? null;
    },
    enabled: !!user,
  });

  // Handle Stripe checkout success/cancel
  useEffect(() => {
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");
    
    if (success === "true") {
      toast({
        title: "Abbonamento attivato! 🎉",
        description: "Le nuove funzionalità sono ora disponibili.",
      });
      refetchSubscription();
      // Clean URL
      setSearchParams({});
    } else if (canceled === "true") {
      toast({
        title: "Checkout annullato",
        description: "Nessun problema, puoi tornare quando vuoi.",
      });
      setSearchParams({});
    }
  }, [searchParams, toast, refetchSubscription, setSearchParams]);

  // Handle ?tab= param for deep-linking (e.g. /impostazioni?tab=abbonamento)
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam) {
      setActiveTab(tabParam);
      setSearchParams((prev) => {
        prev.delete("tab");
        return prev;
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Populate profile form when data loads
  useEffect(() => {
    if (profile) {
      setProfileFirstName(profile.first_name || "");
      setProfileLastName(profile.last_name || "");
    }
  }, [profile]);

  // Refetch subscription ogni volta che la pagina viene montata
  // per catturare eventuali modifiche fatte nel Customer Portal
  useEffect(() => {
    refetchSubscription();
  }, [refetchSubscription]);

  // MFA state for security section
  const { checkMfaStatus, unenrollFactor, isLoading: mfaLoading, error: mfaError, clearError } = useMfa();
  const [isPasswordLogin, setIsPasswordLogin] = useState(false);
  const [mfaEnrolled, setMfaEnrolled] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [disablingMfa, setDisablingMfa] = useState(false);
  const [copied, setCopied] = useState(false);
  const [regeneratingCodes, setRegeneratingCodes] = useState(false);
  const [newBackupCodes, setNewBackupCodes] = useState<string[] | null>(null);

  // Manual ATECO mode (for display in AtecoCombobox)
  const [manualAtecoMode, setManualAtecoMode] = useState(false);

  // Check if user logged in with password and MFA enrollment status
  useEffect(() => {
    const checkLogin = async () => {
      const state = await checkMfaStatus();
      setIsPasswordLogin(state.isPasswordLogin);
      setMfaEnrolled(state.hasEnrolledFactor);
      setMfaFactorId(state.factorId);
    };
    checkLogin();
  }, [checkMfaStatus]);

  // Backup codes remaining count
  const { data: backupCodesRemaining, refetch: refetchBackupCodes } = useQuery({
    queryKey: ["backup-codes-remaining", user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await (supabase as any)
        .from("mfa_backup_codes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("used_at", null);
      if (error) return 0;
      return count ?? 0;
    },
    enabled: !!user?.id && isPasswordLogin,
  });

  const handleRegenerateBackupCodes = async () => {
    setRegeneratingCodes(true);
    setNewBackupCodes(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("generate-backup-codes");
      if (fnError) {
        toast({ title: "Errore", description: "Impossibile rigenerare i codici.", variant: "destructive" });
      } else if (data?.codes) {
        setNewBackupCodes(data.codes);
        toast({ title: "Codici rigenerati!", description: "I vecchi codici sono stati invalidati." });
        refetchBackupCodes();
      }
    } catch {
      toast({ title: "Errore", description: "Errore di rete.", variant: "destructive" });
    }
    setRegeneratingCodes(false);
  };

  const handleDisableMfa = async () => {
    if (!mfaFactorId) return;
    setDisablingMfa(true);
    const success = await unenrollFactor(mfaFactorId);
    if (success) {
      setMfaEnrolled(false);
      setMfaFactorId(null);
      setNewBackupCodes(null);
      toast({ title: "2FA disattivato", description: "La verifica in due passaggi è stata rimossa." });
    } else {
      toast({ title: "Errore", description: "Impossibile disattivare il 2FA. Riprova.", variant: "destructive" });
    }
    setDisablingMfa(false);
  };

  // Local state for form
  const [formData, setFormData] = useState({
    taxRate: "15",
    profitCoefficient: 78,
    inpsRate: 26.07,
    safetyBufferRate: 5,
    deadlineWindowDays: 45,
    bufferBase: "receipts" as "receipts" | "reserve",
    reserveAmount: 0,
    prudenzaPreset: "bilanciato" as string,
    // Story 2.6 — Gestione INPS + riduzioni
    inpsManagement: "separata" as GestioneINPS,
    inpsEnrollmentYear: null as number | null,
    riduzione50Attiva: false,
    riduzione50Scadenza: null as string | null,
    riduzione35Attiva: false,
    // Story 2.7 — Anno Apertura Partita IVA
    annoAperturaPiva: null as number | null,
    // Story 11.1 — Acconti già versati
    accontiImpostaVersati: 0,
    accontiInpsEccedenzaVersati: 0,
    // Story 19-1 — Saldo iniziale conto corrente
    saldoInizialeCC: 0,
    // Story 13.14 — Persistenza codice ATECO
    atecoCode: null as string | null,
  });

  // Gestione change state (Story 2.6)
  const [pendingGestione, setPendingGestione] = useState<GestioneINPS | null>(null);
  const [showGestioneConfirm, setShowGestioneConfirm] = useState(false);

  // Fallback commercialista — variazione > 10% (Story 4-3)
  const [showSettingsVariationAlert, setShowSettingsVariationAlert] = useState(false);

  // Separate state for reserve input to allow free typing
  const [reserveInput, setReserveInput] = useState("");
  // Story 11.1 — separate input state per acconti (permette digitazione libera come reserveInput)
  const [accontiImpostaInput, setAccontiImpostaInput] = useState("");
  const [accontiInpsInput, setAccontiInpsInput] = useState("");
  // Story 19-1 — separate input state per saldo iniziale CC
  const [saldoInizialeInput, setSaldoInizialeInput] = useState("");

  // Fetch current settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ["fiscal_year_settings", user?.id, currentYear],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("fiscal_year_settings")
        .select("*")
        .eq("user_id", user.id)
        .eq("fiscal_year", currentYear)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!user,
    refetchOnMount: "always",
  });

  // Fetch settings anno precedente (per UX "copia da anno precedente")
  const { data: prevYearSettings } = useQuery({
    queryKey: ["fiscal_year_settings", user?.id, currentYear - 1],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("fiscal_year_settings")
        .select("*")
        .eq("user_id", user.id)
        .eq("fiscal_year", currentYear - 1)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!user && !settings,
  });

  // Fetch receipts YTD for preview calculations
  const { data: receipts } = useQuery({
    queryKey: ["receipts_ytd", user?.id, currentYear],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("receipts")
        .select("*")
        .eq("user_id", user.id)
        .eq("fiscal_year", currentYear);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch due soon schedules for preview
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const windowEndDate = new Date();
  windowEndDate.setDate(windowEndDate.getDate() + formData.deadlineWindowDays);
  const windowEnd = `${windowEndDate.getFullYear()}-${String(windowEndDate.getMonth() + 1).padStart(2, "0")}-${String(windowEndDate.getDate()).padStart(2, "0")}`;

  const { data: dueSoonSchedules } = useQuery({
    queryKey: ["due_soon_schedules_preview", user?.id, formData.deadlineWindowDays],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("tax_schedule")
        .select("*")
        .eq("user_id", user.id)
        .neq("status", "paid")
        .gte("due_date", today)
        .lte("due_date", windowEnd);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Tutte le scadenze dell'anno corrente — necessarie per allineare il preview
  // "Netto Spendibile" alla formula del Dashboard (Story 3.7 — superset di dueSoon).
  const { data: currentYearSchedulesPreview } = useQuery({
    queryKey: ["current_year_schedules_preview", user?.id, currentYear],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("tax_schedule")
        .select("status, total_expected, total_paid")
        .eq("user_id", user.id)
        .eq("payment_year", currentYear);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Tool subscriptions — necessarie per allineare il preview alla formula Dashboard
  // (yearlyToolCost) — vedi Story 40-2 e refactor "Netto Spendibile" 2026-04-25.
  const { data: toolSubscriptionsPreview } = useQuery({
    queryKey: ["tool_subscriptions_preview", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("tool_subscriptions")
        .select("cost, frequency")
        .eq("user_id", user.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Check if user has schedule data
  const { data: scheduleCount } = useQuery({
    queryKey: ["schedule_count", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count, error } = await supabase
        .from("tax_schedule")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
  });

  // Fetch next deadline any for preview
  const { data: nextDeadlineAny } = useQuery({
    queryKey: ["next_deadline_any_preview", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("tax_schedule")
        .select("*")
        .eq("user_id", user.id)
        .neq("status", "paid")
        .gte("due_date", today)
        .order("due_date")
        .limit(1)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!user,
  });

  // Query: conteggio incassi anno corrente (Story 2.6 — blocco cambio gestione)
  const { data: receiptsCount } = useQuery({
    queryKey: ["receipts_count_current_year", user?.id, currentYear],
    queryFn: async () => {
      if (!user) return 0;
      const { count, error } = await supabase
        .from("receipts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("fiscal_year", currentYear);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
  });

  // Query: conteggio pagamenti rate già marcate come pagate per anno corrente (Story 4-3)
  const { data: paidSchedulePaymentsCount } = useQuery({
    queryKey: ["paid_schedule_payments_count", user?.id, currentYear],
    queryFn: async () => {
      if (!user) return 0;
      const { count, error } = await supabase
        .from("payments")
        .select("*, tax_schedule!inner(payment_year)", { count: "exact", head: true })
        .eq("user_id", user.id)
        .not("tax_schedule_id", "is", null)
        .eq("tax_schedule.payment_year", currentYear);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
  });

  // Hook: fiscal_rules per aliquote Art/Comm (Story 2.6)
  const { data: fiscalRules } = useFiscalRules(currentYear);

  // profit_coeff_presets query rimossa — catalogo ATECO ora statico (src/data/ateco-codes.ts)

  // Calcolo preview "Netto Spendibile" — usa le STESSE pure functions del Dashboard
  // (`useFiscalCalculations.tsx`) per garantire coerenza tra preview live e valore reale.
  // Vedi src/lib/fiscal-engine.ts → computeNetSpendable + helper.
  const previewValues = useMemo(() => {
    const incassiYTD = receipts?.reduce((sum, r) => sum + Number(r.gross_amount), 0) || 0;
    const profitCoeff = formData.profitCoefficient; // 0-100 scale
    const taxRateNum = parseFloat(formData.taxRate); // 0-100 scale
    const inpsRateNum = formData.inpsRate; // 0-100 scale
    const safetyBufferRate = formData.safetyBufferRate; // 0-100 scale

    // Calcoli base (Separata default — superato da Art/Comm sotto se applicabile)
    const taxableAmount = (incassiYTD * profitCoeff) / 100;
    const taxAmount = Math.round(((taxableAmount * taxRateNum) / 100) * 100) / 100;
    const inpsAmount = Math.round(((taxableAmount * inpsRateNum) / 100) * 100) / 100;
    const totalWithholding = sumMoney(taxAmount, inpsAmount);

    // Story 40-2 + Fix F1 — imposta post-deducibilità per TUTTE le gestioni via fiscal-engine
    let impostaConDeducibilita = taxAmount;
    let inpsVariabile = 0;
    let inpsTotale = inpsAmount;
    if (fiscalRules) {
      const aliquota: 5 | 15 = taxRateNum <= 5 ? 5 : 15;
      const totaleReale = calcTotaleMultiGestione(
        incassiYTD,
        profitCoeff,
        formData.inpsManagement,
        fiscalRules as FiscalRulesParams,
        aliquota,
        formData.riduzione35Attiva,
        formData.riduzione50Attiva,
      );
      impostaConDeducibilita = totaleReale.imposta;
      inpsTotale = totaleReale.contributiINPS;
      if (totaleReale.dettaglioINPS.gestione !== "separata") {
        inpsVariabile = totaleReale.dettaglioINPS.result.variabile;
      }
    }

    // Pure functions unificate (single source of truth — vedi fiscal-engine.ts)
    const daCopireAmount = computeDaCopireAmount({
      inpsManagement: formData.inpsManagement,
      totalWithholding,
      impostaConDeducibilita,
      inpsVariabile,
      inpsTotale,
    });

    const bufferAmount = computeBufferAmount(
      formData.bufferBase,
      totalWithholding,
      incassiYTD,
      safetyBufferRate,
    );

    const monthlyToolCost = computeMonthlyToolCost(toolSubscriptionsPreview);
    const yearlyToolCost = computeYearlyToolCost(monthlyToolCost);

    const unpaidCurrentYearTotal = computeUnpaidCurrentYearTotal(
      currentYearSchedulesPreview,
      formData.accontiImpostaVersati,
      formData.accontiInpsEccedenzaVersati,
    );

    const paidCurrentYearTotal = computePaidCurrentYearTotal(
      currentYearSchedulesPreview,
    );

    const spendable = computeNetSpendable({
      saldoInizialeCC: sanitizeMoney(formData.saldoInizialeCC),
      incassiYTD,
      daCopireAmount,
      bufferAmount,
      yearlyToolCost,
      unpaidCurrentYearTotal,
      paidCurrentYearTotal,
      reserveAmount: sanitizeMoney(formData.reserveAmount),
    });

    // dueSoonRemaining mantenuto per backward compat (UI esistente che lo mostra)
    const dueSoonRemaining = dueSoonSchedules?.reduce((sum, s) => {
      return sum + (Number(s.total_expected) - Number(s.total_paid));
    }, 0) || 0;

    return {
      incassiYTD,
      totalWithholding,
      bufferAmount,
      dueSoonRemaining,
      yearlyToolCost,
      unpaidCurrentYearTotal,
      daCopireAmount,
      spendable,
    };
  }, [
    receipts,
    formData,
    dueSoonSchedules,
    currentYearSchedulesPreview,
    toolSubscriptionsPreview,
    fiscalRules,
  ]);

  // Update form when settings load
  useEffect(() => {
    if (settings) {
      const gestione = (settings.inps_management || "separata") as GestioneINPS;
      setFormData({
        taxRate: settings.tax_rate.toString(),
        profitCoefficient: Number(settings.profit_coefficient),
        inpsRate: Number(settings.inps_rate),
        safetyBufferRate: Number(settings.safety_buffer_rate),
        deadlineWindowDays: settings.deadline_window_days,
        bufferBase: settings.buffer_base as "receipts" | "reserve",
        reserveAmount: Number(settings.reserve_amount),
        prudenzaPreset: (settings as any).prudenza_preset || "bilanciato",
        // Story 2.6 — nuovi campi
        inpsManagement: gestione,
        inpsEnrollmentYear: settings.inps_enrollment_year ?? null,
        riduzione50Attiva: settings.riduzione_50_attiva ?? false,
        riduzione50Scadenza: settings.riduzione_50_scadenza ?? null,
        riduzione35Attiva: settings.riduzione_35_attiva ?? false,
        // Story 2.7
        annoAperturaPiva: settings.anno_apertura_piva ?? null,
        // Story 11.1
        accontiImpostaVersati: Number(settings.acconti_imposta_versati) || 0,
        accontiInpsEccedenzaVersati: Number(settings.acconti_inps_eccedenza_versati) || 0,
        // Story 19-1
        saldoInizialeCC: Number(settings.saldo_iniziale_cc) || 0,
        // Story 13.14 — Persistenza codice ATECO
        atecoCode: (settings as any).ateco_code ?? null,
      });
      const reserveVal = Number(settings.reserve_amount);
      setReserveInput(reserveVal > 0 ? reserveVal.toString() : "");
      // Story 19-1 — populate saldo iniziale input
      const saldoVal = Number(settings.saldo_iniziale_cc) || 0;
      setSaldoInizialeInput(saldoVal > 0 ? saldoVal.toString() : "");
      // Story 11.1 — populate acconti inputs
      const accontiImpostaVal = Number(settings.acconti_imposta_versati) || 0;
      const accontiInpsVal = Number(settings.acconti_inps_eccedenza_versati) || 0;
      setAccontiImpostaInput(accontiImpostaVal > 0 ? accontiImpostaVal.toString() : "");
      setAccontiInpsInput(accontiInpsVal > 0 ? accontiInpsVal.toString() : "");
    }
  }, [settings]);

  // ── Story 13-7: Dirty state tracking for unsaved changes indicator ──
  const savedFormDataRef = useRef<typeof formData | null>(null);
  const savedProfileRef = useRef<{ firstName: string; lastName: string } | null>(null);

  // Update snapshot when settings load from DB
  useEffect(() => {
    if (settings) {
      savedFormDataRef.current = { ...formData };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  // Update snapshot when profile loads
  useEffect(() => {
    if (profile) {
      savedProfileRef.current = { firstName: profile.first_name || "", lastName: profile.last_name || "" };
    }
  }, [profile]);

  // Dirty state derivation — which tabs have unsaved changes
  const dirtyTabs = useMemo(() => {
    const dirty = new Set<string>();
    if (savedFormDataRef.current) {
      const saved = savedFormDataRef.current;
      // Fiscale tab fields
      const fiscaleFields: (keyof typeof formData)[] = [
        "taxRate", "profitCoefficient", "inpsRate", "inpsManagement",
        "inpsEnrollmentYear", "riduzione50Attiva", "riduzione50Scadenza",
        "riduzione35Attiva", "annoAperturaPiva", "accontiImpostaVersati",
        "accontiInpsEccedenzaVersati", "atecoCode", // Story 13.14
      ];
      if (fiscaleFields.some((k) => formData[k] !== saved[k])) dirty.add("fiscale");
      // Prudenza tab fields
      const prudenzaFields: (keyof typeof formData)[] = [
        "safetyBufferRate", "deadlineWindowDays", "bufferBase", "prudenzaPreset",
      ];
      if (prudenzaFields.some((k) => formData[k] !== saved[k])) dirty.add("prudenza");
      // Riserva tab fields
      const riservaFields: (keyof typeof formData)[] = ["reserveAmount", "saldoInizialeCC"];
      if (riservaFields.some((k) => formData[k] !== saved[k])) dirty.add("riserva");
    }
    // Profilo tab
    if (savedProfileRef.current) {
      if (
        profileFirstName !== savedProfileRef.current.firstName ||
        profileLastName !== savedProfileRef.current.lastName
      ) {
        dirty.add("profilo");
      }
    }
    return dirty;
  }, [formData, profileFirstName, profileLastName]);

  // Infer manualAtecoMode from data on load (Review fix M4, updated Story 13.14)
  // Priority: match by ateco_code first, then fallback to coefficient match
  // Infer manualAtecoMode from saved data — check against static catalog
  useEffect(() => {
    if (settings) {
      const savedAtecoCode = (settings as any).ateco_code as string | null;
      if (savedAtecoCode) {
        const matchesCatalog = ATECO_CODES.some((e) => e.code === savedAtecoCode);
        if (!matchesCatalog) {
          setManualAtecoMode(true);
        }
      }
    }
  }, [settings]);

  // Story 2.7 — Derivazione aliquota sostitutiva
  const annoAperturaPivaOptions: number[] = [];
  for (let y = currentYear; y >= 2000; y--) {
    annoAperturaPivaOptions.push(y);
  }
  const derivazioneAliquota = deriveAliquotaSostitutiva(formData.annoAperturaPiva, currentYear);
  const isAliquotaOverride = derivazioneAliquota != null && formData.taxRate !== derivazioneAliquota.aliquota.toString();

  // Reset banner "copia" quando cambia anno
  useEffect(() => {
    setCopyBannerDismissed(false);
  }, [currentYear]);

  // Copia impostazioni dall'anno precedente
  const handleCopyFromPrevYear = () => {
    if (!prevYearSettings) return;
    const prevGestione = (prevYearSettings.inps_management || "separata") as GestioneINPS;
    // Story 2.7 review fix H4: riderivare aliquota per anno corrente (non copiare quella dell'anno precedente)
    const copiedAnnoApertura = prevYearSettings.anno_apertura_piva ?? null;
    const derivazione = deriveAliquotaSostitutiva(copiedAnnoApertura, currentYear);
    const derivedTaxRate = derivazione ? derivazione.aliquota.toString() : prevYearSettings.tax_rate.toString();
    setFormData({
      taxRate: derivedTaxRate,
      profitCoefficient: Number(prevYearSettings.profit_coefficient),
      inpsRate: Number(prevYearSettings.inps_rate),
      safetyBufferRate: Number(prevYearSettings.safety_buffer_rate),
      deadlineWindowDays: prevYearSettings.deadline_window_days,
      bufferBase: prevYearSettings.buffer_base as "receipts" | "reserve",
      reserveAmount: Number(prevYearSettings.reserve_amount),
      prudenzaPreset: (prevYearSettings as any).prudenza_preset || "bilanciato",
      // Story 2.6 — copia anche campi gestione/riduzioni
      inpsManagement: prevGestione,
      inpsEnrollmentYear: prevYearSettings.inps_enrollment_year ?? null,
      riduzione50Attiva: prevYearSettings.riduzione_50_attiva ?? false,
      riduzione50Scadenza: prevYearSettings.riduzione_50_scadenza ?? null,
      riduzione35Attiva: prevYearSettings.riduzione_35_attiva ?? false,
      // Story 2.7
      annoAperturaPiva: copiedAnnoApertura,
      // Story 11.1 — NON copiare acconti da anno precedente (sono specifici per anno)
      accontiImpostaVersati: 0,
      accontiInpsEccedenzaVersati: 0,
      // Story 19-1 — NON copiare saldo iniziale CC (specifico per anno)
      saldoInizialeCC: 0,
      // Story 13.14 — Copia codice ATECO da anno precedente
      atecoCode: (prevYearSettings as any).ateco_code ?? null,
    });
    const reserveVal = Number(prevYearSettings.reserve_amount);
    setReserveInput(reserveVal > 0 ? reserveVal.toString() : "");
    // Story 11.1 — reset acconti inputs
    setAccontiImpostaInput("");
    setAccontiInpsInput("");
    // Story 19-1 — reset saldo iniziale input
    setSaldoInizialeInput("");
    setCopyBannerDismissed(true);
    toast({ title: `Impostazioni copiate dal ${currentYear - 1}. Verifica e salva.` });
  };

  const handleSave = async () => {
    if (!user) return;

    // Snapshot pre-save — serve a rilevare modifiche dei campi INPS strutturali
    // per forzare la rigenerazione di tax_schedule dopo il salvataggio.
    const prevSnapshot = savedFormDataRef.current;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("fiscal_year_settings")
        .upsert(
          {
            user_id: user.id,
            fiscal_year: currentYear,
            tax_rate: parseFloat(formData.taxRate),
            profit_coefficient: formData.profitCoefficient,
            inps_rate: formData.inpsRate,
            inps_type: mapGestioneToInpsType(formData.inpsManagement), // dual-write (Story 2.6)
            safety_buffer_rate: formData.safetyBufferRate,
            deadline_window_days: formData.deadlineWindowDays,
            buffer_base: formData.bufferBase,
            reserve_amount: formData.reserveAmount,
            // Story 2.6 — nuovi campi gestione INPS
            inps_management: formData.inpsManagement,
            inps_enrollment_year: formData.inpsEnrollmentYear,
            riduzione_50_attiva: formData.riduzione50Attiva,
            riduzione_50_scadenza: formData.riduzione50Scadenza,
            riduzione_35_attiva: formData.riduzione35Attiva,
            // Story 2.7
            anno_apertura_piva: formData.annoAperturaPiva,
            // Story 11.1
            acconti_imposta_versati: formData.accontiImpostaVersati,
            acconti_inps_eccedenza_versati: formData.accontiInpsEccedenzaVersati,
            // Story 19-1
            saldo_iniziale_cc: formData.saldoInizialeCC,
            // Story 13.14 — Persistenza codice ATECO
            ateco_code: formData.atecoCode,
          } as any,
          { onConflict: "user_id,fiscal_year" }
        );

      if (error) throw error;

      // Story 20-1 (v2 — Legge Bilancio 2025): Propagate structural INPS fields with per-year
      // eligibility enforcement for riduzione 50%.
      //
      // Two responsibilities:
      // 1. UPDATE existing fiscal_year_settings rows with current structural values,
      //    applying riduzione 50% scadenza enforcement per-year (la rid50 potrebbe essere
      //    attiva nel currentYear ma non più in anni fuori finestra [2025..2028]).
      // 2. INSERT missing rows for near-future years [currentYear+1, currentYear+3] so
      //    when the user opens Dashboard for next year the settings carry over correctly
      //    without needing a manual "copy from prev year" action.
      try {
        // Fetch years that already have a row (so we know what's existing vs missing)
        const { data: existingRows } = await supabase
          .from("fiscal_year_settings")
          .select("fiscal_year")
          .eq("user_id", user.id);

        const existingYears = new Set((existingRows ?? []).map((r) => r.fiscal_year));

        // Target window: 3 future years (covers rid50 scadenza window 2025-2028)
        const futureYears = [currentYear + 1, currentYear + 2, currentYear + 3];
        // All years that need processing (excluding currentYear, already upserted above)
        const yearsToProcess = new Set<number>([
          ...Array.from(existingYears).filter((y) => y !== currentYear),
          ...futureYears,
        ]);

        const propagationErrors: string[] = [];

        for (const year of yearsToProcess) {
          // Calcola rid50 eleggibile per l'anno specifico (enforcement scadenza)
          const rid50EligibleForYear = formData.riduzione50Attiva
            && formData.inpsEnrollmentYear != null
            && isEligibleRiduzione50(formData.inpsEnrollmentYear, year);

          const structuralFields = {
            inps_management: formData.inpsManagement,
            inps_type: mapGestioneToInpsType(formData.inpsManagement),
            inps_enrollment_year: formData.inpsEnrollmentYear,
            anno_apertura_piva: formData.annoAperturaPiva,
            riduzione_35_attiva: formData.riduzione35Attiva,
            riduzione_50_attiva: rid50EligibleForYear,
            riduzione_50_scadenza: rid50EligibleForYear ? formData.riduzione50Scadenza : null,
          };

          if (existingYears.has(year)) {
            // Anno esistente: UPDATE solo campi strutturali (preserve per-year fields)
            const { error: updateError } = await supabase
              .from("fiscal_year_settings")
              .update(structuralFields)
              .eq("user_id", user.id)
              .eq("fiscal_year", year);
            if (updateError) propagationErrors.push(`${year}: ${updateError.message}`);
          } else {
            // Anno mancante: INSERT con carry-over + defaults per campi per-anno
            const { error: insertError } = await supabase
              .from("fiscal_year_settings")
              .insert({
                user_id: user.id,
                fiscal_year: year,
                ...structuralFields,
                // Copia parametri non strutturali dall'anno corrente come seed
                tax_rate: parseFloat(formData.taxRate),
                profit_coefficient: formData.profitCoefficient,
                inps_rate: formData.inpsRate,
                safety_buffer_rate: formData.safetyBufferRate,
                deadline_window_days: formData.deadlineWindowDays,
                buffer_base: formData.bufferBase,
                ateco_code: formData.atecoCode,
                // Campi per-anno: reset (l'utente li inserirà anno per anno)
                acconti_imposta_versati: 0,
                acconti_inps_eccedenza_versati: 0,
                saldo_iniziale_cc: 0,
                reserve_amount: 0,
              } as any);
            if (insertError) propagationErrors.push(`${year}: ${insertError.message}`);
          }
        }

        if (propagationErrors.length > 0) {
          console.error("[Impostazioni] Propagation errors:", propagationErrors);
          toast({ variant: "destructive", title: "Attenzione", description: "Impostazioni salvate, ma la propagazione ad altri anni potrebbe essere incompleta." });
        } else {
          console.log(`[Impostazioni] Propagated structural fields to ${yearsToProcess.size} year(s) (with rid50 scadenza enforcement)`);
        }
      } catch (propErr) {
        console.error("[Impostazioni] Propagation exception:", propErr);
        toast({ variant: "destructive", title: "Attenzione", description: "Impostazioni salvate, ma la propagazione ad altri anni potrebbe essere incompleta." });
      }

      // Story 4-3: Variazione > 10% — check se mostrare fallback commercialista
      if (settings && (paidSchedulePaymentsCount ?? 0) > 0) {
        const prevProfitCoeff = settings.profit_coefficient ?? 78;
        const prevTaxRate = settings.tax_rate ?? 15;
        const prevInpsRate = settings.inps_rate ?? 26.07;
        const prevTotalRate = (prevProfitCoeff / 100) * (prevTaxRate + prevInpsRate);

        const newProfitCoeff = formData.profitCoefficient;
        const newTaxRate = parseFloat(formData.taxRate);
        const newInpsRate = formData.inpsRate;
        const newTotalRate = (newProfitCoeff / 100) * (newTaxRate + newInpsRate);

        if (prevTotalRate > 0) {
          const variationPct = Math.abs(newTotalRate - prevTotalRate) / prevTotalRate;
          if (variationPct > 0.10) {
            setShowSettingsVariationAlert(true);
            track("fallback_commercialista_shown", {
              trigger: "settings_variation",
              variation_pct: Math.round(variationPct * 100),
            });
          }
        }
      }

      // Invalida TUTTE le query che dipendono dalle impostazioni fiscali
      queryClient.invalidateQueries({ queryKey: ["fiscal_year_settings"] });
      queryClient.invalidateQueries({ queryKey: ["receipts_ytd"] });
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      queryClient.invalidateQueries({ queryKey: ["due_soon_schedules"] });
      queryClient.invalidateQueries({ queryKey: ["due_soon_schedules_preview"] });
      queryClient.invalidateQueries({ queryKey: ["next_deadline_in_window"] });
      queryClient.invalidateQueries({ queryKey: ["next_deadline_any"] });
      queryClient.invalidateQueries({ queryKey: ["next_deadline_any_preview"] });
      queryClient.invalidateQueries({ queryKey: ["schedule_count"] });
      queryClient.invalidateQueries({ queryKey: ["tax_schedule"] });
      queryClient.invalidateQueries({ queryKey: ["tool_subscriptions"] });

      // Rigenera tax_schedule se sono cambiati campi INPS strutturali.
      // Why: senza questa chiamata le righe schedule_payments restano calcolate
      // con i vecchi parametri (es. riduzione 50% vs 35%), quindi Scadenziario
      // e unpaidCurrentYearTotal in Dashboard mostrano importi obsoleti.
      const inpsStructuralChanged =
        !prevSnapshot ||
        prevSnapshot.riduzione35Attiva !== formData.riduzione35Attiva ||
        prevSnapshot.riduzione50Attiva !== formData.riduzione50Attiva ||
        prevSnapshot.inpsManagement !== formData.inpsManagement ||
        prevSnapshot.inpsEnrollmentYear !== formData.inpsEnrollmentYear ||
        prevSnapshot.profitCoefficient !== formData.profitCoefficient ||
        prevSnapshot.taxRate !== formData.taxRate ||
        prevSnapshot.annoAperturaPiva !== formData.annoAperturaPiva;

      if (inpsStructuralChanged) {
        // Rigenera sia l'anno corrente (primo anno Art/Comm, INPS fisso Q1-Q4)
        // sia l'anno successivo (obblighi cross-anno da reddito N -> tasse N+1).
        const regenResults = await Promise.allSettled([
          regenerateForPaymentYear(currentYear),
          regenerateForPaymentYear(currentYear + 1),
        ]);
        regenResults.forEach((r, i) => {
          const py = i === 0 ? currentYear : currentYear + 1;
          if (r.status === "rejected") {
            console.warn(`[Impostazioni] Regen ${py} failed:`, r.reason);
          } else if (!r.value.success) {
            console.warn(`[Impostazioni] Regen ${py} skipped: ${r.value.reason}`);
          }
        });
      }

      toast({ title: "Impostazioni salvate!" });
      // Story 13-7: Reset dirty state snapshot after successful save
      savedFormDataRef.current = { ...formData };
    } catch (error: any) {
      console.error("[Impostazioni] Save error:", {
        message: error?.message,
        details: error?.details,
        code: error?.code,
        hint: error?.hint,
      });
      toast({
        title: "Errore",
        description: error?.message || "Impossibile salvare le impostazioni.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      await updateProfile.mutateAsync({
        first_name: profileFirstName.trim() || null,
        last_name: profileLastName.trim() || null,
      });
      toast({ title: "Profilo aggiornato!" });
      // Story 13-7: Reset dirty state snapshot after successful save
      savedProfileRef.current = { firstName: profileFirstName, lastName: profileLastName };
    } catch {
      toast({
        title: "Errore",
        description: "Impossibile aggiornare il profilo.",
        variant: "destructive",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  // ATECO handlers — catalogo completo statico
  const handleAtecoSelect = (code: string, coefficient: number) => {
    setFormData({ ...formData, profitCoefficient: coefficient, atecoCode: code });
    setManualAtecoMode(false);
  };

  const handleAtecoManualEntry = (code: string, coefficient: number) => {
    setFormData({ ...formData, profitCoefficient: coefficient, atecoCode: code || null });
    setManualAtecoMode(true);
  };

  // Helper: derive INPS rate from gestione and fiscalRules (Story 2.6)
  // Uses fiscalRules when available, falls back to current formData rate for separata only
  const getInpsRateForGestione = (gestione: GestioneINPS): number => {
    if (fiscalRules) {
      switch (gestione) {
        case "separata": return Number(fiscalRules.inps_rate_separata);
        case "artigiani": return Number(fiscalRules.inps_rate_artigiani);
        case "commercianti": return Number(fiscalRules.inps_rate_commercianti);
      }
    }
    // Fallback: if fiscalRules not loaded yet, keep current rate for separata (user-editable)
    // For Art/Comm this is a degraded state — the RadioGroup is disabled until fiscalRules loads
    return formData.inpsRate;
  };

  // Helper: gestione INPS label
  const GESTIONE_LABELS: Record<GestioneINPS, string> = {
    separata: "Gestione Separata",
    artigiani: "Artigiani",
    commercianti: "Commercianti",
  };

  // Gestione change handler — requires confirmation (Story 2.6)
  const handleGestioneChangeRequest = (newGestione: GestioneINPS) => {
    if (newGestione === formData.inpsManagement) return;
    setPendingGestione(newGestione);
    setShowGestioneConfirm(true);
  };

  const handleGestioneChangeConfirm = () => {
    if (!pendingGestione) return;
    const prevGestione = formData.inpsManagement;
    const newGestione = pendingGestione;

    if (newGestione === "separata") {
      // Da Art/Comm → Separata: reset campi Art/Comm
      setFormData({
        ...formData,
        inpsManagement: newGestione,
        inpsRate: getInpsRateForGestione(newGestione),
        inpsEnrollmentYear: null,
        riduzione50Attiva: false,
        riduzione50Scadenza: null,
        riduzione35Attiva: false,
      });
    } else if (prevGestione === "separata") {
      // Da Separata → Art/Comm: mostra campi, aggiorna aliquota
      setFormData({
        ...formData,
        inpsManagement: newGestione,
        inpsRate: getInpsRateForGestione(newGestione),
        inpsEnrollmentYear: null,
        riduzione50Attiva: false,
        riduzione50Scadenza: null,
        riduzione35Attiva: false,
      });
    } else {
      // Da Art/Comm → Art/Comm (altra gestione): mantieni anno/riduzioni, aggiorna aliquota
      setFormData({
        ...formData,
        inpsManagement: newGestione,
        inpsRate: getInpsRateForGestione(newGestione),
      });
    }

    setShowGestioneConfirm(false);
    setPendingGestione(null);
  };

  const handleGestioneChangeCancel = () => {
    setShowGestioneConfirm(false);
    setPendingGestione(null);
  };

  // Can change gestione? (Story 2.6 AC #5)
  const canChangeGestione = (receiptsCount ?? 0) === 0;

  // Analytics: track fallback commercialista gestione bloccata (Story 4-3)
  useEffect(() => {
    if (!canChangeGestione) {
      track("fallback_commercialista_shown", { trigger: "gestione_blocked" });
    }
  }, [canChangeGestione]);

  // Check if next deadline is outside window
  const hasScheduleData = (scheduleCount || 0) > 0;
  const nextDeadlineOutsideWindow = nextDeadlineAny && previewValues.dueSoonRemaining === 0;

  if (isLoading) {
    return (
      <AppLayout>
        <Helmet>
          <meta name="robots" content="noindex, follow" />
        </Helmet>
        {isMobile && <MobileHeader title="Impostazioni" />}
        <PageErrorBoundary>
        <PageContainer narrow data-testid="skeleton-loading">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          {/* Tab bar skeleton */}
          <div className="flex gap-4 border-b pb-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-24 rounded-md" />
            ))}
          </div>
          {/* Content skeleton */}
          <div className="space-y-4">
            <Skeleton className="h-[200px] w-full rounded-xl" />
            <Skeleton className="h-[150px] w-full rounded-xl" />
          </div>
        </PageContainer>
        </PageErrorBoundary>
      </AppLayout>
    );
  }

  // Reusable save button component
  // Blocca salvataggio se Art/Comm senza fiscalRules (review fix H1/M1)
  const saveDisabled = saving || (formData.inpsManagement !== "separata" && !fiscalRules);

  const saveButton = (
    <Button onClick={handleSave} disabled={saveDisabled} className="w-full gap-2">
      {saving ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Save className="h-4 w-4" />
      )}
      Salva Impostazioni
    </Button>
  );

  const tabTriggerClass = "rounded-lg px-3 py-2 min-h-[44px] text-sm whitespace-nowrap text-slate-500 hover:text-slate-700 hover:bg-white/50 transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:font-semibold data-[state=active]:shadow-[0_1px_3px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.05)]";

  return (
    <AppLayout>
      <Helmet>
        <meta name="robots" content="noindex, follow" />
      </Helmet>
      {isMobile && <MobileHeader title="Impostazioni" />}
      <PageErrorBoundary>
      <PageContainer narrow>
        <div className={cn(isMobile && "hidden")}>
          <h1 className="text-2xl font-bold">Impostazioni</h1>
          <p className="text-muted-foreground">
            Configura i parametri fiscali per l'anno {currentYear}
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="py-1 -mx-4 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <TabsList className="h-auto w-max sm:w-full sm:justify-center bg-transparent px-4 sm:px-1 py-0.5 gap-0.5 sm:flex-wrap">
            <TabsTrigger value="fiscale" className={tabTriggerClass}>
              Parametri Fiscali
              {dirtyTabs.has("fiscale") && <span className="ml-1 h-2 w-2 rounded-full bg-warning" aria-label="modifiche non salvate" />}
            </TabsTrigger>
            <TabsTrigger value="prudenza" className={tabTriggerClass}>
              Prudenza
              {dirtyTabs.has("prudenza") && <span className="ml-1 h-2 w-2 rounded-full bg-warning" aria-label="modifiche non salvate" />}
            </TabsTrigger>
            <TabsTrigger value="categorie" className={tabTriggerClass}>
              Categorie
            </TabsTrigger>
            <TabsTrigger value="riserva" className={tabTriggerClass}>
              Riserva
              {dirtyTabs.has("riserva") && <span className="ml-1 h-2 w-2 rounded-full bg-warning" aria-label="modifiche non salvate" />}
            </TabsTrigger>
            <TabsTrigger value="abbonamento" className={tabTriggerClass}>
              Abbonamento
            </TabsTrigger>
            <TabsTrigger value="profilo" className={tabTriggerClass}>
              Profilo
              {dirtyTabs.has("profilo") && <span className="ml-1 h-2 w-2 rounded-full bg-warning" aria-label="modifiche non salvate" />}
            </TabsTrigger>
            <TabsTrigger value="notifiche" className={tabTriggerClass}>
              Notifiche
            </TabsTrigger>
            <TabsTrigger value="privacy" className={tabTriggerClass}>
              Privacy
            </TabsTrigger>
            {isPasswordLogin && (
              <TabsTrigger value="sicurezza" className={tabTriggerClass}>
                Sicurezza
              </TabsTrigger>
            )}
          </TabsList>
          </div>

          {/* ── Tab: Parametri Fiscali ── */}
          <TabsContent value="fiscale" className="space-y-6 mt-6">
            {/* Banner copia impostazioni anno precedente */}
            {!settings && !copyBannerDismissed && prevYearSettings && (
              <Card className="border-blue-200 bg-blue-50/50">
                <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-4">
                  <div className="flex items-center gap-3">
                    <Info className="h-5 w-5 text-blue-600 shrink-0" />
                    <p className="text-sm text-blue-900">
                      Non ci sono impostazioni per il <strong>{currentYear}</strong>.
                      Vuoi copiare quelle del {currentYear - 1}?
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full sm:w-auto">
                    <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => setCopyBannerDismissed(true)}>
                      Inizia da zero
                    </Button>
                    <Button size="sm" className="w-full sm:w-auto" onClick={handleCopyFromPrevYear}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copia da {currentYear - 1}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Parametri Fiscali</CardTitle>
                <CardDescription>
                  Impostazioni del tuo Regime Forfettario
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Story 2.7 — Anno Apertura Partita IVA */}
                <div className="space-y-2">
                  <Label htmlFor="anno-apertura-piva-settings">Anno apertura Partita IVA</Label>
                  <Select
                    value={formData.annoAperturaPiva?.toString() ?? "null"}
                    onValueChange={(v) => {
                      const anno = v === "null" ? null : parseInt(v, 10);
                      const derivazione = deriveAliquotaSostitutiva(anno, currentYear);
                      setFormData({
                        ...formData,
                        annoAperturaPiva: anno,
                        ...(derivazione ? { taxRate: derivazione.aliquota.toString() } : {}),
                      });
                    }}
                  >
                    <SelectTrigger id="anno-apertura-piva-settings" aria-label="Anno di apertura della partita IVA">
                      <SelectValue placeholder="Non specificare" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="null">Non specificare</SelectItem>
                      {annoAperturaPivaOptions.map((y) => (
                        <SelectItem key={y} value={y.toString()}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {derivazioneAliquota && derivazioneAliquota.aliquota === 5 && (
                    <p className="text-sm text-muted-foreground" role="status">
                      <Info className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
                      Hai aperto nel {formData.annoAperturaPiva}: sei al {derivazioneAliquota.annoCorrente}° anno su 5 del regime agevolato al 5%.
                    </p>
                  )}
                  {derivazioneAliquota && derivazioneAliquota.aliquota === 15 && (
                    <p className="text-sm text-muted-foreground" role="status">
                      <Info className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
                      Hai aperto nel {formData.annoAperturaPiva}: hai superato i 5 anni di regime agevolato. L'aliquota ordinaria è 15%.
                    </p>
                  )}
                </div>

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
                    value={formData.taxRate}
                    onValueChange={(v) => setFormData({ ...formData, taxRate: v })}
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

                {/* ATECO Selector con Dialog */}
                <div className="space-y-3">
                  <Label>Coefficiente di Redditività</Label>
                  <AtecoCombobox
                    id="settings-ateco"
                    value={formData.atecoCode}
                    coefficient={formData.profitCoefficient}
                    onSelect={handleAtecoSelect}
                    onManualEntry={handleAtecoManualEntry}
                    isManualMode={manualAtecoMode}
                  />
                  <p className="text-sm text-slate-600">
                    Il coefficiente determina quale percentuale del fatturato è considerata reddito imponibile.
                  </p>
                </div>

                {/* ── Gestione INPS (Story 2.6) ── */}
                <Separator />
                <div className="space-y-3">
                  <Label>Gestione INPS</Label>
                  {!canChangeGestione ? (
                    <>
                      {/* Gestione bloccata: incassi > 0 */}
                      <div className="flex items-center gap-2 rounded-lg border border-border p-3 bg-muted/30">
                        <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium">{GESTIONE_LABELS[formData.inpsManagement]}</span>
                        <Badge variant="outline" className="ml-auto text-xs">Attiva</Badge>
                      </div>
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          Non è possibile cambiare gestione INPS con incassi già registrati nell'anno.
                          Il cambio sarà disponibile al prossimo anno fiscale.{" "}
                          <a href="mailto:supporto@forfettino.it" className="underline underline-offset-2 font-medium">
                            Contatta supporto
                          </a>
                        </AlertDescription>
                      </Alert>
                      {/* Fallback commercialista — gestione bloccata (Story 4-3) */}
                      <CommercialistaFallbackAlert
                        trigger="gestione_blocked"
                        isDismissible={false}
                        className="mt-1"
                      />
                    </>
                  ) : (
                    <>
                      {/* Gestione modificabile: incassi = 0, fiscalRules caricato */}
                      <RadioGroup
                        value={formData.inpsManagement}
                        onValueChange={(v) => {
                          const gestioni: GestioneINPS[] = ["separata", "artigiani", "commercianti"];
                          if (gestioni.includes(v as GestioneINPS)) {
                            handleGestioneChangeRequest(v as GestioneINPS);
                          }
                        }}
                        disabled={!fiscalRules}
                        aria-label="Gestione INPS"
                        className="space-y-2"
                      >
                        <div className="flex items-center space-x-2 min-h-[44px]">
                          <RadioGroupItem value="separata" id="gestione-separata" />
                          <Label htmlFor="gestione-separata" className="cursor-pointer">
                            Gestione Separata
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2 min-h-[44px]">
                          <RadioGroupItem value="artigiani" id="gestione-artigiani" />
                          <Label htmlFor="gestione-artigiani" className="cursor-pointer">
                            Artigiani
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2 min-h-[44px]">
                          <RadioGroupItem value="commercianti" id="gestione-commercianti" />
                          <Label htmlFor="gestione-commercianti" className="cursor-pointer">
                            Commercianti
                          </Label>
                        </div>
                      </RadioGroup>
                      <p className="text-sm text-slate-600">
                        La gestione INPS determina come vengono calcolati i contributi previdenziali.
                        {!fiscalRules && " Caricamento parametri in corso..."}
                      </p>
                    </>
                  )}

                  {/* AlertDialog conferma cambio gestione */}
                  <AlertDialog open={showGestioneConfirm} onOpenChange={(open) => {
                    if (!open) handleGestioneChangeCancel();
                  }}>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Conferma cambio gestione INPS</AlertDialogTitle>
                        <AlertDialogDescription className="space-y-2">
                          <span className="block">
                            Stai per cambiare la gestione INPS da{" "}
                            <strong>{GESTIONE_LABELS[formData.inpsManagement]}</strong> a{" "}
                            <strong>{pendingGestione ? GESTIONE_LABELS[pendingGestione] : ""}</strong>.
                          </span>
                          <span className="block">
                            Tutti gli importi fiscali verranno ricalcolati con i nuovi parametri.
                          </span>
                          {pendingGestione === "separata" && formData.inpsManagement !== "separata" && (
                            <span className="block text-sm text-muted-foreground">
                              I parametri Art/Comm (anno iscrizione, riduzioni) verranno resettati.
                            </span>
                          )}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel onClick={handleGestioneChangeCancel}>Annulla</AlertDialogCancel>
                        <AlertDialogAction onClick={handleGestioneChangeConfirm}>
                          Conferma cambio
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                {/* ── Campi condizionali Art/Comm (Story 2.6) ── */}
                {formData.inpsManagement !== "separata" && (
                  <div className="space-y-4 rounded-lg border border-border p-4 bg-muted/20">
                    <p className="text-sm font-medium text-muted-foreground">
                      Parametri {GESTIONE_LABELS[formData.inpsManagement]}
                    </p>

                    {/* Anno iscrizione INPS */}
                    <div className="space-y-2">
                      <Label htmlFor="inps-enrollment-year">Anno di iscrizione alla gestione INPS</Label>
                      <Select
                        value={formData.inpsEnrollmentYear?.toString() ?? ""}
                        onValueChange={(v) => {
                          const year = v ? parseInt(v, 10) : null;
                          const isEligible = year ? isEligibleRiduzione50(year, currentYear) : false;
                          const scadenza = year ? computeRiduzione50Scadenza(year) : null;
                          setFormData({
                            ...formData,
                            inpsEnrollmentYear: year,
                            riduzione50Attiva: isEligible ? formData.riduzione50Attiva : false,
                            riduzione50Scadenza: isEligible ? scadenza : null,
                          });
                        }}
                      >
                        <SelectTrigger id="inps-enrollment-year" aria-label="Anno di iscrizione alla gestione INPS">
                          <SelectValue placeholder="Seleziona anno" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: currentYear - 2000 + 1 }, (_, i) => currentYear - i).map((year) => (
                            <SelectItem key={year} value={year.toString()}>
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-slate-600">
                        L'anno in cui ti sei iscritto alla gestione {GESTIONE_LABELS[formData.inpsManagement]}.
                      </p>
                    </div>

                    {/* Riduzione 50% nuova iscrizione */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="riduzione-50-toggle">Riduzione 50% nuova iscrizione</Label>
                        <p className="text-sm text-slate-600">
                          {formData.riduzione35Attiva
                            ? "Non cumulabile con la riduzione 35%. Disattiva prima la riduzione 35%."
                            : formData.inpsEnrollmentYear && isEligibleRiduzione50(formData.inpsEnrollmentYear, currentYear)
                            ? `Eleggibile — scade il ${computeRiduzione50Scadenza(formData.inpsEnrollmentYear)?.split("-").reverse().join("/") ?? "N/A"}`
                            : "Non eleggibile — riservato a iscrizioni nel 2025 (Legge Bilancio 2025)"}
                        </p>
                      </div>
                      <Switch
                        id="riduzione-50-toggle"
                        checked={formData.riduzione50Attiva}
                        disabled={!formData.inpsEnrollmentYear || !isEligibleRiduzione50(formData.inpsEnrollmentYear, currentYear) || formData.riduzione35Attiva}
                        onCheckedChange={(checked) => {
                          setFormData({
                            ...formData,
                            riduzione50Attiva: checked,
                            riduzione50Scadenza: checked ? computeRiduzione50Scadenza(formData.inpsEnrollmentYear) : null,
                            ...(checked ? { riduzione35Attiva: false } : {}),
                          });
                        }}
                        aria-label="Riduzione 50% nuova iscrizione"
                      />
                    </div>

                    {/* Riduzione 35% */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="riduzione-35-toggle">Riduzione contributiva 35%</Label>
                        <p className="text-sm text-slate-600">
                          {formData.riduzione50Attiva
                            ? "Non cumulabile con la riduzione 50%. Disattiva prima la riduzione 50%."
                            : "Riduzione per contribuenti in regime forfettario"}
                        </p>
                      </div>
                      <Switch
                        id="riduzione-35-toggle"
                        checked={formData.riduzione35Attiva}
                        disabled={formData.riduzione50Attiva}
                        onCheckedChange={(checked) => {
                          setFormData({
                            ...formData,
                            riduzione35Attiva: checked,
                            ...(checked ? { riduzione50Attiva: false, riduzione50Scadenza: null } : {}),
                          });
                        }}
                        aria-label="Riduzione contributiva 35%"
                      />
                    </div>
                  </div>
                )}

                {/* ── Aliquota INPS — condizionale per gestione (Story 2.6) ── */}
                <div className="space-y-3">
                  {formData.inpsManagement === "separata" ? (
                    <>
                      <Label>Aliquota INPS</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={formData.inpsRate}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val) && val >= 0 && val <= 100) {
                            setFormData({ ...formData, inpsRate: val });
                          } else if (e.target.value === "") {
                            setFormData({ ...formData, inpsRate: 26.07 });
                          }
                        }}
                      />
                      <p className="text-sm text-slate-600">
                        Aliquota standard {currentYear}: 26.07%. Range valido: 0-100%.
                      </p>
                    </>
                  ) : (
                    <>
                      <Label>Aliquota INPS {GESTIONE_LABELS[formData.inpsManagement]}</Label>
                      <div className="flex items-center gap-2 rounded-lg border border-border p-3 bg-muted/30">
                        <span className="text-sm font-medium">{formData.inpsRate}%</span>
                        <span className="text-sm text-slate-600 ml-auto">
                          Da parametri {currentYear}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600">
                        L'aliquota INPS per {GESTIONE_LABELS[formData.inpsManagement]} è determinata dai parametri normativi e non è modificabile manualmente.
                      </p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Story 11.1 — Sezione Acconti Già Versati */}
            {(() => {
              const isFirstYear = formData.annoAperturaPiva != null &&
                formData.annoAperturaPiva >= currentYear;
              return (
                <Card>
                  <CardHeader>
                    <CardTitle>Acconti Già Versati</CardTitle>
                    <CardDescription>
                      Importi degli acconti versati per ridurre il saldo da pagare
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {isFirstYear ? (
                      <p className="text-sm text-muted-foreground">
                        Al primo anno non ci sono acconti da dichiarare.
                      </p>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5">
                            <Label htmlFor="acconti-imposta">
                              Acconti imposta sostitutiva versati (cod. 1790 + 1791)
                            </Label>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-[280px]">
                                  <p>Somma del primo acconto (giugno) e secondo acconto (novembre) dell'anno precedente. Trovi gli importi nell'F24 o nel cassetto fiscale.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">€</span>
                            <Input
                              id="acconti-imposta"
                              type="text"
                              inputMode="decimal"
                              placeholder="0"
                              value={accontiImpostaInput}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === "" || /^\d+([.,]\d{0,2})?$/.test(val)) {
                                  setAccontiImpostaInput(val);
                                  const parsed = parseFloat(val.replace(",", "."));
                                  setFormData({ ...formData, accontiImpostaVersati: isNaN(parsed) ? 0 : parsed });
                                }
                              }}
                              className="flex-1"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5">
                            <Label htmlFor="acconti-inps">
                              Acconti INPS eccedenza versati
                            </Label>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-[280px]">
                                  <p>Acconti sulla parte variabile INPS versati l'anno precedente. Non include le rate fisse trimestrali.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">€</span>
                            <Input
                              id="acconti-inps"
                              type="text"
                              inputMode="decimal"
                              placeholder="0"
                              value={accontiInpsInput}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === "" || /^\d+([.,]\d{0,2})?$/.test(val)) {
                                  setAccontiInpsInput(val);
                                  const parsed = parseFloat(val.replace(",", "."));
                                  setFormData({ ...formData, accontiInpsEccedenzaVersati: isNaN(parsed) ? 0 : parsed });
                                }
                              }}
                              className="flex-1"
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })()}

            {saveButton}

            {/* Fallback Commercialista — variazione > 10% (Story 4-3) */}
            {showSettingsVariationAlert && (
              <CommercialistaFallbackAlert
                trigger="settings_variation"
                onDismiss={() => setShowSettingsVariationAlert(false)}
                className="mt-4"
              />
            )}
          </TabsContent>

          {/* ── Tab: Parametri di Prudenza ── */}
          <TabsContent value="prudenza" className="space-y-6 mt-6">
            {/* Preset buttons */}
            <Card>
              <CardHeader>
                <CardTitle>Livello di Prudenza</CardTitle>
                <CardDescription>
                  Scegli un preset oppure personalizza i parametri
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {([
                    { key: "prudente", label: "Prudente", desc: "15%, 60gg, sugli incassi", buffer: 15, days: 60, base: "receipts" as const },
                    { key: "bilanciato", label: "Bilanciato", desc: "10%, 45gg, sugli incassi", buffer: 10, days: 45, base: "receipts" as const },
                    { key: "spinto", label: "Spinto", desc: "5%, 30gg, sull'accantonamento", buffer: 5, days: 30, base: "reserve" as const },
                  ] as const).map((preset) => (
                    <button
                      key={preset.key}
                      onClick={() => {
                        setFormData({
                          ...formData,
                          safetyBufferRate: preset.buffer,
                          deadlineWindowDays: preset.days,
                          bufferBase: preset.base,
                          prudenzaPreset: preset.key,
                        });
                      }}
                      className={cn(
                        "rounded-lg border p-3 text-left transition-all hover:border-primary/50",
                        formData.prudenzaPreset === preset.key
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "border-border"
                      )}
                    >
                      <p className="font-medium text-sm">{preset.label}</p>
                      <p className="text-sm text-slate-600 mt-1">{preset.desc}</p>
                    </button>
                  ))}
                </div>
                {formData.prudenzaPreset === "personalizzato" && (
                  <p className="text-sm text-slate-600 text-center">
                    Stai usando valori personalizzati
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Personalizza</CardTitle>
                <CardDescription>
                  Modifica i singoli parametri di prudenza
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Cuscinetto anti-imprevisti */}
                <TooltipProvider>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Label>Cuscinetto anti-imprevisti</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[280px]">
                            <p>Esempio: 10% = su €10.000 di incassi, il tool consiglia di tenere da parte €1.000 in più.</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          max={30}
                          value={formData.safetyBufferRate}
                          onChange={(e) => {
                            const val = Math.min(30, Math.max(0, parseInt(e.target.value) || 0));
                            setFormData({ ...formData, safetyBufferRate: val });
                          }}
                          className="w-16 h-8 text-center text-sm"
                        />
                        <span className="text-sm font-medium text-primary w-6">%</span>
                      </div>
                    </div>
                    <Slider
                      value={[formData.safetyBufferRate]}
                      onValueChange={([v]) =>
                        setFormData({ ...formData, safetyBufferRate: v, prudenzaPreset: "personalizzato" })
                      }
                      min={0}
                      max={30}
                      step={1}
                    />
                    <div className="flex justify-between text-sm text-slate-600">
                      <span>0%</span>
                      <span>30%</span>
                    </div>
                    <p className="text-sm text-slate-600">
                      Riduce lo spendibile consigliato trattenendo una percentuale extra per imprevisti e stime conservative.
                    </p>
                    {previewValues.bufferAmount > 0 && (
                      <p className="text-sm font-medium text-warning">
                        Impatto oggi: −{formatCurrency(previewValues.bufferAmount)}
                      </p>
                    )}
                  </div>
                </TooltipProvider>

                <Separator />

                {/* Blocca fondi prima delle scadenze */}
                <TooltipProvider>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Label>Blocca fondi prima delle scadenze</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[280px]">
                            <p>Esempio: se un F24 è tra 40 giorni e il blocco è 45 giorni, quell'importo viene già sottratto dallo spendibile.</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          max={90}
                          step={5}
                          value={formData.deadlineWindowDays}
                          onChange={(e) => {
                            const val = Math.min(90, Math.max(0, parseInt(e.target.value) || 0));
                            setFormData({ ...formData, deadlineWindowDays: val });
                          }}
                          className="w-16 h-8 text-center text-sm"
                        />
                        <span className="text-sm font-medium text-primary w-12">giorni</span>
                      </div>
                    </div>
                    <Slider
                      value={[formData.deadlineWindowDays]}
                      onValueChange={([v]) =>
                        setFormData({ ...formData, deadlineWindowDays: v, prudenzaPreset: "personalizzato" })
                      }
                      min={0}
                      max={90}
                      step={5}
                    />
                    <div className="flex justify-between text-sm text-slate-600">
                      <span>0 giorni</span>
                      <span>90 giorni</span>
                    </div>
                    <p className="text-sm text-slate-600">
                      Le scadenze fiscali entro questo periodo vengono sottratte dallo spendibile consigliato.
                    </p>

                    {/* Status scadenze bloccate */}
                    {hasScheduleData ? (
                      <div className="text-sm">
                        <span className="font-medium">Scadenze bloccate oggi: </span>
                        <span className={previewValues.dueSoonRemaining > 0 ? "text-warning font-medium" : "text-muted-foreground"}>
                          {formatCurrency(previewValues.dueSoonRemaining)}
                        </span>
                        {nextDeadlineOutsideWindow && nextDeadlineAny && (
                          <p className="text-sm text-slate-600 mt-1">
                            Prossima scadenza: {new Date(nextDeadlineAny.due_date + "T00:00:00").toLocaleDateString("it-IT")} (fuori finestra)
                          </p>
                        )}
                      </div>
                    ) : (
                      <Alert className="py-2">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          Scadenziario non generato: vai in Scadenziario per calcolare le scadenze fiscali.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </TooltipProvider>

                <Separator />

                {/* Su cosa calcoliamo il cuscinetto? */}
                <div className="space-y-3">
                  <Label>Su cosa calcoliamo il cuscinetto?</Label>
                  <RadioGroup
                    value={formData.bufferBase}
                    onValueChange={(v) =>
                      setFormData({ ...formData, bufferBase: v as "receipts" | "reserve", prudenzaPreset: "personalizzato" })
                    }
                    className="space-y-3"
                  >
                    <div className="flex items-start space-x-3">
                      <RadioGroupItem value="receipts" id="base-receipts" className="mt-0.5" />
                      <div>
                        <Label htmlFor="base-receipts" className="cursor-pointer font-medium">
                          Sugli incassi (più prudente)
                        </Label>
                        <p className="text-sm text-slate-600">
                          Trattiene una % degli incassi totali.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <RadioGroupItem value="reserve" id="base-reserve" className="mt-0.5" />
                      <div>
                        <Label htmlFor="base-reserve" className="cursor-pointer font-medium">
                          Sull'accantonamento (più realistico)
                        </Label>
                        <p className="text-sm text-slate-600">
                          Trattiene una % dell'importo da accantonare per tasse e INPS.
                        </p>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                <Separator />

                {/* Anteprima — voci allineate alla formula reale del Dashboard */}
                {(previewValues.incassiYTD > 0 || formData.saldoInizialeCC > 0) && (
                  <div className="rounded-lg bg-muted/50 p-4 space-y-3">
                    <p className="font-medium text-sm">Anteprima sullo spendibile di oggi</p>
                    <div className="space-y-2 text-sm">
                      {formData.saldoInizialeCC > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Saldo Iniziale CC</span>
                          <span>{formatCurrency(formData.saldoInizialeCC)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Incassi YTD</span>
                        <span>{formatCurrency(previewValues.incassiYTD)}</span>
                      </div>
                      {previewValues.daCopireAmount > 0 && (
                        <div className="flex justify-between text-destructive">
                          <span>
                            − Da coprire (
                            {formData.inpsManagement === "separata"
                              ? "tasse + INPS"
                              : "imposta + INPS variabile"}
                            )
                          </span>
                          <span>{formatCurrency(previewValues.daCopireAmount)}</span>
                        </div>
                      )}
                      {previewValues.bufferAmount > 0 && (
                        <div className="flex justify-between text-warning">
                          <span>− Cuscinetto anti-imprevisti ({formData.safetyBufferRate}%)</span>
                          <span>{formatCurrency(previewValues.bufferAmount)}</span>
                        </div>
                      )}
                      {previewValues.yearlyToolCost > 0 && (
                        <div className="flex justify-between text-warning">
                          <span>− Costi tool annuali</span>
                          <span>{formatCurrency(previewValues.yearlyToolCost)}</span>
                        </div>
                      )}
                      {previewValues.unpaidCurrentYearTotal > 0 && (
                        <div className="flex justify-between text-warning">
                          <span>− Obbligazioni anno non pagate</span>
                          <span>{formatCurrency(previewValues.unpaidCurrentYearTotal)}</span>
                        </div>
                      )}
                      {formData.reserveAmount > 0 && (
                        <div className="flex justify-between text-warning">
                          <span>− Riserva personale</span>
                          <span>{formatCurrency(formData.reserveAmount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold pt-2 border-t border-border">
                        <span>= Spendibile consigliato</span>
                        <span className="text-primary">{formatCurrency(previewValues.spendable)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {saveButton}
          </TabsContent>

          {/* ── Tab: Categorie Servizio ── */}
          <TabsContent value="categorie" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Categorie Servizio</CardTitle>
                <CardDescription>
                  Organizza i tuoi incassi per tipo di servizio
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {categoriesLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : (
                  <>
                    {/* Lista categorie */}
                    {serviceCategories.length > 0 && (
                      <div className="space-y-2">
                        {serviceCategories.map((cat) => (
                          <div
                            key={cat.id}
                            className={cn(
                              "flex items-center gap-3 rounded-lg border border-slate-200/60 px-3 py-2.5",
                              !cat.active && "opacity-50"
                            )}
                          >
                            <span
                              className="inline-block w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: cat.color ?? "#94a3b8" }}
                            />
                            {editingCategoryId === cat.id ? (
                              <Input
                                autoFocus
                                value={editingCategoryName}
                                onChange={(e) => setEditingCategoryName(e.target.value)}
                                onBlur={async () => {
                                  const trimmed = editingCategoryName.trim();
                                  if (trimmed && trimmed !== cat.name) {
                                    try {
                                      await updateCategory({ id: cat.id, updates: { name: trimmed } });
                                    } catch (e: unknown) {
                                      toast({ title: "Errore", description: e instanceof Error ? e.message : "Errore aggiornamento", variant: "destructive" });
                                    }
                                  }
                                  setEditingCategoryId(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                  if (e.key === "Escape") setEditingCategoryId(null);
                                }}
                                className="h-8 flex-1"
                              />
                            ) : (
                              <button
                                type="button"
                                className="flex-1 text-left text-sm text-slate-700 hover:text-slate-900"
                                onClick={() => {
                                  setEditingCategoryId(cat.id);
                                  setEditingCategoryName(cat.name);
                                }}
                              >
                                {cat.name}
                              </button>
                            )}
                            <Switch
                              checked={cat.active}
                              onCheckedChange={async () => {
                                try {
                                  await toggleActive(cat.id);
                                } catch (e: unknown) {
                                  toast({ title: "Errore", description: e instanceof Error ? e.message : "Errore toggle", variant: "destructive" });
                                }
                              }}
                              aria-label={`${cat.active ? "Disattiva" : "Attiva"} categoria ${cat.name}`}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Value explanation (only when empty) */}
                    {activeCategories.length === 0 && (
                      <div className="rounded-lg bg-slate-50 p-4 space-y-2" data-testid="categories-empty-state">
                        <p className="text-sm font-medium text-slate-700">Categorizza per capire da dove arrivano i tuoi guadagni</p>
                        <p className="text-sm text-slate-600">Crea categorie come "Consulenza", "Formazione", "Progettazione" per scoprire qual è il servizio che ti rende di più nei report.</p>
                      </div>
                    )}

                    {/* Suggestions — always visible, hiding already-created ones */}
                    {(() => {
                      const existingNames = new Set(serviceCategories.map((c) => c.name.toLowerCase()));
                      const remaining = getSuggestions(atecoCategory ?? null).filter((name) => !existingNames.has(name.toLowerCase()));
                      if (remaining.length === 0) return null;
                      return (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-slate-700">Aggiungi con un tap</p>
                          <div className="flex flex-wrap gap-2">
                            {remaining.map((name) => (
                              <button
                                key={name}
                                type="button"
                                className="inline-flex items-center rounded-full bg-white px-3 py-1.5 text-sm text-slate-700 shadow-[0_1px_2px_rgba(0,0,0,0.05),0_0_0_1px_rgba(23,23,23,0.05)] hover:bg-slate-100 transition-colors"
                                onClick={async () => {
                                  try {
                                    await createCategoryWithToast({ name });
                                  } catch (e: unknown) {
                                    toast({ title: "Errore", description: e instanceof Error ? e.message : "Errore creazione", variant: "destructive" });
                                  }
                                }}
                              >
                                + {name}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Input nuova categoria */}
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Nuova categoria..."
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        onKeyDown={async (e) => {
                          if (e.key === "Enter" && newCategoryName.trim() && canAddCategory) {
                            try {
                              await createCategoryWithToast({ name: newCategoryName.trim() });
                              setNewCategoryName("");
                            } catch (err: unknown) {
                              toast({ title: "Errore", description: err instanceof Error ? err.message : "Errore creazione", variant: "destructive" });
                            }
                          }
                        }}
                        className="flex-1"
                        disabled={!canAddCategory}
                      />
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button
                                size="sm"
                                disabled={!canAddCategory || !newCategoryName.trim()}
                                onClick={async () => {
                                  try {
                                    await createCategoryWithToast({ name: newCategoryName.trim() });
                                    setNewCategoryName("");
                                  } catch (err: unknown) {
                                    toast({ title: "Errore", description: err instanceof Error ? err.message : "Errore creazione", variant: "destructive" });
                                  }
                                }}
                              >
                                + Nuova categoria
                              </Button>
                            </span>
                          </TooltipTrigger>
                          {!canAddCategory && (
                            <TooltipContent>
                              <p>Limite raggiunto — Passa a Pro</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    </div>

                    {/* Contatore Free */}
                    {!hasPaidPlan && (
                      <p className="text-sm text-slate-500">{categoriesUsed}/{FREE_CATEGORY_LIMIT} categorie usate</p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Tab: Riserva Personale ── */}
          <TabsContent value="riserva" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Riserva Personale</CardTitle>
                <CardDescription>
                  Importo fisso extra da escludere dallo spendibile consigliato
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Label htmlFor="reserve">Importo Riserva (€)</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">€</span>
                    <Input
                      id="reserve"
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={reserveInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "" || /^\d+$/.test(val)) {
                          setReserveInput(val);
                          setFormData({ ...formData, reserveAmount: val ? parseInt(val, 10) : 0 });
                        }
                      }}
                      className="flex-1"
                    />
                  </div>
                  <p className="text-sm text-slate-600">
                    Questo importo viene sottratto dallo spendibile consigliato. Utile per un fondo emergenza, obiettivo di risparmio o spese programmate.
                  </p>
                </div>

                {formData.reserveAmount > 0 && (
                  <div className="rounded-lg bg-muted/50 p-4">
                    <p className="text-sm">
                      <span className="text-muted-foreground">Impatto sullo spendibile: </span>
                      <span className="font-medium text-warning">−{formatCurrency(formData.reserveAmount)}</span>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Story 19-1 — Saldo Iniziale Conto Corrente */}
            <Card>
              <CardHeader>
                <CardTitle>Saldo Iniziale Conto Corrente</CardTitle>
                <CardDescription>
                  Il saldo del tuo conto corrente a inizio anno. Viene sommato agli incassi per calcolare il netto spendibile.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Label htmlFor="saldoInizialeCC">Saldo iniziale conto corrente (€)</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">€</span>
                    <Input
                      id="saldoInizialeCC"
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={saldoInizialeInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "" || /^\d+$/.test(val)) {
                          setSaldoInizialeInput(val);
                          setFormData({ ...formData, saldoInizialeCC: val ? parseInt(val, 10) : 0 });
                        }
                      }}
                      className="flex-1"
                    />
                  </div>
                  <p className="text-sm text-slate-600">
                    A differenza della riserva personale (che protegge un importo dallo spendibile), il saldo CC rappresenta il cash effettivamente disponibile sul tuo conto a inizio anno.
                  </p>
                </div>

                {formData.saldoInizialeCC > 0 && (
                  <div className="rounded-lg bg-muted/50 p-4">
                    <p className="text-sm">
                      <span className="text-muted-foreground">Impatto sullo spendibile: </span>
                      <span className="font-medium text-success">+{formatCurrency(formData.saldoInizialeCC)}</span>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {saveButton}
          </TabsContent>

          {/* ── Tab: Piani abbonamento ── */}
          <TabsContent value="abbonamento" className="space-y-8 mt-6">
            {/* Header */}
            <div>
              <h2 className="text-xl font-semibold">Il tuo piano</h2>
              <p className="text-muted-foreground text-sm">
                Forfettino è gratuito. Ecco cosa include il tuo piano e cosa ti aspetta.
              </p>
            </div>

            {/* Alert scadenza (solo se Pro con cancel_at_period_end — kept for existing Pro users) */}
            {isPro && subscription?.cancel_at_period_end && (
              <Alert className="border-warning-muted bg-warning-muted">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <AlertDescription className="text-warning">
                  Il tuo abbonamento non verrà rinnovato. Continuerai ad avere accesso alle funzionalità Pro fino al{" "}
                  {subscription.current_period_end
                    ? new Date(subscription.current_period_end).toLocaleDateString("it-IT")
                    : "termine del periodo"}.
                </AlertDescription>
              </Alert>
            )}

            {/* Existing Pro user management — kept for backward compat */}
            {isPro && (
              <div className="space-y-2">
                <Button
                  variant="outline"
                  onClick={openPortal}
                  disabled={portalLoading}
                  className="w-full gap-2"
                >
                  {portalLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CreditCard className="h-4 w-4" />
                  )}
                  Gestisci abbonamento
                </Button>
                <p className="text-sm text-slate-600 text-center">
                  Cambia piano, metodo di pagamento o annulla
                </p>
              </div>
            )}

            {/* Pricing Cards Free vs Pro — break out of narrow container */}
            <div className="-mx-4 sm:-mx-8 md:-mx-16 lg:-mx-24">
              <PricingCards variant="settings" isCurrentPlanFree={!isPro} />
            </div>
          </TabsContent>

          {/* ── Tab: Profilo ── */}
          <TabsContent value="profilo" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Dati Personali
                </CardTitle>
                <CardDescription>
                  Modifica il tuo nome e cognome
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {user?.app_metadata?.provider === "google" ? (
                  <div className="space-y-2">
                    <Label htmlFor="profile-email-readonly">Email</Label>
                    <Input id="profile-email-readonly" value={user?.email || ""} disabled className="bg-muted" />
                    <p className="text-sm text-slate-500">
                      Email gestita dal provider Google.
                    </p>
                  </div>
                ) : (
                  <ChangeEmailCard currentEmail={user?.email || ""} />
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="profile-first-name">Nome</Label>
                    <Input
                      id="profile-first-name"
                      value={profileFirstName}
                      onChange={(e) => setProfileFirstName(e.target.value)}
                      placeholder="Mario"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profile-last-name">Cognome</Label>
                    <Input
                      id="profile-last-name"
                      value={profileLastName}
                      onChange={(e) => setProfileLastName(e.target.value)}
                      placeholder="Rossi"
                    />
                  </div>
                </div>
                <Button onClick={handleSaveProfile} disabled={savingProfile} className="w-full gap-2">
                  {savingProfile ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Salva Profilo
                </Button>
              </CardContent>
            </Card>

            {/* Story 36.3 — Quick link cambio password */}
            {isPasswordLogin && (
              <button
                type="button"
                data-testid="change-password-link"
                onClick={() => setActiveTab("sicurezza")}
                className="text-sm text-slate-600 hover:text-slate-900 underline flex items-center gap-1"
              >
                Cambia password
                <ChevronRight className="h-4 w-4" />
              </button>
            )}

            {/* Story 36.2 — Riepilogo dati profilo e fiscali */}
            <ProfileSummaryCard
              user={user}
              profile={profile ?? null}
              formData={formData}
              isLoading={!profile || isLoading}
              setActiveTab={setActiveTab}
            />

          </TabsContent>

          {/* ── Tab: Notifiche ── */}
          <TabsContent value="notifiche" className="space-y-6 mt-6">
            <NotificationPreferencesExpanded />
          </TabsContent>

          {/* ── Tab: Privacy e Dati ── */}
          <TabsContent value="privacy" className="space-y-6 mt-6">
            <PrivacyDataSection />
          </TabsContent>

          {/* ── Tab: Sicurezza ── */}
          {isPasswordLogin && (
            <TabsContent value="sicurezza" className="space-y-6 mt-6">
              {/* Change Password Card */}
              <ChangePasswordCard />

              {/* MFA Toggle Card (Story 16.3) */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Autenticazione a due fattori
                    {mfaEnrolled ? (
                      <Badge data-testid="mfa-badge-active" className="bg-success-muted text-success hover:bg-success-muted">Attivo</Badge>
                    ) : (
                      <Badge data-testid="mfa-badge-inactive" variant="secondary">Disattivo</Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Aggiungi un ulteriore livello di sicurezza al tuo account con la verifica in due passaggi.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {mfaEnrolled ? (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        La verifica in due passaggi è attiva. Ad ogni login ti verrà chiesto il codice dall'app di autenticazione.
                      </p>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10">
                            <Shield className="h-4 w-4" />
                            Disattiva autenticazione a due fattori
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Disattivare il 2FA?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Rimuovendo la verifica in due passaggi, il tuo account sarà protetto solo dalla password.
                              I codici di backup saranno invalidati. Potrai riattivare il 2FA in qualsiasi momento.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annulla</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={handleDisableMfa}
                              disabled={disablingMfa}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {disablingMfa ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : null}
                              Disattiva
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Il 2FA non è attivo. Attivalo per proteggere il tuo account con un secondo fattore di verifica.
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => navigate("/mfa/setup")}
                        className="gap-2"
                      >
                        <Shield className="h-4 w-4" />
                        Attiva autenticazione a due fattori
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Backup Codes Card — only when MFA is active */}
              {mfaEnrolled && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <KeyRound className="h-5 w-5" />
                      Codici di backup
                    </CardTitle>
                    <CardDescription>
                      Usa i codici di backup per accedere se perdi il telefono
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {newBackupCodes ? (
                      <div className="space-y-4">
                        <Alert>
                          <KeyRound className="h-4 w-4" />
                          <AlertDescription>
                            <strong>Salva questi codici in un posto sicuro!</strong> Non saranno più visibili.
                          </AlertDescription>
                        </Alert>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {newBackupCodes.map((c, i) => (
                            <code
                              key={i}
                              className="rounded bg-muted px-3 py-2 text-center text-sm font-mono tracking-wider"
                            >
                              {c}
                            </code>
                          ))}
                        </div>
                        <Button
                          variant="outline"
                          className="w-full gap-2"
                          onClick={async () => {
                            await navigator.clipboard.writeText(newBackupCodes.join("\n"));
                            toast({ title: "Codici copiati!" });
                          }}
                        >
                          <Copy className="h-4 w-4" />
                          Copia tutti i codici
                        </Button>
                        <Button
                          variant="ghost"
                          className="w-full"
                          onClick={() => setNewBackupCodes(null)}
                        >
                          Chiudi
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          {backupCodesRemaining != null
                            ? `Codici rimasti: ${backupCodesRemaining} / 10`
                            : "Caricamento..."}
                        </p>
                        {backupCodesRemaining === 0 && (
                          <Alert>
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                              Non hai più codici di backup. Rigenerali per evitare il rischio di lockout.
                            </AlertDescription>
                          </Alert>
                        )}
                        <Button
                          variant="outline"
                          onClick={handleRegenerateBackupCodes}
                          disabled={regeneratingCodes}
                          className="gap-2"
                        >
                          {regeneratingCodes ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                          Rigenera codici di backup
                        </Button>
                        <p className="text-sm text-slate-600">
                          I vecchi codici saranno invalidati.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          )}
        </Tabs>
      </PageContainer>
      </PageErrorBoundary>
    </AppLayout>
  );
}
