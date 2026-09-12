// Dataset per la pagina pubblica /faq (story 79.9 — highest citation rate format per LLM).
// Single source of truth per: rendering FaqPage.tsx + FAQPage JSON-LD + prerender statico.
// NON duplicare letteralmente landing-faq.ts: quelle FAQ sono conversion-oriented (competitor,
// pensione), queste sono informative pure (regime, INPS, scadenze, ATECO).
//
// Regole GEO (skill geo-content-writer):
// - question: H2 form, >= 8 parole ideale, termina con "?"
// - answerCapsule: 120-150 char (tolleranza test 120-160), front-loaded, autosufficiente,
//   almeno un dato numerico o riferimento normativo, NESSUN link, NESSUN "vedi sotto".
// - answerDetail: 1-2 paragrafi con fatti concreti, esempi numerici, riferimenti normativi.

export type FaqPageItem = {
  id: string;
  question: string;
  answerCapsule: string;
  answerDetail: string;
  sourceRefs?: string[];
};

export type FaqPageSource = {
  label: string;
  url: string;
};

export const faqPageItems: FaqPageItem[] = [
  {
    id: "cose-regime-forfettario",
    question: "Cos'è il regime forfettario e chi può accedervi nel 2026?",
    answerCapsule:
      "Il regime forfettario è il regime fiscale italiano per partite IVA con ricavi annui fino a 85.000 EUR (Legge 190/2014, art. 1 c. 54-89).",
    answerDetail:
      "Il regime forfettario sostituisce IRPEF, addizionali regionali e comunali e IRAP con un'unica imposta sostitutiva del 15% (5% per i primi 5 anni di attività in presenza dei requisiti start-up). Si applica a persone fisiche esercenti attività d'impresa, arti o professioni con ricavi o compensi non superiori a 85.000 EUR l'anno (soglia introdotta dalla Legge 197/2022 a partire dal 2023). Sono esclusi, tra gli altri, chi ha redditi da lavoro dipendente o assimilato superiori a 35.000 EUR nell'anno precedente (soglia in deroga prorogata per il 2025-2026 dalla Legge 207/2024; il limite ordinario è 30.000 EUR), chi partecipa a società di persone o SRL trasparenti, e chi opera prevalentemente verso ex datori di lavoro.",
  },
  {
    id: "limite-fatturato-85000",
    question: "Qual è il limite di fatturato per il regime forfettario nel 2026?",
    answerCapsule:
      "Il limite è 85.000 EUR di ricavi annui: tra 85.001 e 100.000 si esce dall'anno successivo, oltre 100.000 l'uscita è immediata.",
    answerDetail:
      "La soglia di 85.000 EUR è stata introdotta dalla Legge 197/2022 (Legge di Bilancio 2023) in sostituzione del precedente limite di 65.000 EUR. Tra 85.001 e 100.000 EUR il contribuente resta nel regime per l'anno in corso e passa al regime ordinario dal 1° gennaio dell'anno successivo. Oltre 100.000 EUR di ricavi percepiti nell'anno, l'uscita è immediata: a partire dalla fattura che causa il superamento si applica IVA e il regime ordinario opera retroattivamente dal 1° gennaio dello stesso anno.",
  },
  {
    id: "imposta-sostitutiva-15-5",
    question: "Come si calcola l'imposta sostitutiva al 15% o 5% del forfettario?",
    answerCapsule:
      "L'imposta sostitutiva è 15% (5% per i primi 5 anni di start-up) sul reddito imponibile: ricavi per coefficiente ATECO, meno contributi INPS versati.",
    answerDetail:
      "Il calcolo segue tre passi. Primo: si moltiplicano i ricavi incassati nell'anno per il coefficiente di redditività associato al codice ATECO (tipicamente dal 40% al 86%). Secondo: dal risultato si sottraggono i contributi previdenziali effettivamente versati nell'anno (INPS Gestione Separata, Artigiani, Commercianti o cassa professionale). Terzo: sul reddito imponibile così ottenuto si applica l'aliquota del 15% o del 5% (primi 5 anni, se vale la condizione start-up ex art. 1 c. 65 Legge 190/2014). Esempio: 30.000 EUR ricavi × 78% (servizi) = 23.400 EUR; meno 5.500 EUR INPS = 17.900 EUR imponibile; 15% = 2.685 EUR di imposta sostitutiva.",
  },
  {
    id: "lordo-vs-netto-spendibile",
    question: "Qual è la differenza tra fatturato lordo e netto spendibile?",
    answerCapsule:
      "Il lordo è l'incassato totale; il netto spendibile è ciò che resta dopo imposta sostitutiva, contributi INPS e accantonamenti per scadenze fiscali.",
    answerDetail:
      "Il fatturato lordo è la somma degli incassi dei clienti nell'anno. Il reddito imponibile si ottiene moltiplicando il lordo per il coefficiente ATECO e sottraendo i contributi previdenziali versati. Dal reddito imponibile si calcolano imposta sostitutiva (15% o 5%) e INPS dovuti. Il netto spendibile è il lordo incassato meno queste uscite fiscali: è l'importo reale disponibile per vivere, investire o risparmiare. Per un professionista in Gestione Separata con 30.000 EUR lordi e coefficiente 78%, il netto spendibile si aggira intorno ai 20.000-21.000 EUR.",
  },
  {
    id: "contributi-inps-forfettario",
    question: "Quanto pago di contributi INPS come forfettario nel 2026?",
    answerCapsule:
      "In Gestione Separata l'aliquota è 26,07% sul reddito imponibile; artigiani e commercianti pagano minimale fisso ~4.500 EUR più ~24% sull'eccedenza.",
    answerDetail:
      "I professionisti senza altra cassa previdenziale iscritti alla Gestione Separata INPS pagano il 26,07% sul reddito imponibile (Circolare INPS 8/2026), versato con gli stessi termini dell'imposta sostitutiva (scadenza di giugno — per i forfettari prorogata, nel 2026 al 20 luglio — e 30 novembre). Artigiani e commercianti pagano contributi su base fissa (minimale ~4.500 EUR annui nel 2026) e variabili (~24% per artigiani, 24,48% per commercianti sull'eccedenza fino al massimale), divisi in quattro rate fisse al 16 maggio, 20 agosto, 16 novembre e 16 febbraio. I commercianti pagano inoltre lo 0,09% di maternità.",
  },
  {
    id: "deduzione-inps-imposta",
    question: "Posso dedurre i contributi INPS dall'imposta sostitutiva nel forfettario?",
    answerCapsule:
      "Sì: i contributi INPS effettivamente versati nell'anno si deducono dal reddito imponibile prima di calcolare l'imposta sostitutiva al 15% o 5%.",
    answerDetail:
      "La deducibilità è integrale e opera per cassa, cioè vale solo per i contributi previdenziali effettivamente pagati nell'anno fiscale, indipendentemente dal periodo di competenza. Questo significa che versando a dicembre i contributi riduci già l'imponibile di quell'anno. La deduzione riduce sia l'imposta sostitutiva sia la base per il calcolo degli acconti dell'anno successivo. Se i contributi versati superano il reddito imponibile, l'eccedenza può essere dedotta dal reddito complessivo del contribuente (art. 1 c. 64 Legge 190/2014).",
  },
  {
    id: "conviene-forfettario-ordinario",
    question: "Quando conviene il regime forfettario rispetto al regime ordinario?",
    answerCapsule:
      "Conviene sotto 85.000 EUR per chi ha costi bassi: aliquota fissa 15% (o 5%) è vantaggiosa rispetto agli scaglioni IRPEF fino al 43% dell'ordinario.",
    answerDetail:
      "Il regime forfettario conviene quando i costi effettivi sono inferiori alla quota forfettaria dedotta (100% meno il coefficiente ATECO). Un professionista con coefficiente 78% deduce forfettariamente il 22% dei ricavi come costi: se i costi reali sono inferiori al 22%, forfettario è conveniente. Il forfettario, inoltre, non applica IVA sulle fatture e non calcola addizionali regionali/comunali. Per attività con alti costi (commercio di beni, servizi con molte spese) l'ordinario permette di dedurre i costi reali e può risultare più conveniente. Lo strumento decisionale corretto è simulare entrambi i regimi sui propri numeri.",
  },
  {
    id: "coefficiente-redditivita-ateco",
    question: "Come funziona il coefficiente di redditività per codice ATECO nel forfettario?",
    answerCapsule:
      "Il coefficiente ATECO (40%-86%, allegato 4 Legge 190/2014) moltiplica i ricavi per ottenere il reddito imponibile: servizi 78%, commercio alimenti 40%.",
    answerDetail:
      "L'allegato 4 alla Legge 190/2014 associa a ogni gruppo di codici ATECO un coefficiente di redditività che rappresenta la quota dei ricavi considerata come reddito imponibile (il resto è considerato costi forfettari). Esempi: commercio di alimenti e bevande 40%, commercio all'ingrosso e al dettaglio 40%, intermediari del commercio 62%, attività manifatturiere 67%, altre attività economiche 67%, attività professionali, scientifiche e tecniche 78%, costruzioni e immobiliari 86%. La scelta del codice ATECO impatta direttamente il reddito tassabile, quindi deve rispecchiare l'attività effettivamente svolta.",
  },
  {
    id: "superamento-85000-euro",
    question: "Cosa succede se supero gli 85.000 euro di fatturato nel regime forfettario?",
    answerCapsule:
      "Tra 85.001 e 100.000 EUR si esce dal forfettario dall'anno successivo; oltre 100.000 EUR l'uscita è immediata con IVA e regime ordinario retroattivo.",
    answerDetail:
      "Il meccanismo dei due scaglioni deriva dalla Legge 197/2022. Se chiudi l'anno tra 85.001 e 100.000 EUR di ricavi, continui nel forfettario per l'anno corrente e passi al regime ordinario dal 1° gennaio dell'anno successivo. Se invece superi 100.000 EUR già a metà anno, l'uscita è immediata: dalla fattura che causa il superamento devi applicare IVA al cliente e il regime ordinario opera retroattivamente dal 1° gennaio dello stesso anno, con ricalcolo di IRPEF ordinaria. Questo obbliga anche alla rettifica dell'IVA sugli acquisti di beni e servizi non utilizzati.",
  },
  {
    id: "fattura-elettronica-forfettari",
    question: "Devo emettere fattura elettronica come forfettario nel 2026?",
    answerCapsule:
      "Sì: dal 1° gennaio 2024 la fattura elettronica via SdI è obbligatoria per tutti i forfettari senza eccezioni (DL 36/2022, art. 18).",
    answerDetail:
      "L'obbligo di fatturazione elettronica tramite Sistema di Interscambio (SdI) è stato esteso a tutti i forfettari dal 1° gennaio 2024, rimuovendo le soglie di esenzione precedentemente in vigore (DL 36/2022, art. 18, convertito in Legge 79/2022). Sulle fatture va indicata la dicitura di non applicazione IVA ai sensi dell'art. 1 c. 54-89 Legge 190/2014. L'imposta di bollo è dovuta in misura fissa di 2 EUR per ogni fattura di importo superiore a 77,47 EUR, da versare trimestralmente tramite F24 con i codici tributo dedicati dell'Agenzia delle Entrate.",
  },
  {
    id: "acconto-saldo-forfettario",
    question: "Come si calcolano acconto e saldo delle tasse nel regime forfettario?",
    answerCapsule:
      "L'acconto è 100% dell'imposta dell'anno prima: 40% col saldo a giugno (forfettari 2026: proroga al 20 luglio), 60% entro il 30 novembre.",
    answerDetail:
      "Per il regime forfettario l'acconto dell'imposta sostitutiva è calcolato con il metodo storico (100% dell'imposta dell'anno precedente) oppure con quello previsionale (100% dell'imposta stimata sull'anno in corso, se si prevede una riduzione). L'acconto si divide in due rate: il 40% insieme al saldo dell'anno precedente alla scadenza di giugno, e il 60% entro il 30 novembre. Per i forfettari e i soggetti ISA il termine di giugno è di norma prorogato da un decreto annuale: nel 2026 slitta al 20 luglio senza maggiorazione, con ulteriore differimento fino al 20 agosto applicando una maggiorazione dello 0,80%. Se l'acconto totale è inferiore a 257,52 EUR la prima rata non è dovuta e si versa tutto a novembre; se è inferiore a 51,65 EUR l'acconto non è dovuto.",
  },
  {
    id: "scadenze-2026-forfettari",
    question: "Quali sono le scadenze fiscali per i forfettari nel 2026?",
    answerCapsule:
      "Le scadenze chiave 2026 per i forfettari: 20 luglio (saldo 2025 + primo acconto, proroga ISA), 20 agosto (differimento +0,80%), 30 novembre (secondo acconto).",
    answerDetail:
      "Il calendario dei forfettari nel 2026 prevede: 20 luglio 2026 per il versamento del saldo dell'imposta sostitutiva 2025 e della prima rata di acconto 2026 (40%), insieme ai contributi INPS in saldo e acconto — termine prorogato per forfettari e soggetti ISA (la scadenza ordinaria era il 30 giugno); 20 agosto 2026 come termine ultimo differito, con maggiorazione dello 0,80%; 30 novembre 2026 per la seconda rata di acconto (60%). Artigiani e commercianti pagano inoltre i contributi fissi INPS il 16 maggio, 20 agosto, 16 novembre e 16 febbraio. L'imposta di bollo sulle fatture elettroniche si versa trimestralmente il mese successivo al trimestre di riferimento.",
  },
  {
    id: "forfettario-lavoro-dipendente",
    question: "Posso avere il regime forfettario con un lavoro dipendente?",
    answerCapsule:
      "Sì, se nell'anno precedente il reddito da lavoro dipendente non ha superato 35.000 EUR lordi (soglia in deroga per il 2026; ordinaria 30.000 EUR).",
    answerDetail:
      "Il limite di 35.000 EUR (soglia in deroga prorogata per il 2025-2026 dalla Legge di Bilancio 2025, Legge 207/2024; senza ulteriori proroghe tornerà al valore ordinario di 30.000 EUR dal 2027) si riferisce al reddito annuo lordo da lavoro dipendente o assimilato (es. co.co.co., pensioni) percepito nell'anno precedente a quello per cui si vuole applicare il forfettario. Se il rapporto di lavoro dipendente è cessato nell'anno precedente e non sono stati percepiti altri redditi di lavoro dipendente o da pensione, il limite non si applica. Inoltre, un forfettario non può fatturare in modo prevalente al proprio datore di lavoro attuale o a datori di lavoro dei due anni precedenti, per evitare il mascheramento di un rapporto di lavoro dipendente come partita IVA.",
  },
  {
    id: "riduzione-inps-35-percento",
    question: "Come funziona la riduzione INPS del 35% per artigiani e commercianti forfettari?",
    answerCapsule:
      "La riduzione 35% (art. 1 c. 77 Legge 190/2014) si applica su richiesta telematica ai contributi INPS di artigiani e commercianti in forfettario.",
    answerDetail:
      "La riduzione del 35% opera sia sui contributi fissi (minimale) sia sui contributi variabili calcolati sull'eccedenza del reddito imponibile. Vale esclusivamente per artigiani e commercianti iscritti alle rispettive gestioni INPS e solo mentre si è in regime forfettario. La richiesta si presenta telematicamente tramite il cassetto previdenziale INPS entro il 28 febbraio dell'anno per cui si vuole ottenere lo sconto (o entro 30 giorni dall'apertura della posizione per i nuovi iscritti). Attenzione: la riduzione si riflette proporzionalmente sulla contribuzione accreditata ai fini pensionistici, riducendo i trimestri utili.",
  },
  {
    id: "riduzione-inps-50-startup",
    question: "Come funziona la riduzione INPS del 50% per i primi 3 anni di attività?",
    answerCapsule:
      "Dal 2025 (Legge 207/2024) i nuovi iscritti forfettari in Gestione Separata, artigiani o commercianti hanno una riduzione del 50% sui contributi per 36 mesi.",
    answerDetail:
      "La Legge 207/2024 (Legge di Bilancio 2025) ha introdotto una nuova agevolazione: i contribuenti che aprono partita IVA dal 1° gennaio 2025 e aderiscono al regime forfettario beneficiano di una riduzione del 50% dei contributi previdenziali per i primi 36 mesi di attività. Vale per Gestione Separata, Artigiani e Commercianti. Per artigiani e commercianti la riduzione 50% è cumulabile con la riduzione 35% esistente. La misura si applica solo a chi non ha avuto altre partite IVA nei 3 anni precedenti e richiede istanza telematica all'INPS entro i termini stabiliti dalla circolare attuativa.",
  },
  {
    id: "forfettino-netto-spendibile",
    question: "Cos'è Forfettino e come calcola il netto spendibile ogni giorno?",
    answerCapsule:
      "Forfettino è un gestionale gratuito che calcola quotidianamente il netto spendibile reale sottraendo imposta sostitutiva, INPS e accantonamenti dal lordo.",
    answerDetail:
      "Forfettino registra ogni incasso e lo elabora con le regole ufficiali del regime forfettario: applica il coefficiente ATECO del tuo codice, calcola in tempo reale l'imposta sostitutiva al 15% o 5%, i contributi INPS per la tua gestione (Separata, Artigiani, Commercianti), gli acconti storici e previsionali, e accantona automaticamente le somme necessarie per le prossime scadenze F24. Il risultato è il netto spendibile del giorno: quanto puoi effettivamente spendere, risparmiare o investire senza rischiare sorprese a fine anno. Forfettino è completamente gratuito, non richiede carta di credito e non sostituisce il commercialista.",
  },
];

