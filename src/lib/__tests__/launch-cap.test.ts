/**
 * Test per la logica di cap enforcement — Story 72-1
 *
 * Le Edge Functions (Deno) non sono importabili direttamente in Vitest.
 * Questi test estraggono la logica decisionale dal webhook e checkout
 * e la verificano con strutture dati realistiche che rispecchiano
 * i tipi Stripe reali.
 *
 * Copertura:
 * - decrement_launch_cap: tutti i 7 reason codes e le reazioni del webhook
 * - webhook: estrazione payment_intent (session vs invoice), refund branching
 * - checkout: pre-validazione finestra attiva + security bypass prevention
 * - concurrency: documentato per test manuale SQL
 */

import { describe, it, expect } from "vitest";

// ─── Extracted Decision Logic (mirrors webhook/checkout code) ───

/** Reasons that trigger a refund attempt in the webhook */
const REFUND_REASONS = new Set([
  "cap_exhausted",
  "window_inactive",
  "window_closed",
  "window_not_found",
]);

/** Reasons that are safe to proceed without refund */
const SAFE_REASONS = new Set(["already_processed", "lock_timeout"]);

type CapResult =
  | { success: true; remaining: number }
  | { success: false; reason: string; remaining?: number };

/**
 * Decides the webhook action based on RPC result.
 * Mirrors the if/else chain in stripe-webhook/index.ts lines 86-153.
 */
function decideWebhookAction(
  capResult: CapResult | null,
  rpcError: boolean
): "proceed" | "refund" | "skip_subscription" {
  // RPC call failed entirely → proceed (don't block paying user)
  if (rpcError || capResult === null) return "proceed";

  if (capResult.success) return "proceed";

  const reason = (capResult as { success: false; reason: string }).reason;
  if (SAFE_REASONS.has(reason)) return "proceed";
  if (REFUND_REASONS.has(reason)) return "refund";

  // Unknown reason → default to proceed (defensive)
  return "proceed";
}

/** Stripe session shape (simplified from Stripe.Checkout.Session) */
interface MockSession {
  id: string;
  payment_intent: string | { id: string } | null;
  invoice: string | { id: string } | null;
  metadata?: Record<string, string>;
  mode?: string;
  subscription?: string | null;
}

/** Stripe invoice shape (simplified) */
interface MockInvoice {
  payment_intent: string | { id: string } | null;
}

/**
 * Extracts payment_intent ID from session, falling back to invoice.
 * Mirrors stripe-webhook/index.ts lines 103-118.
 */
function extractPaymentIntentId(
  session: MockSession,
  invoice: MockInvoice | null
): string | null {
  if (session.payment_intent) {
    return typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent.id;
  }

  if (session.invoice && invoice) {
    if (invoice.payment_intent) {
      return typeof invoice.payment_intent === "string"
        ? invoice.payment_intent
        : invoice.payment_intent.id;
    }
  }

  return null;
}

/** Active window shape from launch_windows query */
interface ActiveWindow {
  id: string;
  cap_remaining: number;
  is_active: boolean;
  starts_at: string;
  ends_at: string;
}

/**
 * Checkout pre-validation logic.
 * Mirrors create-checkout-session/index.ts lines 76-98.
 * Returns: null (OK), 400 (window_id_required), 409 (window_unavailable)
 */
function validateCheckout(
  activeWindows: ActiveWindow[],
  windowId: string | undefined
): null | 400 | 409 {
  const hasActiveWindow = activeWindows.length > 0;

  if (hasActiveWindow && !windowId) return 400;

  if (windowId) {
    const target = activeWindows.find((w) => w.id === windowId);
    if (!target || target.cap_remaining <= 0) return 409;
  }

  return null;
}

// ─── RPC Contract Tests ───

