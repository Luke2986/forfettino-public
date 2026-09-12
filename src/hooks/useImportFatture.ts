import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import { parseFatturaPA, FatturaPAParseError } from "@/lib/fatturapa-parser";
import type { ParsedInvoice } from "@/lib/fatturapa-parser";
import { sanitizeMoney, multiplyByPercent, subtractMoney } from "@/lib/money";
import { track } from "@/lib/analytics";
import { useFiscalYear } from "@/contexts/FiscalYearContext";

// === TIPI ===

export type InvoiceDirection = "emessa" | "ricevuta" | "auto";

export interface ImportPreviewRow extends ParsedInvoice {
  /** Indice univoco per la selezione */
  index: number;
  /** Nome della controparte (determinato automaticamente) */
  clientName: string;
  /** Direzione: fattura emessa o ricevuta */
  direction: InvoiceDirection;
  /** Campi calcolati */
  taxableAmount: number;
  taxAmount: number;
  inpsAmount: number;
  netSpendable: number;
  /** Flag possibile duplicato */
  isDuplicate: boolean;
  /** Selezionato per l'import */
  selected: boolean;
}

export type ImportStep = "idle" | "parsing" | "preview" | "importing" | "done" | "error";

// === HOOK ===

export function useImportFatture(yearOverride?: number) {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<ImportStep>("idle");
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importCount, setImportCount] = useState(0);

  const { selectedYear } = useFiscalYear();
  const currentYear = yearOverride ?? selectedYear;

  // Fetch fiscal settings (come in NuovoIncasso e Incassi)
  const { data: settings } = useQuery({
    queryKey: ["fiscal_year_settings", user?.id, currentYear],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("fiscal_year_settings")
        .select("*")
        .eq("user_id", user.id)
        .eq("fiscal_year", currentYear)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch existing receipts per il check duplicati
  const { data: existingReceipts } = useQuery({
    queryKey: ["receipts_all_for_dedup", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("receipts")
        .select("receipt_date, gross_amount, client_name")
        .eq("user_id", user.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  /**
   * Determina la direzione della fattura e chi è la controparte.
   *
   * Logica:
   * - Se il nome del profilo utente corrisponde al sellerName → fattura EMESSA → controparte è buyerName
   * - Se il nome del profilo utente corrisponde al buyerName → fattura RICEVUTA → controparte è sellerName
   * - Se nessun match → default: fattura emessa (buyerName come controparte)
   */
  const resolveCounterparty = useCallback(
    (invoice: ParsedInvoice): { clientName: string; direction: InvoiceDirection } => {
      const userName = buildUserFullName(profile?.first_name, profile?.last_name);

      if (!userName) {
        // Profilo senza nome — default: controparte = buyerName
        return { clientName: invoice.buyerName, direction: "auto" };
      }

      const normalizedUser = userName.toLowerCase();
      const normalizedSeller = invoice.sellerName.toLowerCase();
      const normalizedBuyer = invoice.buyerName.toLowerCase();

      // Match fuzzy: l'utente è il venditore (fattura EMESSA)
      if (fuzzyNameMatch(normalizedSeller, normalizedUser)) {
        return { clientName: invoice.buyerName, direction: "emessa" };
      }

      // Match fuzzy: l'utente è l'acquirente (fattura RICEVUTA)
      if (fuzzyNameMatch(normalizedBuyer, normalizedUser)) {
        return { clientName: invoice.sellerName, direction: "ricevuta" };
      }

      // Nessun match → default: fattura emessa
      return { clientName: invoice.buyerName, direction: "auto" };
    },
    [profile],
  );

  /**
   * Controlla se una fattura parsata è un possibile duplicato.
   */
  const isDuplicate = useCallback(
    (clientName: string, invoice: ParsedInvoice): boolean => {
      if (!existingReceipts) return false;
      return existingReceipts.some(
        (r) =>
          r.receipt_date === invoice.date &&
          Math.abs(sanitizeMoney(r.gross_amount) - sanitizeMoney(invoice.grossAmount)) < 0.01 &&
          (r.client_name || "").toLowerCase() === clientName.toLowerCase(),
      );
    },
    [existingReceipts],
  );

  /**
   * Calcola i campi fiscali per un importo lordo.
   */
  const calculateFiscalFields = useCallback(
    (grossAmount: number) => {
      const gross = sanitizeMoney(grossAmount);
      const profitCoeff = sanitizeMoney(settings?.profit_coefficient) || 78;
      const taxRate = sanitizeMoney(settings?.tax_rate) || 15;
      const inpsRate = sanitizeMoney(settings?.inps_rate) || 26.07;

      const taxable = multiplyByPercent(gross, profitCoeff);
      const tax = multiplyByPercent(taxable, taxRate);
      const inps = multiplyByPercent(taxable, inpsRate);
      const net = subtractMoney(subtractMoney(gross, tax), inps);

      return {
        taxableAmount: taxable,
        taxAmount: tax,
        inpsAmount: inps,
        netSpendable: net,
      };
    },
    [settings],
  );

  /**
   * Legge e parsa uno o più file XML FatturaPA.
   */
  const parseFiles = useCallback(
    async (files: FileList | File[]) => {
      setStep("parsing");
      setErrorMessage(null);

      try {
        const allInvoices: ParsedInvoice[] = [];

        for (const file of Array.from(files)) {
          if (!file.name.toLowerCase().endsWith(".xml")) {
            throw new FatturaPAParseError(
              `Il file "${file.name}" non è un file XML. Carica solo file .xml FatturaPA. ` +
              `I file .p7m (firmati digitalmente) devono essere estratti prima.`
            );
          }

          const xmlString = await readFileAsText(file);
          const invoices = parseFatturaPA(xmlString);
          allInvoices.push(...invoices);
        }

        if (allInvoices.length === 0) {
          throw new FatturaPAParseError("Nessuna fattura trovata nei file caricati.");
        }

        // Crea le righe di preview con calcoli fiscali, auto-detect e check duplicati
        const rows: ImportPreviewRow[] = allInvoices.map((invoice, index) => {
          const { clientName, direction } = resolveCounterparty(invoice);
          return {
            ...invoice,
            index,
            clientName,
            direction,
            ...calculateFiscalFields(invoice.grossAmount),
            isDuplicate: isDuplicate(clientName, invoice),
            selected: true,
          };
        });

        setPreviewRows(rows);
        setStep("preview");
      } catch (err) {
        const message =
          err instanceof FatturaPAParseError
            ? err.message
            : "Errore durante il parsing del file XML. Verifica che sia un file FatturaPA valido.";
        setErrorMessage(message);
        setStep("error");
      }
    },
    [calculateFiscalFields, isDuplicate, resolveCounterparty],
  );

  /**
   * Toggle selezione di una riga.
   */
  const toggleRow = useCallback((index: number) => {
    setPreviewRows((prev) => prev.map((row) => (row.index === index ? { ...row, selected: !row.selected } : row)));
  }, []);

  /**
   * Seleziona/deseleziona tutte le righe.
   */
  const toggleAll = useCallback((selected: boolean) => {
    setPreviewRows((prev) => prev.map((row) => ({ ...row, selected })));
  }, []);

  /**
   * Importa le righe selezionate nella tabella receipts.
   */
  const importSelected = useCallback(async () => {
    if (!user) return;

    const selectedRows = previewRows.filter((r) => r.selected);
    if (selectedRows.length === 0) {
      toast({
        title: "Nessun incasso selezionato",
        description: "Seleziona almeno un incasso da importare.",
        variant: "destructive",
      });
      return;
    }

    setStep("importing");

    try {
      // 1. Crea/aggiorna i clienti PRIMA dei receipts.
      //    Se questo step fallisce, non inseriamo receipts orfani senza
      //    controparte registrata nell'anagrafica.
      const clientIdByName = await ensureClientsExist(
        user.id,
        [...new Set(selectedRows.map((r) => r.clientName))],
      );

      // 2. Prepara i record per l'insert batch
      const records = selectedRows.map((row) => ({
        user_id: user.id,
        receipt_date: row.date,
        fiscal_year: row.fiscalYear,
        gross_amount: sanitizeMoney(row.grossAmount),
        // Story 86-1: collega l'incasso al cliente appena creato/trovato.
        // Senza client_id l'incasso e' invisibile al report clienti.
        client_id: clientIdByName.get(clientKey(row.clientName)) ?? null,
        client_name: row.clientName,
        invoice_number: row.invoiceNumber,
        notes: `Fattura n. ${row.invoiceNumber}`,
        taxable_amount: row.taxableAmount,
        tax_amount: row.taxAmount,
        inps_amount: row.inpsAmount,
        net_spendable: row.netSpendable,
        source: "xml_import",
      }));

      // 3. Insert batch receipts
      const { error } = await supabase.from("receipts").insert(records);

      if (error) throw error;

      // Invalida le query correlate
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      queryClient.invalidateQueries({ queryKey: ["receipts_ytd"] });
      queryClient.invalidateQueries({ queryKey: ["receipts_ytd_prev"] });
      queryClient.invalidateQueries({ queryKey: ["fiscal_year_settings_prev"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["receipts_all_for_dedup"] });
      queryClient.invalidateQueries({ queryKey: ["due_soon_schedules"] });
      queryClient.invalidateQueries({ queryKey: ["next_deadline"] });
      queryClient.invalidateQueries({ queryKey: ["import_count_limit"] });
      queryClient.invalidateQueries({ queryKey: ["receipt_count_limit"] });
      queryClient.invalidateQueries({ queryKey: ["current_year_schedules"] });
      // Story 86-1: gli incassi importati ora sono associati ai clienti, il
      // ranking e il catalogo devono rifletterlo subito.
      queryClient.invalidateQueries({ queryKey: ["client-revenue-report"] });
      queryClient.invalidateQueries({ queryKey: ["clients_active"] });

      setImportCount(selectedRows.length);
      setStep("done");

      track("import_xml_completed", { source: "import_dialog", count: selectedRows.length });

      // Award contribution points for first XML import (one-time, RPC handles dedup)
      Promise.resolve(supabase.rpc("record_first_import_contribution" as any)).catch(() => {});

      toast({
        title: "Import completato!",
        description: `${selectedRows.length} incass${selectedRows.length === 1 ? "o importato" : "i importati"} con successo.`,
      });
    } catch (err) {
      console.error("Errore import fatture:", err);

      // Messaggio diagnostico: distingui RLS limit vs altri errori Supabase
      let message = "Errore durante il salvataggio. Riprova.";
      if (err && typeof err === "object") {
        const supabaseErr = err as { message?: string; code?: string; details?: string };
        const isRlsViolation =
          supabaseErr.code === "42501" ||
          (supabaseErr.message ?? "").toLowerCase().includes("row-level security") ||
          (supabaseErr.message ?? "").toLowerCase().includes("row level security");
        if (isRlsViolation) {
          message =
            "Hai raggiunto il limite del piano Free (max 3 import XML per anno, 5 incassi manuali, 8 totali). " +
            "Elimina qualche incasso o passa a PRO.";
        } else if (supabaseErr.message) {
          message = `Errore durante il salvataggio: ${supabaseErr.message}`;
        }
      }
      setErrorMessage(message);
      setStep("error");
      toast({
        title: "Errore",
        description: message,
        variant: "destructive",
      });
    }
  }, [user, previewRows, queryClient, toast]);

  /**
   * Reset completo dello stato.
   */
  const reset = useCallback(() => {
    setStep("idle");
    setPreviewRows([]);
    setErrorMessage(null);
    setImportCount(0);
  }, []);

  return {
    step,
    previewRows,
    errorMessage,
    importCount,
    selectedCount: previewRows.filter((r) => r.selected).length,
    parseFiles,
    toggleRow,
    toggleAll,
    importSelected,
    reset,
  };
}

// === HELPER PRIVATI ===

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Impossibile leggere il file "${file.name}".`));
    reader.readAsText(file);
  });
}

/**
 * Costruisce il nome completo dell'utente dal profilo.
 */
function buildUserFullName(firstName: string | null | undefined, lastName: string | null | undefined): string | null {
  const parts = [firstName, lastName].filter(Boolean).map((s) => s!.trim());
  return parts.length > 0 ? parts.join(" ") : null;
}

/**
 * Match fuzzy tra un nome nel documento XML e il nome dell'utente.
 * Verifica se uno contiene l'altro (case-insensitive, già normalizzati).
 */
function fuzzyNameMatch(documentName: string, userName: string): boolean {
  if (!documentName || !userName) return false;

  // Esatto
  if (documentName === userName) return true;

  // Il nome utente è contenuto nel nome del documento (es. "Mario Rossi" in "ROSSI MARIO SRL")
  if (documentName.includes(userName)) return true;

  // Il nome del documento è contenuto nel nome utente
  if (userName.includes(documentName)) return true;

  // Prova anche con le parti individuali del nome utente
  const userParts = userName.split(/\s+/).filter((p) => p.length > 2);
  if (userParts.length >= 2) {
    // Tutte le parti significative del nome devono essere presenti
    const allPartsMatch = userParts.every((part) => documentName.includes(part));
    if (allPartsMatch) return true;
  }

  return false;
}

/** Chiave di match cliente: case-insensitive, senza spazi ai bordi. */
function clientKey(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Assicura che i clienti esistano nel database (crea quelli nuovi) e
 * restituisce la mappa nome -> client_id per collegarli agli incassi.
 *
 * Se un cliente esiste già (case-insensitive), lo riusa.
 *
 * Propaga gli errori al caller: se l'insert clients fallisce,
 * i receipts NON devono essere inseriti per evitare orfani.
 *
 * Story 86-1: prima restituiva void e scartava gli id dei clienti appena
 * creati, quindi gli incassi importati nascevano senza client_id — invisibili
 * al report clienti, che raggruppa per client_id.
 *
 * @returns Map con chiave clientKey(nome) e valore client_id
 */
async function ensureClientsExist(
  userId: string,
  clientNames: string[],
): Promise<Map<string, string>> {
  const { data: existing, error: fetchError } = await supabase
    .from("clients")
    .select("id, display_name")
    .eq("user_id", userId);
  if (fetchError) throw fetchError;

  const byName = new Map<string, string>();
  // Omonimi permessi dal prodotto: a parita' di nome vince il primo, coerente
  // con resolveClientId che ordina per created_at.
  for (const c of existing || []) {
    const key = clientKey(c.display_name);
    if (!byName.has(key)) byName.set(key, c.id);
  }

  const newNames = clientNames.filter(
    (name) => name.trim() && !byName.has(clientKey(name)),
  );
  if (newNames.length === 0) return byName;

  const newClients = newNames.map((name) => ({
    user_id: userId,
    name: name.trim(),
    display_name: name.trim(),
    active: true,
  }));

  const { data: created, error: insertError } = await supabase
    .from("clients")
    .insert(newClients)
    .select("id, display_name");
  if (insertError) throw insertError;

  for (const c of created || []) {
    byName.set(clientKey(c.display_name), c.id);
  }

  return byName;
}
