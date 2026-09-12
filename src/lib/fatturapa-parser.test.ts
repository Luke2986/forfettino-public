import { describe, it, expect } from "vitest";
import { parseFatturaPA, FatturaPAParseError } from "./fatturapa-parser";

// === XML DI ESEMPIO (conformi alle specifiche ufficiali v1.2.2) ===

/**
 * Fattura EMESSA dal forfettario al suo cliente.
 * CedentePrestatore = il freelancer (Luca Bianchi)
 * CessionarioCommittente = il cliente (Acme Srl)
 * Con ImportoTotaleDocumento presente.
 */
const XML_FATTURA_EMESSA = `<?xml version="1.0" encoding="UTF-8"?>
<FatturaElettronica versione="FPR12"
  xmlns="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2">
  <FatturaElettronicaHeader>
    <CedentePrestatore>
      <DatiAnagrafici>
        <Anagrafica>
          <Nome>Luca</Nome>
          <Cognome>Bianchi</Cognome>
        </Anagrafica>
      </DatiAnagrafici>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>
        <Anagrafica>
          <Denominazione>Acme Srl</Denominazione>
        </Anagrafica>
      </DatiAnagrafici>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <Data>2025-03-15</Data>
        <Numero>FT-001/2025</Numero>
        <ImportoTotaleDocumento>1500.00</ImportoTotaleDocumento>
      </DatiGeneraliDocumento>
    </DatiGenerali>
  </FatturaElettronicaBody>
</FatturaElettronica>`;

/**
 * Fattura RICEVUTA dal forfettario (lui è CessionarioCommittente).
 * CedentePrestatore = fornitore (Tech Solutions SpA)
 * CessionarioCommittente = il freelancer (Mario Rossi)
 */
const XML_FATTURA_RICEVUTA = `<?xml version="1.0" encoding="UTF-8"?>
<FatturaElettronica versione="FPR12">
  <FatturaElettronicaHeader>
    <CedentePrestatore>
      <DatiAnagrafici>
        <Anagrafica>
          <Denominazione>Tech Solutions SpA</Denominazione>
        </Anagrafica>
      </DatiAnagrafici>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>
        <Anagrafica>
          <Nome>Mario</Nome>
          <Cognome>Rossi</Cognome>
        </Anagrafica>
      </DatiAnagrafici>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <Data>2025-06-20</Data>
        <Numero>42</Numero>
        <ImportoTotaleDocumento>800.50</ImportoTotaleDocumento>
      </DatiGeneraliDocumento>
    </DatiGenerali>
  </FatturaElettronicaBody>
</FatturaElettronica>`;

/** Lotto con 2 fatture nello stesso documento (come esempio ufficiale FPA03) */
const XML_LOTTO = `<?xml version="1.0" encoding="UTF-8"?>
<FatturaElettronica versione="FPA12">
  <FatturaElettronicaHeader>
    <CedentePrestatore>
      <DatiAnagrafici>
        <Anagrafica>
          <Denominazione>ALPHA SRL</Denominazione>
        </Anagrafica>
      </DatiAnagrafici>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>
        <Anagrafica>
          <Denominazione>Ente Pubblico XYZ</Denominazione>
        </Anagrafica>
      </DatiAnagrafici>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <Data>2025-01-10</Data>
        <Numero>001</Numero>
        <ImportoTotaleDocumento>2000.00</ImportoTotaleDocumento>
      </DatiGeneraliDocumento>
    </DatiGenerali>
  </FatturaElettronicaBody>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <Data>2025-02-15</Data>
        <Numero>002</Numero>
        <ImportoTotaleDocumento>3500.75</ImportoTotaleDocumento>
      </DatiGeneraliDocumento>
    </DatiGenerali>
  </FatturaElettronicaBody>
</FatturaElettronica>`;

/**
 * Fattura SENZA ImportoTotaleDocumento — conforme ai file ufficiali.
 * Usa fallback: DettaglioPagamento > ImportoPagamento
 */
