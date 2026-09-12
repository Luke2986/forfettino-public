/**
 * ClientCombobox — Selettore cliente con autocomplete e creazione al volo
 *
 * Usa Popover + Command (cmdk): seleziona un cliente esistente oppure digita
 * un nome nuovo, che viene creato al salvataggio da resolveClientId().
 * Condiviso tra NuovoIncasso e il dialog di modifica di Incassi.
 *
 * Story 86-1. Estratto da NuovoIncasso per fixare la modifica incasso, che
 * usava un Input a testo libero e non associava mai il cliente.
 *
 * Contratto: il valore e' una stringa sola — il testo di ricerca E il valore
 * committato sono la stessa cosa. L'id non e' tracciato qui: viene risolto per
 * nome al submit. Non cambiare in {id, name} senza toccare entrambi i call site.
 */
import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
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

export interface ClientComboboxOption {
  id: string;
  display_name: string;
}

export interface ClientComboboxProps {
  /** Nome cliente corrente (stringa vuota = nessun cliente) */
  value: string;
  /** Callback su selezione o digitazione */
  onChange: (value: string) => void;
  /** Catalogo clienti attivi per l'autocomplete */
  clients: ClientComboboxOption[] | undefined;
  /** Placeholder del trigger */
  placeholder?: string;
  /** ID per accessibilita' (collega la Label del call site) */
  id?: string;
  disabled?: boolean;
}

export function ClientCombobox({
  value,
  onChange,
  clients,
  placeholder = "Seleziona o digita un cliente...",
  id,
  disabled,
}: ClientComboboxProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          {value || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput
            placeholder="Cerca cliente..."
            value={value}
            onValueChange={onChange}
            aria-label="Cerca cliente"
          />
          <CommandList>
            <CommandEmpty>
              {value.trim() ? (
                <div className="p-2 text-sm">
                  Verra' creato il cliente "{value.trim()}"
                </div>
              ) : (
                "Nessun cliente trovato"
              )}
            </CommandEmpty>
            <CommandGroup>
              {clients?.map((client) => (
                <CommandItem
                  key={client.id}
                  value={client.display_name}
                  onSelect={(selected) => {
                    onChange(selected);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === client.display_name ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {client.display_name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
