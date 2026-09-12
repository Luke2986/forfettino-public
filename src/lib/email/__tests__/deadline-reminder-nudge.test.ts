import { describe, it, expect } from "vitest";
// AC#12 (84-3): nudge "marca pagata = stop reminder" nel renderer 84-2 (campo opzionale paidNudge).
import {
  renderDeadlineReminderEmail,
  type DeadlineEmailInput,
} from "../../../../supabase/functions/_shared/email-templates/deadline-reminder.ts";

const base: DeadlineEmailInput = {
  recipientName: "Marco",
  bucketLabel: "Saldo Imposta",
  amountEuro: 1234.56,
  dueDateISO: "2026-07-20",
  daysUntil: 7,
  ctaUrl: "https://forfettino.it/scadenziario?utm_source=email&utm_medium=transactional&utm_campaign=scadenza_saldo_tax_7",
  manageUrl: "https://forfettino.it/impostazioni",
  unsubscribeUrl: "https://x.supabase.co/functions/v1/unsubscribe-scadenze?token=abc",
  privacyUrl: "https://forfettino.it/privacy-policy",
};

describe("renderDeadlineReminderEmail — nudge marca-pagata (AC#12)", () => {
  it("con paidNudge=true: riga presente in HTML e text", () => {
    const { html, text } = renderDeadlineReminderEmail({ ...base, paidNudge: true });
    expect(html).toContain("Segnala la rata come pagata");
    expect(html).toContain("non ti ricorderemo più questa scadenza");
    expect(text).toContain("Segnala la rata come pagata nello scadenziario e non ti ricorderemo più questa scadenza.");
  });

  it("il nudge HTML linka allo scadenziario con gli stessi UTM della CTA", () => {
    const { html } = renderDeadlineReminderEmail({ ...base, paidNudge: true });
    // 2 occorrenze di utm_campaign: CTA primaria + link nudge (stesso ctaUrl)
    const utm = (html.match(/utm_campaign=scadenza_saldo_tax_7/g) || []).length;
    expect(utm).toBe(2);
  });

  it("OFF di default: senza paidNudge il body 84-2 resta invariato (no nudge, 1 solo link CTA)", () => {
    const { html, text } = renderDeadlineReminderEmail(base);
    expect(html).not.toContain("Segnala la rata come pagata");
    expect(text).not.toContain("Segnala la rata come pagata");
    const utm = (html.match(/utm_campaign=scadenza_saldo_tax_7/g) || []).length;
    expect(utm).toBe(1);
  });
});
