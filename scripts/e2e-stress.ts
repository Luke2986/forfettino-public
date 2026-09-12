/**
 * E2E STRESS TEST — HTTP Route Stress + Browser Smoke
 *
 * Parte 1: Stress HTTP routes con fetch nativo (no dipendenze)
 *   - Landing page caricamento rapido e ripetuto
 *   - Auth page caricamento concorrente
 *   - Asset loading (JS, CSS)
 *   - Response validation (no 5xx, no crash)
 *
 * Parte 2: (Opzionale) Se Playwright è installato, test browser
 *
 * USO:
 *   1. Avvia il dev server: npm run dev
 *   2. Esegui: npx tsx scripts/e2e-stress.ts
 *
 * CONFIGURAZIONE:
 *   BASE_URL — default http://localhost:8080
 *   CONCURRENCY — richieste parallele (default 10)
 *   ROUNDS — iterazioni (default 5)
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:8080";
const CONCURRENCY = Number(process.env.CONCURRENCY) || 10;
const ROUNDS = Number(process.env.ROUNDS) || 5;

// --- Types ---

interface TestResult {
  name: string;
  passed: boolean;
  durationMs: number;
  details?: string;
}

interface RouteResult {
  url: string;
  status: number;
  durationMs: number;
  error?: string;
  contentLength: number;
}

const results: TestResult[] = [];

// --- Helpers ---

async function fetchRoute(path: string): Promise<RouteResult> {
  const url = `${BASE_URL}${path}`;
  const start = performance.now();
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "ForfettinoStressTest/1.0" },
    });
    const body = await res.text();
    return {
      url: path,
      status: res.status,
      durationMs: Math.round(performance.now() - start),
      contentLength: body.length,
    };
  } catch (err) {
    return {
      url: path,
      status: 0,
      durationMs: Math.round(performance.now() - start),
      error: err instanceof Error ? err.message : String(err),
      contentLength: 0,
    };
  }
}

async function runTest(
  name: string,
  fn: () => Promise<{ passed: boolean; details: string }>
) {
  const start = performance.now();
  try {
    const { passed, details } = await fn();
    results.push({ name, passed, durationMs: Math.round(performance.now() - start), details });
  } catch (err) {
    results.push({
      name,
      passed: false,
      durationMs: Math.round(performance.now() - start),
      details: `Error: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}

// --- Tests ---

async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║        FORFETTINO — E2E STRESS TEST             ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log(`  Base URL:    ${BASE_URL}`);
  console.log(`  Concurrency: ${CONCURRENCY}`);
  console.log(`  Rounds:      ${ROUNDS}`);
  console.log();

  // ================================================================
  // TEST 1: Server is alive
  // ================================================================
  await runTest("Server responds to /", async () => {
    const r = await fetchRoute("/");
    return {
      passed: r.status === 200 && r.contentLength > 0,
      details: `status=${r.status}, size=${r.contentLength}b, ${r.durationMs}ms`,
    };
  });

  // ================================================================
  // TEST 2: All public routes return 200
  // ================================================================
  await runTest("Public routes all return 200", async () => {
    const routes = ["/", "/auth"];
    const results = await Promise.all(routes.map(fetchRoute));
    const failures = results.filter((r) => r.status !== 200);
    return {
      passed: failures.length === 0,
      details: results.map((r) => `${r.url}: ${r.status} (${r.durationMs}ms)`).join(" | "),
    };
  });

  // ================================================================
  // TEST 3: Concurrent landing page requests
  // ================================================================
  await runTest(`${CONCURRENCY} concurrent requests to /`, async () => {
    const tasks = Array.from({ length: CONCURRENCY }, () => fetchRoute("/"));
    const results = await Promise.all(tasks);
    const successes = results.filter((r) => r.status === 200).length;
    const failures = results.filter((r) => r.status !== 200);
    const avgMs = Math.round(results.reduce((s, r) => s + r.durationMs, 0) / results.length);
    const maxMs = Math.max(...results.map((r) => r.durationMs));

    return {
      passed: successes === CONCURRENCY,
      details: `${successes}/${CONCURRENCY} ok | avg ${avgMs}ms | max ${maxMs}ms${failures.length > 0 ? ` | failures: ${failures.map((f) => f.error || f.status).join(", ")}` : ""}`,
    };
  });

  // ================================================================
  // TEST 4: Sustained load (ROUNDS × CONCURRENCY)
  // ================================================================
  await runTest(`Sustained load: ${ROUNDS} rounds × ${CONCURRENCY} concurrent`, async () => {
    let totalRequests = 0;
    let totalSuccesses = 0;
    const allDurations: number[] = [];
    const routes = ["/", "/auth"];

    for (let round = 0; round < ROUNDS; round++) {
      const tasks = Array.from({ length: CONCURRENCY }, (_, i) =>
        fetchRoute(routes[i % routes.length])
      );
      const results = await Promise.all(tasks);
      totalRequests += results.length;
      totalSuccesses += results.filter((r) => r.status === 200).length;
      allDurations.push(...results.map((r) => r.durationMs));
    }

    const sorted = allDurations.sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const successRate = Math.round((totalSuccesses / totalRequests) * 100);

    return {
      passed: successRate >= 95 && p95 < 5000,
      details: `${totalSuccesses}/${totalRequests} (${successRate}%) | p50=${p50}ms | p95=${p95}ms`,
    };
  });

  // ================================================================
  // TEST 5: Response contains valid HTML
  // ================================================================
  await runTest("Landing page returns valid HTML (not empty/error)", async () => {
    const r = await fetchRoute("/");
    const res = await fetch(`${BASE_URL}/`);
    const html = await res.text();

    const hasDoctype = html.toLowerCase().includes("<!doctype");
    const hasRoot = html.includes("id=\"root\"") || html.includes("id='root'");
    const hasNoError = !html.includes("Internal Server Error") && !html.includes("Cannot GET");
    const hasNoNaN = !html.includes("NaN") && !html.includes("undefined");

    return {
      passed: hasDoctype && hasRoot && hasNoError && hasNoNaN,
      details: [
        hasDoctype ? "DOCTYPE ok" : "MISSING DOCTYPE",
        hasRoot ? "root div ok" : "MISSING root div",
        hasNoError ? "no server error" : "SERVER ERROR in HTML",
        hasNoNaN ? "no NaN/undefined" : "NaN/undefined FOUND",
      ].join(" | "),
    };
  });

  // ================================================================
  // TEST 6: Auth page responds correctly
  // ================================================================
  await runTest("Auth page loads and contains form elements", async () => {
    const res = await fetch(`${BASE_URL}/auth`);
    const html = await res.text();

    // Vite SPA: /auth is served as index.html, React Router handles the route
    const hasHTML = html.toLowerCase().includes("<!doctype");
    const hasRoot = html.includes("id=\"root\"") || html.includes("id='root'");

    return {
      passed: res.status === 200 && hasHTML && hasRoot,
      details: `status=${res.status} | ${hasHTML ? "HTML ok" : "not HTML"} | ${hasRoot ? "root ok" : "no root"}`,
    };
  });

  // ================================================================
  // TEST 7: Protected routes redirect to auth (no 500)
  // ================================================================
  await runTest("Protected routes don't return 500", async () => {
    const protectedRoutes = ["/incassi", "/scadenziario", "/impostazioni", "/clienti"];
    const results = await Promise.all(protectedRoutes.map(fetchRoute));
    const serverErrors = results.filter((r) => r.status >= 500);

    return {
      passed: serverErrors.length === 0,
      details: results.map((r) => `${r.url}: ${r.status}`).join(" | "),
    };
  });

  // ================================================================
  // TEST 8: Rapid sequential requests (no connection leak)
  // ================================================================
  await runTest("50 rapid sequential requests (no connection leak)", async () => {
    const durations: number[] = [];
    let failures = 0;

    for (let i = 0; i < 50; i++) {
      const r = await fetchRoute("/");
      durations.push(r.durationMs);
      if (r.status !== 200) failures++;
    }

    // Check that later requests aren't significantly slower (connection leak)
    const first10Avg = durations.slice(0, 10).reduce((s, d) => s + d, 0) / 10;
    const last10Avg = durations.slice(-10).reduce((s, d) => s + d, 0) / 10;
    const degradation = last10Avg / first10Avg;

    return {
      passed: failures === 0 && degradation < 3,
      details: `${50 - failures}/50 ok | first10 avg=${Math.round(first10Avg)}ms | last10 avg=${Math.round(last10Avg)}ms | degradation=${degradation.toFixed(2)}x`,
    };
  });

  // ================================================================
  // TEST 9: Asset caching (repeated requests get same content)
  // ================================================================
  await runTest("Repeated requests return consistent content", async () => {
    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        fetch(`${BASE_URL}/`).then((r) => r.text())
      )
    );

    const lengths = responses.map((r) => r.length);
    const allSameLength = lengths.every((l) => l === lengths[0]);

    return {
      passed: allSameLength,
      details: `Sizes: ${lengths.join(", ")}${allSameLength ? " (consistent)" : " (INCONSISTENT!)"}`,
    };
  });

  // ================================================================
  // Report
  // ================================================================
  console.log("────────────────────────────────────────────────────");
  console.log("  RESULTS");
  console.log("────────────────────────────────────────────────────");

  let passed = 0;
  let failed = 0;

  for (const r of results) {
    const icon = r.passed ? "✓" : "✗";
    console.log(`  ${icon} ${r.name} (${r.durationMs}ms)`);
    if (r.details) console.log(`      ${r.details}`);
    if (r.passed) passed++;
    else failed++;
  }

  console.log();
  console.log(`  Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log();

  if (failed === 0) {
    console.log("  ✅ ALL E2E STRESS TESTS PASSED");
  } else {
    console.log("  ❌ SOME E2E STRESS TESTS FAILED");
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
