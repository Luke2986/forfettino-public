/**
 * Test per FiscalYearContext
 * Copertura:
 * - P0: useFiscalYear throws quando usato fuori dal Provider
 * - P0: Default selectedYear = anno corrente
 * - P0: setSelectedYear cambia l'anno
 * - P2: Figli multipli condividono lo stesso stato
 *
 * NOTA: availableYears rimosso dal context in Story 23.1 — ora fornito da useAvailableYears()
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";
import { FiscalYearProvider, useFiscalYear } from "@/contexts/FiscalYearContext";

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(FiscalYearProvider, null, children);

// FiscalYearContext computes currentYear at module-level via new Date().getFullYear().
// This runs once at import time with the real system clock, so we capture the same
// value here to keep assertions in sync regardless of the real system date.
const REAL_CURRENT_YEAR = new Date().getFullYear();

describe("FiscalYearContext", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("[P0] useFiscalYear fuori dal Provider", () => {
    it("lancia Error quando usato senza FiscalYearProvider", () => {
      // Sopprime console.error di React per rendere l'output pulito
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      expect(() => {
        renderHook(() => useFiscalYear());
      }).toThrow("useFiscalYear must be used within a FiscalYearProvider");

      spy.mockRestore();
    });
  });

  describe("[P0] Default selectedYear", () => {
    it("selectedYear di default e' l'anno corrente", () => {
      const { result } = renderHook(() => useFiscalYear(), { wrapper });

      expect(result.current.selectedYear).toBe(REAL_CURRENT_YEAR);
    });
  });

  describe("[P0] setSelectedYear", () => {
    it("cambia selectedYear quando si chiama setSelectedYear", () => {
      const { result } = renderHook(() => useFiscalYear(), { wrapper });

      expect(result.current.selectedYear).toBe(REAL_CURRENT_YEAR);

      act(() => {
        result.current.setSelectedYear(2024);
      });

      expect(result.current.selectedYear).toBe(2024);
    });

    it("permette di impostare un anno futuro", () => {
      const { result } = renderHook(() => useFiscalYear(), { wrapper });

      act(() => {
        result.current.setSelectedYear(REAL_CURRENT_YEAR + 5);
      });

      expect(result.current.selectedYear).toBe(REAL_CURRENT_YEAR + 5);
    });

    it("permette di impostare un anno passato", () => {
      const { result } = renderHook(() => useFiscalYear(), { wrapper });

      act(() => {
        result.current.setSelectedYear(2020);
      });

      expect(result.current.selectedYear).toBe(2020);
    });
  });

  describe("[P2] Stato condiviso tra figli multipli", () => {
    it("due hook nello stesso Provider condividono lo stesso selectedYear", () => {
      const sharedWrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(FiscalYearProvider, null, children);

      const { result: result1 } = renderHook(() => useFiscalYear(), {
        wrapper: sharedWrapper,
      });

      const { result: result2 } = renderHook(() => useFiscalYear(), {
        wrapper: sharedWrapper,
      });

      // Entrambi partono con lo stesso anno di default
      expect(result1.current.selectedYear).toBe(result2.current.selectedYear);
    });

    it("setSelectedYear aggiorna lo stato per tutti i consumer dello stesso Provider", () => {
      function useDoubleConsumer() {
        const first = useFiscalYear();
        const second = useFiscalYear();
        return { first, second };
      }

      const { result } = renderHook(() => useDoubleConsumer(), { wrapper });

      expect(result.current.first.selectedYear).toBe(REAL_CURRENT_YEAR);
      expect(result.current.second.selectedYear).toBe(REAL_CURRENT_YEAR);

      act(() => {
        result.current.first.setSelectedYear(2024);
      });

      // Entrambi i consumer vedono il nuovo valore
      expect(result.current.first.selectedYear).toBe(2024);
      expect(result.current.second.selectedYear).toBe(2024);
    });
  });
});
