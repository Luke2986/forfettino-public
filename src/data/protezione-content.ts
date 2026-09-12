// ── Guida Completa PDF Config ──
// NOTA: quando si rigenera il PDF con Gamma, aggiornare `edition` qui.
// Questa costante è la single source of truth per edizione, versione e path.

export const GUIDA_COMPLETA_CONFIG = {
  edition: "Marzo 2026",
  version: "1.0",
  pageCount: 14,
  pdfPath: "/guide/guida-protezione-freelancer.pdf",
} as const;

export const guidaCompletaCapitoli = [
  { num: 1, title: "Ecco Cosa Non Ti Copre Nessuno", description: "I 7 macro-rischi del freelancer forfettario" },
  { num: 2, title: "Infortuni e Malattia", description: "Tutele INPS reali e polizze integrative private" },
  { num: 3, title: "Mutue Sanitarie", description: "L'alternativa solidale: Cesare Pozzo e mutuo soccorso" },
  { num: 4, title: "RC Professionale", description: "Claims made, retroattività e provider per non iscritti Albo" },
  { num: 5, title: "Tutela Legale", description: "Recupero crediti e controversie da ~100 euro/anno" },
  { num: 6, title: "Cyber Risk", description: "Protezione digitale per freelancer con fatturato <300k" },
  { num: 7, title: "Pensione Integrativa", description: "FPA vs PIP e il vantaggio fiscale nascosto del forfettario" },
  { num: 8, title: "Protezione Home Office", description: "Multirischio ufficio domestico e attrezzature" },
  { num: 9, title: "Assicurazione sulla Vita", description: "TCM per proteggere chi dipende dal tuo reddito" },
  { num: 10, title: "Tabella Riassuntiva", description: "Tutti i rischi, coperture, costi e provider a colpo d'occhio" },
  { num: 11, title: "Checklist di Protezione", description: "7 voci stampabili per costruire la tua protezione" },
] as const;

// ── Types ──

export interface FaqItem {
  question: string;
  answer: string;
}

/** Percorsi disponibili nella sezione protezione */
export type Percorso = "infortuni" | "rc" | "pensione";

/** IDs canonici delle 7 voci checklist — usati come single source of truth */
export const checklistIds = [
  "infortuni",
  "rc",
  "mutua",
  "tutela-legale",
  "pensione",
  "cyber",
  "tcm",
] as const;
export type ChecklistId = (typeof checklistIds)[number];

// ── Hub: macro-aree raggruppate per categoria ──

export interface HubAreaItem {
  id: ChecklistId;
  label: string;
  description: string;
  priceRange: string;
  available: boolean;
  target?: Percorso;
}

export interface HubCategoryGroup {
  title: string;
  /** Nome icona Lucide da usare nel rendering */
  icon: "Shield" | "Scale" | "Landmark" | "Heart";
  items: HubAreaItem[];
}

export const hubCategoryGroups: HubCategoryGroup[] = [
  {
    title: "Protezione del reddito",
    icon: "Shield",
    items: [
      {
        id: "infortuni",
        label: "Infortuni e malattia",
        description: "Copre il reddito se non puoi lavorare",
        priceRange: "€15-40/mese",
        available: true,
        target: "infortuni",
      },
      {
        id: "mutua",
        label: "Mutua sanitaria",
        description: "Alternativa alle polizze, detraibile al 19%",
        priceRange: "€4-20/mese",
        available: true,
        target: "infortuni",
      },
    ],
  },
  {
    title: "Protezione del patrimonio",
    icon: "Scale",
    items: [
      {
        id: "rc",
        label: "RC Professionale",
        description: "Se un cliente ti fa causa, paga la polizza",
        priceRange: "€10-40/mese",
        available: true,
        target: "rc",
      },
      {
        id: "tutela-legale",
        label: "Tutela legale",
        description: "Avvocato in tasca per crediti insoluti",
        priceRange: "€8-12/mese",
        available: false,
      },
      {
        id: "cyber",
        label: "Cyber Risk",
        description: "Protezione dati e ripristino sistemi",
        priceRange: "€10-25/mese",
        available: false,
      },
    ],
  },
  {
    title: "Previdenza",
    icon: "Landmark",
    items: [
      {
        id: "pensione",
        label: "Pensione integrativa",
        description: "La pensione INPS da forfettario sarà bassa. Qui vedi perché e cosa fare.",
        priceRange: "Importo variabile",
        available: true,
        target: "pensione",
      },
    ],
  },
  {
    title: "Famiglia",
    icon: "Heart",
    items: [
      {
        id: "tcm",
        label: "TCM / Vita",
        description: "Proteggi chi dipende dal tuo reddito",
        priceRange: "Variabile",
        available: false,
      },
    ],
  },
];

