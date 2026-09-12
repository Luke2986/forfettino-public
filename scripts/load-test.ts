/**
 * LOAD TEST — Supabase Concurrent Query Stress
 *
 * Simula richieste concorrenti al database Supabase per verificare
 * che le query principali reggano sotto carico.
 *
 * USO:
 *   npx tsx scripts/load-test.ts
 *
 * Richiede le variabili d'ambiente:
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_PUBLISHABLE_KEY
 *
 * Configurazione:
 *   CONCURRENCY — numero di richieste parallele
 *   ROUNDS — numero di iterazioni
 *   TIMEOUT_MS — timeout per singola query
 *
 * NOTA: usa SOLO operazioni di lettura (SELECT) e la anon key.
 * Non modifica nessun dato. Sicuro da eseguire su qualsiasi ambiente.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Load .env manually (no dotenv dependency)
function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), ".env");
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env not found, rely on existing env vars
  }
}
loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !SUPABASE_URL.startsWith("http")) {
  console.error("❌ Missing or invalid VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY in .env");
  console.error("   Assicurati che .env contenga URL e key reali (non placeholder).");
  console.error(`   VITE_SUPABASE_URL = ${SUPABASE_URL || "(missing)"}`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Configuration ---
const CONCURRENCY = 20;   // richieste parallele per round
const ROUNDS = 5;         // iterazioni
const TIMEOUT_MS = 10000; // timeout per query

// --- Query definitions ---
interface QueryDef {
  name: string;
  fn: (client: SupabaseClient) => Promise<{ data: unknown; error: unknown }>;
}

const QUERIES: QueryDef[] = [
  {
    name: "fiscal_rules (select all)",
    fn: (c) => c.from("fiscal_rules").select("*").limit(10),
  },
  {
    name: "fiscal_rules (latest year)",
    fn: (c) => c.from("fiscal_rules").select("*").order("fiscal_year", { ascending: false }).limit(1),
  },
  {
    name: "profit_coeff_presets (all)",
    fn: (c) => c.from("profit_coeff_presets").select("*").limit(50),
  },
  {
    name: "profiles (count, head only)",
    fn: (c) => c.from("profiles").select("id", { count: "exact", head: true }),
  },
  {
    name: "receipts (count, head only)",
    fn: (c) => c.from("receipts").select("id", { count: "exact", head: true }),
  },
  {
    name: "tax_schedule (count, head only)",
    fn: (c) => c.from("tax_schedule").select("id", { count: "exact", head: true }),
  },
  {
    name: "fiscal_year_settings (count, head only)",
    fn: (c) => c.from("fiscal_year_settings").select("id", { count: "exact", head: true }),
  },
  {
    name: "tool_subscriptions (count, head only)",
    fn: (c) => c.from("tool_subscriptions").select("id", { count: "exact", head: true }),
  },
];

// --- Execution ---

interface QueryResult {
  name: string;
  durationMs: number;
  success: boolean;
  error?: string;
}

async function runQuery(query: QueryDef): Promise<QueryResult> {
  const start = performance.now();

  try {
    const result = await Promise.race([
      query.fn(supabase),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("TIMEOUT")), TIMEOUT_MS)
      ),
    ]);

    const durationMs = Math.round(performance.now() - start);

    if (result.error) {
      const errMsg = typeof result.error === "object" && result.error !== null
        ? (result.error as { message?: string }).message || JSON.stringify(result.error)
        : String(result.error);
      return {
        name: query.name,
        durationMs,
        success: false,
        error: errMsg,
      };
    }

    return { name: query.name, durationMs, success: true };
  } catch (err) {
    return {
      name: query.name,
      durationMs: Math.round(performance.now() - start),
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function runRound(roundNum: number): Promise<QueryResult[]> {
  // Create CONCURRENCY tasks by cycling through queries
  const tasks: Promise<QueryResult>[] = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    const query = QUERIES[i % QUERIES.length];
    tasks.push(runQuery(query));
  }

  return Promise.all(tasks);
}

async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║          FORFETTINO — LOAD TEST                 ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log();
  console.log(`  Supabase URL: ${SUPABASE_URL}`);
  console.log(`  Concurrency:  ${CONCURRENCY} queries/round`);
  console.log(`  Rounds:       ${ROUNDS}`);
  console.log(`  Timeout:      ${TIMEOUT_MS}ms`);
  console.log(`  Queries:      ${QUERIES.length} types`);
  console.log();

  const allResults: QueryResult[] = [];

  for (let round = 1; round <= ROUNDS; round++) {
    const roundStart = performance.now();
    const results = await runRound(round);
    const roundDuration = Math.round(performance.now() - roundStart);

    const successes = results.filter((r) => r.success).length;
    const failures = results.filter((r) => !r.success).length;
    const avgMs = Math.round(
      results.reduce((sum, r) => sum + r.durationMs, 0) / results.length
    );
    const maxMs = Math.max(...results.map((r) => r.durationMs));
    const minMs = Math.min(...results.map((r) => r.durationMs));

    console.log(
      `  Round ${round}/${ROUNDS}: ${successes}✓ ${failures}✗ | ` +
      `avg ${avgMs}ms | min ${minMs}ms | max ${maxMs}ms | total ${roundDuration}ms`
    );

    if (failures > 0) {
      const errors = results.filter((r) => !r.success);
      for (const e of errors) {
        console.log(`    ✗ ${e.name}: ${e.error}`);
      }
    }

    allResults.push(...results);
  }

  // --- Summary ---
  console.log();
  console.log("────────────────────────────────────────────────────");
  console.log("  SUMMARY");
  console.log("────────────────────────────────────────────────────");

  const totalQueries = allResults.length;
  const totalSuccesses = allResults.filter((r) => r.success).length;
  const totalFailures = allResults.filter((r) => !r.success).length;
  const allDurations = allResults.map((r) => r.durationMs).sort((a, b) => a - b);
  const p50 = allDurations[Math.floor(allDurations.length * 0.5)];
  const p95 = allDurations[Math.floor(allDurations.length * 0.95)];
  const p99 = allDurations[Math.floor(allDurations.length * 0.99)];

  console.log(`  Total queries: ${totalQueries}`);
  console.log(`  Success:       ${totalSuccesses} (${Math.round(totalSuccesses / totalQueries * 100)}%)`);
  console.log(`  Failures:      ${totalFailures}`);
  console.log(`  Latency p50:   ${p50}ms`);
  console.log(`  Latency p95:   ${p95}ms`);
  console.log(`  Latency p99:   ${p99}ms`);
  console.log();

  // Per-query breakdown
  console.log("  Per-query breakdown:");
  for (const q of QUERIES) {
    const qResults = allResults.filter((r) => r.name === q.name);
    if (qResults.length === 0) continue;
    const qSucc = qResults.filter((r) => r.success).length;
    const qAvg = Math.round(
      qResults.reduce((sum, r) => sum + r.durationMs, 0) / qResults.length
    );
    const qMax = Math.max(...qResults.map((r) => r.durationMs));
    console.log(
      `    ${q.name}: ${qSucc}/${qResults.length} ok | avg ${qAvg}ms | max ${qMax}ms`
    );
  }

  console.log();

  // Verdict
  const successRate = totalSuccesses / totalQueries;
  if (successRate >= 0.99 && p95 < 2000) {
    console.log("  ✅ PASS — All queries healthy under load");
  } else if (successRate >= 0.95) {
    console.log("  ⚠️  WARN — Some queries slow or failing under load");
  } else {
    console.log("  ❌ FAIL — Significant failures under load");
  }

  process.exit(totalFailures > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
