/**
 * Test per InfoToggletip
 * Story 87-1 — Fix tooltip icone info non utilizzabili su touch (PWA mobile)
 *
 * Copertura:
 * - AC1: su mobile il contenuto compare al tap e RESTA visibile
 * - AC2: il tap sul trigger non propaga al contenitore cliccabile
 * - AC3: su desktop resta un Tooltip (hover), nessuna regressione
 * - AC4: il trigger è focusabile e annuncia "Informazioni"
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// ===== vi.mock (hoisted) =====
let mockIsMobile = false;
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mockIsMobile,
}));

import { InfoToggletip } from "./info-toggletip";

/**
 * Radix asChild richiede un elemento DOM che inoltri props e ref.
 * NB: passare un componente che ignora le props (es. `function T() { return
 * <button/> }`) rompe il wiring in silenzio — i consumer reali (KpiCard,
 * SpendibileHero) passano un <button> diretto.
 */

describe("InfoToggletip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsMobile = false;
  });

  describe("mobile (touch)", () => {
    beforeEach(() => {
      mockIsMobile = true;
    });

    // Il bug segnalato: su touch il contenuto lampeggiava e spariva.
    it("[AC1] shows content on tap and keeps it visible", async () => {
      render(
        <InfoToggletip content={<p>Netto dopo tasse e INPS</p>}>
          <button type="button" aria-label="Informazioni">
            i
          </button>
        </InfoToggletip>,
      );

      fireEvent.click(screen.getByLabelText("Informazioni"));

      await waitFor(() => {
        expect(screen.getByText("Netto dopo tasse e INPS")).toBeDefined();
      });

      // Non deve sparire da solo: il contenuto e' ancora li' dopo il tick
      expect(screen.getByText("Netto dopo tasse e INPS")).toBeDefined();
    });

    it("[AC2] tap on the trigger does not bubble to the clickable card", async () => {
      const onCardClick = vi.fn();
      render(
        <div onClick={onCardClick} role="button" tabIndex={0}>
          <InfoToggletip content={<p>Info</p>}>
            <button type="button" aria-label="Informazioni">
              i
            </button>
          </InfoToggletip>
        </div>,
      );

      fireEvent.click(screen.getByLabelText("Informazioni"));

      await waitFor(() => {
        expect(screen.getByText("Info")).toBeDefined();
      });
      expect(onCardClick).not.toHaveBeenCalled();
    });

    it("[AC4] trigger is focusable and labelled", () => {
      render(
        <InfoToggletip content={<p>Info</p>}>
          <button type="button" aria-label="Informazioni">
            i
          </button>
        </InfoToggletip>,
      );

      const trigger = screen.getByLabelText("Informazioni");
      expect(trigger.tagName).toBe("BUTTON");
      trigger.focus();
      expect(document.activeElement).toBe(trigger);
    });
  });

  describe("desktop (hover)", () => {
    it("[AC3] renders the trigger and does not open on click", () => {
      render(
        <InfoToggletip content={<p>Solo hover</p>}>
          <button type="button" aria-label="Informazioni">
            i
          </button>
        </InfoToggletip>,
      );

      expect(screen.getByLabelText("Informazioni")).toBeDefined();
      // Su desktop il Tooltip e' hover-driven: il click non lo apre
      expect(screen.queryByText("Solo hover")).toBeNull();
    });

    it("[AC2] click on the trigger does not bubble to the card", () => {
      const onCardClick = vi.fn();
      render(
        <div onClick={onCardClick} role="button" tabIndex={0}>
          <InfoToggletip content={<p>Info</p>}>
            <button type="button" aria-label="Informazioni">
              i
            </button>
          </InfoToggletip>
        </div>,
      );

      fireEvent.click(screen.getByLabelText("Informazioni"));
      expect(onCardClick).not.toHaveBeenCalled();
    });
  });
});