// ── Glossario termini assicurativi ──

export const glossarioTermini: Record<string, string> = {
  diaria:
    "I soldi che ti bonificano ogni giorno che non lavori — da €50 a €100/giorno a seconda del pacchetto, senza i limiti INPS.",
  franchigia:
    "I primi giorni o euro che paghi tu. Franchigia bassa (3%) = coperto anche per piccoli infortuni ma premio più alto. Franchigia alta (10%+) = premio basso ma rischi intermedi scoperti.",
  scoperto:
    "La percentuale del danno che resta a tuo carico anche sopra la franchigia. Scoperto 10% su un danno di €10.000 = €1.000 li paghi tu.",
  sinistro:
    "L'evento che fa scattare la copertura: un infortunio, una malattia, un errore professionale. In pratica, il \"problema\" per cui hai l'assicurazione.",
  premio:
    "Quello che paghi alla compagnia per avere la copertura — mensile o annuale. È il \"costo\" dell'assicurazione.",
  massimale:
    "Il tetto massimo che la compagnia paga per un singolo sinistro. Massimale basso = rischi scoperti per danni grossi.",
  "mutua sanitaria":
    "Un'alternativa alle assicurazioni private: società di mutuo soccorso che funzionano a porta aperta (nessuno viene escluso) e i cui contributi sono detraibili al 19%.",
  indennità:
    "La somma che ti viene pagata quando si verifica l'evento assicurato — per esempio l'indennità giornaliera di malattia.",
  inail:
    "L'ente pubblico che copre infortuni sul lavoro e malattie professionali. Obbligatorio per artigiani e alcune categorie. Copre il baseline, ma non la malattia generica né la perdita di fatturato.",
  "invalidità permanente":
    "Una menomazione definitiva della capacità lavorativa. La compagnia eroga un capitale in base alla percentuale di invalidità accertata.",
  "claims made":
    "La polizza ti copre per le richieste di risarcimento che arrivano durante la sua validità, anche se l'errore lo hai fatto prima (se hai la retroattività).",
  retroattività:
    "Quanto indietro nel tempo sei coperto per errori passati. Retroattività illimitata = copre tutto il passato. Senza, un errore di 6 mesi fa potrebbe non essere coperto.",
  "postuma":
    "Copertura per richieste di risarcimento che arrivano dopo che hai chiuso l'attività. Fondamentale per chi va in pensione o cambia lavoro.",
  "rc professionale":
    "Lo scudo che paga i danni che fai involontariamente ai clienti nello svolgimento dell'attività. Protegge il tuo patrimonio personale — senza RC, rispondi con tutti i tuoi beni.",
  "fondo pensione aperto":
    "Un fondo pensione gestito da banche o SGR, aperto a tutti. Costi medi (ISC 1,1%-1,5%), buoni rendimenti storici sulle linee azionarie.",
  pip: "Piano Individuale Pensionistico — un prodotto assicurativo (unit linked) per la previdenza complementare. Costi più alti dei FPA (ISC 1,8%-2,5%), ma offre garanzia di capitale per profili prudenti.",
  isc: "Indicatore Sintetico dei Costi — il numero che ti dice quanto costa DAVVERO un fondo pensione. Su 30 anni, anche l'1% in più di ISC può mangiare migliaia di euro.",
  "metodo contributivo":
    "Il sistema con cui si calcola la tua pensione futura: versi poco → prendi poco. Da forfettario versi il minimo INPS, quindi la pensione sarà una frazione del tuo ultimo reddito.",
  "quadro lm":
    "La sezione della dichiarazione dei redditi dove il forfettario dichiara i propri ricavi. I contributi al fondo pensione si deducono dalla base imponibile INPS proprio qui.",
};

// ── Percorso Infortuni/Malattia — 6 schede ──

