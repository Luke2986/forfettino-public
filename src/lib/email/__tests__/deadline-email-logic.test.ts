import { describe, it, expect } from "vitest";
// Logica pura cross-runtime dell'EF 84-3 (import per path relativo, come il test 84-2).
import {
  REMINDER_THRESHOLDS,
  bucketToLabel,
  daysUntilFromDate,
  selectSchedulesInThreshold,
  isDeadlineEmailAllowed,
  buildScadenziarioUrl,
  parseEmailCampaign,
  mapToDeadlineEmailInput,
  dedupKeyOf,
  filterByPrefs,
  filterSendable,
  DEFAULT_PREFS,
  type TaxScheduleLike,
  type NotificationPrefs,
  type ScheduleInThreshold,
} from "../../../../supabase/functions/_shared/deadline-email-logic.ts";

const TODAY = "2026-07-13";

function sched(over: Partial<TaxScheduleLike>): TaxScheduleLike {
  return {
    id: over.id ?? "s1",
    user_id: over.user_id ?? "u1",
    bucket: over.bucket ?? "saldo_tax",
    due_date: over.due_date ?? "2026-07-20",
    status: over.status ?? "open",
    total_expected: over.total_expected ?? 1234.56,
    total_paid: over.total_paid ?? 0,
  };
}

describe("daysUntilFromDate — timezone-safe", () => {
  it("calcola i giorni mancanti senza off-by-one (parse local-time)", () => {
    expect(daysUntilFromDate("2026-07-20", "2026-07-13")).toBe(7);
    expect(daysUntilFromDate("2026-07-16", "2026-07-13")).toBe(3);
    expect(daysUntilFromDate("2026-07-13", "2026-07-13")).toBe(0);
    expect(daysUntilFromDate("2026-07-10", "2026-07-13")).toBe(-3);
  });
});

describe("selectSchedulesInThreshold — rate in soglia", () => {
  it("seleziona open/partial sul default [30,7,3,0] e ne ricava il threshold (84-8: il 30 ora è nel default)", () => {
    const list = [
      sched({ id: "d", due_date: "2026-08-12", status: "open" }), // +30 (84-8: nuovo default, NON soglia esplicita)
      sched({ id: "a", due_date: "2026-07-20", status: "open" }), // +7
      sched({ id: "b", due_date: "2026-07-16", status: "partial" }), // +3
      sched({ id: "c", due_date: "2026-07-13", status: "open" }), // 0
    ];
    // Chiamata SENZA thresholds espliciti → usa REMINDER_THRESHOLDS: prova comportamentale che il 30 è attivo (AC#2).
    const res = selectSchedulesInThreshold(list, TODAY);
    expect(res.map((r) => [r.schedule.id, r.threshold])).toEqual([
      ["d", 30],
      ["a", 7],
      ["b", 3],
      ["c", 0],
    ]);
  });

  it("scarta le rate PAID anche se cadono in soglia", () => {
    const list = [sched({ id: "p", due_date: "2026-07-20", status: "paid" })];
    expect(selectSchedulesInThreshold(list, TODAY)).toEqual([]);
  });

  it("scarta le date fuori soglia (es. +5, +1, -3)", () => {
    const list = [
      sched({ id: "x", due_date: "2026-07-18" }), // +5
      sched({ id: "y", due_date: "2026-07-14" }), // +1
      sched({ id: "z", due_date: "2026-07-10" }), // -3
    ];
    expect(selectSchedulesInThreshold(list, TODAY)).toEqual([]);
  });

  it("rispetta soglie custom (es. [30])", () => {
    const list = [sched({ id: "m", due_date: "2026-08-12" })]; // +30
    const res = selectSchedulesInThreshold(list, TODAY, [30]);
    expect(res).toHaveLength(1);
    expect(res[0].threshold).toBe(30);
  });

  it("le soglie correnti sono [30,7,3,0] (84-8 ha attivato il 30)", () => {
    expect([...REMINDER_THRESHOLDS]).toEqual([30, 7, 3, 0]);
  });
});

describe("isDeadlineEmailAllowed — honor preferenze (AC#4)", () => {
  const base: NotificationPrefs = {
    master_enabled: true,
    scadenze_enabled: true,
    scadenze_email_enabled: true,
    reminder_thresholds: [30, 7, 3, 0],
  };

  it("consentito solo con tutti e tre i flag true", () => {
    expect(isDeadlineEmailAllowed(base)).toBe(true);
  });

  it("master_enabled=false → bloccato", () => {
    expect(isDeadlineEmailAllowed({ ...base, master_enabled: false })).toBe(false);
  });

  it("scadenze_enabled=false → bloccato", () => {
    expect(isDeadlineEmailAllowed({ ...base, scadenze_enabled: false })).toBe(false);
  });

  it("scadenze_email_enabled=false → bloccato (opt-out di canale)", () => {
    expect(isDeadlineEmailAllowed({ ...base, scadenze_email_enabled: false })).toBe(false);
  });

  it("DEFAULT_PREFS (utente senza riga) è consentito", () => {
    expect(isDeadlineEmailAllowed(DEFAULT_PREFS)).toBe(true);
  });
});

