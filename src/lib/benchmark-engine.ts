/**
 * Benchmark Engine — funzioni pure per il comparatore tariffe freelance
 *
 * Converte RAL dipendente → tariffa freelance equivalente usando dati
 * pre-aggregati dal dataset Datapizza (25k+ record tech salaries Italia).
 *
 * Zero dipendenze React/Supabase — testabile in isolamento.
 */

// ── Types ──

export interface BenchmarkStats {
  median: number;  // RAL mediana in €
  p25: number;     // 25° percentile
  p75: number;     // 75° percentile
  count: number;   // sample size
}

export type ExperienceBand = "junior" | "mid" | "senior";
type BandKeyWithAll = ExperienceBand | "_all";

type ProvinceData = Partial<Record<BandKeyWithAll, BenchmarkStats>>;
type JobData = Record<string, ProvinceData>; // chiave: province name o "_all"

export interface AggregatedBenchmarkData {
  meta: {
    totalRecords: number;
    validRecords: number;
    generatedAt: string;
    jobTitles: string[];
    provinces: string[];
    source: string;
  };
  data: Record<string, JobData>;
}

export interface BenchmarkFilters {
  jobTitle: string;
  province?: string;   // opzionale — se omesso usa aggregato tutte le province
  experienceBand?: ExperienceBand; // opzionale — se omesso usa aggregato tutte le fasce
}

export interface FreelanceRateConfig {
  multiplier: number;        // default 1.35
  billableHoursPerYear: number; // default 1300
}

export interface FreelanceRate {
  hourly: number;   // €/ora
  daily: number;    // €/giorno (hourly × 8)
}

export interface BenchmarkResult {
  stats: BenchmarkStats;      // RAL stats
  median: FreelanceRate;      // tariffa freelance dalla mediana
  p25: FreelanceRate;         // tariffa freelance dal P25
  p75: FreelanceRate;         // tariffa freelance dal P75
  filters: BenchmarkFilters;  // filtri applicati
  config: FreelanceRateConfig; // config usata
  fallbackUsed: boolean;      // true se ha dovuto allargare i filtri
  fallbackReason?: string;    // descrizione del fallback
}

// ── Constants ──

export const DEFAULT_CONFIG: FreelanceRateConfig = {
  multiplier: 1.35,
  billableHoursPerYear: 1300,
};

export const EXPERIENCE_BANDS: Record<ExperienceBand, { minMonths: number; maxMonths: number; label: string }> = {
  junior: { minMonths: 0, maxMonths: 24, label: "Fino a 2 anni" },
  mid: { minMonths: 25, maxMonths: 72, label: "3-6 anni" },
  senior: { minMonths: 73, maxMonths: Infinity, label: "Oltre 6 anni" },
};

/**
 * Mapping dei 102 job titles Datapizza in categorie per raggruppamento UI.
 * I titoli non mappati finiscono in "Altro".
 */
export const JOB_TITLE_CATEGORIES: Record<string, string[]> = {
  "Development": [
    ".net_developer", "app_developer", "backend_developer", "frontend_developer",
    "fullstack_developer", "java_developer", "mobile_developer", "rpa_developer",
    "software_architect", "software_developer", "web_developer",
  ],
  "Data & AI": [
    "ai_consultant", "ai_engineer", "bioinformatician", "business_intelligence",
    "data_analyst", "data_engineer", "data_governance", "data_scientist",
    "genai_engineer", "gis_specialist", "machine_learning_engineer", "statistician",
  ],
  "Management": [
    "cfo", "chief_marketing_officer", "cto", "engineering_management",
    "executive", "head_of_human_resources", "infrastructure_manager",
    "it_manager", "operation_manager", "product_manager", "product_owner",
    "project_coordinator", "project_manager", "sales_director", "sales_manager",
    "software_development_manager",
  ],
  "Design & UX": [
    "content_creator", "content_strategy_manager", "graphic_designer",
    "product_designer", "ui/ux_designer",
  ],
  "DevOps & Cloud": [
    "cloud_engineer", "cloud_infrastructure", "devops_engineer",
    "network_and_security_manager", "network_engineer", "system_administrator",
    "system_engineer",
  ],
  "Security & QA": [
    "cybersecurity_specialist", "quality_assurance", "software_tester",
  ],
  "Consulting & IT": [
    "business_analyst", "erp_specialist", "functional_analyst",
    "it_consultant", "it_specialist", "it_support", "solutions_architect",
    "technical_support",
  ],
};

/** Costruisce lookup inverso jobTitle → category */
const JOB_TO_CATEGORY: Record<string, string> = {};
for (const [cat, titles] of Object.entries(JOB_TITLE_CATEGORIES)) {
  for (const t of titles) JOB_TO_CATEGORY[t] = cat;
}

export function getJobTitleCategory(jobTitle: string): string {
  return JOB_TO_CATEGORY[jobTitle] ?? "Altro";
}

/**
 * Label italiana leggibile per un jobTitle (snake_case → Title Case).
 * Casi speciali gestiti per leggibilità.
 */
