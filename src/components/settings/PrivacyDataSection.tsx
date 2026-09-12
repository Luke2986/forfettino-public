import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
import { FileText, Download, Trash2, Loader2, ShieldCheck, ExternalLink } from "lucide-react";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { useProWaitlist } from "@/hooks/useProWaitlist";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { setAnalyticsConsent } from "@/lib/analytics";

/** Format ISO date as "5 marzo 2026". Handles null and timezone-safe parsing. */
function formatDateLongIT(isoDate: string | null): string {
  if (!isoDate) return "";
  try {
    // Append T00:00:00 to date-only strings to force local-time parsing (timezone safety rule)
    const safe = isoDate.includes("T") ? isoDate : `${isoDate}T00:00:00`;
    return new Intl.DateTimeFormat("it-IT", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(safe));
  } catch {
    return "";
  }
}

/** Get local date string YYYY-MM-DD without UTC shift (timezone safety rule). */
function toLocalDateStr(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function PrivacyDataSection() {
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Export state
  const [exporting, setExporting] = useState(false);

  // Delete account state
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Optimistic local state for toggles — instant UI feedback with rollback on error
  // MUST be declared before any conditional return to respect Rules of Hooks
  const [optimisticAnalytics, setOptimisticAnalytics] = useState<boolean | null>(null);
  const [optimisticMarketing, setOptimisticMarketing] = useState<boolean | null>(null);

  if (isLoading || !profile) {
    return (
      <div className="space-y-6">
        <Card>
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
      </div>
    );
  }

  const analyticsValue = optimisticAnalytics ?? profile.analytics_consent ?? false;
  const marketingValue = optimisticMarketing ?? profile.marketing_email_consent ?? false;

  const handleAnalyticsToggle = async (checked: boolean) => {
    const previous = profile.analytics_consent ?? false;
    // Se la scrittura fallisce si torna allo stato precedente, che per un utente
    // che non aveva mai scelto NON e' un rifiuto esplicito: passare il default
    // explicit:true lo farebbe finire su reset() e ricreerebbe lo split di
    // identita' che il fix rimuove.
    const previousExplicit = profile.analytics_consent_at != null;
    setOptimisticAnalytics(checked);
    setAnalyticsConsent(checked);
    try {
      await updateProfile.mutateAsync({
        analytics_consent: checked,
        analytics_consent_at: new Date().toISOString(),
      });
      toast({ title: checked ? "Analytics attivato" : "Analytics disattivato" });
    } catch {
      setOptimisticAnalytics(previous);
      setAnalyticsConsent(previous, { explicit: previousExplicit });
      toast({
        title: "Errore",
        description: "Impossibile aggiornare la preferenza analytics.",
        variant: "destructive",
      });
    } finally {
      setOptimisticAnalytics(null);
    }
  };

  const handleMarketingToggle = async (checked: boolean) => {
    const previous = profile.marketing_email_consent ?? false;
    setOptimisticMarketing(checked);
    try {
      await updateProfile.mutateAsync({
        marketing_email_consent: checked,
        marketing_email_consent_at: new Date().toISOString(),
      });
      toast({ title: checked ? "Email marketing attivate" : "Email marketing disattivate" });
    } catch {
      setOptimisticMarketing(previous);
      toast({
        title: "Errore",
        description: "Impossibile aggiornare la preferenza email.",
        variant: "destructive",
      });
    } finally {
      setOptimisticMarketing(null);
    }
  };

  const handleExportData = async () => {
    setExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Non autenticato");

      const { data, error } = await supabase.functions.invoke("export-user-data", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;

      // Download JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = toLocalDateStr();
      a.href = url;
      a.download = `forfettino-data-export-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: "Esportazione completata", description: "Il file JSON e' stato scaricato." });
    } catch (err) {
      console.error("[ExportData] Errore esportazione:", err);
      toast({
        title: "Errore",
        description: "Impossibile esportare i dati. Riprova tra qualche minuto.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "ELIMINA" || !user) return;
    setDeletingAccount(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Non autenticato");

      const response = await supabase.functions.invoke("delete-account", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (response.error) throw response.error;

      await supabase.auth.signOut();
      navigate("/");
      toast({
        title: "Account eliminato",
        description: "Tutti i tuoi dati sono stati cancellati permanentemente.",
      });
    } catch {
      // Recovery: if the Edge Function partially executed and destroyed
      // the profile but failed on deleteUser, the user is in a zombie state.
      const { data: checkProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!checkProfile) {
        await supabase.auth.signOut();
        navigate("/");
        toast({
          title: "Errore parziale",
          description: "L'eliminazione non e' andata a buon fine completamente. Sei stato disconnesso. Contatta il supporto.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Errore",
        description: "Impossibile eliminare l'account. Riprova o contatta il supporto.",
        variant: "destructive",
      });
    } finally {
      setDeletingAccount(false);
    }
  };

  const legalDocs = [
    {
      label: "Privacy Policy",
      href: "/privacy-policy",
      acceptedAt: profile.privacy_policy_accepted_at,
      version: profile.privacy_policy_version,
    },
    {
      label: "Cookie Policy",
      href: "/cookie-policy",
      acceptedAt: profile.privacy_policy_accepted_at,
      version: profile.privacy_policy_version,
      note: "Accettata insieme alla Privacy Policy",
    },
    {
      label: "Termini di Servizio",
      href: "/terms",
      acceptedAt: profile.tos_accepted_at,
      version: profile.tos_version,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Documenti Legali */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documenti Legali
          </CardTitle>
          <CardDescription>
            Versioni accettate delle nostre policy
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {legalDocs.map((doc, idx) => (
            <div key={doc.label}>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <a
                    href={doc.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
                  >
                    {doc.label}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  {doc.acceptedAt ? (
                    <p className="text-xs text-muted-foreground">
                      Accettati il: {formatDateLongIT(doc.acceptedAt)} — {doc.version}
                      {"note" in doc && doc.note && (
                        <span className="block text-xs italic mt-0.5">{doc.note}</span>
                      )}
                    </p>
                  ) : (
                    <p className="text-xs text-amber-600 font-medium">
                      Non ancora accettati
                    </p>
                  )}
                </div>
              </div>
              {idx < legalDocs.length - 1 && <Separator className="mt-4" />}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Consensi Comunicazioni */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Consensi
          </CardTitle>
          <CardDescription>
            Gestisci le tue preferenze su comunicazioni e analytics
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Marketing email toggle */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Comunicazioni</h4>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="marketing-toggle">Email di marketing</Label>
                <p className="text-sm text-muted-foreground">
                  Aggiornamenti, novita' e suggerimenti via email
                </p>
              </div>
              <Switch
                id="marketing-toggle"
                checked={marketingValue}
                onCheckedChange={handleMarketingToggle}
                aria-label="Email di marketing"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2 italic">
              Le comunicazioni di servizio (scadenze fiscali) restano sempre attive
            </p>
          </div>

          <Separator />

          {/* Analytics toggle */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Analytics e profilazione</h4>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="analytics-toggle">Tracciamento analytics</Label>
                <p className="text-sm text-muted-foreground">
                  Raccogliamo dati anonimi sull'utilizzo dell'app per migliorarne le funzionalita'. Questo include le pagine visitate e le azioni principali.
                </p>
              </div>
              <Switch
                id="analytics-toggle"
                checked={analyticsValue}
                onCheckedChange={handleAnalyticsToggle}
                aria-label="Tracciamento analytics"
              />
            </div>
            {!analyticsValue && (
              <p className="text-xs text-muted-foreground mt-2 italic">
                I dati gia' raccolti verranno cancellati entro 30 giorni
              </p>
            )}
          </div>

          <Separator />

          {/* Waitlist Pro toggle */}
          <ProWaitlistToggle />
        </CardContent>
      </Card>

      {/* I tuoi dati */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            I Tuoi Dati
          </CardTitle>
          <CardDescription>
            Esporta o elimina i tuoi dati personali
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              onClick={handleExportData}
              disabled={exporting}
              className="gap-2"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Esporta i miei dati
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Scarica un file JSON contenente tutti i tuoi dati: profilo, incassi, impostazioni fiscali, scadenze e notifiche.
          </p>

          <Separator />

          {/* Danger Zone: Account Deletion */}
          <div className="pt-2">
            <h4 className="text-sm font-medium text-destructive mb-3">Zona pericolosa</h4>
            <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => {
              setDeleteDialogOpen(open);
              if (!open) setDeleteConfirmText("");
            }}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="gap-2">
                  <Trash2 className="h-4 w-4" />
                  Elimina il mio account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Sei sicuro di voler eliminare il tuo account?</AlertDialogTitle>
                  <AlertDialogDescription className="space-y-3">
                    <span className="block">
                      Questa azione e' irreversibile. Tutti i tuoi dati verranno eliminati permanentemente entro 30 giorni.
                    </span>
                    <span className="block font-medium text-destructive">
                      Questa operazione non puo' essere annullata.
                    </span>
                    <span className="block text-sm">
                      Per confermare, digita <strong>ELIMINA</strong> nel campo sottostante:
                    </span>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Digita ELIMINA per confermare"
                  className="mt-2"
                />
                <AlertDialogFooter>
                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteAccount}
                    disabled={deleteConfirmText !== "ELIMINA" || deletingAccount}
                    className="gap-2"
                  >
                    {deletingAccount ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Elimina permanentemente
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <p className="text-xs text-muted-foreground mt-2">
              Una volta eliminato, il tuo account e tutti i dati associati saranno cancellati permanentemente.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Waitlist Pro toggle (GDPR revocabile) ──

function ProWaitlistToggle() {
  const { isJoined, wasRevoked, isLoading, revoke, rejoin, data } = useProWaitlist();
  const { toast } = useToast();

  if (isLoading) return null;

  // Non mostrare se l'utente non si è mai iscritto
  if (!data) return null;

  const handleToggle = (checked: boolean) => {
    if (checked) {
      rejoin.mutate(undefined, {
        onSuccess: () => toast({ title: "Iscrizione riattivata", description: "Ti avviseremo al lancio di Pro." }),
        onError: () => toast({ title: "Errore", description: "Riprova.", variant: "destructive" }),
      });
    } else {
      revoke.mutate(undefined, {
        onSuccess: () => toast({ title: "Iscrizione revocata", description: "Non riceverai la notifica di lancio Pro." }),
        onError: () => toast({ title: "Errore", description: "Riprova.", variant: "destructive" }),
      });
    }
  };

  return (
    <div>
      <h4 className="text-sm font-medium text-muted-foreground mb-3">Waitlist Pro</h4>
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Label htmlFor="waitlist-toggle">Notifica lancio Pro</Label>
          <p className="text-sm text-muted-foreground">
            Ricevi un'email quando la versione Pro sara' disponibile
          </p>
        </div>
        <Switch
          id="waitlist-toggle"
          checked={isJoined}
          onCheckedChange={handleToggle}
          disabled={revoke.isPending || rejoin.isPending}
          aria-label="Notifica lancio Pro"
        />
      </div>
      {isJoined && data?.consent_given_at && (
        <p className="text-xs text-muted-foreground mt-2 italic">
          Consenso dato il {new Date(data.consent_given_at).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}
        </p>
      )}
    </div>
  );
}