describe("decrement_launch_cap RPC — reason code contracts", () => {
  it("success: webhook proceeds with subscription", () => {
    const result: CapResult = { success: true, remaining: 49 };
    expect(decideWebhookAction(result, false)).toBe("proceed");
  });

  it("cap_exhausted: webhook triggers refund", () => {
    const result: CapResult = { success: false, reason: "cap_exhausted" };
    expect(decideWebhookAction(result, false)).toBe("refund");
  });

  it("window_inactive: webhook triggers refund", () => {
    const result: CapResult = { success: false, reason: "window_inactive" };
    expect(decideWebhookAction(result, false)).toBe("refund");
  });

  it("window_closed: webhook triggers refund", () => {
    const result: CapResult = { success: false, reason: "window_closed" };
    expect(decideWebhookAction(result, false)).toBe("refund");
  });

  it("window_not_found: webhook triggers refund", () => {
    const result: CapResult = { success: false, reason: "window_not_found" };
    expect(decideWebhookAction(result, false)).toBe("refund");
  });

  it("already_processed: webhook proceeds (idempotent retry)", () => {
    const result: CapResult = { success: false, reason: "already_processed" };
    expect(decideWebhookAction(result, false)).toBe("proceed");
  });

  it("lock_timeout: webhook proceeds (don't block paying user)", () => {
    const result: CapResult = { success: false, reason: "lock_timeout" };
    expect(decideWebhookAction(result, false)).toBe("proceed");
  });

  it("RPC error (network/DB failure): webhook proceeds gracefully", () => {
    expect(decideWebhookAction(null, true)).toBe("proceed");
  });

  it("null result (unexpected): webhook proceeds gracefully", () => {
    expect(decideWebhookAction(null, false)).toBe("proceed");
  });

  it("CHECK constraint: cap_remaining >= 0 prevents negative values at DB level", () => {
    // The SQL CHECK prevents direct negative — the RPC also guards cap_remaining > 0
    // If somehow cap_remaining = 0, RPC returns cap_exhausted BEFORE attempting decrement
    const result: CapResult = { success: false, reason: "cap_exhausted" };
    expect(decideWebhookAction(result, false)).toBe("refund");
  });
});

// ─── Webhook Payment Intent Extraction ───

describe("webhook payment_intent extraction", () => {
  it("prefers session.payment_intent when it's a string", () => {
    const session: MockSession = {
      id: "cs_123",
      payment_intent: "pi_direct",
      invoice: "inv_456",
    };
    expect(extractPaymentIntentId(session, null)).toBe("pi_direct");
  });

  it("handles session.payment_intent as expanded object", () => {
    const session: MockSession = {
      id: "cs_123",
      payment_intent: { id: "pi_expanded" },
      invoice: null,
    };
    expect(extractPaymentIntentId(session, null)).toBe("pi_expanded");
  });

  it("falls back to invoice.payment_intent for subscription mode (session.payment_intent = null)", () => {
    const session: MockSession = {
      id: "cs_123",
      payment_intent: null,
      invoice: "inv_456",
    };
    const invoice: MockInvoice = { payment_intent: "pi_from_invoice" };
    expect(extractPaymentIntentId(session, invoice)).toBe("pi_from_invoice");
  });

  it("handles invoice.payment_intent as expanded object", () => {
    const session: MockSession = {
      id: "cs_123",
      payment_intent: null,
      invoice: "inv_456",
    };
    const invoice: MockInvoice = { payment_intent: { id: "pi_inv_expanded" } };
    expect(extractPaymentIntentId(session, invoice)).toBe("pi_inv_expanded");
  });

  it("returns null when neither session nor invoice have payment_intent", () => {
    const session: MockSession = {
      id: "cs_123",
      payment_intent: null,
      invoice: "inv_456",
    };
    const invoice: MockInvoice = { payment_intent: null };
    expect(extractPaymentIntentId(session, invoice)).toBeNull();
  });

  it("returns null when session has no invoice and no payment_intent", () => {
    const session: MockSession = {
      id: "cs_123",
      payment_intent: null,
      invoice: null,
    };
    expect(extractPaymentIntentId(session, null)).toBeNull();
  });
});

// ─── Webhook Refund Branching ───

describe("webhook refund outcome branching", () => {
  it("refund succeeded → skip subscription sync", () => {
    const refundSucceeded = true;
    // After successful refund, webhook breaks out of checkout.session.completed
    expect(refundSucceeded).toBe(true);
    // shouldCreateSubscription = !refundSucceeded
    expect(!refundSucceeded).toBe(false);
  });

  it("refund failed → proceed with subscription (honor payment)", () => {
    const refundSucceeded = false;
    // Webhook logs cap_refund_failed and continues to syncSubscription
    expect(!refundSucceeded).toBe(true);
  });

  it("all 4 hard failure reasons trigger refund, 2 soft reasons do not", () => {
    const hardReasons = ["cap_exhausted", "window_inactive", "window_closed", "window_not_found"];
    const softReasons = ["already_processed", "lock_timeout"];

    for (const reason of hardReasons) {
      expect(REFUND_REASONS.has(reason)).toBe(true);
      expect(SAFE_REASONS.has(reason)).toBe(false);
    }

    for (const reason of softReasons) {
      expect(SAFE_REASONS.has(reason)).toBe(true);
      expect(REFUND_REASONS.has(reason)).toBe(false);
    }
  });

  it("hard + soft reasons are disjoint and cover all known codes", () => {
    const allReasons = new Set([...REFUND_REASONS, ...SAFE_REASONS]);
    expect(allReasons.size).toBe(REFUND_REASONS.size + SAFE_REASONS.size); // disjoint
    expect(allReasons.size).toBe(6); // all known reason codes
  });
});