export function formatJobTitle(jobTitle: string): string {
  return jobTitle
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bAi\b/g, "AI")
    .replace(/\bIt\b/g, "IT")
    .replace(/\bUi\/ux\b/gi, "UI/UX")
    .replace(/\bUi\b/g, "UI")
    .replace(/\bUx\b/g, "UX")
    .replace(/\bCto\b/g, "CTO")
    .replace(/\bCfo\b/g, "CFO")
    .replace(/\bRpa\b/g, "RPA")
    .replace(/\bGis\b/g, "GIS")
    .replace(/\bErp\b/g, "ERP")
    .replace(/\bSre\b/g, "SRE")
    .replace(/\.net\b/gi, ".NET")
    .replace(/\bFp And A\b/g, "FP&A")
    .replace(/\bE Ccommerce\b/g, "E-Commerce")
    .replace(/\bE Commerce\b/g, "E-Commerce")
    .replace(/\bGenai\b/g, "GenAI")
    .replace(/\bCrm\b/g, "CRM");
}

// ── Core functions ──

/**
 * Converte una RAL annua in tariffa freelance (oraria + giornaliera).
 */
export function ralToFreelanceRate(
  ral: number,
  config: FreelanceRateConfig = DEFAULT_CONFIG,
): FreelanceRate {
  if (config.billableHoursPerYear <= 0) {
    return { hourly: 0, daily: 0 };
  }
  const hourly = (ral * config.multiplier) / config.billableHoursPerYear;
  return {
    hourly: Math.round(hourly * 100) / 100,
    daily: Math.round(hourly * 8 * 100) / 100,
  };
}

/**
 * Lookup nel JSON aggregato con fallback progressivo:
 * 1. jobTitle + province + band
 * 2. jobTitle + province + _all (rimuove filtro esperienza)
 * 3. jobTitle + _all + band (rimuove filtro provincia)
 * 4. jobTitle + _all + _all (solo per ruolo)
 *
 * Restituisce null se il jobTitle non esiste nel dataset.
 */
export function lookupBenchmark(
  data: AggregatedBenchmarkData,
  filters: BenchmarkFilters,
): { stats: BenchmarkStats; fallbackUsed: boolean; fallbackReason?: string } | null {
  const jobData = data.data[filters.jobTitle];
  if (!jobData) return null;

  const provKey = filters.province ?? "_all";
  const bandKey: BandKeyWithAll = filters.experienceBand ?? "_all";

  // Attempt 1: exact match
  const exact = jobData[provKey]?.[bandKey];
  if (exact) return { stats: exact, fallbackUsed: false };

  // Attempt 2: drop band filter
  if (filters.experienceBand && jobData[provKey]?._all) {
    return {
      stats: jobData[provKey]._all!,
      fallbackUsed: true,
      fallbackReason: `Pochi dati per ${EXPERIENCE_BANDS[filters.experienceBand].label} in ${filters.province ?? "tutte le province"}. Mostro dati per tutte le fasce di esperienza.`,
    };
  }

  // Attempt 3: drop province filter
  if (filters.province && jobData._all?.[bandKey]) {
    return {
      stats: jobData._all[bandKey]!,
      fallbackUsed: true,
      fallbackReason: `Pochi dati per ${filters.province}. Mostro dati nazionali.`,
    };
  }

  // Attempt 4: drop both
  if (jobData._all?._all) {
    return {
      stats: jobData._all._all!,
      fallbackUsed: true,
      fallbackReason: "Pochi dati per la combinazione selezionata. Mostro dati nazionali per tutte le fasce.",
    };
  }

  return null;
}

/**
 * Orchestratore: lookup + conversione RAL → freelance per p25/p50/p75.
 */
export function computeBenchmark(
  data: AggregatedBenchmarkData,
  filters: BenchmarkFilters,
  config: FreelanceRateConfig = DEFAULT_CONFIG,
): BenchmarkResult | null {
  const result = lookupBenchmark(data, filters);
  if (!result) return null;

  return {
    stats: result.stats,
    median: ralToFreelanceRate(result.stats.median, config),
    p25: ralToFreelanceRate(result.stats.p25, config),
    p75: ralToFreelanceRate(result.stats.p75, config),
    filters,
    config,
    fallbackUsed: result.fallbackUsed,
    fallbackReason: result.fallbackReason,
  };
}

// ── Data accessors (from aggregated JSON meta) ──

export function getAvailableJobTitles(data: AggregatedBenchmarkData): string[] {
  return data.meta.jobTitles;
}

export function getAvailableProvinces(data: AggregatedBenchmarkData): string[] {
  return data.meta.provinces;
}

/**
 * Raggruppa i job titles per categoria, con label formattate.
 * Output: [{ category, items: [{ value, label }] }]
 */
export function getGroupedJobTitles(
  data: AggregatedBenchmarkData,
): { category: string; items: { value: string; label: string }[] }[] {
  const hasData = new Set(Object.keys(data.data));
  const groups: Record<string, { value: string; label: string }[]> = {};

  for (const jt of data.meta.jobTitles) {
    if (!hasData.has(jt)) continue;
    const cat = getJobTitleCategory(jt);
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push({ value: jt, label: formatJobTitle(jt) });
  }

  // Ordina categorie (Altro sempre ultimo)
  return Object.entries(groups)
    .sort(([a], [b]) => {
      if (a === "Altro") return 1;
      if (b === "Altro") return -1;
      return a.localeCompare(b);
    })
    .map(([category, items]) => ({
      category,
      items: items.sort((a, b) => a.label.localeCompare(b.label)),
    }));
}

/** Soglia minima per mostrare warning "pochi dati" */
export const MIN_SAMPLE_WARNING = 10;
