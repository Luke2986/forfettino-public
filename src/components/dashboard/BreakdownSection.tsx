import { cn } from "@/lib/utils";

export interface BreakdownItem {
  /** Label displayed on the left */
  label: string;
  /** Formatted value displayed on the right */
  value: string;
  /** Visual type: entrata (neutral), uscita (amber header), sub (muted sub-item), riserva (blue), formula (muted explanatory step) */
  type?: "entrata" | "uscita" | "sub" | "riserva" | "formula";
  /** Indent the item (for sub-items under a group header) */
  indent?: boolean;
  /** Optional badge text (e.g., "STIMA") */
  badge?: string;
  /** Whether this item should be conditionally shown (defaults to true) */
  show?: boolean;
}

export interface BreakdownTotal {
  /** Label for the total row (e.g., "= Spendibile oggi") */
  label: string;
  /** Formatted value */
  value: string;
  /** Tailwind color class for the value (e.g., "text-success") */
  colorClass?: string;
}

export interface BreakdownSectionProps {
  /** Array of breakdown line items */
  items: BreakdownItem[];
  /** Total row displayed at the bottom with border-t */
  total: BreakdownTotal;
  /** Optional footer content rendered below the total */
  footer?: React.ReactNode;
}

export function BreakdownSection({ items, total, footer }: BreakdownSectionProps) {
  // Filter out items where show === false
  const visibleItems = items.filter((item) => item.show !== false);

  return (
    <div className="space-y-1 pt-2">
      <dl className="space-y-1">
        {visibleItems.map((item, index) => {
          // Determine if this item starts a new group (uscita or riserva header after a non-grouped item)
          const isGroupHeader = item.type === "uscita" || item.type === "riserva";
          const prevItem = index > 0 ? visibleItems[index - 1] : null;
          const needsSeparator = isGroupHeader && prevItem && (!prevItem.indent || prevItem.type === "formula") && prevItem.type !== "uscita" && prevItem.type !== "riserva";

          return (
            <div key={item.label}>
              {needsSeparator && (
                <div className="pt-1 border-t border-dashed border-border/50" />
              )}
              <div
                className={cn(
                  "flex justify-between items-center",
                  "text-sm",
                  item.indent && "pl-4",
                )}
              >
                <dt
                  className={cn(
                    item.type === "uscita" && "text-warning",
                    item.type === "sub" && "text-muted-foreground",
                    item.type === "riserva" && "text-info",
                    item.type === "entrata" && "text-muted-foreground",
                    item.type === "formula" && "text-muted-foreground italic",
                    !item.type && "text-muted-foreground",
                    item.indent && "text-muted-foreground",
                    "flex items-center gap-1",
                  )}
                >
                  {item.label}
                  {item.badge && (
                    <span className="text-xs bg-warning-muted px-1 rounded text-warning">
                      {item.badge}
                    </span>
                  )}
                </dt>
                <dd
                  className={cn(
                    item.type === "uscita" && "text-warning",
                    item.type === "riserva" && "text-info",
                    item.type === "formula" && "text-muted-foreground italic",
                    !item.indent && item.type !== "formula" && "font-medium",
                  )}
                >
                  <span className="tabular-nums">{item.value}</span>
                </dd>
              </div>
            </div>
          );
        })}

        {/* Total row */}
        <div className="flex justify-between items-center font-bold text-base pt-3 border-t border-border mt-2">
          <dt>{total.label}</dt>
          <dd className={cn(total.colorClass, "tabular-nums")}>{total.value}</dd>
        </div>
      </dl>

      {footer && <div className="pt-2">{footer}</div>}
    </div>
  );
}
