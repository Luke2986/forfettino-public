import { describe, it, expect } from "vitest";
// Logica pura cross-runtime dell'EF 84-5 (import per path relativo, come i test 84-2/84-3).
import {
  RESEND_EVENT_TYPES,
  isUuid,
  normalizeTags,
  emailLogStatusForEvent,
  parseResendEvent,
  aggregateEvents,
  type EmailEventLike,
} from "../../../../supabase/functions/_shared/resend-webhook-logic.ts";

const UID = "11111111-1111-4111-8111-111111111111";

/** Costruisce un payload webhook Resend minimale (tags come OGGETTO-mappa, forma reale). */
function payload(over: {
  type?: string;
  created_at?: string;
  email_id?: string;
  to?: unknown;
  tags?: unknown;
  data?: Record<string, unknown>;
}): unknown {
  return {
    type: over.type ?? "email.delivered",
    created_at: over.created_at ?? "2026-06-27T09:00:00.000Z",
    data: {
      email_id: over.email_id ?? "msg_abc",
      to: over.to ?? ["mario@example.com"],
      from: "noreply@forfettino.it",
      subject: "Scadenza fiscale",
      tags: over.tags ?? { category: "deadline_reminder", user_id: UID, threshold: "7" },
      ...over.data,
    },
  };
}

describe("isUuid", () => {
  it("accetta un UUID v4 valido (case-insensitive)", () => {
    expect(isUuid(UID)).toBe(true);
    expect(isUuid(UID.toUpperCase())).toBe(true);
  });
  it("rifiuta stringhe non-UUID, vuote e non-stringhe", () => {
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("")).toBe(false);
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid(123)).toBe(false);
    expect(isUuid("11111111-1111-4111-8111-11111111111")).toBe(false); // 1 char in meno
  });
});

describe("normalizeTags — array ↔ oggetto-mappa (fatto #3)", () => {
  it("oggetto-mappa (forma webhook) → Record identico", () => {
    const out = normalizeTags({ category: "deadline_reminder", user_id: UID, threshold: "7" });
    expect(out).toEqual({ category: "deadline_reminder", user_id: UID, threshold: "7" });
  });
  it("array {name,value} (forma invio 84-3) → stesso Record", () => {
    const out = normalizeTags([
      { name: "category", value: "deadline_reminder" },
      { name: "user_id", value: UID },
      { name: "threshold", value: "7" },
    ]);
    expect(out).toEqual({ category: "deadline_reminder", user_id: UID, threshold: "7" });
  });
  it("array e oggetto producono lo STESSO risultato", () => {
    const obj = normalizeTags({ a: "1", b: "2" });
    const arr = normalizeTags([{ name: "a", value: "1" }, { name: "b", value: "2" }]);
    expect(arr).toEqual(obj);
  });
  it("tags assenti / null / undefined → {}", () => {
    expect(normalizeTags(undefined)).toEqual({});
    expect(normalizeTags(null)).toEqual({});
  });
  it("coercizione valori a stringa + value null → ''", () => {
    expect(normalizeTags({ threshold: 7 })).toEqual({ threshold: "7" });
    expect(normalizeTags([{ name: "x", value: null }])).toEqual({ x: "" });
  });
  it("shape inatteso (numero, item array malformati) → ignora senza throw", () => {
    expect(normalizeTags(42)).toEqual({});
    expect(normalizeTags([{ nope: "1" }, "junk", null])).toEqual({});
  });
});

describe("emailLogStatusForEvent — mapping al CHECK email_log", () => {
  it("delivered → 'delivered', bounced → 'bounced', failed → 'failed' (tutti nel CHECK)", () => {
    expect(emailLogStatusForEvent("email.delivered")).toBe("delivered");
    expect(emailLogStatusForEvent("email.bounced")).toBe("bounced");
    expect(emailLogStatusForEvent("email.failed")).toBe("failed");
  });
  it("tutti gli altri event_type → null (non toccare email_log)", () => {
    for (const t of ["email.sent", "email.complained", "email.delivery_delayed", "email.opened", "email.clicked"]) {
      expect(emailLogStatusForEvent(t)).toBeNull();
    }
    expect(emailLogStatusForEvent("email.unknown")).toBeNull();
  });
});

