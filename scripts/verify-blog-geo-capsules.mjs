#!/usr/bin/env node
/**
 * verify-blog-geo-capsules.mjs
 *
 * Validates that every informational H2 in blog articles:
 *   1. Ends with '?'
 *   2. Contains at least 8 words
 *   3. Is immediately followed by a capsule paragraph (120-150 chars)
 *   4. Capsule has no markdown syntax (links, bold, italic, code)
 *   5. Capsule contains a factual signal (digit, %, EUR, INPS, AdE, Legge, etc.)
 *
 * Structural H2s are excluded: "Domande frequenti*", "In sintesi", "Calcola le tue tasse*"
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const CONTENT_DIR = join(process.cwd(), '_bmad-output', 'content');

// H2s that are structural/promotional — skip them
const STRUCTURAL_H2_PATTERNS = [
  /^## Domande frequenti/i,
  /^## In sintesi/i,
  /^## Calcola le tue tasse/i,
];

// Epic 79.5 — Non-question H2 whitelist. These exact H2 titles are allowed to bypass
// the "must be question + capsule" rule. Keep this set MINIMAL: adding entries here
// creates holes in the GEO capsule validation surface. Every new exception must be
// documented explicitly in the story that introduces it.
const NON_QUESTION_H2_WHITELIST = new Set([
  'Fonti e riferimenti',
]);

// Factual signal patterns
const FACTUAL_SIGNALS = [
  /\d/,                     // any digit
  /%/,                      // percentage
  /EUR/i,                   // currency
  /INPS/,                   // institution
  /AdE/,                    // Agenzia delle Entrate
  /Legge/i,                 // law reference
  /D\.Lgs\./,               // decree
  /Circolare/i,             // circular
  /L\.\s*\d/,               // L. 190, L. 197 etc.
  /art\./i,                 // article reference
  /imposta/i,               // fiscal concept
  /aliquota/i,              // fiscal concept
  /contribut/i,             // contributions
  /reddito/i,               // income concept
  /forfett/i,               // regime concept
  /Gestione Separata/i,     // INPS management type
  /Artigian/i,              // INPS management type
  /Commerciant/i,           // INPS management type
  /minimale/i,              // fiscal concept
  /massimale/i,             // fiscal concept
  /coefficiente/i,          // fiscal concept
  /ATECO/i,                 // code classification
  /flat tax/i,              // fiscal concept
  /IRPEF/i,                 // tax type
  /IVA/,                    // tax type
  /SdI/,                    // Sistema di Interscambio
  /CAD/,                    // Codice Amministrazione Digitale
  /D\.L\./,                 // decreto-legge
];

// Markdown syntax that should NOT appear in capsules
const MARKDOWN_PATTERNS = [
  /\[.*?\]\(.*?\)/,         // links [text](url)
  /https?:\/\//,            // URLs
  /\*\*.+?\*\*/,            // bold **text**
  /\*.+?\*/,                // italic *text*  (but not ** already caught)
  /`.+?`/,                  // inline code
  /^[-*+]\s/,               // list items
  /^\|/,                    // table rows
];

function isStructuralH2(line) {
  return STRUCTURAL_H2_PATTERNS.some(p => p.test(line));
}

