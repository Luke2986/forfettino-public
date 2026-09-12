import { getBreakdownItems, type ContributionBreakdown, type ActionConfig } from "@/lib/contribution-helpers";

interface ContributionBreakdownListProps {
  breakdown: ContributionBreakdown;
  configs: ActionConfig[];
}

export function ContributionBreakdownList({ breakdown, configs }: ContributionBreakdownListProps) {
  const items = getBreakdownItems(breakdown, configs);

  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-500 mt-2">
        Inizia a contribuire per guadagnare punti!
      </p>
    );
  }

  return (
    <ul className="mt-3 divide-y divide-slate-100">
      {items.map((item) => (
        <li
          key={item.action}
          className="flex items-center justify-between text-sm py-2.5"
        >
          <span className="flex items-center gap-2">
            <span
              className={`inline-block w-2.5 h-2.5 rounded-sm ${item.color}`}
            />
            <span className="text-slate-600">{item.label}</span>
          </span>
          <span className={`font-semibold tabular-nums ${item.textColor}`}>
            {item.points} pt
          </span>
        </li>
      ))}
    </ul>
  );
}
