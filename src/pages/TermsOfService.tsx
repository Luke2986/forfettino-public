import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { CURRENT_TOS_VERSION } from "@/lib/legal-versions";

export default function TermsOfService() {
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
        <title>Termini di Servizio — Forfettino</title>
        <meta
          name="description"
          content="Termini di servizio di Forfettino per l'utilizzo del calcolatore fiscale e della web app."
        />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />
        <link rel="canonical" href="https://forfettino.it/terms" />
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
          Ultimo aggiornamento: 5 marzo 2026 &middot; Versione {CURRENT_TOS_VERSION}
        </p>
        <h1 className="text-2xl font-bold mb-6">Termini di Servizio</h1>

        <p className="italic text-sm text-muted-foreground mb-6">
          Questo documento sarà validato da consulente legale.
        </p>

        {/* 1. Oggetto */}
        <h2 className="text-lg font-semibold mt-8 mb-3">1. Oggetto del Servizio</h2>
        <p>
          Forfettino è un calcolatore fiscale online destinato a liberi professionisti e imprese individuali
          che operano in regime forfettario ai sensi della Legge 190/2014 e successive modifiche.
          Il servizio consente di stimare imposte, contributi INPS, netto spendibile, scadenze fiscali
          e altre metriche finanziarie sulla base dei dati inseriti dall'utente.
        </p>

        {/* 2. Disclaimer */}
        <h2 className="text-lg font-semibold mt-8 mb-3">2. Disclaimer — Non Sostituisce la Consulenza Professionale</h2>
        <p>
          <strong>
            Forfettino NON è un commercialista, un consulente fiscale né un CAF. I calcoli e le informazioni
            fornite hanno carattere puramente indicativo e orientativo.
          </strong>
        </p>
        <p>
          L'utente riconosce e accetta che:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-sm">
          <li>I risultati dei calcoli sono stime basate sui parametri normativi vigenti e sui dati inseriti dall'utente</li>
          <li>Forfettino non garantisce l'esattezza, la completezza o l'attualità dei calcoli</li>
          <li>È responsabilità dell'utente verificare i risultati con il proprio commercialista o consulente fiscale</li>
          <li>Forfettino non si assume alcuna responsabilità per decisioni fiscali prese sulla base dei calcoli forniti</li>
        </ul>

        {/* 3. Limitazione responsabilità */}
        <h2 className="text-lg font-semibold mt-8 mb-3">3. Limitazione di Responsabilità</h2>
        <p>
          Nei limiti consentiti dalla legge applicabile, il titolare di Forfettino non sarà responsabile per:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-sm">
          <li>Danni diretti o indiretti derivanti dall'utilizzo o dall'impossibilità di utilizzo del servizio</li>
          <li>Errori nei calcoli fiscali dovuti a dati errati inseriti dall'utente o a variazioni normative non ancora recepite</li>
          <li>Perdite economiche derivanti da decisioni fiscali basate sui risultati di Forfettino</li>
          <li>Interruzioni temporanee del servizio dovute a manutenzione o cause di forza maggiore</li>
        </ul>

        {/* 4. Requisiti di accesso */}
        <h2 className="text-lg font-semibold mt-8 mb-3">4. Requisiti di Accesso</h2>
        <p>
          L'utilizzo di Forfettino è riservato a:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-sm">
          <li>Persone fisiche maggiorenni (18 anni compiuti)</li>
          <li>Titolari di Partita IVA in regime forfettario, o che intendono aprirne una</li>
        </ul>
        <p>
          Registrandosi, l'utente dichiara di soddisfare tali requisiti.
        </p>

        {/* 5. Account utente */}
        <h2 className="text-lg font-semibold mt-8 mb-3">5. Account Utente</h2>
        <p>
          L'utente è responsabile della sicurezza delle proprie credenziali di accesso.
          Forfettino offre la possibilità di attivare l'autenticazione a due fattori (MFA)
          per una protezione aggiuntiva dell'account.
        </p>

        {/* 6. Cancellazione account */}
        <h2 className="text-lg font-semibold mt-8 mb-3">6. Cancellazione dell'Account</h2>
        <p>
          L'utente può richiedere in qualsiasi momento la cancellazione del proprio account e di tutti
          i dati associati scrivendo a{" "}
          <a href="mailto:privacy@forfettino.it" className="text-primary hover:underline">
            privacy@forfettino.it
          </a>.
          La cancellazione sarà effettuata entro 30 giorni dalla richiesta, come indicato nella Privacy Policy.
        </p>

        {/* 7. Proprietà intellettuale */}
        <h2 className="text-lg font-semibold mt-8 mb-3">7. Proprietà Intellettuale</h2>
        <p>
          Tutti i contenuti del servizio (testi, grafica, loghi, software, struttura del database)
          sono di proprietà del titolare o utilizzati su licenza. È vietata la riproduzione, distribuzione
          o modifica senza autorizzazione scritta.
        </p>
        <p>
          I dati fiscali e gli incassi inseriti dall'utente restano di esclusiva proprietà dell'utente stesso.
        </p>

        {/* 8. Legge applicabile */}
        <h2 className="text-lg font-semibold mt-8 mb-3">8. Legge Applicabile e Foro Competente</h2>
        <p>
          I presenti Termini sono regolati dalla legge italiana. Per qualsiasi controversia derivante
          dall'utilizzo del servizio sarà competente il Foro del luogo di residenza del consumatore,
          ai sensi dell'Art. 66-bis del Codice del Consumo (D.Lgs. 206/2005).
        </p>

        {/* 9. Modifiche */}
        <h2 className="text-lg font-semibold mt-8 mb-3">9. Modifiche ai Termini di Servizio</h2>
        <p>
          Ci riserviamo il diritto di modificare questi Termini di Servizio. In caso di modifiche
          sostanziali, gli utenti saranno informati tramite notifica in-app e sarà richiesta una nuova
          accettazione. L'utilizzo continuato del servizio dopo la notifica costituisce accettazione
          delle modifiche.
        </p>

        {/* 10. Contatti */}
        <h2 className="text-lg font-semibold mt-8 mb-3">10. Contatti</h2>
        <p>
          Per qualsiasi domanda relativa ai presenti Termini, scrivere a{" "}
          <a href="mailto:postmaster@forfettino.it" className="text-primary hover:underline">
            postmaster@forfettino.it
          </a>.
        </p>
      </article>
    </PageContainer>
    </>
  );
}