function h2PlainText(line) {
  return line.replace(/^##\s+/, '').trim();
}

function isWhitelistedH2(line) {
  return NON_QUESTION_H2_WHITELIST.has(h2PlainText(line));
}

function hasFactualSignal(text) {
  return FACTUAL_SIGNALS.some(p => p.test(text));
}

function hasMarkdownSyntax(text) {
  return MARKDOWN_PATTERNS.some(p => p.test(text));
}

function countWords(text) {
  // Remove the '## ' prefix for word counting
  const cleaned = text.replace(/^##\s+/, '').replace(/\?$/, '').trim();
  return cleaned.split(/\s+/).filter(w => w.length > 0).length;
}

function stripFrontmatter(content) {
  if (content.startsWith('---')) {
    const endIdx = content.indexOf('---', 3);
    if (endIdx !== -1) {
      return content.slice(endIdx + 3);
    }
  }
  return content;
}

function validateFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const body = stripFrontmatter(content);
  const lines = body.split('\n');
  const errors = [];
  const fileName = filePath.split('/').pop();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip non-H2 lines
    if (!line.startsWith('## ')) continue;

    // Skip structural H2s
    if (isStructuralH2(line)) continue;

    // Epic 79.5 — skip whitelisted non-question H2s (e.g. "Fonti e riferimenti")
    if (isWhitelistedH2(line)) continue;

    const lineNum = i + 1;
    const h2Text = line;

    // Check 1: ends with ?
    if (!h2Text.endsWith('?')) {
      errors.push(`${fileName}:${lineNum} — H2 non termina con '?': "${h2Text}"`);
      continue; // skip further checks for this H2
    }

    // Check 2: at least 8 words
    const wordCount = countWords(h2Text);
    if (wordCount < 8) {
      errors.push(`${fileName}:${lineNum} — H2 ha solo ${wordCount} parole (minimo 8): "${h2Text}"`);
    }

    // Find next non-empty line (the capsule)
    let capsuleLine = null;
    let capsuleLineNum = -1;
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].trim() !== '') {
        capsuleLine = lines[j].trim();
        capsuleLineNum = j + 1;
        break;
      }
    }

    if (!capsuleLine) {
      errors.push(`${fileName}:${lineNum} — H2 non seguito da capsule (fine file)`);
      continue;
    }

    // Check capsule is not another heading or structural element
    if (capsuleLine.startsWith('#') || capsuleLine.startsWith('|') || capsuleLine.startsWith('```') || capsuleLine.startsWith('-')) {
      errors.push(`${fileName}:${capsuleLineNum} — Manca capsule dopo H2 (trovato: ${capsuleLine.slice(0, 60)}...)`);
      continue;
    }

    // Check 3: capsule length 120-150 chars
    const capsuleLen = capsuleLine.length;
    if (capsuleLen < 120 || capsuleLen > 150) {
      errors.push(`${fileName}:${capsuleLineNum} — Capsule fuori range (${capsuleLen} char, atteso 120-150): "${capsuleLine.slice(0, 80)}..."`);
    }

    // Check 4: no markdown syntax in capsule
    if (hasMarkdownSyntax(capsuleLine)) {
      errors.push(`${fileName}:${capsuleLineNum} — Capsule contiene sintassi markdown: "${capsuleLine.slice(0, 80)}..."`);
    }

    // Check 5: factual signal in capsule
    if (!hasFactualSignal(capsuleLine)) {
      errors.push(`${fileName}:${capsuleLineNum} — Capsule senza segnale fattuale: "${capsuleLine.slice(0, 80)}..."`);
    }
  }

  return errors;
}

// Main
const files = readdirSync(CONTENT_DIR)
  .filter(f => f.startsWith('blog-') && f.endsWith('.md'))
  .sort();

console.log(`\n🔍 Validating ${files.length} blog articles for GEO capsules...\n`);

let totalErrors = 0;
let totalH2Questions = 0;
let totalH2Whitelist = 0;
let totalH2Structural = 0;

for (const file of files) {
  const filePath = join(CONTENT_DIR, file);
  const errors = validateFile(filePath);

  // Classify H2s: structural (skipped silently), whitelist (skipped by Epic 79.5),
  // question (validated with capsule rule)
  const content = readFileSync(filePath, 'utf-8');
  const body = stripFrontmatter(content);
  const allH2 = body.split('\n').filter(l => l.trim().startsWith('## ')).map(l => l.trim());
  const structural = allH2.filter(isStructuralH2).length;
  const whitelist = allH2.filter(l => !isStructuralH2(l) && isWhitelistedH2(l)).length;
  const questions = allH2.length - structural - whitelist;

  totalH2Structural += structural;
  totalH2Whitelist += whitelist;
  totalH2Questions += questions;

  if (errors.length > 0) {
    console.log(`❌ ${file} (${questions} Q-H2, ${whitelist} whitelist, ${errors.length} errors)`);
    errors.forEach(e => console.log(`   ${e}`));
    totalErrors += errors.length;
  } else {
    console.log(`✅ ${file} (${questions} Q-H2, ${whitelist} whitelist)`);
  }
}

const totalAllH2 = totalH2Questions + totalH2Whitelist + totalH2Structural;
console.log(`\n📊 Summary:`);
console.log(`   H2 totali : ${totalAllH2}`);
console.log(`   H2 domanda (capsule required): ${totalH2Questions}`);
console.log(`   H2 whitelist (Epic 79.5, skip): ${totalH2Whitelist}`);
console.log(`   H2 structural (skip): ${totalH2Structural}`);
console.log(`   Errori: ${totalErrors}\n`);

if (totalErrors > 0) {
  console.error(`\n❌ FAILED: ${totalErrors} capsule validation errors.\n`);
  process.exit(1);
} else {
  console.log(`\n✅ ALL CAPSULES VALID.\n`);
}
