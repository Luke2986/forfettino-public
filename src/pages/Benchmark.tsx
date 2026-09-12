/**
 * Story 46.1 — Pagina Comparatore Tariffe Freelance
 * Confronto tariffa personale con benchmark di mercato (dataset Datapizza).
 * Accesso: solo utenti PRO e admin.
 */

import { useState, useMemo, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { ProGateOverlay } from "@/components/subscription/ProGateOverlay";
import { useUserRole } from "@/hooks/useUserRole";
import { useFiscalCalculations, formatCurrency } from "@/hooks/useFiscalCalculations";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronDown, AlertTriangle, Info, BarChart3, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFiscalYear } from "@/contexts/FiscalYearContext";
import { track } from "@/lib/analytics";
import {
  type ExperienceBand,
  type FreelanceRateConfig,
  type BenchmarkResult,
  DEFAULT_CONFIG,
  EXPERIENCE_BANDS,
  MIN_SAMPLE_WARNING,
  computeBenchmark,
  getGroupedJobTitles,
  getAvailableProvinces,
  formatJobTitle,
} from "@/lib/benchmark-engine";
import aggregatedData from "@/data/benchmark-aggregated.json";
import type { AggregatedBenchmarkData } from "@/lib/benchmark-engine";

const benchmarkData = aggregatedData as unknown as AggregatedBenchmarkData;

const CARD_SHADOW = "shadow-[0_1px_2px_rgba(0,0,0,0.05),0_0_0_1px_rgba(23,23,23,0.05)]";
const CARD_SHADOW_HOVER = "hover:shadow-[0_2px_4px_rgba(0,0,0,0.08),0_0_0_1px_rgba(23,23,23,0.08)]";

export default function Benchmark() {
  const isMobile = useIsMobile();

  return (
    <AppLayout>
      {isMobile && <MobileHeader title="Comparatore" />}
      <ProGateOverlay
        featureName="Comparatore Tariffe"
        featureDescription="Confronta la tua tariffa con migliaia di freelancer italiani. Scopri se sei sotto o sopra mercato."
      >
        <PageContainer className="space-y-5">
          <BenchmarkContent />
        </PageContainer>
      </ProGateOverlay>
    </AppLayout>
  );
}

