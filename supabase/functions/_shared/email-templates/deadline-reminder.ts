/**
 * deadline-reminder.ts — Renderer condiviso per l'email di avviso scadenza fiscale.
 *
 * SCOPO (Story 84-2): produrre il TEMPLATE (layout branded + corpo scadenza + multipart
 * HTML/text). NON invia nulla. L'Edge Function di invio è 84-3; l'attivazione del pixel
 * apertura è 84-5/84-7; gli UTM reali sono passati dal chiamante (84-6).
 *
 * VINCOLI CROSS-RUNTIME (rompere = rompere uno dei tre runtime — vedi Dev Notes §Architettura):
 *  - TS puro, dependency-free. SOLO `Intl` + string building.
 *  - NO `import ... from "https://esm.sh/..."` (romperebbe Vitest/Node).
 *  - NO `Deno.env`, `Deno.*`, `Deno.serve` (romperebbe Vitest/Node).
 *  - NO React / React Email. NO import da `src/` (i `_shared/*.tsx` sono SOLO per l'auth hook).
 *
 * Consumatori previsti:
 *  - EF Deno 84-3: `import { renderDeadlineReminderEmail } from "../_shared/email-templates/deadline-reminder.ts"`
 *  - Test Vitest: `src/lib/email/__tests__/deadline-reminder.test.ts` (import per path relativo)
 *  - Script preview Deno: `preview-deadline.ts` (stessa sorgente → single source of truth)
 */

// ── Contratto input/output ───────────────────────────────────────────────────