describe("parseResendEvent — estrazione difensiva", () => {
  it("delivered: estrae eventType, emailId, recipient, userId, threshold, category, occurredAt", () => {
    const r = parseResendEvent(payload({ type: "email.delivered" }));
    expect(r.eventType).toBe("email.delivered");
    expect(r.emailId).toBe("msg_abc");
    expect(r.recipient).toBe("mario@example.com");
    expect(r.userId).toBe(UID);
    expect(r.threshold).toBe(7);
    expect(r.category).toBe("deadline_reminder");
    expect(r.occurredAt).toBe("2026-06-27T09:00:00.000Z");
    expect(r.clickedUrl).toBeNull();
    expect(r.bounceType).toBeNull();
  });

  it("occurredAt = top-level created_at, NON data.created_at", () => {
    const r = parseResendEvent(
      payload({ created_at: "2026-06-27T10:00:00.000Z", data: { created_at: "1999-01-01T00:00:00.000Z" } }),
    );
    expect(r.occurredAt).toBe("2026-06-27T10:00:00.000Z");
  });

  it("occurredAt: created_at non-parsabile → null (caller usa now(), anti retry-storm timestamptz)", () => {
    expect(parseResendEvent(payload({ created_at: "non-una-data" })).occurredAt).toBeNull();
    expect(parseResendEvent(payload({ created_at: "" })).occurredAt).toBeNull();
  });

  it("recipient: data.to come stringa singola", () => {
    const r = parseResendEvent(payload({ to: "solo@example.com" }));
    expect(r.recipient).toBe("solo@example.com");
  });

  it("user_id mancante nei tags → userId null (email non-scadenza)", () => {
    const r = parseResendEvent(payload({ tags: { category: "broadcast" } }));
    expect(r.userId).toBeNull();
    expect(r.category).toBe("broadcast");
    expect(r.threshold).toBeNull();
  });

  it("user_id NON-UUID → null (anti retry-storm, §user_id)", () => {
    const r = parseResendEvent(payload({ tags: { user_id: "DROP TABLE users", category: "x" } }));
    expect(r.userId).toBeNull();
  });

  it("threshold non-numerico → null", () => {
    const r = parseResendEvent(payload({ tags: { threshold: "abc", user_id: UID } }));
    expect(r.threshold).toBeNull();
    expect(r.userId).toBe(UID);
  });

  it("clicked: estrae clickedUrl da data.click.link (solo per email.clicked)", () => {
    const r = parseResendEvent(payload({ type: "email.clicked", data: { click: { link: "https://forfettino.it/scadenziario" } } }));
    expect(r.eventType).toBe("email.clicked");
    expect(r.clickedUrl).toBe("https://forfettino.it/scadenziario");
  });

  it("clicked: fallback su data.link se data.click assente", () => {
    const r = parseResendEvent(payload({ type: "email.clicked", data: { link: "https://forfettino.it/x" } }));
    expect(r.clickedUrl).toBe("https://forfettino.it/x");
  });

  it("bounced: estrae bounceType da data.bounce.type (solo per email.bounced)", () => {
    const r = parseResendEvent(payload({ type: "email.bounced", data: { bounce: { type: "hard" } } }));
    expect(r.eventType).toBe("email.bounced");
    expect(r.bounceType).toBe("hard");
  });

  it("payload vuoto / malformato → tutti i campi null senza throw", () => {
    expect(() => parseResendEvent(null)).not.toThrow();
    const r = parseResendEvent({});
    expect(r.eventType).toBe("");
    expect(r.emailId).toBeNull();
    expect(r.recipient).toBeNull();
    expect(r.userId).toBeNull();
    expect(r.occurredAt).toBeNull();
  });

  it("tags in forma array (difensivo) → estrae comunque", () => {
    const r = parseResendEvent(
      payload({ tags: [{ name: "user_id", value: UID }, { name: "threshold", value: "3" }] }),
    );
    expect(r.userId).toBe(UID);
    expect(r.threshold).toBe(3);
  });
});

describe("idempotenza — parse puro/deterministico (svix_id è la dedup key, non data.email_id)", () => {
  it("stesso payload → parse identico (un retry Resend produce la STESSA riga email_events)", () => {
    const p = payload({ type: "email.delivered" });
    expect(parseResendEvent(p)).toEqual(parseResendEvent(p));
  });
  it("eventi diversi condividono lo stesso email_id → email_id NON può essere dedup key (serve svix_id)", () => {
    // delivered e opened dello STESSO messaggio hanno lo stesso data.email_id ma sono due
    // eventi distinti → la dedup deve essere su svix-id (UNIQUE), non su resend_message_id.
    const delivered = parseResendEvent(payload({ type: "email.delivered", email_id: "msg_X" }));
    const opened = parseResendEvent(payload({ type: "email.opened", email_id: "msg_X" }));
    expect(delivered.emailId).toBe(opened.emailId);
    expect(delivered.eventType).not.toBe(opened.eventType);
  });
});

describe("aggregateEvents — conteggi base (AC#7)", () => {
  const rows: EmailEventLike[] = [
    { event_type: "email.sent", category: "deadline_reminder", threshold: 7 },
    { event_type: "email.delivered", category: "deadline_reminder", threshold: 7 },
    { event_type: "email.delivered", category: "deadline_reminder", threshold: 3 },
    { event_type: "email.bounced", category: "deadline_reminder", threshold: 0 },
    { event_type: "email.complained", category: "broadcast", threshold: null },
    { event_type: "email.opened", category: "deadline_reminder", threshold: 7 },
  ];

  it("conteggi per event_type + scorciatoie recapito", () => {
    const s = aggregateEvents(rows);
    expect(s.total).toBe(6);
    expect(s.delivered).toBe(2);
    expect(s.bounced).toBe(1);
    expect(s.complained).toBe(1);
    expect(s.opened).toBe(1);
    expect(s.clicked).toBe(0);
    expect(s.byEventType["email.sent"]).toBe(1);
  });

  it("breakdown per campagna (category:threshold)", () => {
    const s = aggregateEvents(rows);
    expect(s.byCampaign["deadline_reminder:7"]).toEqual({
      "email.sent": 1,
      "email.delivered": 1,
      "email.opened": 1,
    });
    expect(s.byCampaign["deadline_reminder:3"]).toEqual({ "email.delivered": 1 });
    expect(s.byCampaign["broadcast:na"]).toEqual({ "email.complained": 1 });
  });

  it("dataset vuoto → zeri", () => {
    const s = aggregateEvents([]);
    expect(s.total).toBe(0);
    expect(s.delivered).toBe(0);
    expect(s.byEventType).toEqual({});
  });
});

describe("RESEND_EVENT_TYPES — copertura completa degli 8 eventi", () => {
  it("contiene tutti gli 8 event type Resend gestiti", () => {
    expect(RESEND_EVENT_TYPES).toEqual([
      "email.sent",
      "email.delivered",
      "email.delivery_delayed",
      "email.bounced",
      "email.complained",
      "email.failed",
      "email.opened",
      "email.clicked",
    ]);
  });
});