/** Combobox con ricerca per selezionare il ruolo */
function JobTitleCombobox({
  groupedJobs,
  value,
  onSelect,
}: {
  groupedJobs: { category: string; items: { value: string; label: string }[] }[];
  value: string;
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const selectedLabel = useMemo(() => {
    for (const group of groupedJobs) {
      const found = group.items.find((item) => item.value === value);
      if (found) return found.label;
    }
    return null;
  }, [groupedJobs, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          role="combobox"
          aria-expanded={open}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            "mt-1.5",
            !value && "text-muted-foreground",
          )}
        >
          {selectedLabel ?? "Cerca o seleziona il tuo ruolo..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Cerca ruolo..." />
          <CommandList>
            <CommandEmpty>Nessun ruolo trovato.</CommandEmpty>
            {groupedJobs.map((group) => (
              <CommandGroup
                key={group.category}
                heading={group.category}
              >
                {group.items.map((item) => (
                  <CommandItem
                    key={item.value}
                    value={item.label}
                    onSelect={() => {
                      onSelect(item.value);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === item.value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function BenchmarkContent() {
  // ── State ──
  const [jobTitle, setJobTitle] = useState<string>("");
  const [province, setProvince] = useState<string>("");
  const [experienceBand, setExperienceBand] = useState<ExperienceBand | "">("");
  const [config, setConfig] = useState<FreelanceRateConfig>({ ...DEFAULT_CONFIG });
  const [customizeOpen, setCustomizeOpen] = useState(false);

  // ── Data ──
  const groupedJobs = useMemo(() => getGroupedJobTitles(benchmarkData), []);
  const provinces = useMemo(() => getAvailableProvinces(benchmarkData), []);

  // Admin check — exclude admin from tracking (AC 1, Task 1.4)
  const { data: userRole } = useUserRole();
  const isAdmin = userRole === "admin";

  // Fiscal data for personal comparison
  const { metrics } = useFiscalCalculations();
  const { selectedYear } = useFiscalYear();
  const incassiYTD = metrics?.incassiYTD ?? 0;

  // ── Compute benchmark ──
  const result: BenchmarkResult | null = useMemo(() => {
    if (!jobTitle) return null;
    return computeBenchmark(
      benchmarkData,
      {
        jobTitle,
        province: province || undefined,
        experienceBand: (experienceBand || undefined) as ExperienceBand | undefined,
      },
      config,
    );
  }, [jobTitle, province, experienceBand, config]);

  // ── Personal rate ──
  const personalRate = useMemo(() => {
    if (incassiYTD <= 0) return null;
    const currentYear = new Date().getFullYear();
    // Past year = full 12 months; current year = months elapsed so far
    const monthsElapsed = selectedYear < currentYear ? 12 : new Date().getMonth() + 1;
    const estimatedHours = (config.billableHoursPerYear * monthsElapsed) / 12;
    if (estimatedHours <= 0) return null;
    // incassiYTD è in centesimi
    const hourly = (incassiYTD / 100) / estimatedHours;
    return { hourly: Math.round(hourly * 100) / 100, daily: Math.round(hourly * 8 * 100) / 100 };
  }, [incassiYTD, config.billableHoursPerYear, selectedYear]);

  // ── Position indicator ──
  const positionLabel = useMemo(() => {
    if (!personalRate || !result) return null;
    if (personalRate.hourly < result.p25.hourly) return { text: "Sotto la media", color: "text-red-600", bg: "bg-red-50" };
    if (personalRate.hourly > result.p75.hourly) return { text: "Sopra la media", color: "text-blue-700", bg: "bg-blue-50" };
    return { text: "Nella media", color: "text-emerald-700", bg: "bg-emerald-50" };
  }, [personalRate, result]);

  // ── Analytics tracking (Story 46.3, AC 1) ──
  const lastTrackedRef = useRef<string>("");
  useEffect(() => {
    if (!jobTitle || isAdmin) return;
    // Deduplicate: only fire when the filter combination changes
    const key = `${jobTitle}|${province}|${experienceBand}`;
    if (key === lastTrackedRef.current) return;
    lastTrackedRef.current = key;
    track("benchmark_viewed", {
      jobTitle,
      province: province || undefined,
      experienceBand: experienceBand || undefined,
      personalHourlyRate: personalRate?.hourly ?? undefined,
    });
  }, [jobTitle, province, experienceBand, isAdmin, personalRate]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Comparatore Tariffe</h1>
        <p className="text-sm text-slate-600 mt-1">
          Confronta la tua tariffa con il mercato italiano basandoti su dati reali di {benchmarkData.meta.validRecords.toLocaleString("it-IT")} profili tech.
        </p>
      </div>

      {/* Filters */}
      <div className={`rounded-2xl border-0 ${CARD_SHADOW} ${CARD_SHADOW_HOVER} bg-white p-5 transition-shadow`}>
        <div className="space-y-4">
          {/* Job title — Combobox con ricerca */}
          <div>
            <Label className="text-sm font-medium text-slate-700">Ruolo</Label>
            <JobTitleCombobox
              groupedJobs={groupedJobs}
              value={jobTitle}
              onSelect={setJobTitle}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Province */}
            <div>
              <Label htmlFor="province" className="text-sm font-medium text-slate-700">Provincia (opzionale)</Label>
              <Select value={province || "__all__"} onValueChange={(v) => setProvince(v === "__all__" ? "" : v)}>
                <SelectTrigger id="province" className="mt-1.5">
                  <SelectValue placeholder="Tutte le province" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="__all__">Tutte le province</SelectItem>
                  {provinces.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Experience band */}
            <div>
              <Label className="text-sm font-medium text-slate-700">Esperienza</Label>
              <RadioGroup
                value={experienceBand}
                onValueChange={(v) => setExperienceBand(v as ExperienceBand | "")}
                className="flex gap-3 mt-2"
              >
                {(Object.entries(EXPERIENCE_BANDS) as [ExperienceBand, typeof EXPERIENCE_BANDS.junior][]).map(
                  ([key, band]) => (
                    <div key={key} className="flex items-center gap-1.5">
                      <RadioGroupItem value={key} id={`band-${key}`} />
                      <Label htmlFor={`band-${key}`} className="text-sm cursor-pointer">{band.label}</Label>
                    </div>
                  ),
                )}
              </RadioGroup>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Warning pochi dati */}
          {result.stats.count < MIN_SAMPLE_WARNING && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200/60 px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800">
                Pochi dati per questa combinazione ({result.stats.count} profili). Il risultato potrebbe non essere rappresentativo.
                {result.fallbackReason && <> {result.fallbackReason}</>}
                {" "}Prova senza filtro provincia o esperienza per un campione più ampio.
              </p>
            </div>
          )}

          {/* Fallback notice (non-warning) */}
          {result.fallbackUsed && result.stats.count >= MIN_SAMPLE_WARNING && (
            <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-200/60 px-4 py-3">
              <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
              <p className="text-sm text-blue-800">{result.fallbackReason}</p>
            </div>
          )}

          {/* Benchmark card */}
          <div className={`rounded-2xl border-0 ${CARD_SHADOW} ${CARD_SHADOW_HOVER} bg-white p-5 space-y-4 transition-shadow`}>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-900">Benchmark di Mercato</h2>
              <span className="text-sm text-slate-500">— {formatJobTitle(result.filters.jobTitle)}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-slate-600">Tariffa oraria mediana</p>
                <p className="text-xl font-bold tabular-nums text-slate-800">€{result.median.hourly.toFixed(0)}/ora</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Tariffa giornaliera</p>
                <p className="text-xl font-bold tabular-nums text-slate-800">€{result.median.daily.toFixed(0)}/giorno</p>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <p className="text-sm text-slate-600">Range P25–P75</p>
                <p className="text-sm font-medium tabular-nums text-slate-700">
                  €{result.p25.hourly.toFixed(0)} – €{result.p75.hourly.toFixed(0)}/ora
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-500">
              Basato su {result.stats.count.toLocaleString("it-IT")} profili
              {result.filters.province ? ` in ${result.filters.province}` : " a livello nazionale"}
              {result.filters.experienceBand ? `, fascia ${EXPERIENCE_BANDS[result.filters.experienceBand].label.toLowerCase()}` : ""}
            </p>
          </div>

          {/* Personal comparison */}
          {personalRate && positionLabel && (
            <div className={`rounded-2xl border-0 ${CARD_SHADOW} ${CARD_SHADOW_HOVER} bg-white p-5 space-y-3 transition-shadow`}>
              <h2 className="text-sm font-semibold text-slate-900">Il tuo posizionamento</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-600">La tua tariffa implicita</p>
                  <p className="text-xl font-bold tabular-nums text-slate-800">€{personalRate.hourly.toFixed(0)}/ora</p>
                  <p className="text-sm text-slate-500">€{personalRate.daily.toFixed(0)}/giorno</p>
                </div>
                <div className="flex items-center">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${positionLabel.color} ${positionLabel.bg}`}>
                    {positionLabel.text}
                  </span>
                </div>
              </div>
              <p className="text-sm text-slate-500">
                Calcolata dai tuoi incassi {new Date().getFullYear()} ({formatCurrency(incassiYTD)}) su {config.billableHoursPerYear} ore/anno stimate.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!jobTitle && (
        <div className={`rounded-2xl border-0 ${CARD_SHADOW} bg-white p-6 text-center`}>
          <BarChart3 className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-600">
            Seleziona un ruolo per vedere il benchmark di mercato.
          </p>
        </div>
      )}

      {/* No data for selection */}
      {jobTitle && !result && (
        <div className={`rounded-2xl border-0 ${CARD_SHADOW} bg-white p-5`}>
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
            <p className="text-sm text-slate-600">
              Non abbiamo ancora dati sufficienti per <strong>{formatJobTitle(jobTitle)}</strong> con i filtri selezionati.
              Prova a rimuovere il filtro provincia o esperienza.
            </p>
          </div>
        </div>
      )}

      {/* Customize formula */}
      <Collapsible open={customizeOpen} onOpenChange={setCustomizeOpen}>
        <CollapsibleTrigger className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-800 transition-colors">
          <ChevronDown className={`h-4 w-4 transition-transform ${customizeOpen ? "rotate-180" : ""}`} />
          Personalizza formula di conversione
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className={`rounded-2xl border-0 ${CARD_SHADOW} bg-white p-5 mt-3 space-y-5`}>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium text-slate-700">Moltiplicatore RAL → Freelance</Label>
                <span className="text-sm font-medium tabular-nums text-slate-800">{config.multiplier.toFixed(2)}×</span>
              </div>
              <Slider
                value={[config.multiplier]}
                onValueChange={([v]) => setConfig((c) => ({ ...c, multiplier: v }))}
                min={1.2}
                max={1.6}
                step={0.05}
                className="w-full"
              />
              <p className="text-sm text-slate-500 mt-1">
                Copre: niente ferie pagate, TFR, malattia + INPS a carico + rischio clienti
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium text-slate-700">Ore fatturabili/anno</Label>
                <span className="text-sm font-medium tabular-nums text-slate-800">{config.billableHoursPerYear}</span>
              </div>
              <Slider
                value={[config.billableHoursPerYear]}
                onValueChange={([v]) => setConfig((c) => ({ ...c, billableHoursPerYear: v }))}
                min={1000}
                max={1600}
                step={50}
                className="w-full"
              />
              <p className="text-sm text-slate-500 mt-1">
                Un freelance fattura meno di un dipendente: admin, vendita, formazione, periodi vuoti
              </p>
            </div>

            {config.multiplier !== DEFAULT_CONFIG.multiplier || config.billableHoursPerYear !== DEFAULT_CONFIG.billableHoursPerYear ? (
              <button
                onClick={() => setConfig({ ...DEFAULT_CONFIG })}
                className="text-sm text-slate-500 hover:text-slate-700 underline"
              >
                Ripristina valori predefiniti
              </button>
            ) : null}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Disclaimer */}
      <div className="px-1">
        <p className="text-sm text-slate-500">
          Stime indicative basate su dati crowdsourced di stipendi dipendenti IT italiani ({benchmarkData.meta.source}) convertiti in tariffe freelance equivalenti. Non costituiscono consulenza professionale. Ultimo aggiornamento: {benchmarkData.meta.generatedAt}.
        </p>
      </div>
    </div>
  );
}
