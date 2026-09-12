/**
 * Test Story 81-6 — Squircle utility su form primitives + banner inline + alert sistema + Progress.
 * Verifica che `squircle-md`/`squircle-lg`/`squircle-full` sostituisca `rounded-md`/`rounded-lg`/`rounded-xl`/`rounded-2xl`/`rounded-full` su:
 *  - Input/Textarea/SelectTrigger/SelectContent/PasswordInput/Command root → squircle-md
 *  - Progress Root → squircle-full (alias semantico, zero cambio visivo)
 *  - SogliaInline/FirstIncomeBanner → squircle-md
 *  - OnboardingBanner → squircle-lg
 *  - ExpiredRatesBanner → !squircle-lg (override Card primitive `rounded-2xl`)
 *  - Badge/Checkbox/Radio/SelectItem/CommandItem invariati (decisione architetturale)
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";

import { Input } from "../input";
import { Textarea } from "../textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../select";
import { PasswordInput } from "../password-input";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from "../command";
import { Progress } from "../progress";
import { Badge } from "../badge";
import { Checkbox } from "../checkbox";
import { RadioGroup, RadioGroupItem } from "../radio-group";

import { SogliaInline } from "@/components/dashboard/SogliaForfettarioBanner";
import { FirstIncomeBanner } from "@/components/dashboard/FirstIncomeBanner";
import { OnboardingBanner } from "@/components/dashboard/OnboardingBanner";
import { ExpiredRatesBanner } from "@/components/dashboard/ExpiredRatesBanner";

// Mocks shared
vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
  trackAnonymous: vi.fn(),
  setAnalyticsConsent: vi.fn(),
  ANALYTICS_EVENTS: { CHECKLIST_DISMISSED: "checklist_dismissed" },
}));

vi.mock("@/hooks/useFiscalCalculations", () => ({
  formatCurrency: (v: number) => `€ ${v.toLocaleString("en-US")}`,
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@/hooks/useOnboardingChecklist", () => ({
  useOnboardingChecklist: () => ({
    items: [
      { id: "a", label: "x", completed: false },
      { id: "b", label: "y", completed: true },
    ],
    percentage: 50,
    isComplete: false,
    isDismissed: false,
    isLoading: false,
    dismiss: vi.fn(),
  }),
}));

// Regex word-boundary per evitare match parziali (es. "rounded-md" dentro "sm:rounded-md")
const ROUNDED_MD_REGEX = /(?:^|\s)rounded-md(?:\s|$)/;
const ROUNDED_LG_REGEX = /(?:^|\s)rounded-lg(?:\s|$)/;
const ROUNDED_XL_REGEX = /(?:^|\s)rounded-xl(?:\s|$)/;
const ROUNDED_2XL_REGEX = /(?:^|\s)rounded-2xl(?:\s|$)/;
const ROUNDED_FULL_REGEX = /(?:^|\s)rounded-full(?:\s|$)/;

describe("Story 81-6 — Input squircle (AC #1)", () => {
  it("Input ha squircle-md, NON rounded-md", () => {
    const { container } = render(<Input data-testid="i" />);
    const input = container.querySelector("input");
    expect(input?.className).toContain("squircle-md");
    expect(input?.className).not.toMatch(ROUNDED_MD_REGEX);
  });
});

describe("Story 81-6 — Textarea squircle (AC #2)", () => {
  it("Textarea ha squircle-md, NON rounded-md", () => {
    const { container } = render(<Textarea />);
    const textarea = container.querySelector("textarea");
    expect(textarea?.className).toContain("squircle-md");
    expect(textarea?.className).not.toMatch(ROUNDED_MD_REGEX);
  });
});

describe("Story 81-6 — Select squircle (AC #3)", () => {
  it("SelectTrigger ha squircle-md, NON rounded-md", () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="x" />
        </SelectTrigger>
      </Select>,
    );
    const trigger = screen.getByRole("combobox");
    expect(trigger.className).toContain("squircle-md");
    expect(trigger.className).not.toMatch(ROUNDED_MD_REGEX);
  });

  it("SelectContent ha squircle-md, SelectItem mantiene rounded-sm", () => {
    render(
      <Select open>
        <SelectTrigger>
          <SelectValue placeholder="x" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">A</SelectItem>
        </SelectContent>
      </Select>,
    );
    // SelectContent rendered via portal, query all that have squircle-md
    const content = document.body.querySelector('[role="listbox"]');
    expect(content).not.toBeNull();
    const cls = (content as HTMLElement).className;
    expect(cls).toContain("squircle-md");
    expect(cls).not.toMatch(ROUNDED_MD_REGEX);

    const item = document.body.querySelector('[role="option"]');
    expect(item).not.toBeNull();
    expect((item as HTMLElement).className).toContain("rounded-sm");
  });
});

describe("Story 81-6 — PasswordInput squircle (AC #4)", () => {
  it("PasswordInput ha squircle-md, toggle button mantiene rounded-sm", () => {
    const { container } = render(<PasswordInput />);
    const input = container.querySelector("input");
    expect(input?.className).toContain("squircle-md");
    expect(input?.className).not.toMatch(ROUNDED_MD_REGEX);

    const toggle = container.querySelector("button");
    expect(toggle?.className).toContain("rounded-sm");
  });
});

describe("Story 81-6 — Command squircle (AC #5)", () => {
  // jsdom non implementa scrollIntoView, richiesto da cmdk runtime
  beforeAll(() => {
    if (!Element.prototype.scrollIntoView) {
      Element.prototype.scrollIntoView = vi.fn();
    }
  });

  it("Command root ha squircle-md, CommandItem mantiene rounded-sm", () => {
    render(
      <Command>
        <CommandInput />
        <CommandList>
          <CommandItem>x</CommandItem>
        </CommandList>
      </Command>,
    );
    // Command root: cmdk attributes
    const root = document.body.querySelector("[cmdk-root]");
    expect(root).not.toBeNull();
    const cls = (root as HTMLElement).className;
    expect(cls).toContain("squircle-md");
    expect(cls).not.toMatch(ROUNDED_MD_REGEX);

    const item = document.body.querySelector("[cmdk-item]");
    expect(item).not.toBeNull();
    expect((item as HTMLElement).className).toContain("rounded-sm");
  });
});

describe("Story 81-6 — Progress squircle alias (AC #18)", () => {
  it("Progress Root ha squircle-full, NON rounded-full", () => {
    const { container } = render(<Progress value={50} />);
    const root = container.querySelector('[role="progressbar"]');
    expect(root).not.toBeNull();
    const cls = (root as HTMLElement).className;
    expect(cls).toContain("squircle-full");
    expect(cls).not.toMatch(ROUNDED_FULL_REGEX);
  });
});

describe("Story 81-6 — Decisioni invariate (AC #14, #15, #16)", () => {
  it("Badge preserva rounded-full (decisione contraria epic AC #5 — pill aesthetic)", () => {
    const { container } = render(<Badge>Pro</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain("rounded-full");
    expect(badge.className).not.toMatch(/squircle-(sm|md|lg|2xl)/);
  });

  it("Checkbox preserva rounded-sm (epic AC #7 — native form OS look)", () => {
    const { container } = render(<Checkbox />);
    const checkbox = container.querySelector('[role="checkbox"]');
    expect(checkbox?.className).toContain("rounded-sm");
    expect(checkbox?.className).not.toMatch(/squircle-/);
  });

  it("RadioGroupItem preserva rounded-full (epic AC #7 — cerchio nativo)", () => {
    const { container } = render(
      <RadioGroup>
        <RadioGroupItem value="x" />
      </RadioGroup>,
    );
    const radio = container.querySelector('[role="radio"]');
    expect(radio?.className).toContain("rounded-full");
    expect(radio?.className).not.toMatch(/squircle-(sm|md|lg|2xl)/);
  });
});

describe("Story 81-6 — SogliaInline squircle (AC #7)", () => {
  it("SogliaInline outer ha squircle-md, NON rounded-lg", () => {
    const { container } = render(<SogliaInline incassiTotali={50000} />);
    // outer = first child div
    const outer = container.firstChild as HTMLElement;
    expect(outer.className).toContain("squircle-md");
    expect(outer.className).not.toMatch(ROUNDED_LG_REGEX);
  });
});

describe("Story 81-6 — FirstIncomeBanner squircle (AC #8)", () => {
  it("outer ha squircle-md, NON rounded-xl", () => {
    render(
      <FirstIncomeBanner
        spendable={1000}
        futureObligations={500}
        nextYear={2027}
        onDismiss={() => {}}
      />,
    );
    const banner = screen.getByTestId("first-income-banner");
    expect(banner.className).toContain("squircle-md");
    expect(banner.className).not.toMatch(ROUNDED_XL_REGEX);
  });
});

describe("Story 81-6 — OnboardingBanner squircle alert sistema (AC #12)", () => {
  it("outer ha squircle-lg, NON rounded-2xl", () => {
    const { container } = render(<OnboardingBanner />);
    const outer = container.firstChild as HTMLElement;
    expect(outer).not.toBeNull();
    expect(outer.className).toContain("squircle-lg");
    expect(outer.className).not.toMatch(ROUNDED_2XL_REGEX);
  });
});

describe("Story 81-6 — ExpiredRatesBanner !squircle-lg override (AC #13)", () => {
  it("Card outer ha !squircle-lg per override Card primitive", () => {
    render(
      <ExpiredRatesBanner expiredCount={1} isDismissed={false} onDismiss={() => {}} />,
    );
    const alert = screen.getByRole("alert");
    expect(alert.className).toContain("!squircle-lg");
  });
});

// Source-string assertion per banner che richiedono mock setup pesante (useAuth/useProfile/
// supabase chain). Verifica diretta della className statica nel source file — coverage AC senza
// duplicazione mock infra esistente. Pattern accettabile per static className verification.
describe("Story 81-6 — InactiveSurveyBanner squircle (AC #11)", () => {
  it("source contiene squircle-md su success state e default state, NON rounded-lg", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const filePath = path.resolve(
      process.cwd(),
      "src/components/dashboard/InactiveSurveyBanner.tsx",
    );
    const source = await fs.readFile(filePath, "utf-8");
    // Outer container className (success + default state) hanno squircle-md
    const occurrences = source.match(/squircle-md/g) ?? [];
    expect(occurrences.length).toBeGreaterThanOrEqual(2);
    // Nessun rounded-lg standalone su outer (verifica word-boundary)
    expect(source).not.toMatch(/className="[^"]*\brounded-lg\b[^"]*border bg-(emerald|muted)/);
  });
});
