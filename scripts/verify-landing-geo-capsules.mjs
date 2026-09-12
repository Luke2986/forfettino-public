#!/usr/bin/env node
/**
 * verify-landing-geo-capsules.mjs — Epic 79.3
 *
 * Validates the prerendered landing page (dist/index.html) for GEO/LLMO readiness:
 *
 *   1. Every informational <h2> is a question of 8+ words ending with '?'
 *   2. Every informational <h2> is followed by a <p> "answer capsule" of
 *      120-150 characters (robust lookup: tolerates wrapper divs/spans by
 *      walking forward up to 3 sibling elements before giving up)
 *   3. The capsule contains no forbidden inline markup (links, bold, italic, code)
 *   4. The capsule contains at least one factual signal (digit, %, EUR, INPS,
 *      ATECO, Legge, forfett*, etc.)
 *   5. The DOM contains at least one semantic <table> with <thead> and >= 3 rows
 *   6. Every FAQ answer has <= 4 sentences — checked BOTH from FAQPage JSON-LD
 *      AND from AccordionContent DOM nodes (forceMount) to satisfy AC #8
 *      literally ("nel markup prerenderizzato"). The two sources must align.
 *
 * Structural/promotional/emotional H2s are excluded from the question-check.
 *
 * Exits with code 1 on any violation so it can gate CI / pre-release manually.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { JSDOM } from 'jsdom';

const DIST_HTML = join(process.cwd(), 'dist', 'index.html');

// H2 texts (normalized) that are NOT informational — skip question/capsule check.
// Matching is done on the normalized text content (lowercase, whitespace-collapsed).
const STRUCTURAL_H2_TEXTS = [
  'forfettino e per te?',
  'forfettino è per te?',
  'forfettino pro arriva presto',
  'domande frequenti',
  'quanto puoi spendere oggi?',
  // Epic 79.5 — non-question authority section, bypasses capsule rule
  'fonti e riferimenti',
];

// Factual signals — at least one must appear in every capsule
const FACTUAL_SIGNALS = [
  /\d/,
  /%/,
  /EUR/i,
  /INPS/,
  /ATECO/i,
  /forfett/i,
  /aliquota/i,
  /coefficiente/i,
  /gestione/i,
  /soglia/i,
  /minimale/i,
  /contribut/i,
  /imposta/i,
  /Legge/i,
  /D\.Lgs\./,
  /Circolare/i,
  /2026/,
  /85\.?000/,
  /IRPEF/i,
  /scaden/i,
  /acconto/i,
  /saldo/i,
];

// Forbidden inline markup inside the capsule's textContent
// (we also check DOM-level: no <a>, <strong>, <em>, <code>, <b>, <i> inside the capsule)
const FORBIDDEN_TEXT_PATTERNS = [
  /\*\*/,
  /`/,
  /https?:\/\//i,
  /\[.*?\]\(.*?\)/,
];

const FORBIDDEN_INLINE_TAGS = ['A', 'STRONG', 'B', 'EM', 'I', 'CODE'];

function normalize(text) {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

function countWords(text) {
  return text
    .replace(/\?$/, '')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

function hasFactualSignal(text) {
  return FACTUAL_SIGNALS.some((p) => p.test(text));
}

function hasForbiddenText(text) {
  return FORBIDDEN_TEXT_PATTERNS.some((p) => p.test(text));
}

function hasForbiddenInline(el) {
  return FORBIDDEN_INLINE_TAGS.some(
    (tag) => el.querySelector(tag.toLowerCase()) !== null,
  );
}

function isStructuralH2(text) {
  const n = normalize(text);
  return STRUCTURAL_H2_TEXTS.some((s) => n === normalize(s));
}

/**
 * Count sentences in a text, excluding common Italian abbreviations and decimals.
 * Returns the number of sentence-terminators (. ! ?).
 */
function countSentences(text) {
  let cleaned = text;
  cleaned = cleaned.replace(/\d+[.,]\d+/g, 'X');     // decimals: 4.521 / 26,07
  cleaned = cleaned.replace(/D\.Lgs\./g, 'X');        // decreto
  cleaned = cleaned.replace(/art\.\s*\d+/gi, 'X');    // article references
  cleaned = cleaned.replace(/n\.\s*\d+/gi, 'X');      // number references
  cleaned = cleaned.replace(/comma\s*\d+/gi, 'X');
  cleaned = cleaned.replace(/L\.\s*\d+/g, 'X');
  const matches = cleaned.match(/[.!?]+/g) || [];
  return matches.length;
}

function extractFaqAnswers(doc) {
  // FAQPage JSON-LD is emitted by react-helmet-async in a <script type="application/ld+json">
  const scripts = Array.from(
    doc.querySelectorAll('script[type="application/ld+json"]'),
  );
  const candidates = [];
  for (const s of scripts) {
    try {
      const data = JSON.parse(s.textContent || '');
      if (!data) continue;
      // Direct FAQPage block
      if (data['@type'] === 'FAQPage' && Array.isArray(data.mainEntity)) {
        candidates.push(data);
      }
      // FAQPage inside @graph (story 79.6)
      if (Array.isArray(data['@graph'])) {
        for (const node of data['@graph']) {
          if (node && node['@type'] === 'FAQPage' && Array.isArray(node.mainEntity)) {
            candidates.push(node);
          }
        }
      }
    } catch {
      // ignore malformed JSON-LD
    }
  }
  if (candidates.length === 0) return [];
  const first = candidates[0];
  return first.mainEntity.map((q) => ({
    question: q.name || '',
    answer: (q.acceptedAnswer && q.acceptedAnswer.text) || '',
  }));
}

function main() {
  const errors = [];

  if (!existsSync(DIST_HTML)) {
    console.error(`❌ ${DIST_HTML} non trovato — esegui prima 'npm run build'.`);
    process.exit(1);
  }

  const html = readFileSync(DIST_HTML, 'utf-8');
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  // ─── 1-4. H2 + capsule check ──────────────────────────────────────────────
  const h2s = Array.from(doc.querySelectorAll('h2'));
  let informationalCount = 0;
  let capsuleOkCount = 0;

  for (const h2 of h2s) {
    const text = (h2.textContent || '').replace(/\s+/g, ' ').trim();

    if (!text) continue;
    if (isStructuralH2(text)) continue;

    informationalCount++;

    // Check ends with ?
    if (!text.endsWith('?')) {
      errors.push(`H2 non termina con '?': "${text}"`);
      continue;
    }

    // Check 8+ words
    const words = countWords(text);
    if (words < 8) {
      errors.push(`H2 ha solo ${words} parole (minimo 8): "${text}"`);
    }

    // Find the capsule <p>: walk forward up to 3 sibling elements, tolerating
    // wrapper divs/spans (icon rows, pill badges) but stopping at any heading.
    let nextEl = h2.nextElementSibling;
    let hops = 0;
    while (nextEl && hops < 3) {
      if (/^H[1-6]$/.test(nextEl.tagName)) {
        nextEl = null;
        break;
      }
      if (nextEl.tagName === 'P') break;
      nextEl = nextEl.nextElementSibling;
      hops++;
    }
    if (!nextEl || nextEl.tagName !== 'P') {
      errors.push(
        `H2 "${text}" non seguito da <p> capsule entro 3 fratelli`,
      );
      continue;
    }

    const capsuleText = (nextEl.textContent || '').replace(/\s+/g, ' ').trim();
    const len = capsuleText.length;
    if (len < 120 || len > 150) {
      errors.push(
        `Capsule dopo "${text.slice(0, 50)}..." fuori range: ${len} char (atteso 120-150). Testo: "${capsuleText}"`,
      );
    }

    if (hasForbiddenText(capsuleText)) {
      errors.push(
        `Capsule dopo "${text.slice(0, 50)}..." contiene markup vietato nel testo: "${capsuleText}"`,
      );
    }

    if (hasForbiddenInline(nextEl)) {
      errors.push(
        `Capsule dopo "${text.slice(0, 50)}..." contiene tag inline vietati (a/strong/em/b/i/code)`,
      );
    }

    if (!hasFactualSignal(capsuleText)) {
      errors.push(
        `Capsule dopo "${text.slice(0, 50)}..." senza segnale fattuale: "${capsuleText}"`,
      );
    }

    if (len >= 120 && len <= 150 && !hasForbiddenText(capsuleText) && !hasForbiddenInline(nextEl) && hasFactualSignal(capsuleText) && text.endsWith('?') && words >= 8) {
      capsuleOkCount++;
    }
  }

  if (informationalCount < 5) {
    errors.push(
      `Solo ${informationalCount} H2 informativi trovati nella landing (minimo 5 richiesti da AC #1).`,
    );
  }

  // ─── 5. Semantic table check ──────────────────────────────────────────────
  const tables = Array.from(doc.querySelectorAll('table'));
  const semanticTables = tables.filter((t) => {
    const thead = t.querySelector('thead');
    const tbody = t.querySelector('tbody');
    if (!thead || !tbody) return false;
    const rows = tbody.querySelectorAll('tr');
    return rows.length >= 3;
  });
  if (semanticTables.length === 0) {
    errors.push(
      `Nessuna tabella semantica trovata (richiesta almeno 1 con <thead> e >= 3 righe in <tbody>).`,
    );
  }

  // ─── 6. FAQ answer sentence count — BOTH JSON-LD and DOM (forceMount) ─────
  const faqAnswers = extractFaqAnswers(doc);
  if (faqAnswers.length !== 14) {
    errors.push(
      `FAQPage JSON-LD deve contenere esattamente 14 item (trovati: ${faqAnswers.length}).`,
    );
  }

  for (const { question, answer } of faqAnswers) {
    const sentences = countSentences(answer);
    if (sentences > 4) {
      errors.push(
        `FAQ JSON-LD "${question}" ha ${sentences} frasi (max 4): "${answer.slice(0, 80)}..."`,
      );
    }
    if (!answer || answer.length < 20) {
      errors.push(`FAQ JSON-LD "${question}" con risposta troppo corta o mancante.`);
    }
  }

  // 6b. DOM check: AccordionContent uses forceMount so answers are in the
  // prerendered markup. We scope to #faq > ... > [data-state] Radix containers
  // (the Accordion). Fall back to any element matching the Radix content selector.
  const faqSection = doc.getElementById('faq');
  let domFaqCount = 0;
  if (faqSection) {
    // Radix Accordion renders AccordionContent as [data-radix-collection-item]
    // or [data-state] inside the accordion. Use a resilient selector:
    // every element whose id matches "radix-*content*" or role="region".
    const contents = Array.from(
      faqSection.querySelectorAll('[role="region"], [id*="content"]'),
    ).filter((el) => {
      const t = (el.textContent || '').trim();
      return t.length > 20;
    });
    domFaqCount = contents.length;

    for (const el of contents) {
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      const sentences = countSentences(text);
      if (sentences > 4) {
        errors.push(
          `FAQ DOM (AccordionContent) ha ${sentences} frasi (max 4): "${text.slice(0, 80)}..."`,
        );
      }
    }

    if (domFaqCount > 0 && domFaqCount !== faqAnswers.length) {
      errors.push(
        `FAQ drift: ${faqAnswers.length} item in JSON-LD vs ${domFaqCount} in AccordionContent DOM.`,
      );
    }
  }

  // ─── Report ───────────────────────────────────────────────────────────────
  console.log(`\n🔍 Landing GEO validator (dist/index.html)`);
  console.log(
    `   ${informationalCount} H2 informativi, ${capsuleOkCount} capsule valide, ${semanticTables.length} tabelle semantiche, ${faqAnswers.length} FAQ FAQPage, ${domFaqCount} FAQ DOM.`,
  );

  if (errors.length > 0) {
    console.error(`\n❌ FAILED: ${errors.length} errori\n`);
    errors.forEach((e, i) => console.error(`   ${i + 1}. ${e}`));
    process.exit(1);
  } else {
    console.log(`\n✅ Landing GEO validation OK.\n`);
  }
}

main();
