/**
 * verify-prerender.mjs
 *
 * Post-build verification: checks every SEO-critical prerendered HTML file for:
 *   - Non-empty <div id="root">
 *   - <meta name="description"> present with content
 *   - <script type="application/ld+json"> present with expected schema types
 *   - <title> present and not generic "Forfettino"
 *   - Expected keyword present in prerendered body content
 *
 * Exit code 1 if any check fails (safety net for CI).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getIndexableRoutes } from "./seo-content.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, "../dist");

// Keywords to verify per route (spot-check content rendering)
const EXPECTED_KEYWORDS = {
  "/": "netto spendibile",
  "/calcolatore-forfettario": "regime forfettario",
  "/blog": "Forfettino",
  "/blog/calcolo-tasse-regime-forfettario-2026": "imposta sostitutiva",
  "/blog/contributi-inps-regime-forfettario-2026": "26,07",
  "/blog/scadenze-fiscali-forfettario-2026": "scadenze",
  "/blog/aprire-partita-iva-forfettaria-2026": "partita IVA",
  "/faq": "regime forfettario",
  "/glossario": "regime forfettario",
};

const EXPECTED_SCHEMA_TYPES = {
  "/": ["FAQPage", "SoftwareApplication", "WebPage"],
  "/calcolatore-forfettario": ["WebApplication", "BreadcrumbList", "FAQPage"],
  "/blog": ["CollectionPage"],
  "/pro-presto": ["BreadcrumbList", "FAQPage"],
  "/privacy-policy": ["Organization"],
  "/cookie-policy": ["Organization"],
  "/terms": ["Organization"],
  "/faq": ["FAQPage", "BreadcrumbList", "WebPage"],
  "/glossario": ["DefinedTermSet", "FAQPage", "BreadcrumbList", "WebPage"],
};

function getRootHtml(html) {
  const rootStart = html.indexOf('<div id="root">');
  if (rootStart === -1) return "";
  const bodyEnd = html.indexOf("</body>", rootStart);
  return bodyEnd === -1 ? html.slice(rootStart) : html.slice(rootStart, bodyEnd);
}

function getExpectedKeyword(route) {
  if (EXPECTED_KEYWORDS[route.path]) return EXPECTED_KEYWORDS[route.path];
  return route.title;
}

function collectSchemaTypes(schema, types = new Set()) {
  if (!schema || typeof schema !== "object") return types;

  const schemaType = schema["@type"];
  if (Array.isArray(schemaType)) {
    schemaType.forEach((type) => types.add(type));
  } else if (schemaType) {
    types.add(schemaType);
  }

  if (Array.isArray(schema["@graph"])) {
    schema["@graph"].forEach((node) => collectSchemaTypes(node, types));
  }

  return types;
}

function extractJsonLdTypes(html, issues) {
  const scripts = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  const types = new Set();
  let count = 0;

  for (const script of scripts) {
    count++;
    const rawJson = script[1].trim();
    if (!rawJson) {
      issues.push("empty JSON-LD script");
      continue;
    }

    try {
      collectSchemaTypes(JSON.parse(rawJson), types);
    } catch (error) {
      issues.push(`invalid JSON-LD script: ${error.message}`);
    }
  }

  return { count, types };
}

function getExpectedSchemaTypes(route) {
  if (route.path.startsWith("/blog/")) {
    return ["Article", "BreadcrumbList"];
  }

  return EXPECTED_SCHEMA_TYPES[route.path] ?? ["Organization"];
}

function includesText(haystack, needle) {
  return haystack.toLocaleLowerCase("it-IT").includes(needle.toLocaleLowerCase("it-IT"));
}

function verify() {
  const routes = getIndexableRoutes();
  let failures = 0;
  let checked = 0;

  for (const route of routes) {
    const filePath = path.join(distPath, route.output);

    if (!fs.existsSync(filePath)) {
      console.error(`❌ MISSING: ${route.output} (route ${route.path})`);
      failures++;
      continue;
    }

    const html = fs.readFileSync(filePath, "utf-8");
    const rootHtml = getRootHtml(html);
    const issues = [];

    // 1. Root not empty (check for the exact empty-root pattern)
    if (html.includes('<div id="root"></div>')) {
      issues.push("root is empty (no prerendered content)");
    } else if (!html.includes('<div id="root">')) {
      issues.push("root div not found");
    }

    // 2. Meta description
    const descMatch = html.match(/<meta name="description" content="([^"]*)"/);
    if (!descMatch || descMatch[1].length < 10) {
      issues.push("missing or empty meta description");
    }

    // 3. JSON-LD — verify actual schema types, not just script count
    const { count: ldCount, types: ldTypes } = extractJsonLdTypes(html, issues);
    if (ldCount === 0) {
      issues.push("missing JSON-LD script");
    }

    const expectedSchemaTypes = getExpectedSchemaTypes(route);
    for (const expectedType of expectedSchemaTypes) {
      if (!ldTypes.has(expectedType)) {
        issues.push(`missing JSON-LD schema type "${expectedType}"`);
      }
    }

    // 4. Title not generic
    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    if (!titleMatch || titleMatch[1] === "Forfettino") {
      issues.push("title is missing or generic");
    }

    // 5. Expected keyword in prerendered body content for every SEO route
    const keyword = getExpectedKeyword(route);
    if (!keyword || !includesText(rootHtml, keyword)) {
      issues.push(`keyword "${keyword}" not found`);
    }

    checked++;

    if (issues.length > 0) {
      console.error(`❌ ${route.path} (${route.output}):`);
      issues.forEach((i) => console.error(`   - ${i}`));
      failures++;
    } else {
      console.log(`✅ ${route.path}`);
    }
  }

  console.log(`\n${checked} pages checked, ${failures} failed.`);

  if (failures > 0) {
    console.error("\n⛔ Prerender verification FAILED. Fix issues above before deploying.");
    process.exit(1);
  }

  console.log("🎉 All prerendered pages pass verification.");
}

verify();