// Le slide usano string per il contenuto, poi PercorsoInfortuni le renderizza con GlossarioTooltip.
// Questo mantiene il file dati puro (no JSX imports).

export interface SlideContentData {
  id: string;
  title: string;
  subtitle?: string;
  emoji?: string;
  paragraphs: string[];
  highlight?: {
    label: string;
    value: string;
  };
  table?: {
    headers: string[];
    rows: string[][];
  };
  note?: string;
  cta?: boolean;
}

// ── Shared CTA slide template — DRY across all percorsi ──

export function buildCtaSlide(overrides: {
  id: string;
  extraParagraphs?: string[];
}): SlideContentData {
  return {
    id: overrides.id,
    title: "Riepilogo",
    emoji: "🎯",
    paragraphs: [
      ...(overrides.extraParagraphs ?? []),
      "Nel regime forfettario i costi assicurativi non sono deducibili. La protezione però resta più importante del risparmio fiscale.",
    ],
    cta: true,
  };
}

export const percorsoInfortuniSlides: SlideContentData[] = [
  {
    id: "shock-inps",
    title: "Quanto ti dà l'INPS se ti ammali",
    emoji: "😱",
    paragraphs: [
      "L'indennità di malattia INPS per la Gestione Separata va da €26 a €53 al giorno. Per riceverla servono almeno 4 mesi di contributi versati negli ultimi 12 mesi, e dura al massimo 61 giorni l'anno.",
      "Chi è iscritto alla Gestione Artigiani/Commercianti non riceve indennità di malattia dall'INPS.",
    ],
    table: {
      headers: ["Contributi versati (ultimi 12 mesi)", "Indennità/giorno"],
      rows: [
        ["4-8 mesi (8%)", "~€26"],
        ["9-12 mesi (12%)", "~€40"],
        ["oltre 12 mesi (16%)", "~€53"],
      ],
    },
    note: "Dati Gestione Separata INPS 2025, massimale €120.607. Sotto i 4 mesi di contributi: zero indennità. Artigiani/Commercianti: zero indennità malattia.",
  },
  {
    id: "diaria",
    title: "Cos'è la diaria",
    emoji: "🛡️",
    paragraphs: [
      "La diaria è un'indennità giornaliera: ricevi da €50 a €100 al giorno per ogni giorno in cui non puoi lavorare, senza i limiti dell'INPS.",
      "Una polizza infortuni/malattia di solito copre tre cose:",
    ],
    table: {
      headers: ["Componente", "Cosa fa"],
      rows: [
        ["Rimborso spese mediche", "Paghi meno (o niente) per visite, esami, interventi"],
        ["Diaria giornaliera", "Ricevi soldi ogni giorno che non lavori"],
        ["Invalidità permanente", "Un capitale se il danno è definitivo"],
      ],
    },
  },
  {
    id: "costo-netflix",
    title: "Quanto costa",
    emoji: "📺",
    paragraphs: [
      "Per un freelancer, proteggersi da infortuni e malattia costa poche decine di euro al mese.",
    ],
    table: {
      headers: ["Copertura", "Cosa ottieni", "Costo indicativo"],
      rows: [
        ["Diaria ricovero", "€70-100/giorno", "~€20-35/mese"],
        ["Inabilità temporanea", "€50/giorno", "~€15-25/mese"],
        ["Rimborso spese mediche", "Fino a €20k/anno", "Variabile per età"],
      ],
    },
    note: "Fasce indicative. I costi reali dipendono da età, stato di salute e coperture scelte.",
  },
  {
    id: "personas",
    title: "Due esempi concreti",
    emoji: "👤",
    paragraphs: [
      "Due profili realistici con fasce indicative (non prezzi di compagnie specifiche):",
    ],
    table: {
      headers: ["Chi", "Profilo", "Costo indicativo"],
      rows: [
        ["Marco", "Copywriter, 30 anni", "~€15/mese"],
        ["Sara", "Fotografa, 45 anni", "~€40/mese"],
      ],
    },
    note: "Polizze modulabili di compagnie come Unipol, UniSalute o Zurich. Cerca online \"polizza infortuni libero professionista\".",
  },
  {
    id: "mutue",
    title: "Le mutue sanitarie",
    emoji: "🤝",
    paragraphs: [
      "Le mutue sanitarie (Società di Mutuo Soccorso) funzionano diversamente dalle assicurazioni private.",
      "Non escludono per malattie pregresse (porta aperta), costano poco, e i contributi sono detraibili al 19% fino a €1.291/anno, anche per i forfettari.",
      "La più storica è Cesare Pozzo, fondata nel 1877. Ce ne sono altre.",
    ],
    highlight: {
      label: "Il vantaggio fiscale",
      value: "I contributi alle mutue sono detraibili al 19%, fino a €1.291/anno. Le polizze assicurative per il forfettario non sono deducibili.",
    },
  },
  buildCtaSlide({
    id: "cta",
    extraParagraphs: [
      "Ora conosci i numeri dell'INPS, le opzioni private e i costi reali.",
    ],
  }),
];

