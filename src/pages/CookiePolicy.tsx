import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function CookiePolicy() {
  const navigate = useNavigate();
  const [cookiebotMissing, setCookiebotMissing] = useState(false);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  const handleManageCookies = () => {
    if (typeof window !== "undefined" && (window as any).Cookiebot) {
      (window as any).Cookiebot.show();
      setCookiebotMissing(false);
    } else {
      setCookiebotMissing(true);
    }
  };

  return (
    <>
      <Helmet>
        <title>Cookie Policy — Forfettino</title>
        <meta
          name="description"
          content="Informativa cookie di Forfettino con dettagli su cookie tecnici, analytics e preferenze utente."
        />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />
        <link rel="canonical" href="https://forfettino.it/cookie-policy" />
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
          Ultimo aggiornamento: 1 settembre 2026
        </p>
        <h1 className="text-2xl font-bold mb-6">Cookie Policy</h1>

        <p className="italic text-sm text-muted-foreground mb-6">
          Questo documento sarà validato da consulente legale. La struttura è conforme al GDPR
          e alla Direttiva ePrivacy.
        </p>

        {/* 1. Cosa sono i cookie */}
        <h2 className="text-lg font-semibold mt-8 mb-3">1. Cosa Sono i Cookie</h2>
        <p>
          I cookie sono piccoli file di testo memorizzati nel browser dell'utente durante la navigazione.
          Forfettino utilizza cookie e tecnologie simili (localStorage) per garantire il funzionamento
          del servizio e, previo consenso, per finalità analitiche.
        </p>

        {/* 2. Cookie tecnici */}
        <h2 className="text-lg font-semibold mt-8 mb-3">2. Cookie Tecnici (Necessari)</h2>
        <p>
          Questi cookie sono indispensabili per il funzionamento del sito e non richiedono il consenso dell'utente.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <caption className="sr-only">Cookie tecnici necessari al funzionamento del sito</caption>
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-4 font-semibold">Nome</th>
                <th className="text-left py-2 pr-4 font-semibold">Fornitore</th>
                <th className="text-left py-2 pr-4 font-semibold">Finalità</th>
                <th className="text-left py-2 font-semibold">Durata</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="py-2 pr-4">sb-*-auth-token</td>
                <td className="py-2 pr-4">Supabase</td>
                <td className="py-2 pr-4">Sessione di autenticazione utente</td>
                <td className="py-2">Sessione / refresh token</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">CookieConsent</td>
                <td className="py-2 pr-4">Cookiebot</td>
                <td className="py-2 pr-4">Memorizza le preferenze sui cookie dell'utente</td>
                <td className="py-2">12 mesi</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 3. Cookie analytics */}
        <h2 className="text-lg font-semibold mt-8 mb-3">3. Cookie Analytics</h2>
        <p>
          Forfettino utilizza PostHog (hosting EU) per analisi di utilizzo. Su tutte le pagine
          PostHog viene caricato <strong>solo dopo</strong> che l'utente ha accettato la categoria
          «statistiche» dal banner Cookiebot: prima di quel momento nessuna richiesta raggiunge
          PostHog e nessun cookie <code>ph_*</code> viene scritto.
        </p>
        <p className="mt-2">
          Per i <strong>visitatori non autenticati</strong> non viene creato alcun profilo persona:
          gli eventi restano anonimi e aggregati, senza identificativo riconducibile a una persona.
        </p>
        <p className="mt-2">
          Per gli <strong>utenti autenticati</strong> gli eventi sono associati a un identificativo
          interno pseudonimo (l'id dell'account), sulla base del <strong>legittimo interesse</strong>
          (Art. 6.1.f) a misurare il funzionamento e l'utilizzo del prodotto. In questa fase non
          vengono trasmessi l'indirizzo email né altri dati identificativi.
        </p>
        <p className="mt-2">
          L'indirizzo email e gli attributi di profilo (piano, configurazione fiscale, numero di
          incassi registrati) vengono associati a quell'identificativo <strong>solo previo consenso
          esplicito</strong> (Art. 6.1.a). È questo passaggio a costituire profilazione ai sensi del
          GDPR. L'utente può revocare il consenso, o disattivare del tutto l'associazione dei propri
          eventi, da Impostazioni &gt; Privacy: da quel momento gli eventi tornano anonimi.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <caption className="sr-only">Cookie analytics</caption>
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-4 font-semibold">Nome</th>
                <th className="text-left py-2 pr-4 font-semibold">Fornitore</th>
                <th className="text-left py-2 pr-4 font-semibold">Finalità</th>
                <th className="text-left py-2 font-semibold">Durata</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="py-2 pr-4">ph_*</td>
                <td className="py-2 pr-4">PostHog (EU)</td>
                <td className="py-2 pr-4">Analytics di prodotto. Utenti autenticati: identificativo pseudonimo (legittimo interesse). Email e attributi di profilo — cioè la profilazione — solo previo consenso</td>
                <td className="py-2">12 mesi</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 4. LocalStorage */}
        <h2 className="text-lg font-semibold mt-8 mb-3">4. Dati in LocalStorage</h2>
        <p>
          Forfettino utilizza il localStorage del browser per memorizzare preferenze dell'interfaccia utente
          (tema, stato sidebar, banner già visti). Questi dati sono puramente tecnici, non vengono trasmessi
          a terzi e non richiedono consenso.
        </p>

        {/* 5. Gestione del consenso */}
        <h2 className="text-lg font-semibold mt-8 mb-3">5. Gestione del Consenso</h2>
        <p>
          Il consenso ai cookie non tecnici viene gestito tramite Cookiebot. L'utente può in qualsiasi momento
          modificare le proprie preferenze tramite il bottone seguente o attraverso l'icona cookie presente
          nel sito.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleManageCookies}
          className="mt-2"
        >
          Gestisci preferenze cookie
        </Button>
        {cookiebotMissing && (
          <p className="text-sm text-muted-foreground mt-2">
            Il gestore cookie non è attualmente disponibile. Puoi gestire i cookie dalle impostazioni del tuo browser.
          </p>
        )}

        {/* 6. Come disabilitare i cookie */}
        <h2 className="text-lg font-semibold mt-8 mb-3">6. Come Disabilitare i Cookie</h2>
        <p>
          Oltre alla gestione tramite Cookiebot, l'utente può disabilitare i cookie direttamente
          dalle impostazioni del proprio browser. Si noti che la disabilitazione dei cookie tecnici
          potrebbe compromettere il funzionamento del servizio (ad esempio, l'autenticazione).
        </p>

        {/* 7. Aggiornamenti */}
        <h2 className="text-lg font-semibold mt-8 mb-3">7. Aggiornamenti</h2>
        <p>
          Questa Cookie Policy può essere aggiornata periodicamente. La versione più recente è
          sempre disponibile a questa pagina.
        </p>

        {/* 8. Contatti */}
        <h2 className="text-lg font-semibold mt-8 mb-3">8. Contatti</h2>
        <p>
          Per domande sulla Cookie Policy, scrivere a{" "}
          <a href="mailto:privacy@forfettino.it" className="text-primary hover:underline">
            privacy@forfettino.it
          </a>.
        </p>
      </article>
    </PageContainer>
    </>
  );
}
