import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { StrictMode } from "react";
import { render, cleanup } from "@testing-library/react";

// ── Hoisted mocks: posthog.capture + isPosthogReady flippabile via getter ──
const { mockCapture, state } = vi.hoisted(() => ({
  mockCapture: vi.fn(),
  state: { ready: true },
}));

vi.mock("@/lib/posthog", () => ({
  get isPosthogReady() {
    return state.ready;
  },
  posthog: { capture: mockCapture },
}));

import { EmailClickTracker } from "../EmailClickTracker";

function setSearch(search: string) {
  window.history.replaceState({}, "", `/scadenziario${search}`);
}

describe("EmailClickTracker — deadline_email_clicked (84-6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.ready = true;
    window.sessionStorage.clear();
    setSearch("");
  });

  afterEach(() => {
    cleanup();
  });

  it("utm_source=email + campaign valido → capture una volta con campaign/bucket/threshold", () => {
    setSearch("?utm_source=email&utm_campaign=scadenza_saldo_tax_7");
    render(<EmailClickTracker />);

    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(mockCapture).toHaveBeenCalledWith("deadline_email_clicked", {
      campaign: "scadenza_saldo_tax_7",
      bucket: "saldo_tax",
      threshold: 7,
    });
  });

  it("senza utm_source=email → nessuna capture", () => {
    setSearch("?utm_source=google&utm_campaign=scadenza_saldo_tax_7");
    render(<EmailClickTracker />);
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("nessun query string → nessuna capture", () => {
    setSearch("");
    render(<EmailClickTracker />);
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("utm_source=email senza utm_campaign → no capture (link non canonico, L2)", () => {
    setSearch("?utm_source=email");
    render(<EmailClickTracker />);
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("dedup: due render con stesso campaign → una sola capture (sessionStorage)", () => {
    setSearch("?utm_source=email&utm_campaign=scadenza_inps_q3_3");
    const first = render(<EmailClickTracker />);
    first.unmount();
    render(<EmailClickTracker />);
    expect(mockCapture).toHaveBeenCalledTimes(1);
  });

  it("StrictMode (doppio mount effetto) → una sola capture", () => {
    setSearch("?utm_source=email&utm_campaign=scadenza_june_30");
    render(
      <StrictMode>
        <EmailClickTracker />
      </StrictMode>,
    );
    expect(mockCapture).toHaveBeenCalledTimes(1);
  });

  it("isPosthogReady=false → no-op, nessuna capture, nessun crash", () => {
    state.ready = false;
    setSearch("?utm_source=email&utm_campaign=scadenza_saldo_tax_7");
    expect(() => render(<EmailClickTracker />)).not.toThrow();
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("campaign malformato → capture col solo campaign (no bucket/threshold), nessun throw", () => {
    setSearch("?utm_source=email&utm_campaign=scadenza_bad");
    expect(() => render(<EmailClickTracker />)).not.toThrow();
    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(mockCapture).toHaveBeenCalledWith("deadline_email_clicked", {
      campaign: "scadenza_bad",
    });
  });
});