// ── FAQ Infortuni/Malattia ──

export const faqInfortuni: FaqItem[] = [
  {
    question: "Il burnout è coperto?",
    answer:
      "Dipende dalla polizza. Alcune coprono l'inabilità temporanea da malattia, ma il burnout è zona grigia. Chiedi al tuo broker o consulente assicurativo.",
  },
  {
    question: "Posso accendere e spegnere l'assicurazione?",
    answer:
      "No, le polizze sono annuali. Puoi non rinnovare alla scadenza, ma dura almeno un anno.",
  },
  {
    question: "Se pago 10 anni e non mi succede niente?",
    answer:
      "Hai comprato tranquillità, non un investimento. Come l'assicurazione auto: meglio non usarla mai. Il giorno che serve, vale tutto quello che hai pagato.",
  },
  {
    question: "I costi sono deducibili?",
    answer:
      "I premi assicurativi professionali non sono deducibili nel forfettario. I contributi alle Società di Mutuo Soccorso sono invece detraibili al 19% (fino €1.291/anno).",
  },
  {
    question: "Cos'è la franchigia?",
    answer:
      "I primi giorni o euro che paghi tu prima che la copertura scatti. Franchigia bassa (3%): coperto anche per piccoli infortuni, ma premio più alto. Franchigia alta (10%+): premio basso, ma rischi intermedi scoperti.",
  },
  {
    question: "Cosa copre l'INAIL?",
    answer:
      "Per artigiani e alcune categorie è obbligatorio. Copre infortuni sul lavoro e malattie professionali, ma non la malattia generica e non la perdita di fatturato. Le polizze private coprono quello che l'INAIL non copre.",
  },
];

// ── Percorso RC Professionale — 6 schede ──

