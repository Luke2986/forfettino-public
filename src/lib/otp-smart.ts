/**
 * OTP Smart — Logica soglia per verifica OTP dopo inattivita'.
 * Story 67.1 + 67.2 (Device Trust)
 */

/** Soglia di inattivita' in giorni: se l'ultima verifica OTP e' piu' vecchia, richiedere OTP. */
export const OTP_THRESHOLD_DAYS = 14;

/** Durata default del device trust token in giorni. */
export const DEVICE_TRUST_EXPIRY_DAYS = 30;

// ── Device Trust Token (Story 67.2) ──────────────────────────

export interface DeviceTrustToken {
  userId: string;
  createdAt: string;
  expiresAt: string;
}

/**
 * Salva un device trust token in localStorage.
 * Chiamare dopo verifica OTP riuscita per "ricordare" il dispositivo.
 */
export function saveDeviceTrust(
  userId: string,
  expiryDays: number = DEVICE_TRUST_EXPIRY_DAYS,
): void {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000);
  const token: DeviceTrustToken = {
    userId,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
  localStorage.setItem(`device_trust_${userId}`, JSON.stringify(token));
}

/**
 * Verifica se il dispositivo corrente e' fidato per l'utente dato.
 * Fail-open: se token corrotto/mancante → false (non fidato, OTP procede).
 */
export function isDeviceTrusted(userId: string): boolean {
  try {
    const raw = localStorage.getItem(`device_trust_${userId}`);
    if (!raw) return false;

    const token: DeviceTrustToken = JSON.parse(raw);
    if (token.userId !== userId) return false;

    const expiresAt = new Date(token.expiresAt);
    if (isNaN(expiresAt.getTime())) return false;

    return Date.now() < expiresAt.getTime();
  } catch {
    return false;
  }
}

/**
 * Rimuove device trust token(s) da localStorage.
 * Se userId fornito → rimuove solo quel token.
 * Se non fornito → rimuove tutti i token device_trust_*.
 */
export function clearDeviceTrust(userId?: string): void {
  if (userId) {
    localStorage.removeItem(`device_trust_${userId}`);
    return;
  }
  // Rimuovi tutti i device_trust_* keys
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith("device_trust_")) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));
}

/**
 * Determina se l'utente deve completare la verifica OTP.
 *
 * @param lastOtpVerifiedAt - ISO timestamp dell'ultima verifica OTP riuscita (da profiles.last_otp_verified_at). Null = mai verificato.
 * @param thresholdDays - Numero di giorni di soglia (default: OTP_THRESHOLD_DAYS)
 * @returns true se l'OTP e' richiesto, false se l'accesso e' diretto
 */
export function shouldRequireOtp(
  lastOtpVerifiedAt: string | null,
  thresholdDays: number = OTP_THRESHOLD_DAYS,
): boolean {
  // Mai verificato → richiedi OTP (fail-closed)
  if (!lastOtpVerifiedAt) return true;

  const lastVerified = new Date(
    lastOtpVerifiedAt.includes("T") ? lastOtpVerifiedAt : lastOtpVerifiedAt + "T00:00:00",
  );

  // Data invalida → richiedi OTP (fail-closed)
  if (isNaN(lastVerified.getTime())) return true;

  const diffMs = Date.now() - lastVerified.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  return diffDays > thresholdDays;
}