describe("buildScadenziarioUrl — UTM deterministici", () => {
  it("genera /scadenziario con utm_campaign scadenza_<bucket>_<threshold>", () => {
    const url = buildScadenziarioUrl("https://forfettino.it", "saldo_tax", 7);
    expect(url).toContain("https://forfettino.it/scadenziario?");
    expect(url).toContain("utm_source=email");
    expect(url).toContain("utm_medium=transactional");
    expect(url).toContain("utm_campaign=scadenza_saldo_tax_7");
  });
});

describe("parseEmailCampaign — parser inverso utm_campaign (84-6)", () => {
  it("scadenza_saldo_tax_7 → bucket multi-underscore + threshold", () => {
    expect(parseEmailCampaign("scadenza_saldo_tax_7")).toEqual({
      bucket: "saldo_tax",
      threshold: 7,
    });
  });

  it("scadenza_inps_q3_0 → threshold 0", () => {
    expect(parseEmailCampaign("scadenza_inps_q3_0")).toEqual({
      bucket: "inps_q3",
      threshold: 0,
    });
  });

  it("scadenza_acconto_inps_1_3 → bucket con cifra interna + threshold", () => {
    expect(parseEmailCampaign("scadenza_acconto_inps_1_3")).toEqual({
      bucket: "acconto_inps_1",
      threshold: 3,
    });
  });

  it("scadenza_june_30 (soglia 84-8) → ok", () => {
    expect(parseEmailCampaign("scadenza_june_30")).toEqual({
      bucket: "june",
      threshold: 30,
    });
  });

  it("non inizia per scadenza_ → null", () => {
    expect(parseEmailCampaign("altro_saldo_tax_7")).toBeNull();
    expect(parseEmailCampaign("wizard_completed")).toBeNull();
  });

  it("threshold non-numerico → null (difensivo)", () => {
    expect(parseEmailCampaign("scadenza_saldo_tax_x")).toBeNull();
  });

  it("senza segmento threshold (un solo token dopo il prefisso) → null", () => {
    expect(parseEmailCampaign("scadenza_saldo")).toBeNull();
  });

  it("input vuoto/non-stringa → null", () => {
    expect(parseEmailCampaign("")).toBeNull();
    expect(parseEmailCampaign("scadenza_")).toBeNull();
    expect(parseEmailCampaign(undefined as unknown as string)).toBeNull();
  });

  it("round-trip: parse(build(...).campaign) ricostruisce bucket+threshold", () => {
    for (const [bucket, threshold] of [
      ["saldo_tax", 7],
      ["inps_q3", 0],
      ["acconto_inps_1", 3],
      ["june", 30],
    ] as const) {
      const url = buildScadenziarioUrl("https://forfettino.it", bucket, threshold);
      const campaign = new URL(url).searchParams.get("utm_campaign")!;
      expect(parseEmailCampaign(campaign)).toEqual({ bucket, threshold });
    }
  });
});

describe("mapToDeadlineEmailInput — contratto renderer 84-2", () => {
  const input = mapToDeadlineEmailInput({
    schedule: sched({ bucket: "inps_q3", total_expected: 87.5, due_date: "2026-07-20" }),
    threshold: 7,
    todayISO: TODAY,
    recipientName: "Marco",
    appUrl: "https://forfettino.it",
    unsubscribeUrl: "https://x.supabase.co/functions/v1/unsubscribe-scadenze?token=t",
  });

  it("mappa importo=total_expected, label da bucket, date e daysUntil coerenti", () => {
    expect(input.amountEuro).toBe(87.5);
    expect(input.bucketLabel).toBe(bucketToLabel("inps_q3"));
    expect(input.dueDateISO).toBe("2026-07-20");
    expect(input.daysUntil).toBe(7);
  });

  it("popola gli URL (cta con UTM, manage, privacy, unsubscribe passato)", () => {
    expect(input.ctaUrl).toContain("/scadenziario?");
    expect(input.ctaUrl).toContain("utm_campaign=scadenza_inps_q3_7");
    expect(input.manageUrl).toBe("https://forfettino.it/impostazioni");
    expect(input.privacyUrl).toBe("https://forfettino.it/privacy-policy");
    expect(input.unsubscribeUrl).toContain("unsubscribe-scadenze?token=t");
  });

  it("attiva il nudge marca-pagata (AC#12)", () => {
    expect(input.paidNudge).toBe(true);
  });

  it("recipientName vuoto → undefined (fallback 'Ciao,' nel renderer)", () => {
    const noName = mapToDeadlineEmailInput({
      schedule: sched({}),
      threshold: 0,
      todayISO: TODAY,
      recipientName: "  ",
      appUrl: "https://forfettino.it",
      unsubscribeUrl: "https://x/u",
    });
    expect(noName.recipientName).toBeUndefined();
  });
});