export const percorsoRcSlides: SlideContentData[] = [
  {
    id: "rc-shock",
    title: "Chi paga se sbagli",
    emoji: "⚖️",
    paragraphs: [
      "Se il sito del tuo cliente va giù per un tuo errore e lui perde €10.000, il conto arriva a te. Senza una polizza RC, rispondi con il tuo patrimonio personale: conto in banca, casa, risparmi.",
      "Qualche scenario reale per professione:",
    ],
    table: {
      headers: ["Professione", "Rischio tipico"],
      rows: [
        ["Social Media Manager", "Violazione copyright, diffamazione"],
        ["Developer", "Bug software, perdita dati, downtime"],
        ["Consulente", "Danni patrimoniali da errata strategia"],
        ["Coach / Formatore", "Infortuni terzi, mancata conformità"],
      ],
    },
  },
  {
    id: "rc-definizione",
    title: "Cos'è la RC Professionale",
    emoji: "🛡️",
    paragraphs: [
      "La RC Professionale paga i danni che causi involontariamente ai clienti durante il tuo lavoro. Il cliente viene risarcito dalla compagnia, il tuo patrimonio resta al sicuro.",
      "Esistono prodotti pensati per i freelance. Generali ha \"ATTIVA Professione Non Ordinistica\", Lokky ha la \"RC Flex\". Cerca online per farti un'idea dei prezzi.",
    ],
    highlight: {
      label: "In breve",
      value: "La RC professionale copre i danni patrimoniali causati a terzi (clienti) da errori, omissioni o negligenze. Il cliente viene risarcito dalla compagnia.",
    },
  },
  {
    id: "rc-obbligo",
    title: "Obbligatoria o facoltativa",
    emoji: "📋",
    paragraphs: [
      "Per i professionisti con Albo (avvocati, commercialisti, architetti, circa 26 professioni) è obbligatoria dal 2013 (DPR 137/2012, art. 5). La violazione è illecito disciplinare: censura, sospensione, fino alla radiazione. Devi comunicare al cliente gli estremi della polizza e i massimali.",
      "Per tutti gli altri (developer, copy, marketer, consulenti, creator, formatori) è facoltativa. La maggior parte dei professionisti del settore la consiglia, e sempre più committenti la richiedono come requisito contrattuale.",
    ],
    highlight: {
      label: "La differenza",
      value: "Iscritto a un Albo: obbligatoria per legge. Non iscritto: facoltativa, ma senza polizza il rischio è tutto tuo.",
    },
  },
  {
    id: "rc-claims-made",
    title: "Come funziona il claims made",
    emoji: "🔍",
    paragraphs: [
      "La RC professionale funziona in modalità claims made: ti copre per le richieste di risarcimento che arrivano durante la validità della polizza, anche se l'errore risale a prima. Serve però la retroattività.",
      "Senza retroattività, gli errori passati restano scoperti. Retroattività 2 anni = coperto per gli ultimi 2 anni. Illimitata = coperto per tutto il passato. Controlla sempre questa clausola.",
      "Quando smetti di lavorare, la clausola postuma (o ultrattività) ti copre per richieste che arrivano dopo la chiusura dell'attività. Serve a chi va in pensione o cambia lavoro.",
    ],
  },
  {
    id: "rc-costo",
    title: "Quanto costa",
    emoji: "☕",
    paragraphs: [
      "Per molti freelance la RC Professionale costa poche decine di euro al mese. Le polizze sono personalizzabili per settore e fatturato.",
    ],
    table: {
      headers: ["Chi", "Profilo", "Fascia indicativa"],
      rows: [
        ["Giulia", "Consulente marketing, 28 anni, fatturato €30k", "~€15-25/mese"],
        ["Roberto", "Developer senior, 42 anni, fatturato €60k", "~€25-45/mese"],
      ],
    },
    note: "Fasce indicative. Il costo reale dipende da professione, fatturato, massimale scelto e storico sinistri. Cerca online \"RC professionale + [il tuo settore]\".",
  },
  buildCtaSlide({
    id: "rc-cta",
    extraParagraphs: [
      "Ora conosci cos'è la RC Professionale, quando è obbligatoria, come funziona il claims made e quanto costa.",
    ],
  }),
];

// ── FAQ RC Professionale ──

// ── Checklist Protezione — 7 voci ──

export interface ChecklistItem {
  id: ChecklistId;
  label: string;
  description: string;
  priceRange: string;
  linkType: "percorso" | "pensione" | "coming-soon";
  linkTarget?: Percorso;
  /** Testo link personalizzato (default: "Approfondisci nel percorso →") */
  linkLabel?: string;
  /** Mini-contenuto educativo per voci "coming-soon" */
  educationalText?: string;
}

export const checklistItems: ChecklistItem[] = [
  {
    id: "infortuni",
    label: "Infortuni/Malattia",
    description: "Copre il reddito se non puoi lavorare",
    priceRange: "€15-40/mese",
    linkType: "percorso",
    linkTarget: "infortuni",
  },
  {
    id: "rc",
    label: "RC Professionale",
    description: "Se un cliente ti fa causa, paga la polizza",
    priceRange: "€10-40/mese",
    linkType: "percorso",
    linkTarget: "rc",
  },
  {
    id: "mutua",
    label: "Mutua Sanitaria",
    description: "Alternativa alle polizze salute: porta aperta, detraibile 19%",
    priceRange: "€4-20/mese",
    linkType: "percorso",
    linkTarget: "infortuni",
    linkLabel: "Scopri di più nel percorso Infortuni →",
  },
  {
    id: "tutela-legale",
    label: "Tutela Legale",
    description: "Avvocato in tasca per crediti insoluti",
    priceRange: "€8-12/mese",
    linkType: "coming-soon",
    educationalText:
      "Copre crediti insoluti e controversie contrattuali. Costa circa €100-150/anno. Include recupero crediti, difesa penale, controversie con fornitori.",
  },
  {
    id: "pensione",
    label: "Pensione Integrativa",
    description: "La pensione INPS da forfettario sarà bassa. Qui vedi perché.",
    priceRange: "Importo variabile",
    linkType: "pensione",
  },
  {
    id: "cyber",
    label: "Cyber Risk",
    description: "Protezione dati, hacker, ripristino sistemi",
    priceRange: "€10-25/mese",
    linkType: "coming-soon",
    educationalText:
      "Un attacco hacker, un ransomware o la perdita dei dati del cliente possono bloccarti l'attività. Polizze specifiche da €10-25/mese coprono ripristino sistemi, responsabilità per violazione dati e assistenza IT.",
  },
  {
    id: "tcm",
    label: "TCM/Vita",
    description: "Per chi ha familiari che dipendono dal proprio reddito",
    priceRange: "Variabile",
    linkType: "coming-soon",
    educationalText:
      "La TCM (Temporanea Caso Morte) lascia un capitale ai tuoi cari se non ci sei più. Il costo dipende da età e importo assicurato.",
  },
];

