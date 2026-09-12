/**
 * fatturapa-parser.ts - Parser client-side per XML FatturaPA (standard SDI)
 *
 * Conforme alle specifiche tecniche v1.2.2 (fatturapa.gov.it):
 * - Namespace: http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2
 * - Formati: FPA12 (PA) e FPR12 (privati B2B/B2C)
 * - Fatture singole e lotti (più FatturaElettronicaBody)
 * - Denominazione azienda oppure Nome + Cognome persona fisica
 *
 * Estrae ENTRAMBI i soggetti:
 * - CedentePrestatore = chi EMETTE la fattura (venditore/fornitore)
 * - CessionarioCommittente = chi RICEVE la fattura (acquirente/cliente)
 *
 * Il consumer (hook) decide chi è la "controparte" confrontando con il profilo utente.
 *
 * Catena fallback per l'importo totale (ImportoTotaleDocumento è OPZIONALE nello XSD):
 * 1. ImportoTotaleDocumento (se presente)
 * 2. Somma DettaglioPagamento > ImportoPagamento
 * 3. Somma DatiRiepilogo > (ImponibileImporto + Imposta) per aliquota
 * 4. Somma DettaglioLinee > PrezzoTotale (solo imponibile, ultimo resort)
 *
 * Pre-processing dell'XML:
 * - Rimuove BOM (Byte Order Mark) presente nei file Windows
 * - Rimuove direttive <?xml-stylesheet> che causano trasformazioni XSLT indesiderate
 * - Normalizza prefissi namespace sul root element (es. p:FatturaElettronica → FatturaElettronica)
 *
 * NON supporta:
 * - File .p7m (firma digitale) — devono essere estratti prima
 */

// === TIPI ===

export interface ParsedInvoice {
  /** Data fattura in formato YYYY-MM-DD */
  date: string;
  /** Anno fiscale derivato dalla data */
  fiscalYear: number;
  /** Nome del CedentePrestatore (chi emette la fattura) */
  sellerName: string;
  /** Nome del CessionarioCommittente (chi riceve la fattura) */
  buyerName: string;
  /** Importo totale del documento in euro */
  grossAmount: number;
  /** Numero fattura */
  invoiceNumber: string;
}

export class FatturaPAParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FatturaPAParseError";
  }
}

// === HELPER ===

/**
 * Cerca un elemento nel documento XML, gestendo sia con che senza namespace.
 * FatturaPA usa il namespace "http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2"
 * ma molti file lo omettono o usano prefissi diversi.
 */
function getElementText(parent: Element, tagName: string): string | null {
  // Prima prova senza namespace (più comune nei file reali)
  let el = parent.getElementsByTagName(tagName)[0];
  if (el) return el.textContent?.trim() || null;

  // Prova con namespace FatturaPA 1.2
  const NS = "http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2";
  el = parent.getElementsByTagNameNS(NS, tagName)[0];
  if (el) return el.textContent?.trim() || null;

  return null;
}

/**
 * Cerca tutti gli elementi con un dato tag name, gestendo namespace.
 */
function getAllElements(parent: Element | Document, tagName: string): Element[] {
  let elements = Array.from(parent.getElementsByTagName(tagName));
  if (elements.length > 0) return elements;

  const NS = "http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2";
  elements = Array.from(parent.getElementsByTagNameNS(NS, tagName));
  return elements;
}

/**
 * Valida il formato data YYYY-MM-DD
 */
function isValidDate(dateStr: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(Date.parse(dateStr));
}

/**
 * Trova l'elemento root FatturaElettronica nel documento XML con catena di fallback:
 * 1. Il root element stesso (caso standard dopo preprocessing)
 * 2. Ricerca per localName "FatturaElettronica" tra i figli del root (wrapping XSLT)
 * 3. Ricerca con getElementsByTagNameNS nel namespace FatturaPA
 * 4. Ricerca globale per qualsiasi elemento con localName "FatturaElettronica"
 */
