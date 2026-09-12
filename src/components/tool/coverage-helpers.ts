export type CoverageStatus = "covered" | "partial" | "uncovered";

interface CoverableTool {
  id: string;
  cost: number;
  frequency: string;
}

export function toAnnual(cost: number, freq: string): number {
  if (freq === "yearly") return cost;
  if (freq === "quarterly") return cost * 4;
  return cost * 12;
}

export function computeCoverageDots(
  activeTools: CoverableTool[],
  coveredAmount: number,
): Map<string, CoverageStatus> {
  const sorted = [...activeTools].sort(
    (a, b) => toAnnual(b.cost, b.frequency) - toAnnual(a.cost, a.frequency),
  );

  let remaining = coveredAmount;
  const result = new Map<string, CoverageStatus>();

  for (const tool of sorted) {
    const annual = toAnnual(tool.cost, tool.frequency);
    if (remaining >= annual) {
      result.set(tool.id, "covered");
      remaining -= annual;
    } else if (remaining > 0) {
      result.set(tool.id, "partial");
      remaining = 0;
    } else {
      result.set(tool.id, "uncovered");
    }
  }

  return result;
}
