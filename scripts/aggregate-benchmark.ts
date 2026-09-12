/**
 * Pre-aggregazione dataset Datapizza → benchmark-aggregated.json
 *
 * Legge il JSONL raw (11MB, ~26k record), filtra valid=true,
 * aggrega per jobTitle × province × experienceBand → mediana, p25, p75, count.
 *
 * Output: src/data/benchmark-aggregated.json (~50-100KB)
 *
 * Usage: npx tsx scripts/aggregate-benchmark.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Types ──

interface RawRecord {
  jobTitle: string;
  salary: number;
  province: string;
  monthsOfExperience: number;
  valid: boolean;
  submittedAt: string;
}

interface Stats {
  median: number;
  p25: number;
  p75: number;
  count: number;
}

type BandKey = "junior" | "mid" | "senior" | "_all";
type ProvinceData = Partial<Record<BandKey, Stats>>;
type JobData = Record<string, ProvinceData>; // province key or "_all"

interface AggregatedOutput {
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

// ── Helpers ──

function toBand(months: number): BandKey {
  if (months <= 24) return "junior";
  if (months <= 72) return "mid";
  return "senior";
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo));
}

function computeStats(salaries: number[]): Stats | null {
  if (salaries.length === 0) return null;
  const sorted = [...salaries].sort((a, b) => a - b);
  return {
    median: percentile(sorted, 50),
    p25: percentile(sorted, 25),
    p75: percentile(sorted, 75),
    count: sorted.length,
  };
}

// ── Main ──

const INPUT = path.resolve(__dirname, "../src/data/datapizza-salaries.jsonl");
const OUTPUT = path.resolve(__dirname, "../src/data/benchmark-aggregated.json");

console.log("Reading JSONL…");
const lines = fs.readFileSync(INPUT, "utf8").split("\n").filter((l) => l.trim());
const allRecords: RawRecord[] = lines.map((l) => JSON.parse(l));
const records = allRecords.filter((r) => r.valid && r.salary > 0 && r.jobTitle);

console.log(`Total: ${allRecords.length}, Valid with salary: ${records.length}`);

// Collect unique values
const jobTitlesSet = new Set<string>();
const provincesSet = new Set<string>();

// Group salaries: jobTitle → province → band → salary[]
const groups: Record<string, Record<string, Record<BandKey, number[]>>> = {};

for (const r of records) {
  jobTitlesSet.add(r.jobTitle);
  if (r.province) provincesSet.add(r.province);

  const job = r.jobTitle;
  const prov = r.province || "_unknown";
  const band = toBand(r.monthsOfExperience ?? 0);

  if (!groups[job]) groups[job] = {};

  // Per-province per-band
  if (!groups[job][prov]) groups[job][prov] = { junior: [], mid: [], senior: [], _all: [] };
  groups[job][prov][band].push(r.salary);
  groups[job][prov]._all.push(r.salary);

  // All-province per-band
  if (!groups[job]._all) groups[job]._all = { junior: [], mid: [], senior: [], _all: [] };
  groups[job]._all[band].push(r.salary);
  groups[job]._all._all.push(r.salary);
}

// Aggregate: compute stats, skip groups with < 3 records
const MIN_SAMPLE = 3;
const data: Record<string, JobData> = {};

for (const [job, provinces] of Object.entries(groups)) {
  data[job] = {};
  for (const [prov, bands] of Object.entries(provinces)) {
    const provData: ProvinceData = {};
    for (const [band, salaries] of Object.entries(bands)) {
      if (salaries.length >= MIN_SAMPLE) {
        const stats = computeStats(salaries);
        if (stats) provData[band as BandKey] = stats;
      }
    }
    // Only include province if it has at least one band with data
    if (Object.keys(provData).length > 0) {
      data[job][prov] = provData;
    }
  }
}

const jobTitles = [...jobTitlesSet].sort();
const provinces = [...provincesSet].sort();

const output: AggregatedOutput = {
  meta: {
    totalRecords: allRecords.length,
    validRecords: records.length,
    generatedAt: new Date().toISOString().split("T")[0],
    jobTitles,
    provinces,
    source: "Datapizza AI Lab - Italian Tech Salaries (2024-2026)",
  },
  data,
};

fs.writeFileSync(OUTPUT, JSON.stringify(output), "utf8");

const sizeKB = Math.round(fs.statSync(OUTPUT).size / 1024);
console.log(`Output: ${OUTPUT} (${sizeKB} KB)`);
console.log(`Job titles with data: ${Object.keys(data).length}`);
console.log(`Done.`);