const XML_FALLBACK_PAGAMENTO = `<?xml version="1.0" encoding="UTF-8"?>
<FatturaElettronica versione="FPR12">
  <FatturaElettronicaHeader>
    <CedentePrestatore>
      <DatiAnagrafici>
        <Anagrafica>
          <Denominazione>Studio Verdi</Denominazione>
        </Anagrafica>
      </DatiAnagrafici>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>
        <Anagrafica>
          <Denominazione>BETA GAMMA</Denominazione>
        </Anagrafica>
      </DatiAnagrafici>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <Data>2025-04-01</Data>
        <Numero>A-10</Numero>
      </DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>
      <DettaglioLinee>
        <PrezzoTotale>500.00</PrezzoTotale>
      </DettaglioLinee>
    </DatiBeniServizi>
    <DatiPagamento>
      <CondizioniPagamento>TP02</CondizioniPagamento>
      <DettaglioPagamento>
        <ImportoPagamento>610.00</ImportoPagamento>
      </DettaglioPagamento>
    </DatiPagamento>
  </FatturaElettronicaBody>
</FatturaElettronica>`;

/**
 * Fattura SENZA ImportoTotaleDocumento e SENZA DettaglioPagamento.
 * Usa fallback: DatiRiepilogo > ImponibileImporto + Imposta
 */
const XML_FALLBACK_RIEPILOGO = `<?xml version="1.0" encoding="UTF-8"?>
<FatturaElettronica versione="FPR12">
  <FatturaElettronicaHeader>
    <CedentePrestatore>
      <DatiAnagrafici>
        <Anagrafica>
          <Denominazione>SOCIETA' ALPHA SRL</Denominazione>
        </Anagrafica>
      </DatiAnagrafici>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>
        <Anagrafica>
          <Denominazione>BETA GAMMA</Denominazione>
        </Anagrafica>
      </DatiAnagrafici>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <Data>2025-05-10</Data>
        <Numero>FPR-99</Numero>
      </DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>
      <DettaglioLinee>
        <PrezzoTotale>500.00</PrezzoTotale>
      </DettaglioLinee>
      <DettaglioLinee>
        <PrezzoTotale>250.50</PrezzoTotale>
      </DettaglioLinee>
      <DatiRiepilogo>
        <ImponibileImporto>750.50</ImponibileImporto>
        <Imposta>165.11</Imposta>
      </DatiRiepilogo>
    </DatiBeniServizi>
  </FatturaElettronicaBody>
</FatturaElettronica>`;

/**
 * Fattura con SOLO DettaglioLinee (nessun altro fallback disponibile).
 * Ultimo resort: somma PrezzoTotale delle linee (solo imponibile).
 */
const XML_FALLBACK_LINEE = `<?xml version="1.0" encoding="UTF-8"?>
<FatturaElettronica versione="FPR12">
  <FatturaElettronicaHeader>
    <CedentePrestatore>
      <DatiAnagrafici>
        <Anagrafica>
          <Denominazione>Studio Bianchi</Denominazione>
        </Anagrafica>
      </DatiAnagrafici>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>
        <Anagrafica>
          <Denominazione>Cliente ABC</Denominazione>
        </Anagrafica>
      </DatiAnagrafici>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <Data>2025-04-01</Data>
        <Numero>B-20</Numero>
      </DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>
      <DettaglioLinee>
        <PrezzoTotale>500.00</PrezzoTotale>
      </DettaglioLinee>
      <DettaglioLinee>
        <PrezzoTotale>250.50</PrezzoTotale>
      </DettaglioLinee>
    </DatiBeniServizi>
  </FatturaElettronicaBody>
</FatturaElettronica>`;

// === TEST ===