function findFatturaRoot(doc: Document): Element | null {
  const root = doc.documentElement;
  if (!root) return null;

  const rootLocal = root.localName || root.tagName;

  // 1. Il root è già FatturaElettronica (caso standard)
  if (rootLocal === "FatturaElettronica" || rootLocal.endsWith(":FatturaElettronica")) {
    return root;
  }

  // 2. Cerca FatturaElettronica come figlio diretto del root (wrapping XSLT)
  for (const child of Array.from(root.children)) {
    const childLocal = child.localName || child.tagName;
    if (childLocal === "FatturaElettronica" || childLocal.endsWith(":FatturaElettronica")) {
      return child;
    }
  }

  // 3. Ricerca con namespace
  const NS = "http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2";
  const nsResult = doc.getElementsByTagNameNS(NS, "FatturaElettronica")[0];
  if (nsResult) return nsResult;

  // 4. Ricerca globale per tag name (include prefissi)
  const globalResult = doc.getElementsByTagName("FatturaElettronica")[0];
  if (globalResult) return globalResult;

  return null;
}

// === PRE-PROCESSING XML ===

/**
 * Pre-processa la stringa XML per gestire i formati reali dal SDI:
 *
 * 1. Rimuove il BOM (Byte Order Mark \uFEFF) presente nei file generati su Windows
 * 2. Rimuove le direttive <?xml-stylesheet> che causano trasformazioni XSLT
 *    indesiderate nel DOMParser (il browser può generare un documento HTML
 *    con root "document-content" invece dell'XML originale)
 * 3. Normalizza i prefissi namespace sul tag root FatturaElettronica
 *    (es. <p:FatturaElettronica → <FatturaElettronica, </p:FatturaElettronica → </FatturaElettronica)
 *    I figli nei file reali sono già senza prefisso, quindi questa normalizzazione è sicura.
 */
function preprocessXml(xmlString: string): string {
  let s = xmlString;

  // 1. Rimuovi BOM (Byte Order Mark)
  s = s.replace(/^\uFEFF/, "");

  // 2. Rimuovi direttive xml-stylesheet (possono causare trasformazione XSLT)
  s = s.replace(/<\?xml-stylesheet[^?]*\?>/gi, "");

  // 3. Normalizza prefissi namespace sul root element FatturaElettronica
  //    <p:FatturaElettronica ... → <FatturaElettronica ...
  //    </p:FatturaElettronica>  → </FatturaElettronica>
  //    Supporta qualsiasi prefisso (p, ns2, n, ecc.)
  s = s.replace(/<(\/?)[a-zA-Z0-9]+:FatturaElettronica/g, "<$1FatturaElettronica");

  return s.trim();
}

// === PARSER PRINCIPALE ===

/**
 * Parsa una stringa XML FatturaPA e restituisce un array di fatture estratte.
 *
 * @param xmlString - Il contenuto XML del file FatturaPA
 * @returns Array di ParsedInvoice (una per ogni FatturaElettronicaBody nel documento)
 * @throws FatturaPAParseError se il file non è un XML valido o non è una FatturaPA
 */
export function parseFatturaPA(xmlString: string): ParsedInvoice[] {
  if (!xmlString || typeof xmlString !== "string") {
    throw new FatturaPAParseError("Il file è vuoto o non è una stringa valida.");
  }

  // Pre-processing: rimuovi BOM, xml-stylesheet, normalizza prefissi namespace
  const cleanXml = preprocessXml(xmlString);

  const parser = new DOMParser();
  const doc = parser.parseFromString(cleanXml, "application/xml");

  // Controlla errori di parsing XML
  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    throw new FatturaPAParseError(
      "Il file non è un XML valido. Assicurati di caricare un file XML FatturaPA."
    );
  }

  // Verifica che sia un documento FatturaPA (con fallback robusti)
  const root = findFatturaRoot(doc);

  if (!root) {
    const actualRoot = doc.documentElement?.localName || doc.documentElement?.tagName || "sconosciuto";
    throw new FatturaPAParseError(
      `Il file XML non è una FatturaPA. Elemento radice: "${actualRoot}". ` +
      `Atteso: "FatturaElettronica".`
    );
  }

  // Estrai entrambi i soggetti dall'header
  const { sellerName, buyerName } = extractPartyNames(root);

  // Estrai tutti i body (lotto di fatture)
  const bodies = getAllElements(root, "FatturaElettronicaBody");

  if (bodies.length === 0) {
    throw new FatturaPAParseError(
      "Nessun corpo fattura trovato nel documento (FatturaElettronicaBody mancante)."
    );
  }

  const invoices: ParsedInvoice[] = [];

  for (let i = 0; i < bodies.length; i++) {
    const body = bodies[i];
    const invoice = extractInvoiceFromBody(body, sellerName, buyerName, i + 1, bodies.length);
    invoices.push(invoice);
  }

  return invoices;
}

