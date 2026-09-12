import { describe, it, expect } from "vitest";
// Import cross-dir del renderer condiviso (TS puro, Intl-only) usato anche dalla EF Deno 84-3.
// Funziona perché il modulo non ha import esm.sh né global Deno e tsconfig ha
// allowImportingTsExtensions + moduleResolution bundler.
import {
  renderDeadlineReminderEmail,
  formatEuro,
  formatDateIT,
  daysPhrase,
  type DeadlineEmailInput,
} from "../../../../supabase/functions/_shared/email-templates/deadline-reminder.ts";

// ── Scenari di esempio (≥2: importo grande / piccolo, bucket INPS / saldo imposta) ──

const baseUrls = {
  ctaUrl: "https://forfettino.it/scadenziario?utm_source=email&utm_medium=transactional&utm_campaign=scadenza",
  manageUrl: "https://forfettino.it/impostazioni",
  unsubscribeUrl: "https://example.supabase.co/functions/v1/unsubscribe-scadenze?token=abc123",
  privacyUrl: "https://forfettino.it/privacy-policy",
};

// dueDateISO ancorata alla proroga reale forfettari 2026 (20 lug, vedi FORFETTARIO_PROROGA);
// daysUntil:7 è coerente (giorno di invio implicito = 13 lug). No date fiscalmente arbitrarie.
const saldoImposta: DeadlineEmailInput = {
  recipientName: "Marco",
  bucketLabel: "Saldo Imposta",
  amountEuro: 1234.56,
  dueDateISO: "2026-07-20",
  daysUntil: 7,
  ...baseUrls,
};

const inpsSmall: DeadlineEmailInput = {
  bucketLabel: "Rata INPS Q3 (Ago)",
  amountEuro: 87.5,
  dueDateISO: "2026-08-20",
  daysUntil: 0,
  ...baseUrls,
};

describe("formatters", () => {
  it("formatEuro produce simbolo davanti formato IT", () => {
    expect(formatEuro(1234.56)).toBe("€ 1.234,56");
    expect(formatEuro(87.5)).toBe("€ 87,50");
    expect(formatEuro(0)).toBe("€ 0,00");
  });

  it("formatDateIT produce data IT breve timezone-safe", () => {
    expect(formatDateIT("2026-07-06")).toBe("6 lug 2026");
    expect(formatDateIT("2026-08-20")).toBe("20 ago 2026");
  });

  it("daysPhrase gestisce oggi / singolare / plurale", () => {
    expect(daysPhrase(0)).toBe("oggi");
    expect(daysPhrase(1)).toBe("manca 1 giorno");
    expect(daysPhrase(5)).toBe("mancano 5 giorni");
  });

  it("daysPhrase gestisce il ramo scaduta (overdue, singolare/plurale)", () => {
    expect(daysPhrase(-1)).toBe("scaduta da 1 giorno");
    expect(daysPhrase(-4)).toBe("scaduta da 4 giorni");
  });
});

describe("renderDeadlineReminderEmail — subject", () => {
  it("oggetto pattern 'Scadenza {label} il {data}: {importo}' (importo grande)", () => {
    const { subject } = renderDeadlineReminderEmail(saldoImposta);
    expect(subject).toBe("Scadenza Saldo Imposta il 20 lug 2026: € 1.234,56");
  });

  it("oggetto coerente per importo piccolo + bucket INPS", () => {
    const { subject } = renderDeadlineReminderEmail(inpsSmall);
    expect(subject).toBe("Scadenza Rata INPS Q3 (Ago) il 20 ago 2026: € 87,50");
  });

  it("subject identico tra le due rappresentazioni (generato una sola volta)", () => {
    const { subject, html, text } = renderDeadlineReminderEmail(saldoImposta);
    // Il subject non è embeddato nel body, ma deve comparire come <title> nell'HTML
    expect(html).toContain(`<title>${subject}</title>`);
    // E il text non lo duplica come oggetto (è solo il corpo) → coerenza multipart
    expect(text.length).toBeGreaterThan(0);
  });
});

