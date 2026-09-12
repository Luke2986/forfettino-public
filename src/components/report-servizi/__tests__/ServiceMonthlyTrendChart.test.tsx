import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  ServiceMonthlyTrendChart,
  buildTrendData,
  TrendTooltipContent,
} from "../ServiceMonthlyTrendChart";

// Mock recharts to avoid rendering issues in jsdom
vi.mock("recharts", () => {
  const OriginalModule = vi.importActual("recharts");
  return {
    ...OriginalModule,
    ResponsiveContainer: ({ children }: any) => (
      <div data-testid="responsive-container">{children}</div>
    ),
    BarChart: ({ children, data }: any) => (
      <div data-testid="bar-chart" data-count={data?.length ?? 0}>
        {children}
      </div>
    ),
    Bar: ({ dataKey }: any) => <div data-testid={`bar-${dataKey}`} />,
    XAxis: () => <div data-testid="x-axis" />,
    YAxis: () => <div data-testid="y-axis" />,
    CartesianGrid: () => <div data-testid="cartesian-grid" />,
    Tooltip: () => <div data-testid="tooltip" />,
    Cell: () => <div data-testid="cell" />,
  };
});

// Mock useServiceMonthlyTrend hook
const mockCurrentData = [
  { month: 1, grossAmount: 3500, receiptCount: 2 },
  { month: 3, grossAmount: 2000, receiptCount: 1 },
  { month: 5, grossAmount: 4500, receiptCount: 3 },
];

const mockPreviousData = [
  { month: 1, grossAmount: 2800, receiptCount: 1 },
  { month: 3, grossAmount: 3000, receiptCount: 2 },
  { month: 6, grossAmount: 1500, receiptCount: 1 },
];

const mockUseServiceMonthlyTrend = vi.fn(
  (fiscalYear: number, serviceId: string | null | undefined) => {
    if (serviceId === undefined) {
      return { data: undefined, isLoading: false, error: null };
    }
    if (fiscalYear === 2026) {
      return { data: mockCurrentData, isLoading: false, error: null };
    }
    if (fiscalYear === 2025) {
      return { data: mockPreviousData, isLoading: false, error: null };
    }
    return { data: [], isLoading: false, error: null };
  },
);

vi.mock("@/hooks/useServiceMonthlyTrend", () => ({
  useServiceMonthlyTrend: (...args: [number, string | null | undefined]) => mockUseServiceMonthlyTrend(...args),
}));

describe("ServiceMonthlyTrendChart", () => {
  it("renders bar chart with current year data", () => {
    render(
      <ServiceMonthlyTrendChart
        serviceId="s1"
        serviceName="Consulenza"
        fiscalYear={2026}
      />,
    );
    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
    expect(screen.getByTestId("bar-current")).toBeInTheDocument();
  });

  it("renders only months with data (sparse)", () => {
    render(
      <ServiceMonthlyTrendChart
        serviceId="s1"
        serviceName="Consulenza"
        fiscalYear={2026}
      />,
    );
    const chart = screen.getByTestId("bar-chart");
    expect(chart.getAttribute("data-count")).toBe("3");
  });

  it("shows YoY toggle with correct label", () => {
    render(
      <ServiceMonthlyTrendChart
        serviceId="s1"
        serviceName="Consulenza"
        fiscalYear={2026}
      />,
    );
    expect(screen.getByText("Confronta con 2025")).toBeInTheDocument();
  });

  it("shows previous year bar when YoY toggle is activated", () => {
    render(
      <ServiceMonthlyTrendChart
        serviceId="s1"
        serviceName="Consulenza"
        fiscalYear={2026}
      />,
    );
    expect(screen.queryByTestId("bar-previous")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("switch"));

    expect(screen.getByTestId("bar-previous")).toBeInTheDocument();
  });

  it("merges sparse data from both years correctly", () => {
    render(
      <ServiceMonthlyTrendChart
        serviceId="s1"
        serviceName="Consulenza"
        fiscalYear={2026}
      />,
    );

    fireEvent.click(screen.getByRole("switch"));

    // Current has months 1,3,5 — Previous has months 1,3,6 → union = 1,3,5,6 = 4 months
    const chart = screen.getByTestId("bar-chart");
    expect(chart.getAttribute("data-count")).toBe("4");
  });

  it("renders loading skeleton when data is loading", () => {
    mockUseServiceMonthlyTrend.mockReturnValueOnce({
      data: undefined,
      isLoading: true,
      error: null,
    });

    render(
      <ServiceMonthlyTrendChart
        serviceId="s1"
        serviceName="Consulenza"
        fiscalYear={2026}
      />,
    );
    expect(screen.getByTestId("trend-loading")).toBeInTheDocument();
  });

  it("handles null serviceId (Non categorizzato)", () => {
    render(
      <ServiceMonthlyTrendChart
        serviceId={null}
        serviceName="Non categorizzato"
        fiscalYear={2026}
      />,
    );
    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
  });
});

describe("buildTrendData", () => {
  it("returns only months with data (sparse)", () => {
    const result = buildTrendData(
      [{ month: 1, grossAmount: 1000, receiptCount: 1 }],
      undefined,
    );
    expect(result).toHaveLength(1);
    expect(result[0].month).toBe("Gen");
    expect(result[0].current).toBe(1000);
    expect(result[0].previous).toBeUndefined();
  });

  it("merges current and previous year data", () => {
    const result = buildTrendData(
      [{ month: 3, grossAmount: 2000, receiptCount: 1 }],
      [{ month: 3, grossAmount: 1500, receiptCount: 1 }, { month: 6, grossAmount: 800, receiptCount: 1 }],
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ month: "Mar", monthNum: 3, current: 2000, previous: 1500 });
    expect(result[1]).toEqual({ month: "Giu", monthNum: 6, current: undefined, previous: 800 });
  });
});

describe("TrendTooltipContent", () => {
  it("shows delta percentage when both years have data", () => {
    const { container } = render(
      <TrendTooltipContent
        active={true}
        payload={[
          { dataKey: "current", value: 3500 },
          { dataKey: "previous", value: 2800 },
        ]}
        label="Gen"
        fiscalYear={2026}
        showPreviousYear={true}
      />,
    );
    expect(container.textContent).toContain("Delta +25%");
    expect(container.textContent).toContain("2026");
    expect(container.textContent).toContain("2025");
  });

  it("shows 'Nuovo' when current exists but previous is absent", () => {
    const { container } = render(
      <TrendTooltipContent
        active={true}
        payload={[{ dataKey: "current", value: 1000 }]}
        label="Feb"
        fiscalYear={2026}
        showPreviousYear={true}
      />,
    );
    expect(container.textContent).toContain("Nuovo");
  });

  it("shows 'Delta -100%' when previous exists but current is absent", () => {
    const { container } = render(
      <TrendTooltipContent
        active={true}
        payload={[{ dataKey: "previous", value: 2000 }]}
        label="Mar"
        fiscalYear={2026}
        showPreviousYear={true}
      />,
    );
    expect(container.textContent).toContain("Delta -100%");
  });

  it("shows no delta when YoY toggle is off", () => {
    const { container } = render(
      <TrendTooltipContent
        active={true}
        payload={[
          { dataKey: "current", value: 3500 },
          { dataKey: "previous", value: 2800 },
        ]}
        label="Gen"
        fiscalYear={2026}
        showPreviousYear={false}
      />,
    );
    expect(container.textContent).not.toContain("Delta");
    expect(container.textContent).not.toContain("Nuovo");
  });
});
