// Dataset per la pagina pubblica /glossario (story 79.10 — definizioni citabili per LLM).
// Single source of truth per: rendering GlossarioPage.tsx + DefinedTermSet JSON-LD
// (con FAQPage parallelo come fallback) + prerender statico.
//
// NON duplicare faq-page.ts: le FAQ sono procedurali ("come si calcola", "quando scade"),
// il glossario è definitorio ("cos'è", "cosa significa"). Dove c'è sovrapposizione
// concettuale, la versione glossario è più breve e definitoria (max 2-3 frasi nel detail).
//
// Regole GEO (skill geo-content-writer, template Glossary):
// - question: H2 form definitorio ("Cos'è X?" / "Cosa significa X?"), termina con "?"
// - answerCapsule: 120-160 char, front-loaded, autosufficiente, almeno un dato numerico
//   o riferimento normativo, NESSUN link, NESSUN "vedi sotto".
// - answerDetail: 1-2 frasi con esempio concreto e/o riferimento normativo.
// - items ordinati alfabeticamente per term.toLowerCase().

export type GlossarioItem = {
  id: string;
  term: string;
  question: string;
  answerCapsule: string;
  answerDetail: string;
  sourceRefs?: string[];
};

export type GlossarioSource = {
  label: string;
  url: string;
};

