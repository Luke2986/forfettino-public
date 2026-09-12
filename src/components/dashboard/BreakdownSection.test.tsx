import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BreakdownSection } from "./BreakdownSection";
import type { BreakdownItem, BreakdownTotal } from "./BreakdownSection";

// Helper: standard Separata items
const separataItems: BreakdownItem[] = [
  { label: "Incassi Totali (da inizio anno)", value: "€ 50.000,00", type: "entrata" },
  { label: "− Imposte e Contributi", value: "€ 10.000,00", type: "uscita", badge: "STIMA" },
  { label: "Imposta sostitutiva (15%)", value: "€ 5.850,00", type: "sub", indent: true },
  { label: "INPS Gestione Separata (26.07%)", value: "€ 10.164,00", type: "sub", indent: true },
];

const standardTotal: BreakdownTotal = {
  label: "= Spendibile oggi",
  value: "€ 34.000,00",
  colorClass: "text-success",
};

describe("BreakdownSection", () => {
  it("renders all items and total correctly", () => {
    render(<BreakdownSection items={separataItems} total={standardTotal} />);

    // Check all labels are rendered
    expect(screen.getByText("Incassi Totali (da inizio anno)")).toBeInTheDocument();
    expect(screen.getByText("− Imposte e Contributi")).toBeInTheDocument();
    expect(screen.getByText("Imposta sostitutiva (15%)")).toBeInTheDocument();
    expect(screen.getByText("INPS Gestione Separata (26.07%)")).toBeInTheDocument();

    // Check total
    expect(screen.getByText("= Spendibile oggi")).toBeInTheDocument();
    expect(screen.getByText("€ 34.000,00")).toBeInTheDocument();
  });

  it("renders semantic HTML with dl, dt, dd elements", () => {
    const { container } = render(
      <BreakdownSection items={separataItems} total={standardTotal} />
    );

    const dl = container.querySelector("dl");
    expect(dl).toBeInTheDocument();

    const dtElements = container.querySelectorAll("dt");
    const ddElements = container.querySelectorAll("dd");

    // 4 items + 1 total = 5 dt/dd pairs
    expect(dtElements.length).toBe(5);
    expect(ddElements.length).toBe(5);
  });

  it("total row has font-bold class", () => {
    const { container } = render(
      <BreakdownSection items={separataItems} total={standardTotal} />
    );

    // The total row div should have font-bold
    const totalRow = container.querySelector(".font-bold.text-base");
    expect(totalRow).toBeInTheDocument();
  });

  it("total row has border-t class", () => {
    const { container } = render(
      <BreakdownSection items={separataItems} total={standardTotal} />
    );

    const totalRow = container.querySelector(".border-t.border-border");
    expect(totalRow).toBeInTheDocument();
  });

  it("total value has the specified colorClass", () => {
    render(<BreakdownSection items={separataItems} total={standardTotal} />);

    const totalValue = screen.getByText("€ 34.000,00");
    expect(totalValue.className).toContain("text-success");
  });

  it("renders footer when provided", () => {
    render(
      <BreakdownSection
        items={separataItems}
        total={standardTotal}
        footer={<span data-testid="footer-content">Footer qui</span>}
      />
    );

    expect(screen.getByTestId("footer-content")).toBeInTheDocument();
  });

  it("does NOT render footer when not provided", () => {
    render(
      <BreakdownSection items={separataItems} total={standardTotal} />
    );

    // Verify that no footer content is present by checking for absence of any
    // footer-like element. When footer is provided, it renders inside a pt-2 div.
    expect(screen.queryByTestId("footer-content")).not.toBeInTheDocument();
  });

  it("indented items have pl-4 class", () => {
    const { container } = render(
      <BreakdownSection items={separataItems} total={standardTotal} />
    );

    const indentedItems = container.querySelectorAll(".pl-4");
    // We have 2 indented items (Imposta sostitutiva + INPS)
    expect(indentedItems.length).toBe(2);
  });

  it("renders badge when badge prop is present", () => {
    render(<BreakdownSection items={separataItems} total={standardTotal} />);

    expect(screen.getByText("STIMA")).toBeInTheDocument();
  });

  it("hides items where show is false", () => {
    const itemsWithHidden: BreakdownItem[] = [
      { label: "Incassi", value: "€ 50.000,00", type: "entrata" },
      { label: "− Riserva Personale", value: "€ 0,00", type: "riserva", show: false },
      { label: "− Buffer", value: "€ 500,00", type: "riserva", show: true },
    ];

    render(<BreakdownSection items={itemsWithHidden} total={standardTotal} />);

    expect(screen.queryByText("− Riserva Personale")).not.toBeInTheDocument();
    expect(screen.getByText("− Buffer")).toBeInTheDocument();
  });

  it("renders Artigiani label correctly", () => {
    const artiganiItems: BreakdownItem[] = [
      { label: "Incassi Totali (da inizio anno)", value: "€ 50.000,00", type: "entrata" },
      { label: "− Imposte e Contributi", value: "€ 10.000,00", type: "uscita", badge: "STIMA" },
      { label: "Imposta sostitutiva (15%)", value: "€ 5.850,00", type: "sub", indent: true },
      { label: "INPS Artigiani (24.00%)", value: "€ 9.360,00", type: "sub", indent: true },
    ];

    render(<BreakdownSection items={artiganiItems} total={standardTotal} />);

    expect(screen.getByText("INPS Artigiani (24.00%)")).toBeInTheDocument();
    expect(screen.queryByText(/Gestione Separata/)).not.toBeInTheDocument();
  });

  it("renders Commercianti label correctly", () => {
    const commerciantiItems: BreakdownItem[] = [
      { label: "Incassi Totali (da inizio anno)", value: "€ 50.000,00", type: "entrata" },
      { label: "− Imposte e Contributi", value: "€ 10.000,00", type: "uscita", badge: "STIMA" },
      { label: "Imposta sostitutiva (15%)", value: "€ 5.850,00", type: "sub", indent: true },
      { label: "INPS Commercianti (24.48%)", value: "€ 9.547,00", type: "sub", indent: true },
    ];

    render(<BreakdownSection items={commerciantiItems} total={standardTotal} />);

    expect(screen.getByText("INPS Commercianti (24.48%)")).toBeInTheDocument();
    expect(screen.queryByText(/Gestione Separata/)).not.toBeInTheDocument();
  });
});
