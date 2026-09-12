import { useEffect } from "react";

/**
 * usePWAUpdate
 * -----------------------------------------------------------------------------
 * Forza il browser a controllare periodicamente se c'e' un nuovo Service Worker
 * disponibile, e in caso affermativo ricarica la pagina automaticamente.
 *
 * Contesto: vite-plugin-pwa e' gia' configurato con
 *   registerType: 'autoUpdate', skipWaiting: true, clientsClaim: true
 * ma il BROWSER puo' cache-are `sw.js` stesso via HTTP cache, ritardando il
 * rilevamento di una nuova versione anche dopo un deploy.
 *
 * Questo hook chiama `registration.update()` ogni 60 secondi (e al mount),
 * forzando il re-check del SW. Quando un nuovo SW e' installato e attivato,
 * `controllerchange` scatta e ricarichiamo la pagina per mostrare la nuova
 * build — coerentemente col comportamento `autoUpdate` dichiarato.
 *
 * Safe guards:
 *  - skip in dev (il SW non e' registrato da vite in dev)
 *  - skip se SW non supportato dal browser
 *  - `reloading` flag per evitare reload ripetuti se piu' SW cambiano
 *    consecutivamente
 */
export function usePWAUpdate(pollIntervalMs: number = 60_000) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (import.meta.env.DEV) return;

    let reloading = false;
    let intervalId: number | null = null;

    const pollForUpdates = async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((r) => r.update()));
      } catch {
        /* fail-silent: in privacy-restricted contexts update() puo' fallire */
      }
    };

    const onControllerChange = () => {
      // Un nuovo SW ha preso controllo (triggered da skipWaiting + clientsClaim).
      // Ricarichiamo una sola volta per servire l'HTML/JS dalla nuova versione.
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    // Primo check subito al mount (dopo 2s per non competere con altri init)
    const initialCheck = window.setTimeout(pollForUpdates, 2_000);
    // Poi check periodico
    intervalId = window.setInterval(pollForUpdates, pollIntervalMs);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      window.clearTimeout(initialCheck);
      if (intervalId !== null) window.clearInterval(intervalId);
    };
  }, [pollIntervalMs]);
}