// === ESTRAZIONE SOGGETTI ===

interface PartyNames {
  sellerName: string;
  buyerName: string;
}

/**
 * Estrae i nomi di entrambi i soggetti dall'header della FatturaPA.
 * - CedentePrestatore = chi EMETTE la fattura (sellerName)
 * - CessionarioCommittente = chi RICEVE la fattura (buyerName)
 */
function extractPartyNames(root: Element): PartyNames {
  const sellerName = extractNameFromBlock(root, "CedentePrestatore");
  const buyerName = extractNameFromBlock(root, "CessionarioCommittente");

  return { sellerName, buyerName };
}

/**
 * Estrae il nome anagrafico da un blocco (CedentePrestatore o CessionarioCommittente).
 * Prova prima Denominazione (azienda/società), poi Nome + Cognome (persona fisica).
 */
function extractNameFromBlock(root: Element, blockName: string): string {
  const block = getAllElements(root, blockName);
  if (block.length === 0) {
    throw new FatturaPAParseError(
      `Blocco ${blockName} mancante nel documento.`
    );
  }

  const anagrafica = getAllElements(block[0], "Anagrafica");
  if (anagrafica.length === 0) {
    throw new FatturaPAParseError(
      `Blocco Anagrafica mancante in ${blockName}.`
    );
  }

  // Prova Denominazione (azienda/società)
  const denominazione = getElementText(anagrafica[0], "Denominazione");
  if (denominazione) return denominazione;

  // Prova Nome + Cognome (persona fisica)
  const nome = getElementText(anagrafica[0], "Nome");
  const cognome = getElementText(anagrafica[0], "Cognome");

  if (nome && cognome) return `${nome} ${cognome}`;
  if (cognome) return cognome;
  if (nome) return nome;

  throw new FatturaPAParseError(
    `Impossibile determinare il nome in ${blockName}: ` +
    `né Denominazione né Nome/Cognome trovati in Anagrafica.`
  );
}

// === ESTRAZIONE DATI FATTURA ===

/**
 * Estrae i dati di una singola fattura da un FatturaElettronicaBody.
 */
function extractInvoiceFromBody(
  body: Element,
  sellerName: string,
  buyerName: string,
  bodyIndex: number,
  totalBodies: number
): ParsedInvoice {
  const context = totalBodies > 1 ? ` (fattura ${bodyIndex}/${totalBodies})` : "";

  // Cerca DatiGeneraliDocumento
  const datiGenerali = getAllElements(body, "DatiGeneraliDocumento");
  if (datiGenerali.length === 0) {
    throw new FatturaPAParseError(
      `DatiGeneraliDocumento mancante${context}.`
    );
  }

  const datiDoc = datiGenerali[0];

  // Tipo documento (TD01 fattura, TD02 acconto, TD04 nota di credito, ecc.)
  // Le note di credito hanno importi negativi e semantica opposta alle fatture:
  // vanno registrate manualmente con rettifica dell'incasso originale.
  const tipoDoc = getElementText(datiDoc, "TipoDocumento");
  if (tipoDoc === "TD04") {
    throw new FatturaPAParseError(
      `Le note di credito (TD04) non sono supportate${context}. ` +
      `Escludi i file TD04 dall'import e registra la rettifica manualmente.`
    );
  }

  // Data (obbligatoria nello XSD)
  const dataStr = getElementText(datiDoc, "Data");
  if (!dataStr) {
    throw new FatturaPAParseError(
      `Data fattura mancante${context}.`
    );
  }
  if (!isValidDate(dataStr)) {
    throw new FatturaPAParseError(
      `Data fattura non valida: "${dataStr}"${context}. Formato atteso: YYYY-MM-DD.`
    );
  }

  // Numero fattura (obbligatorio nello XSD)
  const numero = getElementText(datiDoc, "Numero") || "N/D";

  // Importo totale — catena di fallback
  const grossAmount = resolveGrossAmount(body, datiDoc, context);

  const fiscalYear = new Date(dataStr).getFullYear();

  return {
    date: dataStr,
    fiscalYear,
    sellerName,
    buyerName,
    grossAmount,
    invoiceNumber: numero,
  };
}

