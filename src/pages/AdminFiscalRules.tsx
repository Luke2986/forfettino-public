import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { useIsMobile } from "@/hooks/use-mobile";
import { useFiscalRules, useFiscalRulesYears, useInsertFiscalRules } from "@/hooks/useFiscalRules";
import { FiscalRulesForm } from "@/components/admin/FiscalRulesForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  AlertTriangle,
  RefreshCw,
  Plus,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const currentRealYear = new Date().getFullYear();

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-40 w-full rounded-lg" />
      ))}
    </div>
  );
}

function NewYearDialog({
  existingYears,
  onCreated,
}: {
  existingYears: number[];
  onCreated: (year: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [newYear, setNewYear] = useState(String(currentRealYear + 1));
  const [copyFromPrev, setCopyFromPrev] = useState(true);
  const { toast } = useToast();
  const insertMutation = useInsertFiscalRules();

  // Anno precedente per la copia (guard: array vuoto → 0 disabilita la query)
  const prevYear = existingYears.length > 0 ? Math.max(...existingYears) : 0;
  const prevYearData = useFiscalRules(copyFromPrev && prevYear > 0 ? prevYear : 0);

  const yearNum = parseInt(newYear, 10);
  const yearExists = existingYears.includes(yearNum);
  const yearValid = !isNaN(yearNum) && yearNum >= 2020 && yearNum <= 2100;

  const handleCreate = () => {
    if (!yearValid || yearExists) return;

    const payload = copyFromPrev && prevYearData.data
      ? (() => {
          const { id, fiscal_year, created_at, updated_at, ...rest } = prevYearData.data;
          return { ...rest, fiscal_year: yearNum };
        })()
      : { fiscal_year: yearNum };

    insertMutation.mutate(payload, {
      onSuccess: () => {
        const description = copyFromPrev && prevYearData.data ? `Copiati da ${prevYear}.` : undefined;
        toast({ title: `Parametri anno ${yearNum} creati`, description });
        setOpen(false);
        onCreated(yearNum);
      },
      onError: () => {
        toast({ title: "Errore", description: "Impossibile creare i parametri.", variant: "destructive" });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      setOpen(v);
      if (!v) { setNewYear(String(currentRealYear + 1)); setCopyFromPrev(true); }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4" />
          Nuovo Anno
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Aggiungi Anno Fiscale</DialogTitle>
          <DialogDescription>
            Crea un nuovo set di parametri INPS per un anno fiscale.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="new-year">Anno Fiscale</Label>
            <Input
              id="new-year"
              type="number"
              min={2020}
              max={2100}
              value={newYear}
              onChange={(e) => setNewYear(e.target.value)}
            />
            {yearExists && (
              <p className="text-xs text-destructive">L'anno {yearNum} esiste già.</p>
            )}
          </div>
          <div className="flex items-center gap-2 min-h-[44px]">
            <Checkbox
              id="copy-prev"
              checked={copyFromPrev}
              onCheckedChange={(v) => setCopyFromPrev(v === true)}
            />
            <Label htmlFor="copy-prev" className="text-sm font-normal">
              Copia valori dall'anno {prevYear}
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Annulla
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!yearValid || yearExists || insertMutation.isPending}
          >
            {insertMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Crea
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminFiscalRulesPage() {
  const isMobile = useIsMobile();
  const { data: years, isLoading: yearsLoading } = useFiscalRulesYears();
  const [selectedYear, setSelectedYear] = useState(currentRealYear);

  const {
    data: rulesData,
    isLoading: rulesLoading,
    error: rulesError,
    refetch,
    isFetching,
  } = useFiscalRules(selectedYear);

  // Quando gli anni caricano, seleziona l'anno corrente se disponibile
  const effectiveYears = years || [];

  const handleYearCreated = (year: number) => {
    setSelectedYear(year);
  };

  return (
    <AppLayout>
      {isMobile && <MobileHeader title="Parametri Fiscali" showBackButton backPath="/" />}
      <div className="container max-w-4xl py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Parametri INPS</h1>
              <p className="text-muted-foreground text-sm">
                Aggiornamento parametri normativi per anno fiscale
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {effectiveYears.length > 0 && (
              <NewYearDialog
                existingYears={effectiveYears}
                onCreated={handleYearCreated}
              />
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
              Aggiorna
            </Button>
          </div>
        </div>

        {/* Year Selector */}
        {yearsLoading ? (
          <Skeleton className="h-10 w-48" />
        ) : effectiveYears.length > 0 ? (
          <div className="flex items-center gap-3">
            <Label className="text-sm font-medium">Anno fiscale:</Label>
            <Select
              value={String(selectedYear)}
              onValueChange={(v) => setSelectedYear(Number(v))}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {effectiveYears.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    <span className="flex items-center gap-2">
                      {y}
                      {y === currentRealYear && (
                        <Badge variant="secondary" className="text-xs px-1 py-0 h-4">
                          corrente
                        </Badge>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {/* Error State */}
        {rulesError && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Errore
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Impossibile caricare i parametri: {rulesError.message}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {rulesLoading && <LoadingSkeleton />}

        {/* Form */}
        {rulesData && <FiscalRulesForm data={rulesData} />}
      </div>
    </AppLayout>
  );
}