export interface DeadlineEmailInput {
  /** "Ciao {name}," — fallback "Ciao," se assente o vuoto */
  recipientName?: string;
  /** Label scadenza già risolta via bucketToLabel (es. "Saldo Imposta") */
  bucketLabel: string;
  /** Importo REALE della rata non pagata in euro (84-3 lo calcola). NON centesimi. */
  amountEuro: number;
  /** Data scadenza "YYYY-MM-DD" */
  dueDateISO: string;
  /**
   * 0 = oggi, >0 = futuro, <0 = già scaduta.
   * DEVE essere coerente con `dueDateISO`: il renderer non lo ricalcola dalla data.
   * Lo calcola il chiamante in modo timezone-safe (84-3 lato server; la preview da PREVIEW_TODAY).
   */
  daysUntil: number;
  /** Link allo scadenziario, GIÀ comprensivo di UTM se forniti (84-6). Il renderer non li inventa. */
  ctaUrl: string;
  /** → /impostazioni (gestione notifiche) */
  manageUrl: string;
  /** → EF unsubscribe-scadenze (84-3). Parametro, non hardcoded. */
  unsubscribeUrl: string;
  /** → /privacy-policy */
  privacyUrl: string;
  /** OFF di default: renderizzato SOLO se passato (gated 84-5/84-7). */
  openPixelUrl?: string;
  /**
   * AC#12 (84-3): se true, rende sotto la CTA il nudge "marca pagata = stop reminder"
   * (HTML + text), con link allo scadenziario = `ctaUrl` (stessi UTM della CTA primaria).
   * OFF di default: i consumatori 84-2 puri non lo passano → body invariato.
   */
  paidNudge?: boolean;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

// ── Formattazione (Intl puro, no import da src/ — cross-runtime) ──
// NB: NON è una replica 1:1 di src/lib/deadline-notifications.ts:formatEuro (che usa
// style:"currency" → "1.234,56 €", simbolo dietro). Qui si applica il formato del
// design-system per le email: simbolo DAVANTI "€ 1.234,56". Divergenza voluta.

/** Importo formato IT con simbolo davanti: `€ 1.234,56` (design system, simbolo-first). */
export function formatEuro(amountEuro: number): string {
  // useGrouping:true esplicito: il default "auto" non raggruppa le migliaia in questo runtime.
  const n = new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(amountEuro);
  return `€ ${n}`; // U+20AC + spazio ASCII + numero → "€ 1.234,56"
}

/** Data IT breve: `6 lug 2026`. Append T00:00:00 per parse local-time (timezone-safe). */
export function formatDateIT(dueDateISO: string): string {
  const safe = dueDateISO.includes("T") ? dueDateISO : `${dueDateISO}T00:00:00`;
  return new Date(safe).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Frase giorni mancanti: "oggi" | "manca 1 giorno" | "mancano N giorni" | "scaduta da N giorni". */
export function daysPhrase(daysUntil: number): string {
  if (daysUntil === 0) return "oggi";
  if (daysUntil === 1) return "manca 1 giorno";
  if (daysUntil > 1) return `mancano ${daysUntil} giorni`;
  const overdue = Math.abs(daysUntil);
  return overdue === 1 ? "scaduta da 1 giorno" : `scaduta da ${overdue} giorni`;
}

function greeting(recipientName?: string): string {
  const name = recipientName?.trim();
  return name ? `Ciao ${name},` : "Ciao,";
}

// ── Escaping (i valori dinamici testuali finiscono in HTML) ───────────────────

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Gli URL finiscono dentro attributi href: minimo escaping di " e &. */
function escapeAttr(url: string): string {
  return url.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

// ── Layout condiviso (consolidato da emailWrapper()) ──────────────────────────

const COLORS = {
  bg: "#f8fafc",
  card: "#ffffff",
  divider: "#e2e8f0",
  teal: "#0d9488",
  textStrong: "#0f172a",
  textBody: "#475569",
  textMuted: "#64748b",
} as const;

const FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

interface ServiceFooterUrls {
  manageUrl: string;
  unsubscribeUrl: string;
  privacyUrl: string;
}

/**
 * Footer di SERVIZIO (non marketing): dichiara la natura dell'avviso + i 3 link
 * (gestisci notifiche / disiscriviti scadenze / privacy). Coerente con
 * List-Unsubscribe one-click che 84-3 imposterà server-side.
 */
export function serviceFooter(urls: ServiceFooterUrls): string {
  const link = (href: string, label: string) =>
    `<a href="${escapeAttr(href)}" style="color:${COLORS.textMuted};text-decoration:underline;">${label}</a>`;
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
    <tr>
      <td style="padding:20px 24px;border-top:1px solid ${COLORS.divider};font-family:${FONT_STACK};font-size:12px;line-height:1.6;color:${COLORS.textMuted};text-align:center;">
        <p style="margin:0 0 8px;">Questo è un avviso di servizio sulle tue scadenze fiscali, non una comunicazione pubblicitaria.</p>
        <p style="margin:0;">
          ${link(urls.manageUrl, "Gestisci notifiche")}
          &nbsp;&middot;&nbsp;
          ${link(urls.unsubscribeUrl, "Non ricevere più questi avvisi")}
          &nbsp;&middot;&nbsp;
          ${link(urls.privacyUrl, "Privacy Policy")}
        </p>
      </td>
    </tr>
  </table>`;
}

interface EmailLayoutOptions {
  title: string;
  bodyHtml: string;
  footerHtml: string;
  /** OFF di default: pixel renderizzato solo se URL passato (gated 84-5/84-7). */
  openPixelUrl?: string;
}

/**
 * Layout email condiviso: header Forfettino (teal), corpo max 480px mobile-first,
 * table-based + CSS inline (compatibilità Outlook/webmail), dark-safe.
 */
export function emailLayout(opts: EmailLayoutOptions): string {
  const { title, bodyHtml, footerHtml, openPixelUrl } = opts;

  // Segnaposto pixel apertura: OFF di default (gating 84-5/84-7). Mai pixel hardcodato attivo.
  const openPixel = openPixelUrl
    ? `<img src="${escapeAttr(openPixelUrl)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;overflow:hidden;" />`
    : `<!-- open-pixel placeholder: inattivo, attivazione gated 84-5/84-7 -->`;

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.bg};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:${COLORS.bg};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLORS.card}" style="border-collapse:collapse;width:100%;max-width:480px;background:${COLORS.card};border:1px solid ${COLORS.divider};border-radius:12px;overflow:hidden;">
          <tr>
            <td align="center" style="padding:24px;border-bottom:1px solid ${COLORS.divider};">
              <span style="font-family:${FONT_STACK};font-size:24px;font-weight:700;color:${COLORS.teal};">Forfettino</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 24px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td>
              ${footerHtml}
            </td>
          </tr>
        </table>
        ${openPixel}
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Corpo template scadenza ───────────────────────────────────────────────────

function deadlineBodyHtml(input: DeadlineEmailInput): string {
  const label = escapeHtml(input.bucketLabel);
  const amount = escapeHtml(formatEuro(input.amountEuro));
  const dateIT = escapeHtml(formatDateIT(input.dueDateISO));
  const phrase = escapeHtml(daysPhrase(input.daysUntil));
  const hello = escapeHtml(greeting(input.recipientName));
  const cta = escapeAttr(input.ctaUrl);

  const scadeLine =
    input.daysUntil === 0
      ? `Scade <strong>oggi</strong>, ${dateIT}.`
      : `Scade il <strong>${dateIT}</strong> &mdash; ${phrase}.`;

  return `
  <p style="margin:0 0 16px;font-family:${FONT_STACK};font-size:15px;line-height:1.6;color:${COLORS.textBody};">${hello}</p>
  <p style="margin:0 0 24px;font-family:${FONT_STACK};font-size:15px;line-height:1.6;color:${COLORS.textBody};">Ti ricordiamo una scadenza fiscale in arrivo.</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 24px;">
    <tr>
      <td bgcolor="${COLORS.bg}" style="padding:16px 20px;background:${COLORS.bg};border:1px solid ${COLORS.divider};border-radius:8px;">
        <p style="margin:0 0 6px;font-family:${FONT_STACK};font-size:14px;font-weight:600;color:${COLORS.textMuted};">${label}</p>
        <p style="margin:0 0 6px;font-family:${FONT_STACK};font-size:28px;font-weight:700;color:${COLORS.textStrong};">${amount}</p>
        <p style="margin:0;font-family:${FONT_STACK};font-size:14px;line-height:1.5;color:${COLORS.textBody};">${scadeLine}</p>
      </td>
    </tr>
  </table>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="border-collapse:collapse;margin:0 auto 8px;">
    <tr>
      <td align="center" bgcolor="${COLORS.teal}" style="border-radius:8px;background:${COLORS.teal};">
        <a href="${cta}" style="display:inline-block;padding:14px 32px;font-family:${FONT_STACK};font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Apri lo scadenziario</a>
      </td>
    </tr>
  </table>${paidNudgeHtml(input)}`;
}

/**
 * AC#12: riga "marca pagata = stop reminder" sotto la CTA. Rende esplicito il comportamento
 * già esistente (status='paid' salta la rata) e dà all'utente la leva per fermare i promemoria
 * di QUELLA scadenza senza opt-out dell'intero canale. Link allo scadenziario = ctaUrl (stessi UTM).
 */
function paidNudgeHtml(input: DeadlineEmailInput): string {
  if (!input.paidNudge) return "";
  const cta = escapeAttr(input.ctaUrl);
  return `
  <p style="margin:16px 0 0;font-family:${FONT_STACK};font-size:13px;line-height:1.6;color:${COLORS.textMuted};text-align:center;">
    Hai già pagato? Segnala la rata come pagata <a href="${cta}" style="color:${COLORS.teal};text-decoration:underline;">nello scadenziario</a> e non ti ricorderemo più questa scadenza.
  </p>`;
}

function deadlineBodyText(input: DeadlineEmailInput): string {
  const amount = formatEuro(input.amountEuro);
  const dateIT = formatDateIT(input.dueDateISO);
  const phrase = daysPhrase(input.daysUntil);
  const hello = greeting(input.recipientName);

  const scadeLine =
    input.daysUntil === 0
      ? `Scade oggi, ${dateIT}.`
      : `Scade il ${dateIT} (${phrase}).`;

  const lines = [
    hello,
    "",
    "Ti ricordiamo una scadenza fiscale in arrivo.",
    "",
    `${input.bucketLabel}: ${amount}`,
    scadeLine,
    "",
    "Apri lo scadenziario:",
    input.ctaUrl,
  ];

  // AC#12: nudge "marca pagata = stop reminder" (versione plain-text).
  if (input.paidNudge) {
    lines.push(
      "",
      "Hai già pagato? Segnala la rata come pagata nello scadenziario e non ti ricorderemo più questa scadenza.",
    );
  }

  return [
    ...lines,
    "",
    "—",
    "Questo è un avviso di servizio sulle tue scadenze fiscali, non una comunicazione pubblicitaria.",
    `Gestisci notifiche: ${input.manageUrl}`,
    `Non ricevere più questi avvisi: ${input.unsubscribeUrl}`,
    `Privacy Policy: ${input.privacyUrl}`,
  ].join("\n");
}

// ── API pubblica ──────────────────────────────────────────────────────────────

/**
 * Renderizza l'email di avviso scadenza da un solo input tipizzato.
 * Subject generato UNA volta e identico per HTML e text (AC #5).
 */
export function renderDeadlineReminderEmail(input: DeadlineEmailInput): RenderedEmail {
  const subject = `Scadenza ${input.bucketLabel} il ${formatDateIT(input.dueDateISO)}: ${formatEuro(input.amountEuro)}`;

  const html = emailLayout({
    title: subject,
    bodyHtml: deadlineBodyHtml(input),
    footerHtml: serviceFooter({
      manageUrl: input.manageUrl,
      unsubscribeUrl: input.unsubscribeUrl,
      privacyUrl: input.privacyUrl,
    }),
    openPixelUrl: input.openPixelUrl,
  });

  const text = deadlineBodyText(input);

  return { subject, html, text };
}
