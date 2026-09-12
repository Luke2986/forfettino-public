import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { sanitizeMoney, multiplyByPercent, subtractMoney } from "@/lib/money";
import { format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type InvoiceRow = Database["public"]["Tables"]["invoices"]["Row"];
type InvoiceInsert = Database["public"]["Tables"]["invoices"]["Insert"];
type InvoicePaymentRow = Database["public"]["Tables"]["invoice_payments"]["Row"];

export type { InvoiceRow, InvoicePaymentRow };

/** Invoice with computed payment totals */
export interface InvoiceWithTotals extends InvoiceRow {
  totalIncassato: number; // euro
  residuo: number; // euro
  payments: InvoicePaymentRow[];
}

/** Params for creating an invoice with its first installment payment */
export interface CreateInvoiceWithFirstPaymentParams {
  numeroFattura: string;
  importoLordo: number; // euro total
  cliente: string | null;
  dataEmissione: Date;
  fiscalYear: number;
  firstPaymentImporto: number; // euro
  firstPaymentDate: Date;
  profitCoefficient: number;
  taxRate: number;
  inpsRate: number;
}

interface RegisterPaymentParams {
  invoiceId: string;
  importo: number; // euro (user input)
  dataIncasso: Date;
  note?: string;
  profitCoefficient: number;
  taxRate: number;
  inpsRate: number;
}

interface MarkAsCollectedParams {
  invoiceId: string;
  dataIncasso: Date;
  profitCoefficient: number;
  taxRate: number;
  inpsRate: number;
}

/** Params for converting an existing receipt into an invoice with installments */
export interface ConvertReceiptToInvoiceParams {
  receiptId: string;
  receiptGrossAmount: number; // current receipt gross (euro)
  receiptDate: string; // YYYY-MM-DD
  receiptClientName: string | null;
  receiptFiscalYear: number;
  invoiceTotalAmount: number; // full project amount (euro), must be >= receiptGrossAmount
  numeroFattura: string;
}

// ---------- Shared helper: create payment + receipt ----------
async function createPaymentAndReceipt(
  userId: string,
  invoiceId: string,
  importoEuro: number,
  dataIncasso: Date,
  note: string | undefined,
  profitCoefficient: number,
  taxRate: number,
  inpsRate: number,
  invoice: InvoiceRow,
  previousPaymentsTotal: number, // euro
) {
  const gross = sanitizeMoney(importoEuro);
  const taxable = multiplyByPercent(gross, profitCoefficient);
  const tax = multiplyByPercent(taxable, taxRate);
  const inps = multiplyByPercent(taxable, inpsRate);
  const netSpendable = subtractMoney(subtractMoney(gross, tax), inps);
  const dateStr = format(dataIncasso, "yyyy-MM-dd");

  // 1. Create invoice_payment record
  const { data: payment, error: payErr } = await supabase
    .from("invoice_payments" as any)
    .insert({
      invoice_id: invoiceId,
      user_id: userId,
      importo: importoEuro,
      data_incasso: dateStr,
      note: note || null,
    })
    .select("id")
    .single();
  if (payErr) throw payErr;

  // 2. Create receipts record with tracciabilità
  const { error: recErr } = await supabase
    .from("receipts")
    .insert({
      user_id: userId,
      receipt_date: dateStr,
      gross_amount: gross,
      client_name: invoice.cliente || null,
      taxable_amount: taxable,
      tax_amount: tax,
      inps_amount: inps,
      net_spendable: netSpendable,
      fiscal_year: invoice.fiscal_year,
      invoice_id: invoiceId,
      invoice_payment_id: (payment as unknown as { id: string }).id,
    });
  if (recErr) throw recErr;

  // 3. Calculate new total and determine new status
  const newTotal = previousPaymentsTotal + gross;
  const invoiceTotal = sanitizeMoney(invoice.importo_lordo);
  const isFullyPaid = newTotal >= invoiceTotal;

  const newStato = isFullyPaid ? "incassata" : "parzialmente_incassata";
  const updateData: any = { stato: newStato };
  if (isFullyPaid) {
    updateData.data_incasso = dateStr;
  }

  const { error: updErr } = await supabase
    .from("invoices" as any)
    .update(updateData)
    .eq("id", invoiceId);
  if (updErr) throw updErr;

  return { invoice, newStato, gross };
}

// ---------- Invalidation helper ----------
function invalidateAllPaymentQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["invoices"] });
  queryClient.invalidateQueries({ queryKey: ["invoice_payments"] });
  queryClient.invalidateQueries({ queryKey: ["receipts"] });
  queryClient.invalidateQueries({ queryKey: ["receipts_ytd"] });
  queryClient.invalidateQueries({ queryKey: ["receipt_count_limit"] });
  queryClient.invalidateQueries({ queryKey: ["due_soon_schedules"] });
  queryClient.invalidateQueries({ queryKey: ["next_deadline"] });
  queryClient.invalidateQueries({ queryKey: ["income_stats"] });
}