describe("renderDeadlineReminderEmail — contenuto presente in HTML e text", () => {
  it("importo IT + data IT + label compaiono in HTML", () => {
    const { html } = renderDeadlineReminderEmail(saldoImposta);
    expect(html).toContain("€ 1.234,56");
    expect(html).toContain("20 lug 2026");
    expect(html).toContain("Saldo Imposta");
  });

  it("importo IT + data IT + label compaiono in text", () => {
    const { text } = renderDeadlineReminderEmail(saldoImposta);
    expect(text).toContain("€ 1.234,56");
    expect(text).toContain("20 lug 2026");
    expect(text).toContain("Saldo Imposta");
  });

  it("multipart: html e text non vuoti", () => {
    const { html, text } = renderDeadlineReminderEmail(inpsSmall);
    expect(html.length).toBeGreaterThan(100);
    expect(text.length).toBeGreaterThan(50);
    expect(html).toContain("<!DOCTYPE html>");
  });

  it("CTA: label visibile 'Apri lo scadenziario' presente in HTML e text", () => {
    const { html, text } = renderDeadlineReminderEmail(saldoImposta);
    expect(html).toContain(">Apri lo scadenziario</a>");
    expect(text).toContain("Apri lo scadenziario:");
  });

  it("CTA bulletproof: il <td> ha bgcolor teal (robustezza Outlook)", () => {
    const { html } = renderDeadlineReminderEmail(saldoImposta);
    expect(html).toContain('bgcolor="#0d9488"');
  });
});

describe("renderDeadlineReminderEmail — footer servizio (no marketing)", () => {
  it("contiene dichiarazione di servizio e i 3 link", () => {
    const { html, text } = renderDeadlineReminderEmail(saldoImposta);
    for (const out of [html, text]) {
      expect(out).toContain("avviso di servizio sulle tue scadenze fiscali");
      expect(out).toContain("Gestisci notifiche");
      expect(out).toContain("Non ricevere più questi avvisi");
      expect(out).toContain("Privacy Policy");
    }
  });

  it("NON contiene copy marketing/waitlist/promozionale", () => {
    const { html, text } = renderDeadlineReminderEmail(saldoImposta);
    for (const out of [html, text]) {
      expect(out).not.toMatch(/marketing/i);
      expect(out).not.toMatch(/waitlist/i);
      expect(out).not.toMatch(/Scopri di più/i);
      expect(out).not.toMatch(/offerta|sconto|promo/i);
    }
  });
});

describe("renderDeadlineReminderEmail — CTA + UTM invariati", () => {
  it("il ctaUrl (con UTM) è passato invariato nel text", () => {
    const { text } = renderDeadlineReminderEmail(saldoImposta);
    expect(text).toContain(baseUrls.ctaUrl);
  });

  it("il renderer NON inventa né muta UTM (HTML href con & encodato ma params intatti)", () => {
    const { html } = renderDeadlineReminderEmail(saldoImposta);
    // In HTML gli '&' diventano '&amp;' ma i parametri restano gli stessi
    expect(html).toContain(
      'href="https://forfettino.it/scadenziario?utm_source=email&amp;utm_medium=transactional&amp;utm_campaign=scadenza"',
    );
    // Nessun utm aggiunto dal renderer oltre quelli passati
    const utmCount = (html.match(/utm_source/g) || []).length;
    expect(utmCount).toBe(1);
  });
});

describe("renderDeadlineReminderEmail — pixel apertura gated", () => {
  it("nessun <img> pixel quando openPixelUrl assente (OFF di default)", () => {
    const { html } = renderDeadlineReminderEmail(saldoImposta);
    expect(html).not.toContain("<img");
    expect(html).toContain("open-pixel placeholder");
  });

  it("renderizza il pixel SOLO se openPixelUrl è passato", () => {
    const { html } = renderDeadlineReminderEmail({
      ...saldoImposta,
      openPixelUrl: "https://example.com/o/abc.gif",
    });
    expect(html).toContain('<img src="https://example.com/o/abc.gif"');
  });
});

describe("renderDeadlineReminderEmail — giorni mancanti (singolare/plurale/oggi)", () => {
  it("daysUntil = 0 → 'oggi' in HTML e text", () => {
    const { html, text } = renderDeadlineReminderEmail({ ...saldoImposta, daysUntil: 0 });
    expect(text).toContain("Scade oggi");
    expect(html).toContain("oggi");
  });

  it("daysUntil = 1 → 'manca 1 giorno'", () => {
    const { text } = renderDeadlineReminderEmail({ ...saldoImposta, daysUntil: 1 });
    expect(text).toContain("manca 1 giorno");
  });

  it("daysUntil > 1 → 'mancano N giorni'", () => {
    const { text } = renderDeadlineReminderEmail({ ...saldoImposta, daysUntil: 7 });
    expect(text).toContain("mancano 7 giorni");
  });
});

describe("renderDeadlineReminderEmail — greeting", () => {
  it("usa il nome quando presente", () => {
    const { html, text } = renderDeadlineReminderEmail(saldoImposta);
    expect(html).toContain("Ciao Marco,");
    expect(text).toContain("Ciao Marco,");
  });

  it("fallback 'Ciao,' senza nome", () => {
    const { text } = renderDeadlineReminderEmail(inpsSmall);
    expect(text.startsWith("Ciao,")).toBe(true);
  });
});
