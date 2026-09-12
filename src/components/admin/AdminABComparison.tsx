import { useState } from "react";
import { FlaskConical, AlertTriangle, RefreshCw, Info } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAdminABComparison, type ABVariantData } from "@/hooks/useAdminABComparison";
import { cn } from "@/lib/utils";

type Range = "7d" | "30d" | "90d" | "all";

const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: "7d", label: "7gg" },
  { value: "30d", label: "30gg" },
  { value: "90d", label: "90gg" },
  { value: "all", label: "Tutto" },
];

function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  return `${Math.round(seconds / 60)}min`;
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}min`;
  if (minutes < 1440) return `${(minutes / 60).toFixed(1)}h`;
  return `${(minutes / 1440).toFixed(1)}gg`;
}

function VariantCard({ variant }: { variant: ABVariantData }) {
  return (
    <div className="rounded-xl border border-slate-200/60 bg-white p-4 space-y-3 flex-1">
      <div className="text-sm font-semibold text-slate-700 capitalize">
        {variant.variantName}
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Completion Rate</span>
          <span className="font-medium text-slate-800">{variant.completionRate}%</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Sample Size</span>
          <span className="font-medium text-slate-800">{variant.sampleSize}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Tempo Median</span>
          <span className="font-medium text-slate-800">
            {formatSeconds(variant.medianCompletionSeconds)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">TTV Median</span>
          <span className="font-medium text-slate-800">
            {formatMinutes(variant.medianTtvMinutes)}
          </span>
        </div>
      </div>
    </div>
  );
}

function RangeSelector({ value, onChange }: { value: Range; onChange: (v: Range) => void }) {
  return (
    <div className="flex gap-1 rounded-lg bg-muted p-0.5">
      {RANGE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            value === opt.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function AdminABComparison() {
  const [range, setRange] = useState<Range>("all");
  const { data, isLoading, isError, refetch } = useAdminABComparison(range);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">A/B Test Wizard</CardTitle>
            </div>
            <RangeSelector value={range} onChange={setRange} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">A/B Test Wizard</CardTitle>
            </div>
            <RangeSelector value={range} onChange={setRange} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertTriangle className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground mb-3">
              Impossibile caricare i dati A/B
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Riprova
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const controlVariant = data.variants.find((v) => v.variantName === "control");
  const shortVariant = data.variants.find((v) => v.variantName === "short");
  const hasSufficientData =
    (controlVariant?.sampleSize ?? 0) >= 30 && (shortVariant?.sampleSize ?? 0) >= 30;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">A/B Test Wizard</CardTitle>
          </div>
          <RangeSelector value={range} onChange={setRange} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasSufficientData && (
          <div className="rounded-lg bg-amber-50 border border-amber-200/60 px-4 py-3 text-sm text-amber-700">
            Servono almeno 30 utenti per variant per risultati significativi.
            Attualmente: {controlVariant?.sampleSize ?? 0} control, {shortVariant?.sampleSize ?? 0} short.
          </div>
        )}

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
          {controlVariant && <VariantCard variant={controlVariant} />}
          {shortVariant && <VariantCard variant={shortVariant} />}
        </div>

        {data.variants.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nessun dato disponibile
          </p>
        )}

        {data.variants.length >= 2 && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium",
                      data.isSignificant
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-600",
                    )}
                  >
                    {data.isSignificant ? "Significativo" : "Non significativo"}
                    <Info className="h-3.5 w-3.5" />
                  </span>
                </TooltipTrigger>
                <TooltipContent aria-label={`Z-score: ${data.zScore.toFixed(4)}, significativita' al 95%`}>
                  <p>Z-score: {data.zScore.toFixed(4)}</p>
                  <p>Soglia 95%: |z| &gt; 1.96</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
