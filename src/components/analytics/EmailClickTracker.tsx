import { useEffect } from "react";
import { posthog, isPosthogReady } from "@/lib/posthog";
import { parseEmailCampaign } from "@/lib/email-campaign-utm";

/**
 * EmailClickTracker — cattura `deadline_email_clicked` all'atterraggio dall'email (Story 84-6).
 *
 * Renderizza `null`. Montato SOPRA le route (sibling di `<Routes>` dentro `<BrowserRouter>`,
 * vedi App.tsx) per intercettare il PRIMISSIMO load dell'URL email PRIMA del redirect di auth:
 * `/scadenziario?utm_source=email&...` è dietro ProtectedRoute → un utente sloggato viene
 * rediretto a `/login` e gli UTM si perdono dall'URL. Catturando al mount globale leggiamo
 * `window.location.search` prima che il redirect consumi la query (fatto #5).
 *
 * - Cattura SOLO se `utm_source=email` (atterraggio da una nostra email).
 * - `posthog.capture` DIRETTO (NON `track()`): l'utente può essere anonimo pre-login e
 *   `track()` salta gli anonimi. Il click anonimo viene poi fuso via `identify()` post-consenso.
 * - Fire ONCE per atterraggio: dedup via `sessionStorage` keyed sul campaign (evita doppioni
 *   su StrictMode/re-render/navigazione SPA).
 * - Fail-silent ovunque: l'analytics non deve mai rompere l'app.
 */
const DEDUP_PREFIX = "ph_email_click:";

export function EmailClickTracker(): null {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("utm_source") !== "email") return;
      if (!isPosthogReady) return;

      const campaign = params.get("utm_campaign") ?? "";
      // L2 review 84-6: i nostri link email impostano SEMPRE utm_campaign (buildScadenziarioUrl,
      // mai vuoto). utm_source=email senza campaign = link non canonico → skip (evita un evento
      // rumoroso `{campaign:""}` non riconducibile a una soglia/bucket).
      if (!campaign) return;

      // Dedup: una sola capture per (atterraggio, campaign). Set PRIMA della capture così
      // il secondo run sincrono di StrictMode trova già la chiave e non duplica.
      const dedupKey = `${DEDUP_PREFIX}${campaign}`;
      try {
        if (window.sessionStorage.getItem(dedupKey)) return;
        window.sessionStorage.setItem(dedupKey, "1");
      } catch {
        // sessionStorage non disponibile (private mode): procede senza dedup persistente.
      }

      const parsed = parseEmailCampaign(campaign);
      const props: Record<string, unknown> = { campaign };
      if (parsed) {
        props.bucket = parsed.bucket;
        props.threshold = parsed.threshold;
      }

      posthog.capture("deadline_email_clicked", props);
    } catch {
      // fail-silent
    }
    // mount-only: la query va letta al primo load, prima di qualsiasi redirect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

export default EmailClickTracker;
