import { useMemo, useCallback, useSyncExternalStore } from "react";
import { useProfile } from "./useProfile";
import { useFiscalCalculations } from "./useFiscalCalculations";

const DISMISS_STORAGE_KEY = "forfettino:onboarding-checklist-dismissed";
const DISMISS_EVENT = "forfettino:onboarding-checklist-dismissed-change";

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function subscribeDismissed(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === DISMISS_STORAGE_KEY) {
      onStoreChange();
    }
  };

  const handleCustomEvent = () => {
    onStoreChange();
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(DISMISS_EVENT, handleCustomEvent);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(DISMISS_EVENT, handleCustomEvent);
  };
}

export interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  /** Visibile solo per Artigiani/Commercianti */
  artCommOnly?: boolean;
}

export interface OnboardingChecklistResult {
  items: ChecklistItem[];
  percentage: number;
  isComplete: boolean;
  isDismissed: boolean;
  isLoading: boolean;
  dismiss: () => void;
}

export function useOnboardingChecklist(): OnboardingChecklistResult {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { metrics, isLoading: metricsLoading } = useFiscalCalculations();

  const isDismissed = useSyncExternalStore(
    subscribeDismissed,
    readDismissed,
    () => false
  );

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_STORAGE_KEY, "true");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(DISMISS_EVENT));
      }
    } catch {
      // ignore storage errors (private mode, SSR)
    }
  }, []);

  const isLoading = profileLoading || metricsLoading;

  const items = useMemo((): ChecklistItem[] => {
    if (!metrics) return [];
    // AC1: checklist visibile solo se l'utente ha completato il wizard di onboarding
    if (!profile?.onboarding_completed) return [];

    const isArtComm = metrics.inpsManagement !== "separata";

    const allItems: ChecklistItem[] = [
      {
        id: "profile-complete",
        label: "Profilo completato",
        completed: !!(profile?.first_name && profile?.last_name),
      },
      {
        id: "gestione-inps",
        label: "Gestione INPS selezionata",
        completed: !!profile?.onboarding_completed,
      },
      {
        id: "fiscal-data",
        label: "Dati fiscali configurati",
        completed:
          metrics.settings.taxRate !== undefined &&
          metrics.settings.profitCoeff !== undefined,
      },
      {
        id: "first-receipt",
        label: "Primo incasso registrato",
        completed: metrics.incassiYTD > 0,
      },
      {
        id: "schedule-viewed",
        label: "Scadenziario attivo",
        completed: metrics.hasScheduleData,
      },
      // Art/Comm only items
      {
        id: "riduzione-35",
        label: "Riduzione 35% configurata",
        // TODO: riduzione_35_attiva è boolean (non nullable, default false) nel DB,
        // quindi non si può distinguere "non ha risposto" da "ha risposto No".
        // Si usa onboarding_completed come proxy perché il wizard obbliga Art/Comm a rispondere.
        // Se il campo diventa nullable in futuro, usare il campo diretto.
        completed: !!profile?.onboarding_completed,
        artCommOnly: true,
      },
      {
        id: "rate-scadute-verified",
        label: "Rate scadute verificate",
        completed:
          metrics.bannerRateScaduteDismissed || metrics.expiredRatesCount === 0,
        artCommOnly: true,
      },
    ];

    // Filtra per gestione
    return allItems.filter((item) => !item.artCommOnly || isArtComm);
  }, [metrics, profile]);

  const { percentage, isComplete } = useMemo(() => {
    if (items.length === 0) return { percentage: 0, isComplete: false };
    const completed = items.filter((i) => i.completed).length;
    const pct = Math.round((completed / items.length) * 100);
    return { percentage: pct, isComplete: pct === 100 };
  }, [items]);

  return {
    items,
    percentage,
    isComplete,
    isDismissed,
    isLoading,
    dismiss,
  };
}
