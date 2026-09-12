export type LandingFaqItem = {
  question: string;
  answer: string;
};

// Single source of truth for landing FAQ: consumed by
// LandingBelowFold (Accordion) and Landing (FAQPage JSON-LD schema).
// Shortened for GEO (Epic 79.5): 2-4 sentences, 40-70 words, at least one factual signal.
// Epic 79.5 revalidation: all answers within 33-57 words (target 40-70, short answers
// left unchanged per AC #4 — no artificial inflation of 79.3-approved content).
export const landingFaqItems: LandingFaqItem[] = [
  {
    question: "Cos'è il Regime Forfettario e chi può accedervi?",
    answer:
      "Il Regime Forfettario (Legge 190/2014) è il regime fiscale agevolato per partite IVA fino a 85.000 EUR di ricavi annui, usato da oltre 2 milioni di italiani. Prevede un'imposta sostitutiva del 5% per i primi 5 anni e 15% dopo, in sostituzione di IRPEF e addizionali. Il reddito imponibile si calcola applicando il coefficiente ATECO ai ricavi.",
  },
  {
    question: "Quanto costa Forfettino?",
    answer:
      "Forfettino è completamente gratuito (0 EUR), senza carta di credito né periodo di prova. Include dashboard fiscale, registrazione incassi, scadenziario F24 e calcolo del netto spendibile in tempo reale per tutti i forfettari (Legge 190/2014). Il piano PRO arriverà in futuro con export CSV, report clienti e benchmark tariffe.",
  },
  {
    question: "Come calcolo il netto spendibile nel Regime Forfettario?",
    answer:
      "Il netto spendibile si ottiene sottraendo imposta sostitutiva e contributi INPS dal fatturato incassato. Formula: Netto = Lordo − (Lordo × Coefficiente ATECO × Aliquota imposta) − (Lordo × Coefficiente ATECO × Aliquota INPS). Con 30.000 EUR lordi, coefficiente ATECO 78%, imposta 15% e INPS 26,07%, restano circa 20.400 EUR.",
  },
  {
    question: "Che differenza c'è tra Forfettino e Fiscozen?",
    answer:
      "Fiscozen (da 399 EUR/anno) è un commercialista online che gestisce la dichiarazione dei redditi a fine anno. Forfettino non sostituisce il commercialista: mostra ogni giorno quanto puoi spendere, quanto devi accantonare per tasse e contributi INPS, e quando scadono gli F24. È gratuito e complementare.",
  },
  {
    question: "Che differenza c'è tra Forfettino e Fatture in Cloud?",
    answer:
      "Fatture in Cloud (da 8 EUR/mese) è un software di fatturazione elettronica focalizzato su emissione e ricezione di XML. Forfettino risolve un problema diverso: mostra il netto spendibile reale ogni giorno, con previsioni imposta sostitutiva, contributi INPS e scadenziario F24 completo. È gratuito.",
  },
  {
    question: "Forfettino è un'alternativa a Finom?",
    answer:
      "Finom è un conto business con fatturazione integrata. Forfettino è un gestionale fiscale gratuito dedicato al Regime Forfettario (Legge 190/2014): calcola ogni giorno il netto spendibile, monitora la soglia 85.000 EUR e gestisce lo scadenziario F24. I due servizi sono complementari, non alternativi: puoi usarli insieme.",
  },
  {
    question: "Forfettino può sostituire TaxMan o Flextax?",
    answer:
      "TaxMan e Flextax offrono dichiarazione fiscale con commercialista dedicato, da centinaia di euro l'anno. Forfettino non sostituisce questi servizi, li completa: monitora la situazione fiscale tutto l'anno, calcola quanto puoi spendere oggi e notifica ogni scadenza di saldo, acconto imposta sostitutiva e INPS. È gratis.",
  },
  {
    question: "Forfettino è un'alternativa a Partitaiva24 o ForfettApp?",
    answer:
      "Partitaiva24 offre consulenza con commercialista dedicato, ForfettApp è un calcolatore fiscale spot. Forfettino è diverso: un sistema di monitoraggio continuo della liquidità reale nel Regime Forfettario (Legge 190/2014) che ti dice ogni giorno quanto puoi spendere dopo imposta sostitutiva e contributi INPS. Gratuito, senza carta di credito.",
  },
  {
    question: "Posso usare Forfettino da smartphone?",
    answer:
      "Forfettino è una web app responsive progettata mobile-first per il Regime Forfettario (Legge 190/2014). Funziona su smartphone, tablet e desktop direttamente dal browser, senza installare nulla. L'interfaccia si adatta automaticamente allo schermo per darti accesso al netto spendibile, allo scadenziario F24 e alla soglia 85.000 EUR ovunque.",
  },
  {
    question: "Verso un sacco di INPS ogni anno! Non basta per la pensione?",
    answer:
      "Probabilmente no. Nel sistema contributivo i freelance ricevono in pensione in proporzione ai contributi versati, senza TFR che si accumula come per i dipendenti. A 65+ anni l'assegno INPS rischia di essere molto più basso dell'ultimo reddito. Queste sono informazioni generiche: confrontati sempre con il tuo commercialista.",
  },
  {
    question: "Mi conviene fare una pensione integrativa? Posso scaricarla dalle tasse?",
    answer:
      "Conviene per proteggere il futuro: iniziare con 50 EUR al mese a 30 anni fa una differenza enorme grazie all'interesse composto. Attenzione però: nel Regime Forfettario puro i versamenti al fondo pensione privato non sono deducibili dall'imposta sostitutiva. Fallo come TFR fai-da-te, non per pagare meno tasse oggi.",
  },
  {
    question: "Quali sono le 3 gestioni INPS disponibili per i forfettari nel 2026?",
    answer:
      "I forfettari versano contributi a Gestione Separata (26,07% senza minimale, Circ. INPS 8/2026), Artigiani (24% con minimale ~4.521 EUR, Circ. INPS 14/2026) o Commercianti (24,48% stesso minimale). Artigiani e Commercianti possono richiedere la riduzione contributiva del 35% (Legge 190/2014) entro il 28 febbraio di ogni anno.",
  },
  {
    question: "Quando si pagano imposta sostitutiva e contributi INPS nel forfettario?",
    answer:
      "Saldo imposta sostitutiva e primo acconto entro la scadenza di giugno — per i forfettari e i soggetti ISA prorogata, nel 2026 al 20 luglio — secondo acconto il 30 novembre. I contributi INPS fissi di Artigiani e Commercianti seguono quattro rate trimestrali al 16 maggio, 20 agosto, 16 novembre e 16 febbraio. I contributi INPS sul reddito eccedente il minimale si pagano con le stesse scadenze IRPEF (Legge 190/2014).",
  },
  {
    question: "Cosa succede se supero la soglia di 85.000 EUR nel regime forfettario?",
    answer:
      "Superando 85.000 EUR in un anno, il forfettario resta nel regime fino al 31 dicembre e passa all'ordinario dall'anno successivo (Legge 197/2022). Sopra 100.000 EUR la decadenza è immediata dal momento del superamento, con passaggio obbligato a IVA, IRPEF progressiva e tassazione ordinaria. Monitorare il progresso verso la soglia è fondamentale.",
  },
];