// === RISOLUZIONE IMPORTO CON FALLBACK A CATENA ===

/**
 * Determina l'importo totale del documento con catena di fallback:
 * 1. ImportoTotaleDocumento (opzionale nello XSD ma più affidabile)
 * 2. Somma DettaglioPagamento > ImportoPagamento
 * 3. Somma DatiRiepilogo > (ImponibileImporto + Imposta) — totale con IVA
 * 4. Somma DettaglioLinee > PrezzoTotale — solo imponibile (ultimo resort)
 */
function resolveGrossAmount(body: Element, datiDoc: Element, context: string): number {
  // 1. ImportoTotaleDocumento
  const importoStr = getElementText(datiDoc, "ImportoTotaleDocumento");
  if (importoStr) {
    const importo = parseFloat(importoStr);
    if (!isNaN(importo) && importo > 0) {
      return Math.round(importo * 100) / 100;
    }
    if (!isNaN(importo) && importo <= 0) {
      throw new FatturaPAParseError(
        `ImportoTotaleDocumento non valido: "${importoStr}"${context}.`
      );
    }
  }

  // 2. Somma DettaglioPagamento > ImportoPagamento
  const fromPayment = calculateTotalFromPayment(body);
  if (fromPayment > 0) {
    return Math.round(fromPayment * 100) / 100;
  }

  // 3. Somma DatiRiepilogo > (ImponibileImporto + Imposta)
  const fromRiepilogo = calculateTotalFromRiepilogo(body);
  if (fromRiepilogo > 0) {
    return Math.round(fromRiepilogo * 100) / 100;
  }

  // 4. Somma DettaglioLinee > PrezzoTotale (solo imponibile)
  const fromLines = calculateTotalFromLines(body);
  if (fromLines > 0) {
    return Math.round(fromLines * 100) / 100;
  }

  throw new FatturaPAParseError(
    `Impossibile determinare l'importo totale${context}. ` +
    `Nessuno dei campi ImportoTotaleDocumento, ImportoPagamento, DatiRiepilogo, DettaglioLinee trovato.`
  );
}

/**
 * Fallback 2: Somma degli ImportoPagamento da DettaglioPagamento.
 * Nei file ufficiali FatturaPA, ImportoPagamento contiene l'importo totale del pagamento.
 */
function calculateTotalFromPayment(body: Element): number {
  const dettagliPagamento = getAllElements(body, "DettaglioPagamento");
  if (dettagliPagamento.length === 0) return 0;

  let total = 0;
  for (const dettaglio of dettagliPagamento) {
    const importoStr = getElementText(dettaglio, "ImportoPagamento");
    if (importoStr) {
      const importo = parseFloat(importoStr);
      if (!isNaN(importo)) {
        total += importo;
      }
    }
  }
  return total;
}

/**
 * Fallback 3: Somma di (ImponibileImporto + Imposta) da DatiRiepilogo.
 * Calcola il totale IVA compresa sommando imponibile + IVA per ogni aliquota.
 */
function calculateTotalFromRiepilogo(body: Element): number {
  const riepilogo = getAllElements(body, "DatiRiepilogo");
  if (riepilogo.length === 0) return 0;

  let total = 0;
  for (const riga of riepilogo) {
    const imponibileStr = getElementText(riga, "ImponibileImporto");
    const impostaStr = getElementText(riga, "Imposta");

    const imponibile = imponibileStr ? parseFloat(imponibileStr) : 0;
    const imposta = impostaStr ? parseFloat(impostaStr) : 0;

    if (!isNaN(imponibile)) total += imponibile;
    if (!isNaN(imposta)) total += imposta;
  }
  return total;
}

/**
 * Fallback 4: Somma dei PrezzoTotale da DettaglioLinee.
 * ATTENZIONE: Questo è solo l'imponibile (senza IVA).
 */
function calculateTotalFromLines(body: Element): number {
  const linee = getAllElements(body, "DettaglioLinee");
  if (linee.length === 0) return 0;

  let total = 0;
  for (const linea of linee) {
    const prezzoTotaleStr = getElementText(linea, "PrezzoTotale");
    if (prezzoTotaleStr) {
      const prezzo = parseFloat(prezzoTotaleStr);
      if (!isNaN(prezzo)) {
        total += prezzo;
      }
    }
  }
  return total;
}
