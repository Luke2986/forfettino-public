#!/usr/bin/env node
/**
 * verify-tldr.mjs — Epic 79.4
 *
 * Validates TL;DR "Executive Summary" blocks added to public pages per story 79.4.
 *
 * Part A — Blog markdown (_bmad-output/content/blog-*.md):
 *   1. Each blog must contain a TL;DR paragraph starting with the exact label
 *      "**In breve:** " (asterisk bold + colon + single space), placed
 *      immediately after the H1 title (ignoring blank lines only).
 *   2. Word count of the TL;DR text (excluding the label "In breve:") must be
 *      between 50 and 70 words (inclusive), split on /\s+/.
 *   3. No forbidden markup inside the TL;DR text: no markdown links
 *      [txt](url), no bare URLs, no extra bold, italic, inline code, lists,
 *      tables, headings. Only the label is allowed to be bold.
 *   4. At least 3 factual signals must appear in the TL;DR text (digits, %,
 *      EUR, Legge/D.Lgs./Circolare, ATECO, INPS, aliquota names, dates, etc.).
 *   5. The TL;DR must be a single paragraph (no blank line inside it).
 *   6. Cross-article dedup: no identical 15-word consecutive substring shared
 *      between two different TL;DRs.
 *
 * Part B — Landing prerendered HTML (dist/index.html):
 *   1. Must contain a <p> whose first <strong> child is exactly "In breve:".
 *   2. Word count of the paragraph text excluding the label must be 50-70.
 *   3. No forbidden inline tags inside the paragraph: no <a>, no additional
 *      <strong>/<b>/<em>/<i>/<code> beyond the label.
 *   4. The paragraph must appear AFTER the hero (after the first <h1>) and
 *      BEFORE the LandingInfoSection (if detectable by id/heading pattern).
 *
 * Exit code 1 on any violation. Designed as a manual CI gate (like
 * verify-blog-geo / verify-landing-geo). Zero new dependencies.
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { JSDOM } from 'jsdom';

const CONTENT_DIR = join(process.cwd(), '_bmad-output', 'content');
const DIST_HTML = join(process.cwd(), 'dist', 'index.html');

const LABEL = '**In breve:** ';
const MIN_WORDS = 50;
const MAX_WORDS = 70;
const DEDUP_NGRAM = 15;

// Factual signal patterns — at least 3 of these matches must appear in each TL;DR.
const FACTUAL_SIGNALS = [
  /\d/,
  /%/,
  /EUR/i,
  /Legge\s*\d/i,
  /L\.\s*\d/,
  /D\.Lgs\./,
  /D\.M\./,
  /Decreto/i,
  /Circolare/i,
  /art\.\s*\d/i,
  /c\.\s*\d/i,
  /comma\s*\d/i,
  /ATECO/i,
  /INPS/,
  /IRPEF/i,
  /IVA/,
  /SdI/,
  /Gestione\s+Separata/i,
  /Artigian/i,
  /Commerciant/i,
  /minimale/i,
  /coefficiente/i,
  /aliquota/i,
  /soglia/i,
  /acconto/i,
  /saldo/i,
  /bollo/i,
  /2026/,
  /2024/,
  /85\.?000/,
  /100\.?000/,
  /35\.?000/,
  /77,?47/,
];

// Forbidden markdown patterns inside the TL;DR text (post-label).
// NOTE: the label "**In breve:** " is already stripped before validation,
// so any remaining asterisk or underscore is a violation.
const FORBIDDEN_TEXT_PATTERNS = [
  { re: /\[[^\]]+\]\([^)]+\)/, name: 'markdown link [text](url)' },
  { re: /https?:\/\//i, name: 'bare URL http(s)://' },
  { re: /\bwww\.\S+/i, name: 'bare URL www.*' },
  { re: /\*/, name: 'asterisk (bold/italic not allowed after label)' },
  { re: /_/, name: 'underscore (italic not allowed)' },
  { re: /`/, name: 'inline code `x`' },
  { re: /^\s*[-+]\s/m, name: 'list item (- or +)' },
  { re: /^\s*\d+\.\s/m, name: 'numbered list item' },
  { re: /^\s*\|/m, name: 'table row |' },
  { re: /^#+\s/m, name: 'heading #' },
];

function stripFrontmatter(content) {
  if (!content.startsWith('---')) return content;
  const end = content.indexOf('\n---', 3);
  if (end === -1) return content;
  return content.slice(end + 4);
}

function countWords(text) {
  return text.trim().split(/\s+/).filter((w) => w.length > 0).length;
}

function countFactualSignals(text) {
  let hits = 0;
  for (const re of FACTUAL_SIGNALS) {
    if (re.test(text)) hits++;
  }
  return hits;
}

function getNgrams(text, n) {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const out = [];
  for (let i = 0; i <= words.length - n; i++) {
    out.push(words.slice(i, i + n).join(' '));
  }
  return out;
}

function validateTldrText(label, text, source) {
  const errors = [];

  const words = countWords(text);
  if (words < MIN_WORDS || words > MAX_WORDS) {
    errors.push(
      `${source}: TL;DR ha ${words} parole (atteso ${MIN_WORDS}-${MAX_WORDS}). Testo: "${text.slice(0, 80)}..."`,
    );
  }

  for (const { re, name } of FORBIDDEN_TEXT_PATTERNS) {
    if (re.test(text)) {
      errors.push(`${source}: TL;DR contiene markup vietato (${name}).`);
    }
  }

  const hits = countFactualSignals(text);
  if (hits < 3) {
    errors.push(
      `${source}: TL;DR ha solo ${hits} fatti specifici (minimo 3). Testo: "${text.slice(0, 80)}..."`,
    );
  }

  return errors;
}

// ─── Part A — Blog markdown ─────────────────────────────────────────────────

function validateBlogFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const body = stripFrontmatter(content);
  const lines = body.split('\n');
  const errors = [];
  const fileName = filePath.split('/').pop();

  // Find H1
  let h1Idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^#\s+\S/.test(lines[i])) {
      h1Idx = i;
      break;
    }
  }
  if (h1Idx === -1) {
    errors.push(`${fileName}: H1 non trovato.`);
    return { errors, tldrText: null };
  }

  // Find first non-empty line after H1
  let nextIdx = -1;
  for (let i = h1Idx + 1; i < lines.length; i++) {
    if (lines[i].trim() !== '') {
      nextIdx = i;
      break;
    }
  }
  if (nextIdx === -1) {
    errors.push(`${fileName}: nessun contenuto dopo H1.`);
    return { errors, tldrText: null };
  }

  const candidate = lines[nextIdx];
  // Strict label: exactly "**In breve:** " with a single space after the colon.
  // Disallow trailing whitespace doubling (e.g. "**In breve:**  testo").
  const STRICT_LABEL_RE = /^\*\*In breve:\*\* (?!\s)/;
  if (!STRICT_LABEL_RE.test(candidate)) {
    errors.push(
      `${fileName}:${nextIdx + 1}: prima riga dopo H1 non inizia con "${LABEL}" (richiesto spazio singolo dopo i due punti). Trovato: "${candidate.slice(0, 80)}..."`,
    );
    return { errors, tldrText: null };
  }

  // Single-paragraph check: the TL;DR must end at the next blank line.
  // Next line must be blank or end-of-file.
  if (nextIdx + 1 < lines.length && lines[nextIdx + 1].trim() !== '') {
    errors.push(
      `${fileName}:${nextIdx + 1}: TL;DR non e' un singolo paragrafo (la riga successiva non e' vuota).`,
    );
  }

  const tldrText = candidate.slice(LABEL.length).trim();
  errors.push(...validateTldrText(LABEL, tldrText, `${fileName}:${nextIdx + 1}`));

  return { errors, tldrText };
}

function runPartA() {
  console.log(`\n🔍 Part A — Blog markdown TL;DR validation`);

  if (!existsSync(CONTENT_DIR)) {
    console.error(`❌ ${CONTENT_DIR} non trovato.`);
    return { errors: [`Part A: ${CONTENT_DIR} inesistente.`], tldrs: [] };
  }

  const files = readdirSync(CONTENT_DIR)
    .filter((f) => f.startsWith('blog-') && f.endsWith('.md'))
    .sort();

  const errors = [];
  const tldrs = [];

  for (const file of files) {
    const filePath = join(CONTENT_DIR, file);
    const { errors: fileErrors, tldrText } = validateBlogFile(filePath);
    if (fileErrors.length > 0) {
      console.log(`   ❌ ${file} (${fileErrors.length} errori)`);
      errors.push(...fileErrors);
    } else {
      console.log(`   ✅ ${file} (TL;DR ${countWords(tldrText)} parole)`);
      tldrs.push({ source: file, text: tldrText });
    }
  }

  // Dedup cross-article: no 15-word consecutive substring shared between two TL;DRs.
  // Report ALL shared n-grams per pair (no early break) for full diagnostics.
  for (let i = 0; i < tldrs.length; i++) {
    const ngramsA = new Set(getNgrams(tldrs[i].text, DEDUP_NGRAM));
    for (let j = i + 1; j < tldrs.length; j++) {
      const ngramsB = getNgrams(tldrs[j].text, DEDUP_NGRAM);
      const shared = new Set();
      for (const g of ngramsB) {
        if (ngramsA.has(g) && !shared.has(g)) {
          shared.add(g);
          errors.push(
            `Dedup: ${tldrs[i].source} e ${tldrs[j].source} condividono substring ${DEDUP_NGRAM}-parole: "${g}"`,
          );
        }
      }
    }
  }

  console.log(`   Part A: ${files.length} file scansionati, ${tldrs.length} TL;DR validi.`);
  return { errors, tldrs };
}

// ─── Part B — Landing prerendered HTML ──────────────────────────────────────

function runPartB() {
  console.log(`\n🔍 Part B — Landing prerender TL;DR validation (dist/index.html)`);
  const errors = [];

  if (!existsSync(DIST_HTML)) {
    errors.push(
      `Part B: ${DIST_HTML} non trovato — esegui 'npm run build' prima di 'npm run verify-tldr'.`,
    );
    return { errors };
  }

  const html = readFileSync(DIST_HTML, 'utf-8');
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  // Find the TL;DR paragraph: a <p> whose first non-whitespace content is a
  // <strong> element with text "In breve:".
  const paragraphs = Array.from(doc.querySelectorAll('p'));
  let tldrP = null;
  for (const p of paragraphs) {
    const firstEl = p.firstElementChild;
    if (!firstEl) continue;
    if (firstEl.tagName !== 'STRONG' && firstEl.tagName !== 'B') continue;
    const labelText = (firstEl.textContent || '').trim();
    if (labelText === 'In breve:' || labelText === 'In breve') {
      tldrP = p;
      break;
    }
  }

  if (!tldrP) {
    errors.push(
      `Part B: Nessun <p> con <strong>In breve:</strong> trovato nel prerender della landing.`,
    );
    return { errors };
  }

  // Position check: must be AFTER the first <h1> (hero title) AND BEFORE the
  // first <h2> (LandingInfoSection and subsequent sections start with h2).
  // The TL;DR lives in a headless <section> between hero and LandingInfoSection.
  const FOLLOWING = dom.window.Node.DOCUMENT_POSITION_FOLLOWING;
  const h1 = doc.querySelector('h1');
  if (!h1) {
    errors.push(`Part B: <h1> hero non trovato nel prerender — regressione SEO grave.`);
  } else {
    const pos = h1.compareDocumentPosition(tldrP);
    if (!(pos & FOLLOWING)) {
      errors.push(`Part B: TL;DR della landing non e' posizionato dopo l'<h1> hero.`);
    }
  }
  const firstH2 = doc.querySelector('h2');
  if (!firstH2) {
    errors.push(`Part B: nessun <h2> trovato nel prerender — LandingInfoSection mancante?`);
  } else {
    const pos = tldrP.compareDocumentPosition(firstH2);
    if (!(pos & FOLLOWING)) {
      errors.push(
        `Part B: TL;DR della landing deve precedere il primo <h2> (LandingInfoSection). Sequenza DOM invertita.`,
      );
    }
  }

  // Forbidden inline tags: no <a>, no extra <strong>/<em>/<code>/<b>/<i>.
  const forbidden = Array.from(tldrP.querySelectorAll('a, em, code, i'));
  if (forbidden.length > 0) {
    errors.push(
      `Part B: TL;DR contiene tag inline vietati: ${forbidden.map((e) => e.tagName).join(', ')}`,
    );
  }

  const strongs = Array.from(tldrP.querySelectorAll('strong, b'));
  if (strongs.length !== 1) {
    errors.push(
      `Part B: TL;DR deve contenere esattamente 1 <strong> (label "In breve:"), trovati ${strongs.length}.`,
    );
  }

  // Text validation (post-label).
  const fullText = (tldrP.textContent || '').replace(/\s+/g, ' ').trim();
  const labelMatch = fullText.match(/^In breve:\s*/);
  if (!labelMatch) {
    errors.push(`Part B: TL;DR landing non inizia con "In breve: ": "${fullText.slice(0, 80)}..."`);
    return { errors };
  }
  const bodyText = fullText.slice(labelMatch[0].length);

  const words = countWords(bodyText);
  if (words < MIN_WORDS || words > MAX_WORDS) {
    errors.push(
      `Part B: TL;DR landing ha ${words} parole (atteso ${MIN_WORDS}-${MAX_WORDS}).`,
    );
  }

  const hits = countFactualSignals(bodyText);
  if (hits < 3) {
    errors.push(
      `Part B: TL;DR landing ha solo ${hits} fatti specifici (minimo 3).`,
    );
  }

  console.log(`   Part B: landing TL;DR trovata, ${words} parole, ${hits} fatti.`);
  return { errors };
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  const { errors: errA } = runPartA();

  if (errA.length > 0) {
    console.error(`\n❌ FAILED: ${errA.length} errori TL;DR\n`);
    errA.forEach((e, i) => console.error(`   ${i + 1}. ${e}`));
    process.exit(1);
  } else {
    console.log(`\n✅ TL;DR validation OK (13 blog).\n`);
  }
}

main();