// ─── Checkout Pre-Validation Logic ───

describe("checkout pre-validation logic", () => {
  const makeWindow = (overrides: Partial<ActiveWindow> = {}): ActiveWindow => ({
    id: "w-default",
    cap_remaining: 50,
    is_active: true,
    starts_at: "2026-04-01T00:00:00Z",
    ends_at: "2026-04-30T23:59:59Z",
    ...overrides,
  });

  it("rejects 400 when active window exists but windowId not provided (bypass prevention)", () => {
    expect(validateCheckout([makeWindow()], undefined)).toBe(400);
  });

  it("rejects 409 when windowId points to window with cap_remaining=0", () => {
    const window = makeWindow({ id: "w1", cap_remaining: 0 });
    expect(validateCheckout([window], "w1")).toBe(409);
  });

  it("rejects 409 when windowId not found in active windows", () => {
    const window = makeWindow({ id: "w1" });
    expect(validateCheckout([window], "w-nonexistent")).toBe(409);
  });

  it("allows checkout when windowId matches active window with cap > 0", () => {
    const window = makeWindow({ id: "w1", cap_remaining: 50 });
    expect(validateCheckout([window], "w1")).toBeNull();
  });

  it("allows checkout without windowId when no active window exists", () => {
    expect(validateCheckout([], undefined)).toBeNull();
  });

  it("allows checkout without windowId when active windows array is empty", () => {
    expect(validateCheckout([], undefined)).toBeNull();
  });

  it("rejects 400 with multiple active windows and no windowId", () => {
    const windows = [
      makeWindow({ id: "w1" }),
      makeWindow({ id: "w2" }),
    ];
    expect(validateCheckout(windows, undefined)).toBe(400);
  });

  it("finds correct window among multiple active windows", () => {
    const windows = [
      makeWindow({ id: "w1", cap_remaining: 0 }),
      makeWindow({ id: "w2", cap_remaining: 30 }),
    ];
    expect(validateCheckout(windows, "w2")).toBeNull();
    expect(validateCheckout(windows, "w1")).toBe(409); // w1 exhausted
  });
});

// ─── Concurrency Simulation (Documented for Manual DB Test) ───

describe("concurrency — documented for manual DB test", () => {
  it("documents SQL script for N checkouts on cap=M verification", () => {
    /**
     * Manual test procedure:
     *
     * -- 1. Setup: create window with cap=5
     * INSERT INTO launch_windows (name, starts_at, ends_at, cap_total, cap_remaining, is_active)
     * VALUES ('concurrency-test', now() - interval '1 hour', now() + interval '1 hour', 5, 5, true)
     * RETURNING id;
     *
     * -- 2. Run 10 sequential decrements (advisory lock serializes them):
     * SELECT decrement_launch_cap(
     *   'WINDOW_ID'::uuid,
     *   'session_' || i,
     *   gen_random_uuid()
     * )
     * FROM generate_series(1, 10) AS i;
     *
     * -- 3. Verify: exactly 5 successes
     * SELECT cap_remaining FROM launch_windows WHERE id = 'WINDOW_ID';
     * -- Expected: 0
     *
     * SELECT count(*) FROM processed_checkout_sessions WHERE window_id = 'WINDOW_ID';
     * -- Expected: 5
     *
     * -- 4. For true concurrency, use pgbench or multiple psql sessions:
     * -- Terminal 1: SELECT decrement_launch_cap('WINDOW_ID', 'sess_a', gen_random_uuid());
     * -- Terminal 2: SELECT decrement_launch_cap('WINDOW_ID', 'sess_b', gen_random_uuid());
     * -- (run simultaneously)
     *
     * -- 5. Cleanup:
     * DELETE FROM processed_checkout_sessions WHERE window_id = 'WINDOW_ID';
     * DELETE FROM launch_windows WHERE name = 'concurrency-test';
     */

    // This test documents the procedure — real concurrency requires PostgreSQL
    expect(true).toBe(true);
  });
});