// ── Pipeline destinatari (H1: era inline non-testata nell'EF; M1 fail-closed) ──

function inThr(over: Partial<TaxScheduleLike>, threshold = 7): ScheduleInThreshold {
  return { schedule: sched(over), threshold };
}

describe("dedupKeyOf — chiave idempotenza (user, schedule, threshold)", () => {
  it("formato stabile uid:sid:thr", () => {
    expect(dedupKeyOf("u1", "s1", 7)).toBe("u1:s1:7");
    expect(dedupKeyOf("u1", "s1", 0)).toBe("u1:s1:0");
  });
});

describe("filterByPrefs — honor preferenze + fail-closed (M1)", () => {
  const ALL_ON: NotificationPrefs = {
    master_enabled: true,
    scadenze_enabled: true,
    scadenze_email_enabled: true,
    reminder_thresholds: [30, 7, 3, 0],
  };

  it("tiene chi ha tutti i flag on, scarta gli opt-out", () => {
    const cands = [
      inThr({ id: "a", user_id: "on" }),
      inThr({ id: "b", user_id: "off" }),
    ];
    const prefs = new Map<string, NotificationPrefs>([
      ["on", ALL_ON],
      ["off", { ...ALL_ON, scadenze_email_enabled: false }],
    ]);
    const { eligible, skippedPrefs } = filterByPrefs(cands, prefs, true);
    expect(eligible.map((c) => c.schedule.id)).toEqual(["a"]);
    expect(skippedPrefs).toBe(1);
  });

  it("utente senza riga (query OK) → DEFAULT_PREFS = consentito", () => {
    const cands = [inThr({ id: "a", user_id: "norow" })];
    const { eligible } = filterByPrefs(cands, new Map(), true);
    expect(eligible).toHaveLength(1);
  });

  it("M1: prefsLoadOk=false → fail-CLOSED, scarta TUTTI (nessun invio)", () => {
    const cands = [
      inThr({ id: "a", user_id: "u1" }),
      inThr({ id: "b", user_id: "u2" }),
    ];
    // Anche con prefs tutte-on in mappa: se la query è fallita, non si invia a nessuno.
    const prefs = new Map<string, NotificationPrefs>([
      ["u1", ALL_ON],
      ["u2", ALL_ON],
    ]);
    const { eligible, skippedPrefs } = filterByPrefs(cands, prefs, false);
    expect(eligible).toEqual([]);
    expect(skippedPrefs).toBe(2);
  });
});

