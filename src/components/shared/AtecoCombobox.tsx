/**
 * AtecoCombobox — Selettore codice ATECO con autocomplete
 *
 * Usa Popover + Command (cmdk) per ricerca istantanea su ~1200 codici.
 * Supporta fallback manuale per codici non in catalogo.
 * Condiviso tra Wizard e Impostazioni.
 */
import { useState, useMemo, useCallback } from "react";
import { Check, ChevronsUpDown, PenLine, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ATECO_CODES, type AtecoEntry } from "@/data/ateco-codes";
import { getCoeffFromAteco } from "@/lib/ateco-coefficienti";
import { isValidManualCoefficient } from "@/lib/ateco-catalog";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface AtecoComboboxProps {
  /** Codice ATECO selezionato (null = nessuna selezione) */
  value: string | null;
  /** Coefficiente attuale (usato per display quando value e' manual) */
  coefficient: number;
  /** Callback selezione da catalogo */
  onSelect: (code: string, coefficient: number) => void;
  /** Callback inserimento manuale (codice opzionale + coefficiente) */
  onManualEntry: (code: string, coefficient: number) => void;
  /** Se true, il combobox e' in modalita' manuale */
  isManualMode?: boolean;
  /** ID per accessibilita' */
  id?: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Max risultati mostrati nella lista per evitare DOM pesante */
const MAX_VISIBLE = 80;

/** Messaggio placeholder quando non c'e' ricerca */
const PLACEHOLDER_MSG =
  "Digita almeno 2 caratteri per cercare...";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getDisplayLabel(
  value: string | null,
  coefficient: number,
  isManual: boolean,
): string {
  if (isManual) return `Inserimento manuale (${coefficient}%)`;
  if (!value) return "Seleziona il tuo codice ATECO";
  const entry = ATECO_CODES.find((e) => e.code === value);
  if (entry) {
    const coeff = getCoeffFromAteco(value);
    return `${entry.code} — ${entry.description} (${coeff}%)`;
  }
  return `${value} (${coefficient}%)`;
}

/**
 * Filtra i codici ATECO per query multi-token.
 * Tutti i token devono matchare (AND) su code+description.
 * Restituisce max MAX_VISIBLE risultati.
 */
function filterAtecoCodes(query: string): AtecoEntry[] {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const tokens = trimmed.toLowerCase().split(/\s+/);
  const results: AtecoEntry[] = [];

  for (const entry of ATECO_CODES) {
    const haystack = `${entry.code} ${entry.description}`.toLowerCase();
    if (tokens.every((t) => haystack.includes(t))) {
      results.push(entry);
      if (results.length >= MAX_VISIBLE) break;
    }
  }

  return results;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function AtecoCombobox({
  value,
  coefficient,
  onSelect,
  onManualEntry,
  isManualMode = false,
  id,
}: AtecoComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [manualCoeff, setManualCoeff] = useState("");

  const label = getDisplayLabel(value, coefficient, isManualMode);

  // Filtro custom (non usiamo il filter built-in di cmdk perche'
  // vogliamo multi-token AND matching e min 2 chars)
  const filtered = useMemo(() => filterAtecoCodes(search), [search]);

  const handleSelect = useCallback(
    (code: string) => {
      const coeff = getCoeffFromAteco(code);
      onSelect(code, coeff);
      setOpen(false);
      setSearch("");
      setShowManual(false);
    },
    [onSelect],
  );

  const handleManualConfirm = useCallback(() => {
    const coeff = Number(manualCoeff);
    if (!isValidManualCoefficient(coeff)) return;
    onManualEntry(manualCode || "", coeff);
    setShowManual(false);
    setManualCode("");
    setManualCoeff("");
    setOpen(false);
  }, [manualCode, manualCoeff, onManualEntry]);

  const handleManualCancel = useCallback(() => {
    setShowManual(false);
    setManualCode("");
    setManualCoeff("");
  }, []);

  const isManualCoeffValid =
    manualCoeff !== "" && isValidManualCoefficient(Number(manualCoeff));

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Seleziona codice ATECO"
            className="w-full justify-between text-left font-normal h-auto min-h-[40px] whitespace-normal"
          >
            <span className="truncate">{label}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] p-0"
          align="start"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Cerca per codice o descrizione..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {search.trim().length < 2 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {PLACEHOLDER_MSG}
                </div>
              ) : filtered.length === 0 ? (
                <CommandEmpty>Nessun codice trovato</CommandEmpty>
              ) : (
                <CommandGroup>
                  {filtered.map((entry) => {
                    const coeff = getCoeffFromAteco(entry.code);
                    const isSelected = value === entry.code;
                    return (
                      <CommandItem
                        key={entry.code}
                        value={entry.code}
                        onSelect={() => handleSelect(entry.code)}
                        className="flex items-start gap-2 py-2"
                      >
                        <Check
                          className={cn(
                            "mt-0.5 h-4 w-4 shrink-0",
                            isSelected ? "opacity-100" : "opacity-0",
                          )}
                          aria-hidden="true"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-medium">
                              {entry.code}
                            </span>
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
                              {coeff}%
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {entry.description}
                          </p>
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
            </CommandList>

            {/* Link al fallback manuale */}
            <div className="border-t p-2">
              <button
                type="button"
                onClick={() => setShowManual((v) => !v)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <PenLine className="h-3.5 w-3.5" aria-hidden="true" />
                Il mio codice non e' in lista
              </button>
            </div>

            {/* Form manuale inline */}
            {showManual && (
              <div className="border-t p-3 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`${id}-manual-code`} className="text-sm">
                    Codice ATECO (opzionale)
                  </Label>
                  <Input
                    id={`${id}-manual-code`}
                    placeholder="es. 62.01.00"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${id}-manual-coeff`} className="text-sm">
                    Coefficiente di redditivita' (40–86%)
                  </Label>
                  <Input
                    id={`${id}-manual-coeff`}
                    type="number"
                    min={40}
                    max={86}
                    placeholder="es. 78"
                    value={manualCoeff}
                    onChange={(e) => setManualCoeff(e.target.value)}
                    className={cn(
                      "h-9",
                      manualCoeff !== "" &&
                        !isManualCoeffValid &&
                        "border-red-400 focus-visible:ring-red-400",
                    )}
                  />
                  {manualCoeff !== "" && !isManualCoeffValid && (
                    <p className="text-xs text-red-600">
                      Il coefficiente deve essere tra 40 e 86
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleManualConfirm}
                    disabled={!isManualCoeffValid}
                  >
                    Conferma
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleManualCancel}
                  >
                    Annulla
                  </Button>
                </div>
              </div>
            )}
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