export const faqPageSources: FaqPageSource[] = [
  {
    label:
      "Legge 23 dicembre 2014, n. 190, art. 1 commi 54-89 — Disciplina del regime forfettario (Normattiva)",
    url: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:2014-12-23;190",
  },
  {
    label:
      "Legge 29 dicembre 2022, n. 197, art. 1 comma 54 — Innalzamento soglia 85.000 EUR (Legge di Bilancio 2023)",
    url: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:2022-12-29;197",
  },
  {
    label:
      "Legge 30 dicembre 2024, n. 207 — Legge di Bilancio 2025, riduzione contributiva 50% nuovi forfettari",
    url: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:2024-12-30;207",
  },
  {
    label: "Agenzia delle Entrate — Regime forfetario (pagina informativa ufficiale)",
    url: "https://www.agenziaentrate.gov.it/portale/web/guest/regime-forfetario",
  },
  {
    label:
      "Circolare INPS n. 8 del 2026 — Contribuzione Gestione Separata (aliquota 26,07%)",
    url: "https://www.inps.it/it/it/dettaglio-approfondimento.schede-servizio-strumento.schede-servizi.gestione-separata-dei-lavoratori-autonomi-50265.html",
  },
  {
    label:
      "Circolare INPS n. 14 del 2026 — Contribuzione Artigiani e Commercianti (minimali e aliquote)",
    url: "https://www.inps.it/it/it/dettaglio-approfondimento.schede-servizio-strumento.schede-servizi.artigiani-e-commercianti-50266.html",
  },
  {
    label:
      "Decreto Legge 30 aprile 2022, n. 36, art. 18 — Obbligo fattura elettronica per forfettari",
    url: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legge:2022-04-30;36",
  },
];

export const FAQ_PAGE_LAST_UPDATED = "2026-04";
export const FAQ_PAGE_PUBLISHED_DATE = "2026-04-01";
export const FAQ_PAGE_MODIFIED_DATE = "2026-04-11";
