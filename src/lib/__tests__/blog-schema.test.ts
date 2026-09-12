import { describe, it, expect } from "vitest";
import {
  extractFaqFromMarkdown,
  extractHowToFromMarkdown,
  buildFaqPageSchema,
  buildHowToSchema,
  stripMarkdown,
} from "../blog-schema";

// ---------------------------------------------------------------------------
// Fixture: representative subset of blog-01 content
// ---------------------------------------------------------------------------

const BLOG_01_CONTENT = `
## Domande frequenti

### Quanto pago di tasse con 30.000 EUR di fatturato in regime forfettario?

Dipende dal coefficiente e dalla gestione INPS, ma per un professionista con coefficiente 78% in Gestione Separata al 15%: reddito imponibile 23.400 EUR, contributi INPS circa 6.100 EUR, imposta sostitutiva circa 2.600 EUR. **Netto spendibile: circa 21.300 EUR** (71% del fatturato).

### I contributi INPS sono tasse?

No, sono contributi previdenziali — finanziano la tua futura pensione, maternita', malattia e ISCRO. A differenza delle tasse, i contributi INPS sono **deducibili** dal reddito imponibile, quindi riducono l'imposta sostitutiva dell'anno successivo.

### Posso scaricare le spese nel regime forfettario?

No, nel forfettario le spese sono calcolate in modo forfettario tramite il coefficiente di redditivita'. Non puoi dedurre spese reali (computer, affitto, viaggi). L'unica deduzione ammessa e' quella dei contributi previdenziali obbligatori.

---

## Calcola le tue tasse in automatico con Forfettino
`;

const HOWTO_CONTENT = `
## Calcolo passo-passo con 3 esempi reali

Vediamo tre scenari concreti con numeri aggiornati al 2026.

### Esempio 1 — Sviluppatore web (Gestione Separata INPS)

**Profilo**: Marco, sviluppatore freelance, codice ATECO 62.01.00, al 3° anno di attivita'.

| Voce | Importo |
|------|---------|
| Incassato nel 2026 | 45.000 EUR |

Marco su 45.000 EUR incassati tiene in tasca circa **34.500 EUR**.

### Esempio 2 — Consulente marketing (Gestione Separata, aliquota 15%)

**Profilo**: Laura, consulente di marketing digitale, codice ATECO 73.11.02, al 7° anno.

| Voce | Importo |
|------|---------|
| Incassato nel 2026 | 60.000 EUR |

Laura su 60.000 EUR incassati tiene circa **42.350 EUR**.

### Esempio 3 — Parrucchiere artigiano (Gestione Artigiani, con riduzione 35%)

**Profilo**: Davide, parrucchiere, codice ATECO 96.02.01, al 2° anno.

| Voce | Importo |
|------|---------|
| Incassato nel 2026 | 35.000 EUR |

Davide su 35.000 EUR incassati tiene circa **30.320 EUR**.

---

## Errori comuni nel calcolo
`;

// ---------------------------------------------------------------------------
// extractFaqFromMarkdown
// ---------------------------------------------------------------------------

