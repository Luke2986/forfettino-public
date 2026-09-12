import { Calendar } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PageYearSelectorProps {
  year: number;
  onYearChange: (year: number) => void;
  availableYears: number[];
  disabled?: boolean;
}

export function PageYearSelector({
  year,
  onYearChange,
  availableYears,
  disabled,
}: PageYearSelectorProps) {
  return (
    <Select value={String(year)} onValueChange={(v) => onYearChange(Number(v))} disabled={disabled}>
      <SelectTrigger className="w-[120px] gap-2 h-9">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <SelectValue placeholder="Anno" />
      </SelectTrigger>
      <SelectContent>
        {availableYears.map((y) => (
          <SelectItem key={y} value={String(y)}>
            {y}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
