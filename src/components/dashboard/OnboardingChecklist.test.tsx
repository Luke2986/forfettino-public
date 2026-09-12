import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OnboardingChecklist } from "./OnboardingChecklist";
import type { OnboardingChecklistResult } from "@/hooks/useOnboardingChecklist";

// Mock the hook
vi.mock("@/hooks/useOnboardingChecklist", () => ({
  useOnboardingChecklist: vi.fn(),
}));

import { useOnboardingChecklist } from "@/hooks/useOnboardingChecklist";

const mockHook = vi.mocked(useOnboardingChecklist);

function buildResult(overrides: Partial<OnboardingChecklistResult> = {}): OnboardingChecklistResult {
  return {
    items: [
      { id: "profile-complete", label: "Profilo completato", completed: true },
      { id: "gestione-inps", label: "Gestione INPS selezionata", completed: true },
      { id: "fiscal-data", label: "Dati fiscali configurati", completed: false },
      { id: "first-receipt", label: "Primo incasso registrato", completed: false },
      { id: "schedule-viewed", label: "Scadenziario attivo", completed: false },
    ],
    percentage: 40,
    isComplete: false,
    isDismissed: false,
    isLoading: false,
    dismiss: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("OnboardingChecklist", () => {
  describe("4.4 — render con items misti completati/pending", () => {
    it("mostra il titolo 'Il tuo progresso'", () => {
      mockHook.mockReturnValue(buildResult());
      render(<OnboardingChecklist />);
      expect(screen.getByText("Il tuo progresso")).toBeTruthy();
    });

    it("mostra la percentuale di completamento", () => {
      mockHook.mockReturnValue(buildResult({ percentage: 40 }));
      render(<OnboardingChecklist />);
      expect(screen.getByText(/40%/)).toBeTruthy();
    });

    it("mostra tutti gli items con label corrette", () => {
      mockHook.mockReturnValue(buildResult());
      render(<OnboardingChecklist />);
      expect(screen.getByText("Profilo completato")).toBeTruthy();
      expect(screen.getByText("Gestione INPS selezionata")).toBeTruthy();
      expect(screen.getByText("Dati fiscali configurati")).toBeTruthy();
      expect(screen.getByText("Primo incasso registrato")).toBeTruthy();
      expect(screen.getByText("Scadenziario attivo")).toBeTruthy();
    });

    it("non renderizza nulla se loading", () => {
      mockHook.mockReturnValue(buildResult({ isLoading: true }));
      const { container } = render(<OnboardingChecklist />);
      expect(container.innerHTML).toBe("");
    });

    it("non renderizza nulla se dismissed", () => {
      mockHook.mockReturnValue(buildResult({ isDismissed: true }));
      const { container } = render(<OnboardingChecklist />);
      expect(container.innerHTML).toBe("");
    });

    it("non renderizza nulla se nessun item", () => {
      mockHook.mockReturnValue(buildResult({ items: [] }));
      const { container } = render(<OnboardingChecklist />);
      expect(container.innerHTML).toBe("");
    });
  });

  describe("4.5 — dismiss nasconde checklist", () => {
    it("bottone dismiss chiama la funzione dismiss", () => {
      const dismissFn = vi.fn();
      mockHook.mockReturnValue(
        buildResult({
          isComplete: true,
          percentage: 100,
          items: [
            { id: "a", label: "Step A", completed: true },
            { id: "b", label: "Step B", completed: true },
          ],
          dismiss: dismissFn,
        })
      );
      render(<OnboardingChecklist />);
      const btn = screen.getByRole("button", { name: /chiudi/i });
      fireEvent.click(btn);
      expect(dismissFn).toHaveBeenCalledTimes(1);
    });
  });

  describe("4.6 — 'Tutto pronto!' visibile solo a 100%", () => {
    it("mostra 'Tutto pronto!' e bottone chiudi quando 100%", () => {
      mockHook.mockReturnValue(
        buildResult({
          isComplete: true,
          percentage: 100,
          items: [
            { id: "a", label: "Step A", completed: true },
          ],
        })
      );
      render(<OnboardingChecklist />);
      expect(screen.getByText(/Tutto pronto/)).toBeTruthy();
      expect(screen.getByRole("button", { name: /chiudi/i })).toBeTruthy();
    });

    it("non mostra 'Tutto pronto!' quando sotto 100%", () => {
      mockHook.mockReturnValue(buildResult({ isComplete: false, percentage: 60 }));
      render(<OnboardingChecklist />);
      expect(screen.queryByText(/Tutto pronto/)).toBeNull();
    });

    it("non mostra bottone chiudi quando sotto 100%", () => {
      mockHook.mockReturnValue(buildResult({ isComplete: false, percentage: 60 }));
      render(<OnboardingChecklist />);
      expect(screen.queryByRole("button", { name: /chiudi/i })).toBeNull();
    });
  });

  describe("accessibilità", () => {
    it("Progress bar ha aria-label con percentuale", () => {
      mockHook.mockReturnValue(buildResult({ percentage: 40 }));
      render(<OnboardingChecklist />);
      const progress = screen.getByRole("progressbar");
      expect(progress.getAttribute("aria-label")).toMatch(/40%/);
    });

    it("lista items usa role='list'", () => {
      mockHook.mockReturnValue(buildResult());
      render(<OnboardingChecklist />);
      const list = screen.getByRole("list");
      expect(list).toBeTruthy();
    });
  });
});