describe("parseFatturaPA", () => {
  describe("Estrazione entrambi i soggetti", () => {
    it("estrae sellerName (CedentePrestatore) e buyerName (CessionarioCommittente)", () => {
      const result = parseFatturaPA(XML_FATTURA_EMESSA);

      expect(result).toHaveLength(1);
      expect(result[0].sellerName).toBe("Luca Bianchi");
      expect(result[0].buyerName).toBe("Acme Srl");
    });

    it("estrae Denominazione per azienda e Nome+Cognome per persona fisica", () => {
      const result = parseFatturaPA(XML_FATTURA_RICEVUTA);

      expect(result[0].sellerName).toBe("Tech Solutions SpA");
      expect(result[0].buyerName).toBe("Mario Rossi");
    });

    it("usa gli stessi soggetti per tutte le fatture di un lotto", () => {
      const result = parseFatturaPA(XML_LOTTO);

      expect(result).toHaveLength(2);
      expect(result[0].sellerName).toBe("ALPHA SRL");
      expect(result[0].buyerName).toBe("Ente Pubblico XYZ");
      expect(result[1].sellerName).toBe("ALPHA SRL");
      expect(result[1].buyerName).toBe("Ente Pubblico XYZ");
    });
  });

  describe("Dati fattura base", () => {
    it("estrae data, numero fattura, anno fiscale e importo", () => {
      const result = parseFatturaPA(XML_FATTURA_EMESSA);

      expect(result[0]).toMatchObject({
        date: "2025-03-15",
        fiscalYear: 2025,
        grossAmount: 1500.00,
        invoiceNumber: "FT-001/2025",
      });
    });

    it("parsa lotto con dati diversi per ogni body", () => {
      const result = parseFatturaPA(XML_LOTTO);

      expect(result[0].date).toBe("2025-01-10");
      expect(result[0].grossAmount).toBe(2000.00);
      expect(result[0].invoiceNumber).toBe("001");

      expect(result[1].date).toBe("2025-02-15");
      expect(result[1].grossAmount).toBe(3500.75);
      expect(result[1].invoiceNumber).toBe("002");
    });

    it("gestisce numero fattura mancante con N/D", () => {
      const xmlSenzaNumero = XML_FATTURA_EMESSA.replace(
        "<Numero>FT-001/2025</Numero>",
        ""
      );
      const result = parseFatturaPA(xmlSenzaNumero);
      expect(result[0].invoiceNumber).toBe("N/D");
    });
  });

  describe("Catena fallback importo", () => {
    it("usa ImportoTotaleDocumento quando presente (priorità 1)", () => {
      const result = parseFatturaPA(XML_FATTURA_EMESSA);
      expect(result[0].grossAmount).toBe(1500.00);
    });

    it("fallback a DettaglioPagamento > ImportoPagamento (priorità 2)", () => {
      const result = parseFatturaPA(XML_FALLBACK_PAGAMENTO);
      // ImportoPagamento = 610.00 (include IVA), usato al posto delle linee (500.00)
      expect(result[0].grossAmount).toBe(610.00);
    });

    it("fallback a DatiRiepilogo ImponibileImporto + Imposta (priorità 3)", () => {
      const result = parseFatturaPA(XML_FALLBACK_RIEPILOGO);
      // ImponibileImporto=750.50 + Imposta=165.11 = 915.61
      expect(result[0].grossAmount).toBe(915.61);
    });

    it("fallback a DettaglioLinee PrezzoTotale (priorità 4, solo imponibile)", () => {
      const result = parseFatturaPA(XML_FALLBACK_LINEE);
      // 500.00 + 250.50 = 750.50 (solo imponibile, senza IVA)
      expect(result[0].grossAmount).toBe(750.50);
    });
  });

  describe("XML malformato o non valido", () => {
    it("lancia errore per stringa vuota", () => {
      expect(() => parseFatturaPA("")).toThrow(FatturaPAParseError);
      expect(() => parseFatturaPA("")).toThrow("vuoto");
    });

    it("lancia errore per XML malformato", () => {
      expect(() => parseFatturaPA("<not-closed>")).toThrow(FatturaPAParseError);
      expect(() => parseFatturaPA("<not-closed>")).toThrow("XML valido");
    });

    it("lancia errore se non è una FatturaElettronica", () => {
      const xmlErrato = `<?xml version="1.0"?><root><data>test</data></root>`;
      expect(() => parseFatturaPA(xmlErrato)).toThrow(FatturaPAParseError);
      expect(() => parseFatturaPA(xmlErrato)).toThrow("FatturaPA");
    });

    it("lancia errore se manca CedentePrestatore", () => {
      const xml = `<?xml version="1.0"?>
        <FatturaElettronica>
          <FatturaElettronicaHeader>
            <CessionarioCommittente>
              <DatiAnagrafici><Anagrafica><Denominazione>Test</Denominazione></Anagrafica></DatiAnagrafici>
            </CessionarioCommittente>
          </FatturaElettronicaHeader>
          <FatturaElettronicaBody>
            <DatiGenerali>
              <DatiGeneraliDocumento>
                <Data>2025-01-01</Data>
                <ImportoTotaleDocumento>100</ImportoTotaleDocumento>
              </DatiGeneraliDocumento>
            </DatiGenerali>
          </FatturaElettronicaBody>
        </FatturaElettronica>`;
      expect(() => parseFatturaPA(xml)).toThrow("CedentePrestatore");
    });

    it("lancia errore se manca CessionarioCommittente", () => {
      const xml = `<?xml version="1.0"?>
        <FatturaElettronica>
          <FatturaElettronicaHeader>
            <CedentePrestatore>
              <DatiAnagrafici><Anagrafica><Denominazione>Test</Denominazione></Anagrafica></DatiAnagrafici>
            </CedentePrestatore>
          </FatturaElettronicaHeader>
          <FatturaElettronicaBody>
            <DatiGenerali>
              <DatiGeneraliDocumento>
                <Data>2025-01-01</Data>
                <ImportoTotaleDocumento>100</ImportoTotaleDocumento>
              </DatiGeneraliDocumento>
            </DatiGenerali>
          </FatturaElettronicaBody>
        </FatturaElettronica>`;
      expect(() => parseFatturaPA(xml)).toThrow("CessionarioCommittente");
    });

    it("lancia errore se manca Anagrafica in CedentePrestatore", () => {
      const xml = `<?xml version="1.0"?>
        <FatturaElettronica>
          <FatturaElettronicaHeader>
            <CedentePrestatore>
              <DatiAnagrafici></DatiAnagrafici>
            </CedentePrestatore>
            <CessionarioCommittente>
              <DatiAnagrafici><Anagrafica><Denominazione>Test</Denominazione></Anagrafica></DatiAnagrafici>
            </CessionarioCommittente>
          </FatturaElettronicaHeader>
          <FatturaElettronicaBody>
            <DatiGenerali>
              <DatiGeneraliDocumento>
                <Data>2025-01-01</Data>
                <ImportoTotaleDocumento>100</ImportoTotaleDocumento>
              </DatiGeneraliDocumento>
            </DatiGenerali>
          </FatturaElettronicaBody>
        </FatturaElettronica>`;
      expect(() => parseFatturaPA(xml)).toThrow("Anagrafica");
    });

    it("lancia errore se manca il body", () => {
      const xml = `<?xml version="1.0"?>
        <FatturaElettronica>
          <FatturaElettronicaHeader>
            <CedentePrestatore>
              <DatiAnagrafici><Anagrafica><Denominazione>Test</Denominazione></Anagrafica></DatiAnagrafici>
            </CedentePrestatore>
            <CessionarioCommittente>
              <DatiAnagrafici><Anagrafica><Denominazione>Client</Denominazione></Anagrafica></DatiAnagrafici>
            </CessionarioCommittente>
          </FatturaElettronicaHeader>
        </FatturaElettronica>`;
      expect(() => parseFatturaPA(xml)).toThrow("corpo fattura");
    });

    it("rifiuta le note di credito (TD04) con messaggio chiaro", () => {
      const xmlTd04 = `<?xml version="1.0"?>
        <FatturaElettronica>
          <FatturaElettronicaHeader>
            <CedentePrestatore>
              <DatiAnagrafici><Anagrafica><Denominazione>Studio Rossi</Denominazione></Anagrafica></DatiAnagrafici>
            </CedentePrestatore>
            <CessionarioCommittente>
              <DatiAnagrafici><Anagrafica><Denominazione>Cliente SpA</Denominazione></Anagrafica></DatiAnagrafici>
            </CessionarioCommittente>
          </FatturaElettronicaHeader>
          <FatturaElettronicaBody>
            <DatiGenerali>
              <DatiGeneraliDocumento>
                <TipoDocumento>TD04</TipoDocumento>
                <Data>2025-06-01</Data>
                <Numero>NC-01</Numero>
                <ImportoTotaleDocumento>500.00</ImportoTotaleDocumento>
              </DatiGeneraliDocumento>
            </DatiGenerali>
          </FatturaElettronicaBody>
        </FatturaElettronica>`;
      expect(() => parseFatturaPA(xmlTd04)).toThrow(FatturaPAParseError);
      expect(() => parseFatturaPA(xmlTd04)).toThrow(/TD04/);
    });

    it("accetta fatture TD01 (default) senza problemi", () => {
      const xmlTd01 = XML_FATTURA_EMESSA.replace(
        "<Numero>FT-001/2025</Numero>",
        "<TipoDocumento>TD01</TipoDocumento>\n        <Numero>FT-001/2025</Numero>",
      );
      const result = parseFatturaPA(xmlTd01);
      expect(result).toHaveLength(1);
      expect(result[0].grossAmount).toBe(1500.00);
    });

    it("lancia errore se manca la data", () => {
      const xml = `<?xml version="1.0"?>
        <FatturaElettronica>
          <FatturaElettronicaHeader>
            <CedentePrestatore>
              <DatiAnagrafici><Anagrafica><Denominazione>Test</Denominazione></Anagrafica></DatiAnagrafici>
            </CedentePrestatore>
            <CessionarioCommittente>
              <DatiAnagrafici><Anagrafica><Denominazione>Client</Denominazione></Anagrafica></DatiAnagrafici>
            </CessionarioCommittente>
          </FatturaElettronicaHeader>
          <FatturaElettronicaBody>
            <DatiGenerali>
              <DatiGeneraliDocumento>
                <Numero>1</Numero>
                <ImportoTotaleDocumento>100</ImportoTotaleDocumento>
              </DatiGeneraliDocumento>
            </DatiGenerali>
          </FatturaElettronicaBody>
        </FatturaElettronica>`;
      expect(() => parseFatturaPA(xml)).toThrow("Data fattura mancante");
    });

    it("lancia errore se importo è negativo", () => {
      const xml = `<?xml version="1.0"?>
        <FatturaElettronica>
          <FatturaElettronicaHeader>
            <CedentePrestatore>
              <DatiAnagrafici><Anagrafica><Denominazione>Test</Denominazione></Anagrafica></DatiAnagrafici>
            </CedentePrestatore>
            <CessionarioCommittente>
              <DatiAnagrafici><Anagrafica><Denominazione>Client</Denominazione></Anagrafica></DatiAnagrafici>
            </CessionarioCommittente>
          </FatturaElettronicaHeader>
          <FatturaElettronicaBody>
            <DatiGenerali>
              <DatiGeneraliDocumento>
                <Data>2025-01-01</Data>
                <ImportoTotaleDocumento>-500</ImportoTotaleDocumento>
              </DatiGeneraliDocumento>
            </DatiGenerali>
          </FatturaElettronicaBody>
        </FatturaElettronica>`;
      expect(() => parseFatturaPA(xml)).toThrow("non valido");
    });

    it("lancia errore se data ha formato errato", () => {
      const xml = `<?xml version="1.0"?>
        <FatturaElettronica>
          <FatturaElettronicaHeader>
            <CedentePrestatore>
              <DatiAnagrafici><Anagrafica><Denominazione>Test</Denominazione></Anagrafica></DatiAnagrafici>
            </CedentePrestatore>
            <CessionarioCommittente>
              <DatiAnagrafici><Anagrafica><Denominazione>Client</Denominazione></Anagrafica></DatiAnagrafici>
            </CessionarioCommittente>
          </FatturaElettronicaHeader>
          <FatturaElettronicaBody>
            <DatiGenerali>
              <DatiGeneraliDocumento>
                <Data>15/03/2025</Data>
                <ImportoTotaleDocumento>100</ImportoTotaleDocumento>
              </DatiGeneraliDocumento>
            </DatiGenerali>
          </FatturaElettronicaBody>
        </FatturaElettronica>`;
      expect(() => parseFatturaPA(xml)).toThrow("non valida");
    });
  });

  describe("Compatibilità file reali SDI", () => {
    it("parsa XML con prefisso namespace p: sul root element", () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" versione="FPA12">
  <FatturaElettronicaHeader>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>01234567890</IdCodice></IdFiscaleIVA>
        <Anagrafica>
          <Denominazione>ALPHA SRL</Denominazione>
        </Anagrafica>
      </DatiAnagrafici>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>
        <CodiceFiscale>98765432100</CodiceFiscale>
        <Anagrafica>
          <Denominazione>AMMINISTRAZIONE BETA</Denominazione>
        </Anagrafica>
      </DatiAnagrafici>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>TD01</TipoDocumento>
        <Divisa>EUR</Divisa>
        <Data>2025-01-15</Data>
        <Numero>1</Numero>
      </DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>
      <DettaglioLinee>
        <NumeroLinea>1</NumeroLinea>
        <Descrizione>PRESTAZIONE PROFESSIONALE</Descrizione>
        <PrezzoUnitario>25.00</PrezzoUnitario>
        <PrezzoTotale>25.00</PrezzoTotale>
        <AliquotaIVA>22.00</AliquotaIVA>
      </DettaglioLinee>
      <DatiRiepilogo>
        <AliquotaIVA>22.00</AliquotaIVA>
        <ImponibileImporto>25.00</ImponibileImporto>
        <Imposta>5.50</Imposta>
      </DatiRiepilogo>
    </DatiBeniServizi>
    <DatiPagamento>
      <CondizioniPagamento>TP02</CondizioniPagamento>
      <DettaglioPagamento>
        <ModalitaPagamento>MP05</ModalitaPagamento>
        <ImportoPagamento>30.50</ImportoPagamento>
      </DettaglioPagamento>
    </DatiPagamento>
  </FatturaElettronicaBody>
</p:FatturaElettronica>`;

      const result = parseFatturaPA(xml);

      expect(result).toHaveLength(1);
      expect(result[0].sellerName).toBe("ALPHA SRL");
      expect(result[0].buyerName).toBe("AMMINISTRAZIONE BETA");
      expect(result[0].date).toBe("2025-01-15");
      expect(result[0].invoiceNumber).toBe("1");
      // Fallback: ImportoPagamento = 30.50 (no ImportoTotaleDocumento)
      expect(result[0].grossAmount).toBe(30.50);
    });

    it("parsa XML con prefisso namespace ns2: sul root element", () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ns2:FatturaElettronica xmlns:ns2="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" versione="FPR12">
  <FatturaElettronicaHeader>
    <CedentePrestatore>
      <DatiAnagrafici>
        <Anagrafica>
          <Nome>Marco</Nome>
          <Cognome>Verdi</Cognome>
        </Anagrafica>
      </DatiAnagrafici>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>
        <Anagrafica>
          <Denominazione>Omega Corp</Denominazione>
        </Anagrafica>
      </DatiAnagrafici>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <Data>2025-07-01</Data>
        <Numero>FT-10</Numero>
        <ImportoTotaleDocumento>1220.00</ImportoTotaleDocumento>
      </DatiGeneraliDocumento>
    </DatiGenerali>
  </FatturaElettronicaBody>
</ns2:FatturaElettronica>`;

      const result = parseFatturaPA(xml);

      expect(result).toHaveLength(1);
      expect(result[0].sellerName).toBe("Marco Verdi");
      expect(result[0].buyerName).toBe("Omega Corp");
      expect(result[0].grossAmount).toBe(1220.00);
    });

    it("parsa XML con BOM (Byte Order Mark) all'inizio", () => {
      const bom = "\uFEFF";
      const xml = `${bom}<?xml version="1.0" encoding="UTF-8"?>
<FatturaElettronica versione="FPR12">
  <FatturaElettronicaHeader>
    <CedentePrestatore>
      <DatiAnagrafici>
        <Anagrafica>
          <Denominazione>Studio Legale Rossi</Denominazione>
        </Anagrafica>
      </DatiAnagrafici>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>
        <Anagrafica>
          <Denominazione>Delta Srl</Denominazione>
        </Anagrafica>
      </DatiAnagrafici>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <Data>2025-09-01</Data>
        <Numero>100</Numero>
        <ImportoTotaleDocumento>500.00</ImportoTotaleDocumento>
      </DatiGeneraliDocumento>
    </DatiGenerali>
  </FatturaElettronicaBody>
</FatturaElettronica>`;

      const result = parseFatturaPA(xml);

      expect(result).toHaveLength(1);
      expect(result[0].sellerName).toBe("Studio Legale Rossi");
      expect(result[0].grossAmount).toBe(500.00);
    });

    it("parsa XML con direttiva xml-stylesheet (strippata in pre-processing)", () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="fatturaordinaria_v1.2.1.xsl"?>
<FatturaElettronica versione="FPR12">
  <FatturaElettronicaHeader>
    <CedentePrestatore>
      <DatiAnagrafici>
        <Anagrafica>
          <Denominazione>Consulenza XYZ</Denominazione>
        </Anagrafica>
      </DatiAnagrafici>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>
        <Anagrafica>
          <Denominazione>Epsilon SpA</Denominazione>
        </Anagrafica>
      </DatiAnagrafici>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <Data>2025-11-20</Data>
        <Numero>FT-55</Numero>
        <ImportoTotaleDocumento>2500.00</ImportoTotaleDocumento>
      </DatiGeneraliDocumento>
    </DatiGenerali>
  </FatturaElettronicaBody>
</FatturaElettronica>`;

      const result = parseFatturaPA(xml);

      expect(result).toHaveLength(1);
      expect(result[0].sellerName).toBe("Consulenza XYZ");
      expect(result[0].buyerName).toBe("Epsilon SpA");
      expect(result[0].grossAmount).toBe(2500.00);
    });

    it("parsa XML con BOM + prefisso p: + xml-stylesheet combinati", () => {
      const bom = "\uFEFF";
      const xml = `${bom}<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="fatturapa_v1.2.1.xsl"?>
<p:FatturaElettronica xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" versione="FPA12">
  <FatturaElettronicaHeader>
    <CedentePrestatore>
      <DatiAnagrafici>
        <Anagrafica>
          <Denominazione>FORNITORE COMPLETO SRL</Denominazione>
        </Anagrafica>
      </DatiAnagrafici>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>
        <Anagrafica>
          <Nome>Anna</Nome>
          <Cognome>Bianchi</Cognome>
        </Anagrafica>
      </DatiAnagrafici>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>TD01</TipoDocumento>
        <Data>2025-12-01</Data>
        <Numero>99/2025</Numero>
      </DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>
      <DettaglioLinee>
        <PrezzoTotale>1000.00</PrezzoTotale>
        <AliquotaIVA>22.00</AliquotaIVA>
      </DettaglioLinee>
      <DatiRiepilogo>
        <ImponibileImporto>1000.00</ImponibileImporto>
        <Imposta>220.00</Imposta>
      </DatiRiepilogo>
    </DatiBeniServizi>
    <DatiPagamento>
      <DettaglioPagamento>
        <ImportoPagamento>1220.00</ImportoPagamento>
      </DettaglioPagamento>
    </DatiPagamento>
  </FatturaElettronicaBody>
</p:FatturaElettronica>`;

      const result = parseFatturaPA(xml);

      expect(result).toHaveLength(1);
      expect(result[0].sellerName).toBe("FORNITORE COMPLETO SRL");
      expect(result[0].buyerName).toBe("Anna Bianchi");
      expect(result[0].date).toBe("2025-12-01");
      expect(result[0].invoiceNumber).toBe("99/2025");
      // Fallback: ImportoPagamento = 1220.00
      expect(result[0].grossAmount).toBe(1220.00);
    });
  });
});