describe("filterByPrefs — soglie per-utente (84-10, filtro additivo)", () => {
  const ALL_ON: NotificationPrefs = {
    master_enabled: true,
    scadenze_enabled: true,
    scadenze_email_enabled: true,
    reminder_thresholds: [30, 7, 3, 0],
  };

  it("utente con [7,0] riceve SOLO i candidati a 7 e 0 giorni", () => {
    const cands = [
      inThr({ id: "a", user_id: "u" }, 30),
      inThr({ id: "b", user_id: "u" }, 7),
      inThr({ id: "c", user_id: "u" }, 3),
      inThr({ id: "d", user_id: "u" }, 0),
    ];
    const prefs = new Map<string, NotificationPrefs>([
      ["u", { ...ALL_ON, reminder_thresholds: [7, 0] }],
    ]);
    const { eligible, skippedPrefs } = filterByPrefs(cands, prefs, true);
    expect(eligible.map((c) => c.schedule.id)).toEqual(["b", "d"]);
    expect(skippedPrefs).toBe(2); // i candidati a 30 e 3 scartati dalle soglie
  });

  it("utente con [30] riceve SOLO il candidato a 30 giorni", () => {
    const cands = [
      inThr({ id: "a", user_id: "u" }, 30),
      inThr({ id: "b", user_id: "u" }, 7),
      inThr({ id: "c", user_id: "u" }, 0),
    ];
    const prefs = new Map<string, NotificationPrefs>([
      ["u", { ...ALL_ON, reminder_thresholds: [30] }],
    ]);
    const { eligible } = filterByPrefs(cands, prefs, true);
    expect(eligible.map((c) => c.schedule.id)).toEqual(["a"]);
  });

  it("utente senza riga (query OK) → DEFAULT_PREFS [30,7,3,0] → riceve tutte le soglie", () => {
    const cands = [
      inThr({ id: "a", user_id: "norow" }, 30),
      inThr({ id: "b", user_id: "norow" }, 7),
      inThr({ id: "c", user_id: "norow" }, 3),
      inThr({ id: "d", user_id: "norow" }, 0),
    ];
    const { eligible } = filterByPrefs(cands, new Map(), true);
    expect(eligible.map((c) => c.schedule.id)).toEqual(["a", "b", "c", "d"]);
    expect(DEFAULT_PREFS.reminder_thresholds).toEqual([30, 7, 3, 0]);
  });

  it("opt-out di canale ha precedenza sulle soglie (scadenze_email_enabled=false → nessun invio anche se la soglia combacia)", () => {
    const cands = [inThr({ id: "a", user_id: "u" }, 7)];
    const prefs = new Map<string, NotificationPrefs>([
      ["u", { ...ALL_ON, scadenze_email_enabled: false, reminder_thresholds: [7] }],
    ]);
    const { eligible } = filterByPrefs(cands, prefs, true);
    expect(eligible).toEqual([]);
  });

  it("filtro additivo per-utente: due utenti con soglie diverse sullo stesso threshold", () => {
    const cands = [
      inThr({ id: "a", user_id: "vuole7" }, 7),
      inThr({ id: "b", user_id: "vuole30" }, 7),
    ];
    const prefs = new Map<string, NotificationPrefs>([
      ["vuole7", { ...ALL_ON, reminder_thresholds: [7] }],
      ["vuole30", { ...ALL_ON, reminder_thresholds: [30] }],
    ]);
    const { eligible } = filterByPrefs(cands, prefs, true);
    expect(eligible.map((c) => c.schedule.id)).toEqual(["a"]); // vuole30 non vuole il 7
  });

  it("ignoreThresholds=true bypassa il filtro soglie (one-shot 84-4 / self-test 84-11)", () => {
    // Rata a 45gg, utente con soglie [30,7,3,0]: senza bypass sarebbe scartata.
    const cands = [inThr({ id: "a", user_id: "u" }, 45)];
    const prefs = new Map<string, NotificationPrefs>([
      ["u", { ...ALL_ON, reminder_thresholds: [30, 7, 3, 0] }],
    ]);
    expect(filterByPrefs(cands, prefs, true).eligible).toEqual([]); // default: filtrata
    const { eligible } = filterByPrefs(cands, prefs, true, true); // ignoreThresholds
    expect(eligible.map((c) => c.schedule.id)).toEqual(["a"]);
  });

  it("ignoreThresholds=true NON bypassa la guard di canale (opt-out resta rispettato, GDPR)", () => {
    const cands = [inThr({ id: "a", user_id: "u" }, 45)];
    const prefs = new Map<string, NotificationPrefs>([
      ["u", { ...ALL_ON, scadenze_email_enabled: false, reminder_thresholds: [30, 7, 3, 0] }],
    ]);
    const { eligible } = filterByPrefs(cands, prefs, true, true);
    expect(eligible).toEqual([]); // canale off → nessun invio anche con ignoreThresholds
  });
});

describe("filterSendable — email risolta + dedup", () => {
  it("scarta chi non ha email risolta", () => {
    const elig = [inThr({ id: "a", user_id: "u1" }), inThr({ id: "b", user_id: "u2" })];
    const withEmail = new Set(["u1"]); // u2 senza email
    const work = filterSendable(elig, withEmail, new Set());
    expect(work.map((c) => c.schedule.id)).toEqual(["a"]);
  });

  it("scarta i già inviati per (user, schedule, threshold)", () => {
    const elig = [
      inThr({ id: "a", user_id: "u1" }, 7),
      inThr({ id: "b", user_id: "u1" }, 7),
    ];
    const withEmail = new Set(["u1"]);
    const already = new Set([dedupKeyOf("u1", "a", 7)]);
    const work = filterSendable(elig, withEmail, already);
    expect(work.map((c) => c.schedule.id)).toEqual(["b"]);
  });

  it("stessa rata, threshold diverso → NON è un duplicato (re-invio legittimo 7→3→0)", () => {
    const elig = [inThr({ id: "a", user_id: "u1" }, 3)];
    const withEmail = new Set(["u1"]);
    const already = new Set([dedupKeyOf("u1", "a", 7)]); // inviato a 7gg, ora 3gg
    const work = filterSendable(elig, withEmail, already);
    expect(work).toHaveLength(1);
  });
});
