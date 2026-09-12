import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { CURRENT_PRIVACY_VERSION } from "@/lib/legal-versions";

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  return (
    <>
      <Helmet>
        <title>Privacy Policy — Forfettino</title>
        <meta
          name="description"
          content="Informativa privacy di Forfettino per utenti, clienti e visitatori del sito."
        />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />
        <link rel="canonical" href="https://forfettino.it/privacy-policy" />
      </Helmet>
      <PageContainer narrow className="py-8 sm:py-12">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleBack}
        className="mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Torna indietro
      </Button>

      <article className="prose prose-slate max-w-none">
        <p className="text-sm text-muted-foreground mb-2">
          Ultimo aggiornamento: 1 settembre 2026 &middot; Versione {CURRENT_PRIVACY_VERSION}
        </p>
        <h1 className="text-2xl font-bold mb-6">Privacy Policy</h1>

        <p className="italic text-sm text-muted-foreground mb-6">
          Questo documento sarà validato da consulente legale. La struttura è conforme al GDPR
          (Regolamento UE 2016/679).
        </p>

        {/* 1. Titolare */}
        <h2 className="text-lg font-semibold mt-8 mb-3">1. Titolare del Trattamento</h2>
        <p>
          Il titolare del trattamento è una persona fisica, raggiungibile all'indirizzo email{" "}
          <a href="mailto:privacy@forfettino.it" className="text-primary hover:underline">
            privacy@forfettino.it
          </a>.
        </p>

        {/* 2. Dati raccolti */}
        <h2 className="text-lg font-semibold mt-8 mb-3">2. Dati Raccolti</h2>
        <p>Forfettino raccoglie le seguenti categorie di dati personali:</p>
        <ol className="list-decimal pl-6 space-y-1 text-sm">
          <li><strong>Dati di account:</strong> nome, cognome, indirizzo email, avatar (se autenticazione via Google OAuth)</li>
          <li><strong>Dati fiscali:</strong> anno apertura P.IVA, codice ATECO, coefficiente di redditività, gestione INPS, aliquote, riduzione contributiva</li>
          <li><strong>Dati operativi:</strong> incassi registrati, piani di rateizzazione, scadenze fiscali</li>
          <li><strong>Preferenze utente:</strong> impostazioni notifiche, preferenze UI, saldo iniziale conto corrente</li>
          <li><strong>Survey e feedback:</strong> risposte a questionari (es. pricing survey Van Westendorp), feedback spontaneo</li>
          <li><strong>Gamification:</strong> punti contributo, traguardi, posizione classifica</li>
          <li><strong>Referral:</strong> codice utente univoco, indirizzo IP (conservato per 30 giorni esclusivamente per prevenzione antifrode)</li>
          <li><strong>Analytics:</strong> dati aggregati anonimi di utilizzo; per gli utenti autenticati, eventi PostHog associati a un identificativo pseudonimo dell'account; in caso di consenso esplicito, anche indirizzo email e attributi di profilo (profilazione)</li>
          <li><strong>Dati tecnici:</strong> token di sessione per l'autenticazione (cookie tecnico Supabase)</li>
        </ol>

        {/* 3. Finalità e base giuridica */}
        <h2 className="text-lg font-semibold mt-8 mb-3">3. Finalità e Base Giuridica</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <caption className="sr-only">Finalità del trattamento e relative basi giuridiche</caption>
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-4 font-semibold">Finalità</th>
                <th className="text-left py-2 font-semibold">Base giuridica</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr><td className="py-2 pr-4">Erogazione del servizio (calcoli fiscali, scadenziario, dashboard)</td><td className="py-2">Esecuzione del contratto (Art. 6.1.b)</td></tr>
              <tr><td className="py-2 pr-4">Invio email di promemoria scadenze fiscali (reminder)</td><td className="py-2">Esecuzione del contratto (Art. 6.1.b)</td></tr>
              <tr><td className="py-2 pr-4">Segnali tecnici di recapito email (consegna, sicurezza anti-abuso)</td><td className="py-2">Legittimo interesse (Art. 6.1.f)</td></tr>
              <tr><td className="py-2 pr-4">Analytics di prodotto con identificativo pseudonimo (utenti autenticati)</td><td className="py-2">Legittimo interesse (Art. 6.1.f)</td></tr>
              <tr><td className="py-2 pr-4">Profilazione analytics con PostHog (email e attributi di profilo)</td><td className="py-2">Consenso esplicito (Art. 6.1.a)</td></tr>
              <tr><td className="py-2 pr-4">Invio comunicazioni marketing via email</td><td className="py-2">Consenso esplicito (Art. 6.1.a)</td></tr>
              <tr><td className="py-2 pr-4">Survey e raccolta feedback</td><td className="py-2">Consenso (Art. 6.1.a)</td></tr>
              <tr><td className="py-2 pr-4">Analytics aggregati anonimi</td><td className="py-2">Legittimo interesse (Art. 6.1.f)</td></tr>
              <tr><td className="py-2 pr-4">Gamification e classifica contributi</td><td className="py-2">Legittimo interesse (Art. 6.1.f)</td></tr>
              <tr><td className="py-2 pr-4">Prevenzione antifrode referral (IP tracking)</td><td className="py-2">Legittimo interesse (Art. 6.1.f)</td></tr>
            </tbody>
          </table>
        </div>

        {/* 4. Canali di comunicazione */}
        <h2 className="text-lg font-semibold mt-8 mb-3">4. Canali di Comunicazione</h2>
        <p>
          Forfettino comunica con l'utente attraverso notifiche in-app (messaggi nel pannello "Messaggi")
          e via email. Distinguiamo due tipi di email:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-sm">
          <li>
            <strong>Email di servizio</strong> (es. promemoria delle scadenze fiscali): parte integrante
            del servizio richiesto, trattate sulla base dell'esecuzione del contratto (Art. 6.1.b). Sono
            attive per impostazione predefinita; l'utente può disattivarle in qualsiasi momento tramite il
            relativo interruttore in Impostazioni &gt; Notifiche o con il link di disiscrizione presente in
            ogni email.
          </li>
          <li>
            <strong>Email di marketing</strong> (novità, promozioni): inviate <strong>esclusivamente previo
            consenso esplicito</strong> (Art. 6.1.a), revocabile in qualsiasi momento.
          </li>
        </ul>
        <p className="text-sm mt-2">
          L'utente può configurare tutte le proprie preferenze di comunicazione nella sezione
          Impostazioni &gt; Notifiche.
        </p>

        {/* 5. Conservazione */}
        <h2 className="text-lg font-semibold mt-8 mb-3">5. Conservazione dei Dati</h2>
        <ul className="list-disc pl-6 space-y-1 text-sm">
          <li><strong>Dati dell'account attivo:</strong> conservati per tutta la durata dell'account</li>
          <li><strong>IP referral:</strong> 30 giorni dalla registrazione del referral, poi cancellato automaticamente</li>
          <li><strong>Risposte survey e NPS:</strong> 24 mesi, poi anonimizzate (il punteggio aggregato viene conservato, i commenti e il legame con l'utente vengono rimossi)</li>
          <li><strong>Log email di servizio:</strong> 6 mesi, poi eliminati automaticamente</li>
          <li><strong>Sessioni utente (DAU/WAU/MAU):</strong> 12 mesi, poi eliminate automaticamente</li>
          <li><strong>Event logs analytics:</strong> 12 mesi, poi eliminati automaticamente</li>
          <li><strong>Analytics aggregati anonimi:</strong> conservati a tempo indeterminato (non riconducibili all'utente)</li>
          <li><strong>Post-cancellazione account:</strong> i dati vengono eliminati entro 30 giorni dalla richiesta</li>
        </ul>
        <p className="text-sm mt-2">
          La pulizia automatica viene eseguita settimanalmente. I periodi di conservazione
          sono proporzionati alla finalità del trattamento (GDPR Art. 5, par. 1, lett. e).
        </p>

        {/* 6. Sub-processori */}
        <h2 className="text-lg font-semibold mt-8 mb-3">6. Sub-processori</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <caption className="sr-only">Elenco sub-processori e garanzie per il trasferimento dati</caption>
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-4 font-semibold">Fornitore</th>
                <th className="text-left py-2 pr-4 font-semibold">Sede</th>
                <th className="text-left py-2 font-semibold">Garanzie</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr><td className="py-2 pr-4">Supabase</td><td className="py-2 pr-4">EU (Germania)</td><td className="py-2">DPA conforme GDPR</td></tr>
              <tr><td className="py-2 pr-4">Resend</td><td className="py-2 pr-4">USA (via AWS SES)</td><td className="py-2">SCC + DPA — invio email</td></tr>
              <tr><td className="py-2 pr-4">Cloudflare</td><td className="py-2 pr-4">USA</td><td className="py-2">Standard Contractual Clauses (SCC)</td></tr>
              <tr><td className="py-2 pr-4">Lovable</td><td className="py-2 pr-4">EU</td><td className="py-2">DPA conforme GDPR</td></tr>
              <tr><td className="py-2 pr-4">Cookiebot (Usercentrics)</td><td className="py-2 pr-4">EU (Danimarca)</td><td className="py-2">Conforme GDPR</td></tr>
              <tr><td className="py-2 pr-4">PostHog</td><td className="py-2 pr-4">EU (Germania)</td><td className="py-2">DPA conforme GDPR — identificativo pseudonimo per legittimo interesse; profilazione previo consenso</td></tr>
              <tr><td className="py-2 pr-4">Google LLC (Gemini API)</td><td className="py-2 pr-4">USA</td><td className="py-2">SCC — generazione riepilogo fiscale AI</td></tr>
              <tr><td className="py-2 pr-4">Stripe</td><td className="py-2 pr-4">USA</td><td className="py-2">SCC + PCI-DSS</td></tr>
              <tr><td className="py-2 pr-4">Meta / WhatsApp (futuro)</td><td className="py-2 pr-4">USA</td><td className="py-2">SCC</td></tr>
            </tbody>
          </table>
        </div>

        {/* 7. Cookie e tracciamento */}
        <h2 className="text-lg font-semibold mt-8 mb-3">7. Cookie e Tracciamento</h2>
        <p>
          Per i dettagli sui cookie utilizzati, consulta la nostra{" "}
          <a href="/cookie-policy" className="text-primary hover:underline">Cookie Policy</a>.
        </p>

        <h3 className="text-base font-semibold mt-6 mb-2">7.1 Tracking delle email</h3>
        <ul className="list-disc pl-6 space-y-1 text-sm">
          <li>
            <strong>Segnali di recapito</strong> (consegnato, respinto, segnalato come spam): trattati come
            necessità di servizio per garantire il corretto funzionamento e la sicurezza dell'invio
            (Art. 6.1.b ed Art. 6.1.f). Sono sempre attivi e non sono riconducibili al contenuto letto.
          </li>
          <li>
            <strong>Apertura delle email</strong> (pixel di tracciamento): <strong>disattivata al lancio</strong>.
            Qualora venisse attivata in futuro, sarà subordinata al consenso analytics (Art. 6.1.a) — oppure
            raccolta solo in forma aggregata e anonima.
          </li>
          <li>
            <strong>Click sui link</strong> contenuti nelle email: misurato tramite parametri UTM e PostHog,
            esclusivamente in presenza del consenso analytics già prestato dall'utente.
          </li>
        </ul>

        {/* 8. Sicurezza */}
        <h2 className="text-lg font-semibold mt-8 mb-3">8. Sicurezza</h2>
        <p>
          Forfettino adotta misure tecniche e organizzative appropriate per proteggere i dati personali,
          tra cui: crittografia dei dati in transito (HTTPS/TLS), autenticazione sicura con supporto MFA opzionale,
          Row Level Security (RLS) a livello database per garantire l'isolamento dei dati tra utenti,
          e policy di password robuste.
        </p>

        {/* 9. Diritti dell'utente */}
        <h2 className="text-lg font-semibold mt-8 mb-3">9. Diritti dell'Utente (Art. 15-22 GDPR)</h2>
        <p>L'utente ha diritto di:</p>
        <ul className="list-disc pl-6 space-y-1 text-sm">
          <li><strong>Accesso</strong> (Art. 15) — richiedere copia dei propri dati personali</li>
          <li><strong>Rettifica</strong> (Art. 16) — correggere dati inesatti o incompleti</li>
          <li><strong>Cancellazione</strong> (Art. 17) — richiedere la cancellazione dei propri dati</li>
          <li><strong>Portabilità</strong> (Art. 20) — ricevere i propri dati in formato strutturato e leggibile</li>
          <li><strong>Opposizione</strong> (Art. 21) — opporsi al trattamento basato su legittimo interesse</li>
          <li><strong>Revoca del consenso</strong> (Art. 7.3) — revocare in qualsiasi momento i consensi prestati</li>
          <li><strong>Reclamo</strong> — presentare reclamo al Garante per la Protezione dei Dati Personali</li>
        </ul>
        <p className="mt-2">
          Per esercitare questi diritti, scrivere a{" "}
          <a href="mailto:privacy@forfettino.it" className="text-primary hover:underline">
            privacy@forfettino.it
          </a>.
        </p>

        {/* 10. Utenti minorenni */}
        <h2 className="text-lg font-semibold mt-8 mb-3">10. Utenti Minorenni</h2>
        <p>
          Forfettino è un servizio destinato esclusivamente a titolari di Partita IVA in regime forfettario.
          L'utilizzo è riservato a persone maggiorenni. Non raccogliamo consapevolmente dati di minori.
        </p>

        {/* 11. Modifiche */}
        <h2 className="text-lg font-semibold mt-8 mb-3">11. Modifiche alla Privacy Policy</h2>
        <p>
          Ci riserviamo il diritto di aggiornare questa Privacy Policy. In caso di modifiche sostanziali,
          gli utenti saranno informati tramite notifica in-app e sarà richiesta una nuova accettazione.
          La versione corrente è sempre consultabile a questa pagina.
        </p>
      </article>
    </PageContainer>
    </>
  );
}
