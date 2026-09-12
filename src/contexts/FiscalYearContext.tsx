import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from "react";

interface FiscalYearContextType {
  selectedYear: number;
  setSelectedYear: (year: number) => void;
}

const FiscalYearContext = createContext<FiscalYearContextType | undefined>(undefined);

const currentYear = new Date().getFullYear();

export function FiscalYearProvider({ children }: { children: ReactNode }) {
  const [selectedYear, setSelectedYearState] = useState<number>(currentYear);

  const setSelectedYear = useCallback((year: number) => {
    setSelectedYearState(year);
  }, []);

  // Memoize the context value to avoid re-rendering every consumer on each
  // provider render (the object identity stays stable unless selectedYear changes).
  const value = useMemo(
    () => ({ selectedYear, setSelectedYear }),
    [selectedYear, setSelectedYear],
  );

  return (
    <FiscalYearContext.Provider value={value}>
      {children}
    </FiscalYearContext.Provider>
  );
}

export function useFiscalYear() {
  const context = useContext(FiscalYearContext);
  if (context === undefined) {
    throw new Error("useFiscalYear must be used within a FiscalYearProvider");
  }
  return context;
}