describe("extractFaqFromMarkdown", () => {
  it("should extract 3 FAQ items from blog-01 content", () => {
    const faqs = extractFaqFromMarkdown(BLOG_01_CONTENT);
    expect(faqs).toHaveLength(3);
    expect(faqs[0].question).toBe(
      "Quanto pago di tasse con 30.000 EUR di fatturato in regime forfettario?",
    );
    expect(faqs[1].question).toBe("I contributi INPS sono tasse?");
    expect(faqs[2].question).toBe("Posso scaricare le spese nel regime forfettario?");
  });

  it("should strip markdown bold from FAQ answers", () => {
    const faqs = extractFaqFromMarkdown(BLOG_01_CONTENT);
    // No ** should remain in answers
    for (const faq of faqs) {
      expect(faq.answer).not.toContain("**");
    }
  });

  it("should return plain text answers (no markdown formatting)", () => {
    const faqs = extractFaqFromMarkdown(BLOG_01_CONTENT);
    expect(faqs[0].answer).toContain("Netto spendibile: circa 21.300 EUR");
    expect(faqs[1].answer).toContain("deducibili");
  });

  it("should return empty array for content without FAQ section", () => {
    const content = `## Some other section\n\n### Not a FAQ\n\nSome text.`;
    expect(extractFaqFromMarkdown(content)).toEqual([]);
  });

  it("should return empty array for empty content", () => {
    expect(extractFaqFromMarkdown("")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// blog-02 FAQ extraction
// ---------------------------------------------------------------------------

const BLOG_02_FAQ_CONTENT = `
## Gestione Separata vs Artigiani/Commercianti: scadenze diverse

Some comparison text here.

---

## Domande frequenti

### Quante volte pago le tasse nel forfettario?

I forfettari in Gestione Separata pagano in 2-3 momenti principali: saldo + 1° acconto a giugno e 2° acconto a novembre (piu' eventuali rate se scelgono la rateizzazione). I forfettari iscritti alla Gestione Artigiani o Commercianti aggiungono 4 rate trimestrali INPS per i contributi fissi, per un totale di 6-8 versamenti annui distribuiti nell'arco dell'anno.

### Posso pagare tutto in un'unica soluzione?

Si, puoi versare saldo e 1° acconto insieme a giugno senza rateizzare — basta compilare il modello F24 con le righe separate per ogni tributo. Il 2° acconto e' comunque in un'unica soluzione a novembre. Non esiste un versamento unico annuale che copra tutto: l'Agenzia delle Entrate prevede almeno 2 appuntamenti distinti (giugno e novembre).

### Cosa metto nel modello F24?

I codici tributo principali per i forfettari sono: **1790** (1° acconto imposta sostitutiva), **1791** (2° acconto), **1792** (saldo). Per i contributi INPS Gestione Separata i codici sono generati automaticamente dal portale INPS nella sezione "Cassetto Previdenziale". Per artigiani e commercianti, i codici dei contributi fissi sono predeterminati e comunicati nella lettera di iscrizione alla gestione previdenziale.

---

## Non perdere mai piu' una scadenza con Forfettino
`;

describe("blog-02 FAQ extraction", () => {
  it("should extract exactly 3 FAQ items from blog-02 content", () => {
    const faqs = extractFaqFromMarkdown(BLOG_02_FAQ_CONTENT);
    expect(faqs).toHaveLength(3);
  });

  it("should extract the correct 3 questions from blog-02", () => {
    const faqs = extractFaqFromMarkdown(BLOG_02_FAQ_CONTENT);
    expect(faqs[0].question).toBe("Quante volte pago le tasse nel forfettario?");
    expect(faqs[1].question).toBe("Posso pagare tutto in un'unica soluzione?");
    expect(faqs[2].question).toBe("Cosa metto nel modello F24?");
  });

  it("should return plain text answers without markdown formatting", () => {
    const faqs = extractFaqFromMarkdown(BLOG_02_FAQ_CONTENT);
    for (const faq of faqs) {
      // No bold markers
      expect(faq.answer).not.toContain("**");
      // No link syntax
      expect(faq.answer).not.toMatch(/\[.*\]\(.*\)/);
      // No table pipe characters
      expect(faq.answer).not.toContain("|");
    }
    // Third FAQ answer should have stripped bold from codici tributo
    expect(faqs[2].answer).toContain("1790");
    expect(faqs[2].answer).toContain("1791");
    expect(faqs[2].answer).toContain("1792");
  });
});

// ---------------------------------------------------------------------------
// extractHowToFromMarkdown
// ---------------------------------------------------------------------------

describe("extractHowToFromMarkdown", () => {
  it("should extract 3 steps from blog-01 HowTo content", () => {
    const howTo = extractHowToFromMarkdown(HOWTO_CONTENT);
    expect(howTo).not.toBeNull();
    expect(howTo!.steps).toHaveLength(3);
    expect(howTo!.name).toBe("Calcolo passo-passo con 3 esempi reali");
  });

  it("should extract step names correctly", () => {
    const howTo = extractHowToFromMarkdown(HOWTO_CONTENT)!;
    expect(howTo.steps[0].name).toContain("Esempio 1");
    expect(howTo.steps[1].name).toContain("Esempio 2");
    expect(howTo.steps[2].name).toContain("Esempio 3");
  });

  it("should extract intro paragraph as step text (not table rows)", () => {
    const howTo = extractHowToFromMarkdown(HOWTO_CONTENT)!;
    // Step text should contain the profile description, not table data
    expect(howTo.steps[0].text).toContain("Marco");
    expect(howTo.steps[0].text).not.toContain("|");
  });

  it("should strip markdown bold from step text", () => {
    const howTo = extractHowToFromMarkdown(HOWTO_CONTENT)!;
    for (const step of howTo.steps) {
      expect(step.text).not.toContain("**");
    }
  });

  it("should return null for content without HowTo section", () => {
    const content = `## Some other section\n\nSome text.`;
    expect(extractHowToFromMarkdown(content)).toBeNull();
  });

  it("should return null for empty content", () => {
    expect(extractHowToFromMarkdown("")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildFaqPageSchema
// ---------------------------------------------------------------------------

describe("buildFaqPageSchema", () => {
  it("should generate valid FAQPage JSON-LD structure", () => {
    const faqs = [
      { question: "What is X?", answer: "X is a thing." },
      { question: "How does Y work?", answer: "Y works like this." },
    ];
    const schema = buildFaqPageSchema(faqs) as Record<string, unknown>;

    expect(schema["@context"]).toBe("https://schema.org");
    expect(schema["@type"]).toBe("FAQPage");

    const mainEntity = schema.mainEntity as Record<string, unknown>[];
    expect(mainEntity).toHaveLength(2);
    expect(mainEntity[0]["@type"]).toBe("Question");
    expect(mainEntity[0].name).toBe("What is X?");

    const answer = mainEntity[0].acceptedAnswer as Record<string, unknown>;
    expect(answer["@type"]).toBe("Answer");
    expect(answer.text).toBe("X is a thing.");
  });
});

// ---------------------------------------------------------------------------
// buildHowToSchema
// ---------------------------------------------------------------------------

describe("buildHowToSchema", () => {
  it("should generate valid HowTo JSON-LD structure", () => {
    const data = {
      name: "How to do X",
      steps: [
        { name: "Step 1", text: "Do this first." },
        { name: "Step 2", text: "Then do this." },
      ],
    };
    const schema = buildHowToSchema(data) as Record<string, unknown>;

    expect(schema["@context"]).toBe("https://schema.org");
    expect(schema["@type"]).toBe("HowTo");
    expect(schema.name).toBe("How to do X");

    const steps = schema.step as Record<string, unknown>[];
    expect(steps).toHaveLength(2);
    expect(steps[0]["@type"]).toBe("HowToStep");
    expect(steps[0].name).toBe("Step 1");
    expect(steps[0].text).toBe("Do this first.");
  });
});

// ---------------------------------------------------------------------------
// stripMarkdown
// ---------------------------------------------------------------------------

describe("stripMarkdown", () => {
  it("should remove bold markers", () => {
    expect(stripMarkdown("This is **bold** text")).toBe("This is bold text");
  });

  it("should remove link syntax", () => {
    expect(stripMarkdown("Visit [Google](https://google.com) now")).toBe("Visit Google now");
  });

  it("should remove inline code", () => {
    expect(stripMarkdown("Use `console.log` here")).toBe("Use console.log here");
  });

  it("should remove horizontal rules", () => {
    expect(stripMarkdown("Above\n---\nBelow")).toBe("Above\n\nBelow");
  });

  it("should remove list markers", () => {
    expect(stripMarkdown("- First item\n- Second item")).toBe("First item\nSecond item");
    expect(stripMarkdown("1. Step one\n2. Step two")).toBe("Step one\nStep two");
  });

  it("should handle combined markdown formatting", () => {
    const input = "**Bold** and [link](url) and `code`";
    expect(stripMarkdown(input)).toBe("Bold and link and code");
  });
});

// ---------------------------------------------------------------------------
// blog-03 FAQ extraction
// ---------------------------------------------------------------------------

const BLOG_03_FAQ_CONTENT = `
## I primi 90 giorni: cosa fare dopo l'apertura

Hai la partita IVA, il codice ATECO, la PEC. E adesso?

---

## Domande frequenti

### Quanto tempo ci vuole per aprire la partita IVA?

Online, pochi minuti. Il numero di partita IVA viene assegnato immediatamente dall'Agenzia delle Entrate tramite il portale Fisconline. L'iscrizione alla Gestione Separata INPS avviene automaticamente con la prima dichiarazione dei redditi, mentre per Artigiani e Commercianti l'iscrizione in Camera di Commercio puo' richiedere qualche giorno lavorativo in piu'. Tramite commercialista, l'intera procedura si conclude generalmente entro 1-3 giorni lavorativi.

### Posso aprire la partita IVA e non fatturare subito?

Si, non c'e' nessun obbligo di fatturare un importo minimo ne' un termine entro cui emettere la prima fattura. Se sei in Gestione Separata non avrai nemmeno contributi da pagare finche' non generi reddito — i contributi sono interamente proporzionali. Se sei artigiano o commerciante, pero', i contributi minimi fissi (circa 4.500 EUR/anno, riducibili con la riduzione 35%) sono dovuti indipendentemente dal fatturato.

### Serve il commercialista per il regime forfettario?

Non e' obbligatorio per legge, ma e' fortemente consigliato — almeno per la prima dichiarazione dei redditi e per la scelta del codice ATECO. Un errore nella classificazione dell'attivita' puo' costarti migliaia di euro in contributi extra o in sanzioni. Molti commercialisti offrono pacchetti forfettari dedicati a partire da 300-500 EUR/anno.

### Posso lavorare come dipendente e avere la partita IVA forfettaria?

Si, purche' il tuo reddito da lavoro dipendente o pensione dell'anno precedente non superi 35.000 EUR lordi. E purche' non fatturi prevalentemente (oltre il 50% del totale) al tuo attuale datore di lavoro o a un ex datore di lavoro degli ultimi 2 anni.

---

*Articolo aggiornato al 28 marzo 2026.*
`;

describe("blog-03 FAQ extraction", () => {
  it("should extract exactly 4 FAQ items from blog-03 content", () => {
    const faqs = extractFaqFromMarkdown(BLOG_03_FAQ_CONTENT);
    expect(faqs).toHaveLength(4);
  });

  it("should extract the correct 4 questions from blog-03", () => {
    const faqs = extractFaqFromMarkdown(BLOG_03_FAQ_CONTENT);
    expect(faqs[0].question).toBe("Quanto tempo ci vuole per aprire la partita IVA?");
    expect(faqs[1].question).toBe("Posso aprire la partita IVA e non fatturare subito?");
    expect(faqs[2].question).toBe("Serve il commercialista per il regime forfettario?");
    expect(faqs[3].question).toBe("Posso lavorare come dipendente e avere la partita IVA forfettaria?");
  });

  it("should return plain text answers without markdown formatting", () => {
    const faqs = extractFaqFromMarkdown(BLOG_03_FAQ_CONTENT);
    for (const faq of faqs) {
      expect(faq.answer).not.toContain("**");
      expect(faq.answer).not.toMatch(/\[.*\]\(.*\)/);
      expect(faq.answer).not.toContain("|");
    }
  });

  it("should not include footer text after horizontal rule in last FAQ answer", () => {
    const faqs = extractFaqFromMarkdown(BLOG_03_FAQ_CONTENT);
    const lastAnswer = faqs[faqs.length - 1].answer;
    expect(lastAnswer).not.toContain("Articolo aggiornato");
    expect(lastAnswer).not.toContain("normativa vigente");
  });
});

// ---------------------------------------------------------------------------
// blog-04 FAQ extraction
// ---------------------------------------------------------------------------

const BLOG_04_FAQ_CONTENT = `
## Come si calcolano i contributi — esempio pratico

Some example text here.

---

## Domande frequenti

### Devo pagare l'INPS anche se non fatturo nulla?

Dipende dalla gestione. In **Gestione Separata**: no, paghi solo in proporzione al reddito. Se fatturi zero, paghi zero — nessun contributo minimo. Questo la rende la gestione piu' adatta a chi sta iniziando o ha entrate variabili. In **Gestione Artigiani/Commercianti**: si, devi versare il contributo minimale (circa 4.500-4.600 EUR/anno) indipendentemente dal fatturato. Anche se la tua attivita' e' ferma, le rate trimestrali continuano ad arrivare. Per questo motivo, se sei artigiano o commerciante con fatturato basso, la riduzione 35% diventa ancora piu' importante.

### Posso cambiare gestione INPS?

Non liberamente — la gestione dipende dal tipo di attivita' e dal codice ATECO. Se svolgi attivita' artigianale, sei obbligatoriamente iscritto alla Gestione Artigiani; se sei un professionista senza albo, alla Gestione Separata. Puoi cambiare gestione solo cambiando tipo di attivita' (ad esempio, chiudendo la posizione artigiana e aprendone una come consulente). Non e' possibile "scegliere" la Gestione Separata per pagare meno se la tua attivita' rientra tra quelle artigianali o commerciali.

### L'ISCRO cos'e' e ne ho diritto?

L'ISCRO (Indennita' Straordinaria di Continuita' Reddituale e Operativa) e' un ammortizzatore sociale riservato ai liberi professionisti iscritti alla Gestione Separata. Se il tuo reddito cala drasticamente — almeno il 70% rispetto alla media dei 2 anni precedenti — e hai almeno 3 anni di contributi versati, puoi richiedere un'indennita' mensile per 6 mesi (importo compreso tra 250 e 800 EUR/mese). L'aliquota ISCRO (0,35%) e' gia' inclusa nel 26,07% che paghi ogni anno, quindi non ha un costo aggiuntivo. La domanda si presenta online sul portale INPS entro il 31 ottobre di ogni anno. Attenzione: artigiani e commercianti non possono accedere all'ISCRO — per loro non esiste un equivalente.

---

*Articolo aggiornato al 28 marzo 2026. Dati basati su Circolare INPS n. 8/2026 (Gestione Separata, aliquote e massimali) e Circolare INPS n. 14/2026 (Artigiani e Commercianti, minimali e aliquote). Per la tua situazione specifica, consulta un commercialista.*
`;

describe("blog-04 FAQ extraction", () => {
  it("should extract exactly 3 FAQ items from blog-04 content", () => {
    const faqs = extractFaqFromMarkdown(BLOG_04_FAQ_CONTENT);
    expect(faqs).toHaveLength(3);
  });

  it("should extract the correct 3 questions from blog-04", () => {
    const faqs = extractFaqFromMarkdown(BLOG_04_FAQ_CONTENT);
    expect(faqs[0].question).toBe("Devo pagare l'INPS anche se non fatturo nulla?");
    expect(faqs[1].question).toBe("Posso cambiare gestione INPS?");
    expect(faqs[2].question).toBe("L'ISCRO cos'e' e ne ho diritto?");
  });

  it("should return plain text answers without markdown formatting", () => {
    const faqs = extractFaqFromMarkdown(BLOG_04_FAQ_CONTENT);
    for (const faq of faqs) {
      expect(faq.answer).not.toContain("**");
      expect(faq.answer).not.toMatch(/\[.*\]\(.*\)/);
      expect(faq.answer).not.toContain("|");
    }
  });

  it("should not include footer text after horizontal rule in last FAQ answer", () => {
    const faqs = extractFaqFromMarkdown(BLOG_04_FAQ_CONTENT);
    const lastAnswer = faqs[faqs.length - 1].answer;
    expect(lastAnswer).not.toContain("Articolo aggiornato");
    expect(lastAnswer).not.toContain("Circolare INPS");
  });
});

// ---------------------------------------------------------------------------
// blog-05 FAQ extraction
// ---------------------------------------------------------------------------

const BLOG_05_FAQ_CONTENT = `
## Come (e quando) si esce dal forfettario

Some text about exiting the regime.

---

## Domande frequenti

### Conviene il forfettario se guadagno molto?

Con fatturati alti (60-85k EUR) e costi bassi, il forfettario conviene ancora nella maggior parte dei casi. L'aliquota del 15% e' molto piu' bassa dell'IRPEF progressiva che su quegli importi arriverebbe al 35-43%. Pero' piu' il fatturato cresce, piu' il vantaggio si assottiglia — soprattutto se hai costi reali significativi e detrazioni personali rilevanti. La soglia psicologica e' intorno ai 50-60k EUR di fatturato: sotto quella cifra il forfettario vince quasi sempre, sopra conviene fare una simulazione dettagliata con i tuoi numeri reali.

### Posso rientrare nel forfettario dopo essere passato all'ordinario?

Si, ma con tempistiche diverse a seconda di come sei uscito. Se l'uscita e' stata **volontaria** (hai scelto tu di passare all'ordinario), devi rispettare il **vincolo triennale**: resti in ordinario per almeno 3 anni, poi puoi rientrare nel forfettario se rispetti tutti i requisiti. Se l'uscita e' stata **obbligatoria** (per superamento della soglia 85.000 EUR), non c'e' vincolo triennale — puoi rientrare nel forfettario gia' dall'anno successivo, purche' tu sia tornato sotto gli 85.000 EUR e rispetti gli altri requisiti.

### Il mio commercialista dice che il forfettario conviene sempre. Ha ragione?

Nella maggior parte dei casi si, ma non in tutti. Il forfettario e' piu' semplice da gestire anche per il commercialista — meno adempimenti significano meno lavoro e meno rischio di errori. Questo non significa che il consiglio sia sbagliato, ma che potrebbe non essere stato fatto un confronto numerico dettagliato con la tua situazione specifica. Se hai costi reali elevati (superiori al forfait), detrazioni personali importanti (mutuo, figli, ristrutturazione) e acquisti con IVA significativa, chiedi esplicitamente una simulazione comparativa. I numeri non mentono.

---

*Articolo aggiornato al 29 marzo 2026. La simulazione usa dati esemplificativi e non sostituisce una consulenza professionale.*
`;

describe("blog-05 FAQ extraction", () => {
  it("should extract exactly 3 FAQ items from blog-05 content", () => {
    const faqs = extractFaqFromMarkdown(BLOG_05_FAQ_CONTENT);
    expect(faqs).toHaveLength(3);
  });

  it("should extract the correct 3 questions from blog-05", () => {
    const faqs = extractFaqFromMarkdown(BLOG_05_FAQ_CONTENT);
    expect(faqs[0].question).toBe("Conviene il forfettario se guadagno molto?");
    expect(faqs[1].question).toBe("Posso rientrare nel forfettario dopo essere passato all'ordinario?");
    expect(faqs[2].question).toBe("Il mio commercialista dice che il forfettario conviene sempre. Ha ragione?");
  });

  it("should return plain text answers without markdown formatting", () => {
    const faqs = extractFaqFromMarkdown(BLOG_05_FAQ_CONTENT);
    for (const faq of faqs) {
      expect(faq.answer).not.toContain("**");
      expect(faq.answer).not.toMatch(/\[.*\]\(.*\)/);
      expect(faq.answer).not.toContain("|");
    }
  });

  it("should not include footer text after horizontal rule in last FAQ answer", () => {
    const faqs = extractFaqFromMarkdown(BLOG_05_FAQ_CONTENT);
    const lastAnswer = faqs[faqs.length - 1].answer;
    expect(lastAnswer).not.toContain("Articolo aggiornato");
    expect(lastAnswer).not.toContain("consulenza professionale");
  });
});

// ---------------------------------------------------------------------------
// blog-03 HowTo extraction
// ---------------------------------------------------------------------------

const BLOG_03_HOWTO_CONTENT = `
## Come aprire la partita IVA — passo per passo

### Step 1: Scegli il codice ATECO giusto

Il codice ATECO classifica la tua attivita' economica e determina:
- Il **coefficiente di redditivita'** (quanto del fatturato viene tassato)
- La **gestione previdenziale** (Gestione Separata, Artigiani o Commercianti)
- Eventuali requisiti specifici (iscrizione ad albi, Camera di Commercio, ecc.)

Ecco i codici ATECO piu' comuni tra i freelancer:

| Professione | Codice ATECO | Coefficiente | Gestione INPS |
|------------|-------------|-------------|--------------|
| Sviluppatore software | 62.01.00 | 78% | Separata |
| Web designer | 74.10.21 | 78% | Separata |
| Parrucchiere | 96.02.01 | 67% | Artigiani |

**Attenzione**: scegliere il codice sbagliato puo' costarti caro.

### Step 2: Compila il modello AA9/12

Per aprire la partita IVA devi compilare il **modello AA9/12** (dichiarazione di inizio attivita').

### Step 3: Iscriviti alla gestione previdenziale

In base al codice ATECO e al tipo di attivita' devi scegliere la gestione previdenziale corretta.

### Step 4: Attiva la fatturazione elettronica

Dal 2024, la fatturazione elettronica e' **obbligatoria per tutti i forfettari**, senza eccezioni.

---

## Quanto costa davvero avere la partita IVA forfettaria
`;

describe("blog-03 HowTo extraction", () => {
  it("should extract 4 steps from blog-03 HowTo content", () => {
    const howTo = extractHowToFromMarkdown(BLOG_03_HOWTO_CONTENT);
    expect(howTo).not.toBeNull();
    expect(howTo!.steps).toHaveLength(4);
    expect(howTo!.name).toBe("Come aprire la partita IVA — passo per passo");
  });

  it("should extract step names correctly", () => {
    const howTo = extractHowToFromMarkdown(BLOG_03_HOWTO_CONTENT)!;
    expect(howTo.steps[0].name).toBe("Step 1: Scegli il codice ATECO giusto");
    expect(howTo.steps[1].name).toBe("Step 2: Compila il modello AA9/12");
    expect(howTo.steps[2].name).toBe("Step 3: Iscriviti alla gestione previdenziale");
    expect(howTo.steps[3].name).toBe("Step 4: Attiva la fatturazione elettronica");
  });

  it("should extract plain text step content (no bold, no links, no table pipes)", () => {
    const howTo = extractHowToFromMarkdown(BLOG_03_HOWTO_CONTENT)!;
    for (const step of howTo.steps) {
      expect(step.text).not.toContain("**");
      expect(step.text).not.toMatch(/\[.*\]\(.*\)/);
      expect(step.text).not.toContain("|");
    }
    // Step 1 should have intro text, not table data
    expect(howTo.steps[0].text).toContain("codice ATECO");
  });
});
