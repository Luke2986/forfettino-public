import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CostCoverageCard } from "./CostCoverageCard";

describe("CostCoverageCard", () => {
  const defaultProps = {
    monthlyTotal: 500,
    yearlyTotal: 6000,
    coveredAmount: 6000,
    spendable: 4000,
    yearlyToolCost: 6000,
    isMetricsLoading: false,
  };

  it("renders nothing when yearlyTotal is 0", () => {
    const { container } = render(
      <CostCoverageCard {...defaultProps} yearlyTotal={0} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders skeleton when metrics are loading", () => {
    render(<CostCoverageCard {...defaultProps} isMetricsLoading={true} />);
    expect(screen.queryByText("Copertura Costi Fissi")).not.toBeInTheDocument();
  });

  it("renders the title", () => {
    render(<CostCoverageCard {...defaultProps} />);
    expect(screen.getByText("Copertura Costi Fissi")).toBeInTheDocument();
  });

  it("shows zero-incassi message when spendable=0 and yearlyToolCost=0", () => {
    render(
      <CostCoverageCard
        {...defaultProps}
        coveredAmount={0}
        spendable={0}
        yearlyToolCost={0}
      />,
    );
    expect(
      screen.getByText("Registra il primo incasso per vedere la copertura"),
    ).toBeInTheDocument();
  });

  it("shows full coverage message when coveredAmount >= yearlyTotal", () => {
    render(
      <CostCoverageCard
        {...defaultProps}
        coveredAmount={6000}
      />,
    );
    expect(
      screen.getByText("I tuoi incassi coprono tutti i costi fissi annui"),
    ).toBeInTheDocument();
  });

  it("shows partial coverage message with months", () => {
    // coveredAmount=2000, yearlyTotal=6000 → 33.3% → 3 mesi
    render(
      <CostCoverageCard
        {...defaultProps}
        coveredAmount={2000}
        spendable={1000}
        yearlyToolCost={1000}
      />,
    );
    expect(screen.getByText(/equivale a 3 mesi su 12/)).toBeInTheDocument();
  });

  it("shows 1 mese (singular) when coveredMonths is 1", () => {
    // coveredAmount=600, yearlyTotal=6000 → 10% → 1 mese
    render(
      <CostCoverageCard
        {...defaultProps}
        coveredAmount={600}
        spendable={200}
        yearlyToolCost={400}
      />,
    );
    expect(screen.getByText(/equivale a 1 mese su 12/)).toBeInTheDocument();
  });

  it("shows stat row with monthly total and coverage percent", () => {
    // coveredAmount=2000, yearlyTotal=6000 → 33%
    render(
      <CostCoverageCard
        {...defaultProps}
        coveredAmount={2000}
        spendable={1000}
        yearlyToolCost={1000}
      />,
    );
    expect(screen.getByText("33% coperto")).toBeInTheDocument();
  });

  it("shows toolCostRatio when spendable > 0", () => {
    // spendable=1000, yearlyToolCost=1000 → ratio = 50%
    render(
      <CostCoverageCard
        {...defaultProps}
        coveredAmount={2000}
        spendable={1000}
        yearlyToolCost={1000}
      />,
    );
    expect(screen.getByText("50% dello spendibile")).toBeInTheDocument();
  });

  it("does not show toolCostRatio when spendable is 0", () => {
    render(
      <CostCoverageCard
        {...defaultProps}
        coveredAmount={0}
        spendable={0}
        yearlyToolCost={0}
      />,
    );
    expect(screen.queryByText(/dello spendibile/)).not.toBeInTheDocument();
  });

  it("renders progress bar with correct color for coverage >= 100%", () => {
    const { container } = render(
      <CostCoverageCard
        {...defaultProps}
        coveredAmount={6000}
      />,
    );
    const fill = container.querySelector(".bg-teal-500");
    expect(fill).toBeInTheDocument();
  });

  it("renders progress bar with amber for coverage 50-99%", () => {
    // coveredAmount=3000, yearlyTotal=6000 → 50%
    const { container } = render(
      <CostCoverageCard
        {...defaultProps}
        coveredAmount={3000}
        spendable={2000}
        yearlyToolCost={1000}
      />,
    );
    const fill = container.querySelector(".bg-amber-500");
    expect(fill).toBeInTheDocument();
  });

  it("renders progress bar with red for coverage < 50%", () => {
    // coveredAmount=1000, yearlyTotal=6000 → 16.7%
    const { container } = render(
      <CostCoverageCard
        {...defaultProps}
        coveredAmount={1000}
        spendable={500}
        yearlyToolCost={500}
      />,
    );
    const fill = container.querySelector(".bg-red-400");
    expect(fill).toBeInTheDocument();
  });
});