export function useInvoices(fiscalYear: number) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // ---------- Fetch invoices ----------
  const invoicesQuery = useQuery({
    queryKey: ["invoices", user?.id, fiscalYear],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("invoices" as any)
        .select("*")
        .eq("user_id", user.id)
        .eq("fiscal_year", fiscalYear)
        .order("data_emissione", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as InvoiceRow[];
    },
    enabled: !!user,
  });

  // ---------- Fetch all invoice_payments (avoid N+1) ----------
  const paymentsQuery = useQuery({
    queryKey: ["invoice_payments", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("invoice_payments" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("data_incasso", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as InvoicePaymentRow[];
    },
    enabled: !!user,
  });

  // ---------- Payments map (grouped by invoice_id) ----------
  const paymentsMap = useMemo(() => {
    const map = new Map<string, InvoicePaymentRow[]>();
    (paymentsQuery.data || []).forEach((p) => {
      const list = map.get(p.invoice_id) || [];
      list.push(p);
      map.set(p.invoice_id, list);
    });
    return map;
  }, [paymentsQuery.data]);

  // ---------- Invoices with computed totals ----------
  const invoicesWithTotals: InvoiceWithTotals[] = useMemo(() => {
    if (!invoicesQuery.data) return [];
    return invoicesQuery.data.map((invoice) => {
      const payments = paymentsMap.get(invoice.id) || [];
      const totalIncassato = payments.reduce(
        (sum, p) => sum + sanitizeMoney(p.importo),
        0
      );
      const residuo = sanitizeMoney(invoice.importo_lordo) - totalIncassato;
      return { ...invoice, totalIncassato, residuo, payments };
    });
  }, [invoicesQuery.data, paymentsMap]);

  // ---------- Create (ghost invoice) ----------
  const createInvoiceMutation = useMutation({
    mutationFn: async (
      invoice: Omit<
        InvoiceInsert,
        "user_id" | "id" | "created_at" | "updated_at" | "stato"
      >
    ) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("invoices" as any)
        .insert({
          ...invoice,
          user_id: user.id,
          stato: "emessa",
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });

  // ---------- Mark as received (emessa → ricevuta) ----------
  const markAsReceivedMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("invoices" as any)
        .update({ stato: "ricevuta" })
        .eq("id", invoiceId)
        .eq("stato", "emessa");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });

  // ---------- Register payment (partial or full) ----------
  const registerPaymentMutation = useMutation({
    mutationFn: async (params: RegisterPaymentParams) => {
      if (!user) throw new Error("Not authenticated");
      const { invoiceId, importo, dataIncasso, note, profitCoefficient, taxRate, inpsRate } = params;

      // Fetch the invoice
      const { data: invoice, error: fetchErr } = await supabase
        .from("invoices" as any)
        .select("*")
        .eq("id", invoiceId)
        .single();
      if (fetchErr) throw fetchErr;
      const inv = invoice as unknown as InvoiceRow;

      // Calculate current total paid
      const existingPayments = paymentsMap.get(invoiceId) || [];
      const previousTotal = existingPayments.reduce(
        (sum, p) => sum + sanitizeMoney(p.importo),
        0
      );

      // Validate: importo must not exceed residuo
      const importoCents = sanitizeMoney(importo);
      const invoiceTotal = sanitizeMoney(inv.importo_lordo);
      const residuo = invoiceTotal - previousTotal;
      if (importoCents > residuo) {
        throw new Error(
          `L'importo supera il residuo di €${residuo.toFixed(2).replace(".", ",")}`
        );
      }

      return createPaymentAndReceipt(
        user.id,
        invoiceId,
        importo,
        dataIncasso,
        note,
        profitCoefficient,
        taxRate,
        inpsRate,
        inv,
        previousTotal,
      );
    },
    onSuccess: () => {
      invalidateAllPaymentQueries(queryClient);
    },
  });

  // ---------- Mark as collected (full payment shortcut) ----------
  const markAsCollectedMutation = useMutation({
    mutationFn: async (params: MarkAsCollectedParams) => {
      if (!user) throw new Error("Not authenticated");
      const { invoiceId, dataIncasso, profitCoefficient, taxRate, inpsRate } = params;

      // Fetch the invoice
      const { data: invoice, error: fetchErr } = await supabase
        .from("invoices" as any)
        .select("*")
        .eq("id", invoiceId)
        .single();
      if (fetchErr) throw fetchErr;
      const inv = invoice as unknown as InvoiceRow;

      // Calculate residuo (full payment = remaining amount)
      const existingPayments = paymentsMap.get(invoiceId) || [];
      const previousTotal = existingPayments.reduce(
        (sum, p) => sum + sanitizeMoney(p.importo),
        0
      );
      const invoiceTotal = sanitizeMoney(inv.importo_lordo);
      const residuoEuro = invoiceTotal - previousTotal;

      if (residuoEuro <= 0) {
        throw new Error("Fattura già completamente incassata");
      }

      return createPaymentAndReceipt(
        user.id,
        invoiceId,
        residuoEuro,
        dataIncasso,
        undefined,
        profitCoefficient,
        taxRate,
        inpsRate,
        inv,
        previousTotal,
      );
    },
    onSuccess: () => {
      invalidateAllPaymentQueries(queryClient);
    },
  });

  // ---------- Edit (stato "emessa" o "ricevuta") ----------
  const editInvoiceMutation = useMutation({
    mutationFn: async (params: {
      id: string;
      updates: Partial<
        Pick<
          InvoiceRow,
          | "numero_fattura"
          | "importo_lordo"
          | "cliente"
          | "data_emissione"
          | "note"
          | "fiscal_year"
        >
      >;
    }) => {
      if (!user) throw new Error("Not authenticated");

      // Verify invoice is in editable state
      const inv = invoicesWithTotals.find((i) => i.id === params.id);
      if (inv && !["emessa", "ricevuta"].includes(inv.stato)) {
        throw new Error("La fattura non è modificabile in questo stato");
      }

      const { error } = await supabase
        .from("invoices" as any)
        .update(params.updates)
        .eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });

  // ---------- Delete (stato "emessa" o "ricevuta", NO se ha pagamenti) ----------
  const deleteInvoiceMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Not authenticated");

      // Verify invoice is in deletable state and has no payments
      const inv = invoicesWithTotals.find((i) => i.id === id);
      if (!inv) {
        throw new Error("Fattura non trovata");
      }
      if (!["emessa", "ricevuta"].includes(inv.stato)) {
        throw new Error("La fattura non è eliminabile in questo stato");
      }
      if (inv.payments.length > 0) {
        throw new Error("Impossibile eliminare una fattura con pagamenti registrati");
      }

      const { error } = await supabase
        .from("invoices" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });

  // ---------- Convert existing receipt → invoice (retroactive installment) ----------
  const convertReceiptToInvoiceMutation = useMutation({
    mutationFn: async (params: ConvertReceiptToInvoiceParams) => {
      if (!user) throw new Error("Not authenticated");
      const {
        receiptId, receiptGrossAmount, receiptDate, receiptClientName,
        receiptFiscalYear, invoiceTotalAmount, numeroFattura,
      } = params;

      if (invoiceTotalAmount < receiptGrossAmount) {
        throw new Error("L'importo totale della fattura deve essere >= l'importo dell'incasso esistente");
      }

      // 1. Create the invoice with the full project amount
      const isFullyPaid = invoiceTotalAmount === receiptGrossAmount;
      const stato = isFullyPaid ? "incassata" : "parzialmente_incassata";
      const { data: newInvoice, error: invErr } = await supabase
        .from("invoices" as any)
        .insert({
          user_id: user.id,
          numero_fattura: numeroFattura,
          importo_lordo: invoiceTotalAmount,
          cliente: receiptClientName,
          data_emissione: receiptDate,
          fiscal_year: receiptFiscalYear,
          stato,
          data_incasso: isFullyPaid ? receiptDate : null,
        })
        .select("*")
        .single();
      if (invErr) throw invErr;
      const inv = newInvoice as unknown as InvoiceRow;

      // 2. Create invoice_payment to represent the existing receipt
      const { data: payment, error: payErr } = await supabase
        .from("invoice_payments" as any)
        .insert({
          invoice_id: inv.id,
          user_id: user.id,
          importo: receiptGrossAmount,
          data_incasso: receiptDate,
          note: "Incasso esistente collegato",
        })
        .select("id")
        .single();
      if (payErr) throw payErr;

      // 3. Link the existing receipt to this invoice + payment
      const { error: linkErr } = await supabase
        .from("receipts")
        .update({
          invoice_id: inv.id,
          invoice_payment_id: (payment as unknown as { id: string }).id,
        })
        .eq("id", receiptId);
      if (linkErr) throw linkErr;

      return { invoice: inv, residuo: invoiceTotalAmount - receiptGrossAmount };
    },
    onSuccess: () => {
      invalidateAllPaymentQueries(queryClient);
    },
  });

  // ---------- Create invoice + first payment (unified flow from NuovoIncasso) ----------
  const createInvoiceWithFirstPaymentMutation = useMutation({
    mutationFn: async (params: CreateInvoiceWithFirstPaymentParams) => {
      if (!user) throw new Error("Not authenticated");
      const {
        numeroFattura, importoLordo, cliente, dataEmissione, fiscalYear,
        firstPaymentImporto, firstPaymentDate, profitCoefficient, taxRate, inpsRate,
      } = params;

      // 1. Create the invoice
      const { data: newInvoice, error: invErr } = await supabase
        .from("invoices" as any)
        .insert({
          user_id: user.id,
          numero_fattura: numeroFattura,
          importo_lordo: importoLordo,
          cliente,
          data_emissione: format(dataEmissione, "yyyy-MM-dd"),
          fiscal_year: fiscalYear,
          stato: "emessa",
        })
        .select("*")
        .single();
      if (invErr) throw invErr;
      const inv = newInvoice as unknown as InvoiceRow;

      // 2. Register the first payment
      return createPaymentAndReceipt(
        user.id,
        inv.id,
        firstPaymentImporto,
        firstPaymentDate,
        "Anticipo",
        profitCoefficient,
        taxRate,
        inpsRate,
        inv,
        0, // no previous payments
      );
    },
    onSuccess: () => {
      invalidateAllPaymentQueries(queryClient);
    },
  });

  // ---------- Derived data ----------
  // pendingInvoices now includes emessa, ricevuta, parzialmente_incassata
  const pendingInvoices = invoicesWithTotals.filter(
    (i) => i.stato !== "incassata"
  );
  const pendingCount = pendingInvoices.length;
  const pendingTotal = pendingInvoices.reduce(
    (sum, i) => sum + i.residuo,
    0
  );

  return {
    invoices: invoicesQuery.data || [],
    invoicesWithTotals,
    isLoading: invoicesQuery.isLoading || paymentsQuery.isLoading,
    paymentsMap,
    pendingInvoices,
    pendingCount,
    pendingTotal,
    createInvoiceMutation,
    createInvoiceWithFirstPaymentMutation,
    convertReceiptToInvoiceMutation,
    markAsReceivedMutation,
    registerPaymentMutation,
    markAsCollectedMutation,
    editInvoiceMutation,
    deleteInvoiceMutation,
  };
}