export const glossarioItems: GlossarioItem[] = [
  {
    id: "acconto-imposta-sostitutiva",
    term: "Acconto d'imposta sostitutiva",
    question: "Cos'è l'acconto d'imposta sostitutiva nel regime forfettario?",
    answerCapsule:
      "L'acconto dell'imposta sostitutiva è il pagamento anticipato in 2 rate (40% alla scadenza di giugno, 60% il 30 novembre) se supera 51,65 euro.",
    answerDetail:
      "L'acconto si versa se l'imposta sostitutiva dell'anno precedente è superiore a 51,65 euro. È pari al 100% dell'imposta dovuta: prima rata (40%) entro il 30 giugno — termine prorogato per i forfettari e i soggetti ISA, nel 2026 al 20 luglio — e seconda rata (60%) entro il 30 novembre. Codici tributo: 1790 (prima rata di acconto) e 1791 (seconda rata o acconto in unica soluzione).",
  },
  {
    id: "aliquota-sostitutiva",
    term: "Aliquota sostitutiva",
    question: "Cos'è l'aliquota sostitutiva del regime forfettario?",
    answerCapsule:
      "L'aliquota sostitutiva del regime forfettario è il 15% sul reddito imponibile, ridotta al 5% per i primi 5 anni di attività start-up (L. 190/2014).",
    answerDetail:
      "L'aliquota ordinaria è il 15% e si applica al reddito imponibile forfettario. Per chi apre una nuova partita IVA rispettando le condizioni start-up (nessuna attività esercitata nei 3 anni precedenti, attività non mera prosecuzione), l'aliquota scende al 5% per 5 anni, ai sensi dell'articolo 1 comma 65 della Legge 190/2014.",
  },
  {
    id: "codice-ateco",
    term: "Codice ATECO",
    question: "Cos'è il codice ATECO della partita IVA forfettaria?",
    answerCapsule:
      "Il codice ATECO è il codice ISTAT 2007 che classifica l'attività economica della partita IVA e determina il coefficiente di redditività forfettario.",
    answerDetail:
      "Ogni partita IVA ha almeno un codice ATECO che identifica il tipo di attività svolta (es. 62.01.00 per programmatori, 74.10.21 per design). Il coefficiente di redditività applicato nel regime forfettario dipende direttamente dal codice: dal 40% (commercio al dettaglio) all'86% (attività professionali). L'elenco ufficiale è pubblicato dall'ISTAT e dall'Agenzia delle Entrate.",
  },
  {
    id: "coefficiente-redditivita",
    term: "Coefficiente di redditività",
    question: "Cos'è il coefficiente di redditività nel regime forfettario?",
    answerCapsule:
      "Il coefficiente di redditività è la percentuale (40%-86%) del fatturato che diventa reddito imponibile, in base al codice ATECO (allegato L. 190/2014).",
    answerDetail:
      "Il coefficiente è fissato per legge (allegato 4 della Legge 190/2014) e varia per tipo di attività: 40% per commercio al dettaglio, 54% per commercio ambulante di alimentari, 62% per servizi di alloggio, 67% per attività di altro, 78% per professionisti (intellettuali e servizi), 86% per costruzioni. Per un professionista che incassa 30.000 euro con coefficiente 78%, il reddito forfettario è 23.400 euro.",
  },
  {
    id: "contributi-inps-artigiani-commercianti",
    term: "Contributi INPS Gestione Artigiani e Commercianti",
    question: "Cosa sono i contributi INPS della gestione artigiani e commercianti?",
    answerCapsule:
      "I contributi INPS artigiani e commercianti si compongono di una quota fissa minima (circa 4.550 euro 2025) più 24%-24,48% sul reddito oltre il minimale.",
    answerDetail:
      "Gli iscritti alla gestione IVS artigiani o commercianti pagano contributi fissi trimestrali sul reddito minimale (18.555 euro circa per il 2025), oltre a una quota percentuale sul reddito eccedente: 24% per artigiani, 24,48% per commercianti (aliquota aggiuntiva 0,48% per indennizzo cessazione). I forfettari possono chiedere la riduzione contributiva del 35%.",
  },
  {
    id: "contributi-inps-gestione-separata",
    term: "Contributi INPS Gestione Separata",
    question: "Cosa sono i contributi INPS della gestione separata?",
    answerCapsule:
      "I contributi INPS gestione separata sono il 26,07% sul reddito imponibile forfettario per i professionisti senza cassa privata (circolare INPS 2025).",
    answerDetail:
      "La gestione separata INPS riguarda professionisti privi di cassa previdenziale di categoria. L'aliquota piena 2025 è 26,07% sul reddito imponibile forfettario, con massimale contributivo oltre il quale non si versa più (circa 120.607 euro). Aggiungendo lo 0,51% ISCRO, l'aliquota effettiva sale a 26,58%. Non esiste minimale: si paga solo sul reddito effettivamente prodotto.",
  },
  {
    id: "fattura-elettronica",
    term: "Fattura elettronica",
    question: "Cos'è la fattura elettronica per i forfettari?",
    answerCapsule:
      "La fattura elettronica tramite SdI è obbligatoria per tutti i forfettari dal 2024, indipendentemente dal fatturato (DL 36/2022, art. 18).",
    answerDetail:
      "Dal 1° gennaio 2024, tutti i forfettari devono emettere fattura elettronica tramite il Sistema di Interscambio (SdI) dell'Agenzia delle Entrate. Prima di quella data, l'obbligo riguardava solo chi superava 25.000 euro di ricavi l'anno precedente. La fattura elettronica non cambia il regime fiscale: resta la marca da bollo da 2 euro oltre 77,47 euro e l'esenzione IVA per ricavi nel regime.",
  },
  {
    id: "flat-tax-incrementale",
    term: "Flat tax incrementale",
    question: "Cos'è la flat tax incrementale e vale per i forfettari?",
    answerCapsule:
      "La flat tax incrementale (L. 197/2022) è un'imposta 15% sul reddito incrementale, riservata alle partite IVA in regime ordinario, NON ai forfettari.",
    answerDetail:
      "Introdotta dalla Legge di Bilancio 2023 (L. 197/2022), la flat tax incrementale consente alle partite IVA in regime ordinario di tassare al 15% la parte di reddito eccedente il più alto dei tre anni precedenti (franchigia 5%, fino a 40.000 euro). I forfettari sono esclusi dal beneficio perché già applicano un'imposta sostitutiva agevolata sull'intero reddito.",
  },
  {
    id: "imposta-sostitutiva",
    term: "Imposta sostitutiva",
    question: "Cos'è l'imposta sostitutiva del regime forfettario?",
    answerCapsule:
      "L'imposta sostitutiva del 15% (o 5% start-up) sostituisce IRPEF, addizionali regionali e comunali e IRAP per i forfettari (Legge 190/2014, comma 64).",
    answerDetail:
      "L'imposta sostitutiva è l'unica imposta sul reddito dovuta dai contribuenti in regime forfettario, calcolata applicando l'aliquota (15% o 5%) al reddito imponibile (ricavi × coefficiente ATECO − contributi INPS versati). Non sono dovute addizionali locali, IRAP, né l'IRPEF progressiva ordinaria. Codice tributo saldo: 1792.",
  },
  {
    id: "iscro",
    term: "ISCRO",
    question: "Cos'è l'ISCRO e chi può richiederla?",
    answerCapsule:
      "L'ISCRO è l'indennità straordinaria INPS fino a 800 euro al mese per 6 mesi, riservata ai professionisti GS con calo reddito ≥50% (L. 234/2021).",
    answerDetail:
      "L'Indennità Straordinaria Continuità Reddituale Operativa è finanziata da un contributo aggiuntivo dello 0,51% a carico degli iscritti alla gestione separata. Spetta ai professionisti che hanno avuto un calo del reddito di almeno il 50% rispetto alla media dei tre anni precedenti e un reddito sotto una soglia massima (8.972 euro nel 2025). L'importo varia tra 250 e 800 euro al mese per 6 mesi.",
  },
  {
    id: "massimale-contributivo-inps",
    term: "Massimale contributivo INPS",
    question: "Cos'è il massimale contributivo INPS?",
    answerCapsule:
      "Il massimale contributivo INPS è la soglia di reddito (circa 120.607 euro nel 2025) oltre la quale non si pagano più contributi previdenziali.",
    answerDetail:
      "Il massimale si applica a gestione separata e iscritti alle gestioni artigiani/commercianti post-1996. Per i forfettari lavoratori autonomi, il reddito oltre il massimale non genera contributi aggiuntivi, ma l'imposta sostitutiva resta dovuta su tutto il reddito imponibile. Il valore è aggiornato annualmente dall'INPS in base alla variazione ISTAT dei prezzi.",
  },
  {
    id: "minimale-contributivo-inps",
    term: "Minimale contributivo INPS",
    question: "Cos'è il minimale contributivo INPS?",
    answerCapsule:
      "Il minimale contributivo INPS artigiani e commercianti è circa 18.555 euro (2025): i contributi fissi sono dovuti anche se il reddito è inferiore.",
    answerDetail:
      "Il minimale riguarda solo le gestioni IVS artigiani e commercianti: i contributi fissi (circa 4.550 euro annui 2025) sono dovuti a prescindere dal reddito effettivamente prodotto. Oltre il minimale si applica la quota percentuale (24% o 24,48%) fino al massimale. La gestione separata INPS non prevede minimale: si versa solo sul reddito effettivo.",
  },
  {
    id: "netto-spendibile",
    term: "Netto spendibile",
    question: "Cos'è il netto spendibile del forfettario?",
    answerCapsule:
      "Il netto spendibile è l'importo che resta dal fatturato dopo imposta sostitutiva (15% o 5%), contributi INPS e accantonamenti per scadenze fiscali.",
    answerDetail:
      "Il netto spendibile è il concetto chiave per un freelancer forfettario: non coincide con il fatturato incassato né con il reddito imponibile. È l'importo effettivamente disponibile per vivere, investire o risparmiare, calcolato sottraendo dal fatturato lordo tutte le uscite fiscali future (imposta sostitutiva, INPS dovuti, rate scadenziario). Per un GS con 30.000 euro lordi e coefficiente 78%, si aggira sui 20.000-21.000 euro.",
  },
  {
    id: "reddito-imponibile-forfettario",
    term: "Reddito imponibile forfettario",
    question: "Cos'è il reddito imponibile forfettario?",
    answerCapsule:
      "Il reddito imponibile forfettario si calcola moltiplicando i ricavi per il coefficiente ATECO (40%-86%), sottraendo i contributi INPS versati nell'anno.",
    answerDetail:
      "La formula è: (ricavi incassati × coefficiente ATECO) − contributi previdenziali versati. I costi effettivi NON sono deducibili: il coefficiente rappresenta in modo forfettario la redditività tipica dell'attività. Esempio professionista (coefficiente 78%) con 30.000 euro di ricavi e 5.500 euro di contributi versati: 30.000 × 78% − 5.500 = 17.900 euro di reddito imponibile.",
  },
  {
    id: "regime-forfettario",
    term: "Regime forfettario",
    question: "Cos'è il regime forfettario per partite IVA?",
    answerCapsule:
      "Il regime forfettario è il regime fiscale agevolato italiano per partite IVA con ricavi fino a 85.000 euro annui (Legge 190/2014, art. 1 c. 54-89).",
    answerDetail:
      "Il regime forfettario sostituisce IRPEF, addizionali e IRAP con un'unica imposta sostitutiva del 15% (o 5% i primi 5 anni in start-up). Il reddito imponibile è determinato forfettariamente tramite coefficienti ATECO, senza deduzione dei costi reali. I forfettari non applicano IVA sulle fatture emesse e non versano IRAP, con adempimenti contabili semplificati.",
  },
  {
    id: "regime-ordinario",
    term: "Regime ordinario",
    question: "Cos'è il regime ordinario in confronto al forfettario?",
    answerCapsule:
      "Il regime ordinario applica IRPEF progressiva (23%-43%), IVA, scritture contabili complete e aliquote INPS ordinarie, senza agevolazioni forfettarie.",
    answerDetail:
      "In regime ordinario il reddito è tassato con aliquote IRPEF progressive (23% fino a 28.000 euro, 35% fino a 50.000, 43% oltre), più addizionali regionali e comunali. Sono deducibili i costi effettivi dell'attività, si applica l'IVA sulle fatture e si tiene la contabilità semplificata o ordinaria. Si esce dal forfettario (e si entra in ordinario) oltre 85.000 euro di ricavi annui.",
  },
  {
    id: "regime-start-up",
    term: "Regime start-up",
    question: "Cos'è il regime start-up con aliquota al 5%?",
    answerCapsule:
      "Il regime start-up riduce l'imposta sostitutiva al 5% per i primi 5 anni di attività, se nuova e non prosecuzione di precedente (L. 190/2014, c. 65).",
    answerDetail:
      "L'aliquota ridotta al 5% spetta per i primi 5 anni (non 5 periodi d'imposta interi, ma 5 esercizi) a chi apre una nuova partita IVA rispettando 3 requisiti: non aver esercitato attività d'impresa, arte o professione nei 3 anni precedenti; l'attività non deve essere mera prosecuzione di altra precedentemente svolta; in caso di acquisizione di azienda, i ricavi del periodo precedente non devono superare 85.000 euro.",
  },
  {
    id: "riduzione-35-inps",
    term: "Riduzione 35% contributi INPS artigiani e commercianti",
    question: "Cos'è la riduzione 35% dei contributi INPS per i forfettari?",
    answerCapsule:
      "La riduzione 35% abbatte di oltre un terzo i contributi INPS artigiani e commercianti per i forfettari che ne fanno richiesta (L. 190/2014, comma 77).",
    answerDetail:
      "Spetta solo agli iscritti alle gestioni IVS artigiani e commercianti in regime forfettario: riduce sia i contributi fissi sul minimale sia la quota percentuale sul reddito eccedente. La richiesta va presentata all'INPS tramite Cassetto Previdenziale entro il 28 febbraio dell'anno di riferimento. Chi sceglie la riduzione maturerà una contribuzione ridotta ai fini pensionistici, in proporzione ai contributi effettivamente versati.",
  },
  {
    id: "riduzione-50-gs-giovani",
    term: "Riduzione 50% contributi INPS gestione separata giovani",
    question: "Cos'è la riduzione 50% dei contributi INPS per giovani under 35?",
    answerCapsule:
      "La riduzione 50% dei contributi INPS gestione separata era una misura per giovani under 35 alla prima partita IVA, attiva nei primi 3 anni di attività.",
    answerDetail:
      "Diverse leggi di bilancio hanno introdotto agevolazioni contributive per i professionisti iscritti alla gestione separata INPS di età inferiore a 35 anni nei primi anni di attività, con modalità e soglie di reddito variabili. Trattandosi di misure modificate più volte dai provvedimenti annuali, l'effettiva applicabilità al forfettario va verificata caso per caso presso l'INPS o consultando la circolare di riferimento dell'anno d'imposta.",
  },
  {
    id: "saldo-imposta-sostitutiva",
    term: "Saldo d'imposta sostitutiva",
    question: "Cos'è il saldo d'imposta sostitutiva del forfettario?",
    answerCapsule:
      "Il saldo dell'imposta sostitutiva si versa a giugno dell'anno dopo (forfettari 2026: 20 luglio), come differenza tra imposta dovuta e acconti versati.",
    answerDetail:
      "Il saldo è il conguaglio finale dell'imposta sostitutiva: si calcola l'imposta effettiva sul reddito imponibile dell'anno, si sottraggono gli acconti versati a giugno e novembre dell'anno precedente, e si paga la differenza (o si chiede a credito). Scadenza ordinaria: 30 giugno. Per i forfettari e i soggetti ISA il termine è prorogato da un decreto annuale: nel 2026 al 20 luglio senza maggiorazione, con ulteriore differimento fino al 20 agosto applicando una maggiorazione dello 0,80%. Codice tributo: 1792.",
  },
  {
    id: "soglia-100000-euro",
    term: "Soglia 100.000 euro",
    question: "Cos'è la soglia dei 100.000 euro nel regime forfettario?",
    answerCapsule:
      "La soglia di 100.000 euro è il limite oltre il quale il regime forfettario decade immediatamente nell'anno in corso, con IVA dovuta retroattiva.",
    answerDetail:
      "Introdotta dalla Legge 197/2022, la soglia del fuoriuscita immediata scatta al superamento di 100.000 euro di ricavi percepiti nell'anno. Da quella fattura in poi si applica IVA e il regime ordinario vale retroattivamente dal 1° gennaio dello stesso anno. Sotto 100.000 euro ma oltre 85.000 euro, l'uscita è differita al 1° gennaio dell'anno successivo.",
  },
  {
    id: "soglia-85000-euro",
    term: "Soglia 85.000 euro",
    question: "Cos'è la soglia degli 85.000 euro nel regime forfettario?",
    answerCapsule:
      "La soglia di 85.000 euro di ricavi annui è il limite ordinario del regime forfettario: tra 85.001 e 100.000 euro si esce dall'anno successivo (L. 197/2022).",
    answerDetail:
      "Il limite di 85.000 euro è stato introdotto dalla Legge 197/2022 (Legge di Bilancio 2023) in sostituzione del precedente limite di 65.000 euro. Tra 85.001 e 100.000 euro il contribuente resta nel regime per l'anno in corso e passa all'ordinario dal 1° gennaio successivo. Oltre 100.000 euro la decadenza è immediata nello stesso anno.",
  },
];

