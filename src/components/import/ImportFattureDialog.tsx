import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ImportDropZone } from "./ImportDropZone";
import { ImportPreviewTable } from "./ImportPreviewTable";
import { useImportFatture } from "@/hooks/useImportFatture";
import { useSubscription } from "@/hooks/useSubscription";
import { Loader2, CheckCircle2, AlertTriangle, FileUp } from "lucide-react";
import { useEffect } from "react";

interface ImportFattureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Anno fiscale per calcoli e dedup — se omesso, usa il context globale */
  yearOverride?: number;
}

export function ImportFattureDialog({ open, onOpenChange, yearOverride }: ImportFattureDialogProps) {
  const {
    step,
    previewRows,
    errorMessage,
    importCount,
    selectedCount,
    parseFiles,
    toggleRow,
    toggleAll,
    importSelected,
    reset,
  } = useImportFatture(yearOverride);

  const { isPro, importsUsed, importsLimit, canAddImport } = useSubscription();

  // Reset quando il dialog viene chiuso
  useEffect(() => {
    if (!open) {
      // Piccolo delay per non resettare durante l'animazione di chiusura
      const timer = setTimeout(reset, 200);
      return () => clearTimeout(timer);
    }
  }, [open, reset]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const remaining = isFinite(importsLimit) ? importsLimit - importsUsed : Infinity;
  const wouldExceedLimit = !isPro && selectedCount > remaining;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5" />
            Importa Fatture XML
          </DialogTitle>
          <DialogDescription>
            Importa file XML FatturaPA e i calcoli fiscali vengono applicati automaticamente.
          </DialogDescription>
        </DialogHeader>

        {/* === STEP: IDLE — Drop zone === */}
        {step === "idle" && (
          <>
            <ImportDropZone onFilesSelected={parseFiles} disabled={!canAddImport} />
            {!isPro && (
              <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
                <span>Import usati quest&apos;anno</span>
                <span className="tabular-nums font-medium">
                  {importsUsed} / {isFinite(importsLimit) ? importsLimit : "∞"}
                </span>
              </div>
            )}
            {!canAddImport && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Hai raggiunto il limite di {isFinite(importsLimit) ? importsLimit : "∞"} import per il piano Free.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}

        {/* === STEP: PARSING — Loading === */}
        {step === "parsing" && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Analisi del file in corso...
            </p>
          </div>
        )}

        {/* === STEP: PREVIEW — Tabella anteprima === */}
        {step === "preview" && (
          <>
            <ImportPreviewTable
              rows={previewRows}
              onToggleRow={toggleRow}
              onToggleAll={toggleAll}
            />
            {wouldExceedLimit && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Puoi importare ancora <strong>{remaining}</strong> fattur{remaining === 1 ? "a" : "e"}.
                  Deseleziona alcune righe per rispettare il limite.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}

        {/* === STEP: IMPORTING — Salvataggio in corso === */}
        {step === "importing" && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Salvataggio incassi in corso...
            </p>
          </div>
        )}

        {/* === STEP: DONE — Successo === */}
        {step === "done" && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <p className="text-lg font-medium">Import completato!</p>
            <p className="text-sm text-muted-foreground">
              {importCount} incass{importCount === 1 ? "o importato" : "i importati"} con successo.
            </p>
          </div>
        )}

        {/* === STEP: ERROR === */}
        {step === "error" && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <AlertTriangle className="h-12 w-12 text-destructive" />
            <p className="text-sm text-destructive text-center max-w-md">
              {errorMessage}
            </p>
          </div>
        )}

        {/* === FOOTER === */}
        <DialogFooter className="gap-2 sm:gap-0">
          {step === "idle" && (
            <Button variant="outline" onClick={handleClose}>
              Annulla
            </Button>
          )}

          {step === "preview" && (
            <>
              <Button variant="outline" onClick={reset}>
                Indietro
              </Button>
              <Button
                onClick={importSelected}
                disabled={selectedCount === 0 || wouldExceedLimit}
              >
                Importa {selectedCount} incass{selectedCount === 1 ? "o" : "i"}
              </Button>
            </>
          )}

          {step === "error" && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Annulla
              </Button>
              <Button onClick={reset}>
                Riprova
              </Button>
            </>
          )}

          {step === "done" && (
            <Button onClick={handleClose}>
              Chiudi
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
