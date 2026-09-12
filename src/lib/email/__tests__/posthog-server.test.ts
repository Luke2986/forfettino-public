import { describe, it, expect } from "vitest";
// Logica pura cross-runtime dell'EF 84-6 (import per path relativo, come deadline-email-logic).
import {
  buildCapturePayload,
  buildDeadlineEmailSentProps,
  DEFAULT_POSTHOG_HOST,
} from "../../../../supabase/functions/_shared/posthog-server.ts";

describe("buildCapturePayload — forma /capture/", () => {
  it("produce { api_key, event, distinct_id, properties, timestamp }", () => {
    const payload = buildCapturePayload({
      apiKey: "phc_test",
      event: "deadline_email_sent",
      distinctId: "user-uuid-1",
      properties: { campaign: "scadenza_saldo_tax_7", threshold: 7 },
      timestamp: "2026-06-27T09:00:00.000Z",
    });
    expect(payload).toEqual({
      api_key: "phc_test",
      event: "deadline_email_sent",
      distinct_id: "user-uuid-1",
      properties: { campaign: "scadenza_saldo_tax_7", threshold: 7 },
      timestamp: "2026-06-27T09:00:00.000Z",
    });
  });

  it("properties default a {} quando omesse", () => {
    const payload = buildCapturePayload({
      apiKey: "phc_test",
      event: "e",
      distinctId: "d",
      timestamp: "2026-06-27T09:00:00.000Z",
    });
    expect(payload.properties).toEqual({});
  });

  it("difensivo: input nullish → stringhe vuote, mai throw", () => {
    const payload = buildCapturePayload({
      apiKey: undefined as unknown as string,
      event: undefined as unknown as string,
      distinctId: undefined as unknown as string,
      timestamp: undefined as unknown as string,
    });
    expect(payload.api_key).toBe("");
    expect(payload.event).toBe("");
    expect(payload.distinct_id).toBe("");
    expect(payload.timestamp).toBe("");
    expect(payload.properties).toEqual({});
  });

  it("DEFAULT_POSTHOG_HOST coerente col client", () => {
    expect(DEFAULT_POSTHOG_HOST).toBe("https://eu.i.posthog.com");
  });
});

describe("buildDeadlineEmailSentProps — property evento", () => {
  it("mappa campaign/bucket/threshold/days_until/batch_id con tipi corretti", () => {
    const props = buildDeadlineEmailSentProps({
      campaign: "scadenza_saldo_tax_7",
      bucket: "saldo_tax",
      threshold: 7,
      daysUntil: 7,
      batchId: "batch-uuid",
    });
    expect(props).toEqual({
      campaign: "scadenza_saldo_tax_7",
      bucket: "saldo_tax",
      threshold: 7,
      days_until: 7,
      batch_id: "batch-uuid",
    });
    expect(typeof props.threshold).toBe("number");
    expect(typeof props.days_until).toBe("number");
  });

  it("threshold 0 (scadenza odierna) resta numerico", () => {
    const props = buildDeadlineEmailSentProps({
      campaign: "scadenza_inps_q3_0",
      bucket: "inps_q3",
      threshold: 0,
      daysUntil: 0,
      batchId: "b",
    });
    expect(props.threshold).toBe(0);
    expect(props.days_until).toBe(0);
  });

  it("NON contiene PII (no email/nome)", () => {
    const props = buildDeadlineEmailSentProps({
      campaign: "scadenza_june_30",
      bucket: "june",
      threshold: 30,
      daysUntil: 30,
      batchId: "b",
    });
    expect(Object.keys(props).sort()).toEqual([
      "batch_id",
      "bucket",
      "campaign",
      "days_until",
      "threshold",
    ]);
  });
});
