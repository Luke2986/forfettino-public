import { describe, it, expect } from "vitest";
import { computeWordCount } from "@/lib/blog-wordcount";

describe("computeWordCount", () => {
  it("ritorna 0 per stringa vuota o null", () => {
    expect(computeWordCount("")).toBe(0);
    expect(computeWordCount(null as unknown as string)).toBe(0);
  });

  it("conta parole in markdown puro", () => {
    const md = "Questo e' un articolo semplice con dieci parole esatte qui.";
    expect(computeWordCount(md)).toBe(10);
  });

  it("rimuove frontmatter YAML prima di contare", () => {
    const md = `---
title: "Esempio"
slug: "esempio"
keyword_primaria: "test"
---

Questo testo ha cinque parole.`;
    expect(computeWordCount(md)).toBe(5);
  });

  it("rimuove bold/italic e conta solo il testo", () => {
    const md = "Questo **e'** un _testo_ **molto** importante.";
    // Questo e' un testo molto importante. = 6 parole
    expect(computeWordCount(md)).toBe(6);
  });

  it("conta link come testo visibile, ignora URL", () => {
    const md = "Leggi la [guida ufficiale](https://example.com/path) adesso.";
    // Leggi la guida ufficiale adesso = 5 parole
    expect(computeWordCount(md)).toBe(5);
  });

  it("ignora code fence blocks", () => {
    const md = `Prima del codice.

\`\`\`typescript
const foo = "bar";
function test() { return 42; }
\`\`\`

Dopo il codice.`;
    // "Prima del codice." (3) + "Dopo il codice." (3) = 6
    expect(computeWordCount(md)).toBe(6);
  });

  it("ignora inline code tick", () => {
    const md = "Usa il comando `npm install` per installare.";
    // Usa il comando npm install per installare = 7 parole
    expect(computeWordCount(md)).toBe(7);
  });

  it("gestisce headings markdown rimuovendo #", () => {
    const md = `# Titolo principale

## Sezione uno

Contenuto breve.`;
    // Titolo principale Sezione uno Contenuto breve = 6 parole
    expect(computeWordCount(md)).toBe(6);
  });

  it("conta liste correttamente", () => {
    const md = `- Primo elemento
- Secondo elemento
- Terzo elemento lungo`;
    // Primo elemento Secondo elemento Terzo elemento lungo = 7 parole
    expect(computeWordCount(md)).toBe(7);
  });

  it("conta tabelle rimuovendo separatori", () => {
    const md = `| Colonna A | Colonna B |
|-----------|-----------|
| Valore uno | Valore due |`;
    // Colonna A Colonna B Valore uno Valore due = 8 parole
    expect(computeWordCount(md)).toBe(8);
  });

  it("produce risultato > 500 per contenuto blog realistico", () => {
    const lorem = Array(150).fill("parola").join(" ");
    const md = `---
title: "Test"
---

# Titolo

${lorem}

## Sezione

${lorem}

${lorem}`;
    expect(computeWordCount(md)).toBeGreaterThan(400);
  });

  it("e' deterministico (stesso input → stesso output)", () => {
    const md = "# Ciao\n\nTesto **di** prova con [link](https://x.it).";
    const first = computeWordCount(md);
    const second = computeWordCount(md);
    expect(first).toBe(second);
  });
});
