/**
 * Focused test for benchmark_viewed analytics tracking (Story 46.3, AC 1 + AC 6).
 * Uses simplified Select mocks (native HTML) to bypass Radix jsdom limitations.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { PRO_SUBSCRIPTION } from "@/test/mock-subscription";

// ── Module mocks ──

const mockUseSubscription = vi.fn(() => PRO_SUBSCRIPTION);
const mockUseUserRole = vi.fn(() => ({ data: "user", isLoading: false }));
const mockUseFiscalCalculations = vi.fn(() => ({
  metrics: { incassiYTD: 0 },
  isLoading: false,
}));
const mockFormatCurrency = vi.fn((v: number) => `€${(v / 100).toFixed(2)}`);
const mockUseIsMobile = vi.fn(() => false);
const mockUseFiscalYear = vi.fn(() => ({ selectedYear: 2026, setSelectedYear: vi.fn() }));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => mockUseSubscription(),
}));
vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: () => mockUseUserRole(),
}));
vi.mock("@/hooks/useFiscalCalculations", () => ({
  useFiscalCalculations: () => mockUseFiscalCalculations(),
  formatCurrency: (v: number) => mockFormatCurrency(v),
}));
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mockUseIsMobile(),
}));
vi.mock("@/contexts/FiscalYearContext", () => ({
  useFiscalYear: () => mockUseFiscalYear(),
}));
vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: ReactNode }) =>
    createElement("div", { "data-testid": "app-layout" }, children),
}));
vi.mock("@/components/layout/MobileHeader", () => ({
  MobileHeader: ({ title }: { title: string }) =>
    createElement("div", null, title),
}));
vi.mock("@/components/layout/PageContainer", () => ({
  PageContainer: ({ children }: { children: ReactNode }) =>
    createElement("div", null, children),
}));
vi.mock("@/components/subscription/ProGateOverlay", () => ({
  ProGateOverlay: ({ children }: { children: ReactNode }) => {
    // In tracking tests, always pass-through (PRO user default)
    return createElement("div", null, children);
  },
}));

// Mock analytics
const mockTrack = vi.fn();
vi.mock("@/lib/analytics", () => ({
  track: (...args: unknown[]) => mockTrack(...args),
}));

// Mock computeBenchmark to return a result when filters match
vi.mock("@/lib/benchmark-engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/benchmark-engine")>();
  return {
    ...actual,
    computeBenchmark: (...args: unknown[]) => actual.computeBenchmark(...(args as Parameters<typeof actual.computeBenchmark>)),
  };
});

// Mock data
vi.mock("@/data/benchmark-aggregated.json", () => ({
  default: {
    meta: { totalRecords: 100, validRecords: 90, generatedAt: "2026-03-18", jobTitles: ["backend_developer"], provinces: ["Milano"], source: "Test" },
    data: {
      backend_developer: { _all: { _all: { median: 38000, p25: 30000, p75: 48000, count: 100 } } },
    },
  },
}));

// ── Key mock: Replace Radix Select with native HTML select ──
vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: { value: string; onValueChange: (v: string) => void; children: ReactNode }) =>
    createElement("div", null,
      createElement("select", {
        "data-testid": "native-select",
        value: value || "",
        onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onValueChange(e.target.value),
      },
        createElement("option", { value: "" }, "Seleziona..."),
        createElement("option", { value: "backend_developer" }, "Backend Developer"),
      ),
      children,
    ),
  SelectTrigger: ({ children }: { children: ReactNode }) => createElement("div", null, children),
  SelectContent: ({ children }: { children: ReactNode }) => createElement("div", null, children),
  SelectGroup: ({ children }: { children: ReactNode }) => createElement("div", null, children),
  SelectItem: ({ children }: { children: ReactNode; value: string }) => createElement("div", null, children),
  SelectLabel: ({ children }: { children: ReactNode }) => createElement("div", null, children),
  SelectValue: ({ placeholder }: { placeholder?: string }) => createElement("span", null, placeholder),
}));

// Mock RadioGroup as simple divs
vi.mock("@/components/ui/radio-group", () => ({
  RadioGroup: ({ children }: { children: ReactNode }) => createElement("div", null, children),
  RadioGroupItem: () => createElement("input", { type: "radio" }),
}));

// Mock Popover/Command components (used by JobTitleCombobox) as native select
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: ReactNode }) => createElement("div", null, children),
  PopoverTrigger: ({ children }: { children: ReactNode }) => createElement("div", null, children),
  PopoverContent: ({ children }: { children: ReactNode }) => createElement("div", null, children),
}));
vi.mock("@/components/ui/command", () => ({
  Command: ({ children }: { children: ReactNode }) => createElement("div", null, children),
  CommandInput: () => null,
  CommandList: ({ children }: { children: ReactNode }) => createElement("div", null, children),
  CommandEmpty: () => null,
  CommandGroup: ({ children }: { children: ReactNode }) => createElement("div", null, children),
  CommandItem: ({ children, onSelect, value }: { children: ReactNode; onSelect: () => void; value?: string }) =>
    createElement("button", { "data-testid": `job-option-${value ?? ""}`, onClick: onSelect }, children),
}));

// ── Import after mocks ──
import Benchmark from "./Benchmark";

function renderBenchmark() {
  return render(
    <MemoryRouter initialEntries={["/benchmark"]}>
      <Benchmark />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseSubscription.mockReturnValue(PRO_SUBSCRIPTION);
  mockUseUserRole.mockReturnValue({ data: "user", isLoading: false });
  mockUseFiscalCalculations.mockReturnValue({ metrics: { incassiYTD: 0 }, isLoading: false });
  mockUseFiscalYear.mockReturnValue({ selectedYear: 2026, setSelectedYear: vi.fn() });
});

describe("Benchmark — Track positive case (Story 46.3)", () => {
  it("calls track('benchmark_viewed') with correct props when a role is selected", () => {
    renderBenchmark();

    // Select a role via the mocked CommandItem button
    const jobOption = screen.getByTestId("job-option-Backend Developer");
    fireEvent.click(jobOption);

    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith("benchmark_viewed", {
      jobTitle: "backend_developer",
      province: undefined,
      experienceBand: undefined,
      personalHourlyRate: undefined,
    });
  });

  it("includes personalHourlyRate in props when personal comparison is visible", () => {
    // 500000 centesimi = 5000€ incassi
    mockUseFiscalCalculations.mockReturnValue({ metrics: { incassiYTD: 500000 }, isLoading: false });
    renderBenchmark();

    const jobOption = screen.getByTestId("job-option-Backend Developer");
    fireEvent.click(jobOption);

    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith(
      "benchmark_viewed",
      expect.objectContaining({
        jobTitle: "backend_developer",
        personalHourlyRate: expect.any(Number),
      }),
    );
    // Verify personalHourlyRate is a positive number
    const props = mockTrack.mock.calls[0][1];
    expect(props.personalHourlyRate).toBeGreaterThan(0);
  });

  it("does NOT re-track when same filters are selected twice", () => {
    renderBenchmark();

    const jobOption = screen.getByTestId("job-option-Backend Developer");
    fireEvent.click(jobOption);
    expect(mockTrack).toHaveBeenCalledTimes(1);

    // Re-select same value — should NOT fire again (useRef dedup)
    fireEvent.click(jobOption);
    expect(mockTrack).toHaveBeenCalledTimes(1);
  });
});