export const glossarioSources: GlossarioSource[] = [
  {
    label: "Legge 190/2014 — Istituzione regime forfettario (Normattiva)",
    url: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:2014-12-23;190",
  },
  {
    label: "Legge 197/2022 — Innalzamento soglia a 85.000 euro (Normattiva)",
    url: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:2022-12-29;197",
  },
  {
    label: "Legge 207/2024 — Legge di Bilancio 2025 (Normattiva)",
    url: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:2024-12-30;207",
  },
  {
    label: "Agenzia delle Entrate — Regime forfettario",
    url: "https://www.agenziaentrate.gov.it/portale/web/guest/schede/agevolazioni/regime-forfetario-agevolato",
  },
  {
    label: "INPS — Gestione Separata (aliquote e massimale 2025)",
    url: "https://www.inps.it/it/it/dettaglio-approfondimento.schede-pratiche.gestione-separata.html",
  },
  {
    label: "INPS — Gestione artigiani e commercianti",
    url: "https://www.inps.it/it/it/dettaglio-approfondimento.schede-pratiche.gestione-artigiani-e-commercianti.html",
  },
  {
    label: "INPS — ISCRO Indennità Continuità Reddituale Operativa",
    url: "https://www.inps.it/it/it/dettaglio-scheda.schede-servizio-strumento.schede-servizi.iscro-50550.html",
  },
  {
    label: "DM 2014 — Coefficienti di redditività ATECO (Agenzia Entrate)",
    url: "https://www.agenziaentrate.gov.it/portale/documents/20143/233439/allegato4_coefficientiredditivita.pdf",
  },
];

export const GLOSSARIO_PAGE_LAST_UPDATED = "2026-04";
export const GLOSSARIO_PAGE_PUBLISHED_DATE = "2026-04-11";
export const GLOSSARIO_PAGE_MODIFIED_DATE = "2026-04-11";
