import { Calendar } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { useAvailableYears } from "@/hooks/useAvailableYears";

interface YearSelectorProps {
  compact?: boolean;
}

export function YearSelector({ compact = false }: YearSelectorProps) {
  const { selectedYear, setSelectedYear } = useFiscalYear();
  const { availableYears } = useAvailableYears();

  if (compact) {
    return (
      <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
        <SelectTrigger className="w-full h-8 px-2 justify-center">
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </SelectTrigger>
        <SelectContent>
          {availableYears.map((year) => (
            <SelectItem key={year} value={String(year)}>
              {year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
      <SelectTrigger className="w-full gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <SelectValue placeholder="Anno" />
      </SelectTrigger>
      <SelectContent>
        {availableYears.map((year) => (
          <SelectItem key={year} value={String(year)}>
            {year}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
