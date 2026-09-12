import { useState, useEffect, useCallback, useMemo } from "react";

export interface ClientFormDraft {
  display_name: string;
  legal_name: string;
  vat_number: string;
  tax_code: string;
  email: string;
  phone: string;
  address_text: string;
  notes: string;
  active: boolean;
}

const STORAGE_PREFIX = "forfettino:client-draft:";

function buildKey(
  userId: string | undefined,
  clientId: string | null,
): string | null {
  if (!userId) return null;
  return `${STORAGE_PREFIX}${userId}:${clientId ?? "new"}`;
}

function isValidDraft(parsed: unknown): parsed is ClientFormDraft {
  if (!parsed || typeof parsed !== "object") return false;
  const d = parsed as Record<string, unknown>;
  return (
    typeof d.display_name === "string" &&
    typeof d.legal_name === "string" &&
    typeof d.vat_number === "string" &&
    typeof d.tax_code === "string" &&
    typeof d.email === "string" &&
    typeof d.phone === "string" &&
    typeof d.address_text === "string" &&
    typeof d.notes === "string" &&
    typeof d.active === "boolean"
  );
}

function readDraft(key: string | null): ClientFormDraft | null {
  if (!key) return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isValidDraft(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export interface UseClientDraftParams {
  userId: string | undefined;
  clientId: string | null;
  enabled: boolean;
}

/**
 * `draft` rappresenta il valore al momento del mount/cambio-chiave (restore).
 * `saveDraft` persiste ma NON aggiorna `draft` di proposito: evita che un
 * eventuale effetto di restore nel consumer sovrascriva l'input mentre
 * l'utente sta digitando. Il prossimo valore di `draft` arriva alla prossima
 * apertura del form (key change).
 */
export function useClientDraft({
  userId,
  clientId,
  enabled,
}: UseClientDraftParams) {
  const key = useMemo(
    () => (enabled ? buildKey(userId, clientId) : null),
    [userId, clientId, enabled],
  );

  const [draft, setDraft] = useState<ClientFormDraft | null>(() =>
    readDraft(key),
  );

  useEffect(() => {
    setDraft(readDraft(key));
  }, [key]);

  const saveDraft = useCallback(
    (data: ClientFormDraft) => {
      if (!key) return;
      try {
        sessionStorage.setItem(key, JSON.stringify(data));
      } catch {
        // SSR, incognito, quota — ignora silenziosamente
      }
    },
    [key],
  );

  const clearDraft = useCallback(() => {
    if (!key) {
      setDraft(null);
      return;
    }
    try {
      sessionStorage.removeItem(key);
    } catch {
      // ignora
    }
    setDraft(null);
  }, [key]);

  return {
    draft,
    saveDraft,
    clearDraft,
    hasDraft: draft !== null,
  };
}