// ── FAQ Pensione Integrativa ──

export const faqPensione: FaqItem[] = [
  {
    question: "Devo comunicare al fondo i contributi non dedotti?",
    answer:
      "Sì, entro il 31 dicembre di ogni anno. Se non comunichi l'importo dei contributi non dedotti, quei contributi verranno tassati alla pensione. Perdi il vantaggio dell'esenzione fiscale.",
  },
  {
    question: "L'INPS non basta per la pensione?",
    answer:
      "Con il metodo contributivo, la pensione sarà proporzionale a quanto hai versato. Da forfettario versi il minimo, quindi la pensione INPS sarà una frazione del tuo ultimo reddito. La previdenza complementare serve a ridurre questo divario.",
  },
  {
    question: "FPA o PIP: quale scelgo?",
    answer:
      "Il Fondo Pensione Aperto (FPA) ha costi più bassi (ISC 1,1%-1,5%) e rendimenti storici migliori. Il PIP ha costi più alti (ISC 1,8%-2,5%) ma offre garanzia di capitale. Per la maggior parte dei forfettari il FPA è la scelta più conveniente, ma dipende dal tuo profilo di rischio.",
  },
  {
    question: "Quanto devo versare?",
    answer:
      "Non c'è un importo fisso. Anche €100/mese fanno la differenza su 20-30 anni grazie all'interesse composto. Puoi sempre aumentare dopo. Ogni euro versato riduce la base imponibile INPS (risparmio ~26% per Gestione Separata).",
  },
];

export const faqRc: FaqItem[] = [
  {
    question: "Devo chiedere al mio commercialista?",
    answer:
      "Sì, digli che stai valutando una RC Professionale. Ti confermerà che serve per proteggere il tuo patrimonio.",
  },
  {
    question: "Se un cliente non paga, la RC copre?",
    answer:
      "No, la RC copre i danni che tu fai al cliente, non il contrario. Per i crediti insoluti serve la tutela legale (costa ~€100-150/anno).",
  },
  {
    question: "È obbligatoria per me?",
    answer:
      "Se sei iscritto a un Albo: sì, per legge (DPR 137/2012). Se non sei iscritto (developer, marketer, consulente, creator): no, ma la maggior parte dei professionisti la consiglia. Sempre più clienti la richiedono come requisito contrattuale.",
  },
  {
    question: "Cos'è la retroattività?",
    answer:
      "Con retroattività 2 anni, la polizza copre errori fatti negli ultimi 2 anni. Retroattività illimitata copre tutto il passato. Senza retroattività, un errore di 6 mesi fa non è coperto. Controlla sempre questa clausola.",
  },
  {
    question: "Se chiudo la partita IVA?",
    answer:
      "Cerca una polizza con clausola postuma (o ultrattività): copre le richieste di risarcimento che arrivano dopo che hai smesso di lavorare. Serve a chi va in pensione o cambia attività.",
  },
  {
    question: "La RC del mio settore esiste?",
    answer:
      "Sì, esistono polizze \"miscellanea\" per professioni non regolamentate (Legge 4/2013): marketing, IT, formazione, benessere, consulenza. Cerca \"RC professionale + [il tuo settore]\".",
  },
];
