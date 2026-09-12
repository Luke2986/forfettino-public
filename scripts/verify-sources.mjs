#!/usr/bin/env node
/**
 * verify-sources.mjs — Epic 79.5
 *
 * Valida la sezione "Fonti e riferimenti" e l'accorciamento FAQ aggiunti
 * da story 79.5 sui 13 blog markdown + landing page prerenderizzata.
 *
 * Parte A — Blog markdown (_bmad-output/content/blog-*.md):
 *   A1. Presenza di UN solo H2 esatto "## Fonti e riferimenti".
 *   A2. Posizione: dopo "## Domande frequenti" (se presente).
 *   A3. Conteggio voci lista (- ): tra 4 e 8 inclusi.
 *   A4. Ogni voce matcha formato: inizia con maiuscola, contiene " \u2014 " em dash,
 *       testo non vuoto prima/dopo l'em dash.
 *   A5. Nessuna voce contiene link markdown ([text](url)), URL nudi, o <a>.
 *   A6. Nessuna voce finisce con "..." o "ecc.".
 *
 * Parte B — Landing prerenderizzata (dist/index.html):
 *   B1. Presenza di <h2> con textContent === "Fonti e riferimenti".
 *   B2. La section parent ha aria-labelledby che matcha l'id dell'h2.
 *   B3. Esiste un <ul> o <ol> dentro la stessa section.
 *   B4. La lista ha tra 6 e 10 <li>.
 *   B5. Ogni <li>: testo contiene " \u2014 " em dash, zero <a> figli, nessun URL.
 *
 * Parte C — Word count FAQ (40-70 parole):
 *   C1. Blog: per ogni "## Domande frequenti", ogni risposta (testo tra H3
 *       consecutivi) deve essere 40-70 parole. Stripping di **, *, `.
 *   C2. Landing: ogni item di landingFaqItems.answer (import dinamico da
 *       src/lib/landing-faq.ts) deve essere 40-70 parole.
 *
 * Parte D — Fatti specifici nelle FAQ:
 *   D1. Ogni risposta blog+landing deve contenere almeno 1 match tra:
 *       \d+%, \d+(\.\d+)? EUR, \d{4}, Legge \d, L\. \d, D\.Lgs\., D\.L\.,
 *       Circolare, art\., comma, ATECO, INPS.
 *
 * Parte E — Structural checks FAQ (AC Epic 79.5 #3):
 *   E1. Ogni risposta FAQ deve avere tra 2 e 4 frasi (normalizzando abbreviazioni
 *       come art., n., comma, c., L., D.Lgs., D.L., lett., P.IVA, es., 1°).
 *   E2. Ogni risposta FAQ puo' contenere al massimo 2 bold markdown (`**text**`).
 *   E3. Nessuna risposta FAQ puo' contenere link markdown (`[text](url)`),
 *       URL nudi, o tag `<a>`.
 *
 * Exit code 1 su qualsiasi violazione. Messaggi diagnostici nel formato:
 *   [verify-sources] <file>:<check> FAIL \u2014 <message>
 *
 * Usage: node scripts/verify-sources.mjs
 * (Richiede npm run build + prerender per la Parte B)
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { JSDOM } from 'jsdom';

const CONTENT_DIR = join(process.cwd(), '_bmad-output', 'content');
const DIST_HTML = join(process.cwd(), 'dist', 'index.html');
const LANDING_FAQ_FILE = join(process.cwd(), 'src', 'lib', 'landing-faq.ts');

const EM_DASH = '\u2014';
const WORD_MIN = 40;
const WORD_MAX = 70;
const BLOG_SOURCES_MIN = 4;
const BLOG_SOURCES_MAX = 8;
const LANDING_SOURCES_MIN = 6;
const LANDING_SOURCES_MAX = 10;

const FACT_PATTERNS = [
  /\d+\s*%/,
  /\d+([.,]\d+)?\s*EUR/i,
  /\b\d{4}\b/,
  /\bLegge\s+\d/i,
  /\bL\.\s*\d/,
  /\bD\.Lgs\./,
  /\bD\.L\./,
  /\bCircolare\b/i,
  /\bart\.\s*\d/i,
  /\bcomma\s*\d/i,
  /\bATECO\b/i,
  /\bINPS\b/,
];

const errors = [];

function fail(scope, check, message) {
  errors.push(`[verify-sources] ${scope}:${check} FAIL ${EM_DASH} ${message}`);
}

function stripFrontmatter(content) {
  if (content.startsWith('---')) {
    const end = content.indexOf('---', 3);
    if (end !== -1) return content.slice(end + 3);
  }
  return content;
}

function countWords(text) {
  const cleaned = text.replace(/\*\*/g, '').replace(/(?<!\*)\*(?!\*)/g, '').replace(/`/g, '').trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter((w) => w.length > 0).length;
}

function hasFactualSignal(text) {
  return FACT_PATTERNS.some((p) => p.test(text));
}

// Epic 79.5 Parte E — structural FAQ checks
const SENTENCE_MIN = 2;
const SENTENCE_MAX = 4;
const BOLD_MAX = 2;

function countSentences(text) {
  // Normalize common Italian abbreviations that contain periods so they are
  // not counted as sentence terminators.
  let t = text.replace(/\*\*/g, '').replace(/(?<!\*)\*(?!\*)/g, '').replace(/`/g, '');
  t = t.replace(/\d+[.,]\d+/g, 'X');
  t = t.replace(/D\.Lgs\./g, 'X');
  t = t.replace(/D\.L\./g, 'X');
  t = t.replace(/\bart\.\s*\d+/gi, 'X');
  t = t.replace(/\bn\.\s*\d+/gi, 'X');
  t = t.replace(/\bcomma\s*\d+/gi, 'X');
  t = t.replace(/\bc\.\s*\d+/gi, 'X');
  t = t.replace(/\bL\.\s*\d+/g, 'X');
  t = t.replace(/\blett\.\s*/gi, 'X');
  t = t.replace(/\bes\.\s/g, 'X ');
  t = t.replace(/\becc\./g, 'X');
  t = t.replace(/P\.IVA/g, 'X');
  t = t.replace(/\b\d+°/g, 'X');
  const m = t.match(/[.!?]+/g) || [];
  return m.length;
}

function countBold(text) {
  const m = text.match(/\*\*[^*]+\*\*/g) || [];
  return m.length;
}

function hasMarkdownLink(text) {
  return /\[[^\]]+\]\([^)]+\)/.test(text);
}

function hasBareUrl(text) {
  return /https?:\/\//.test(text);
}

function hasAnchorTag(text) {
  return /<a[\s>]/i.test(text);
}

function checkFaqStructural(scope, label, answer, lineHint) {
  const sentences = countSentences(answer);
  if (sentences < SENTENCE_MIN || sentences > SENTENCE_MAX) {
    fail(
      scope,
      `E1${lineHint ? ':L' + lineHint : ''}`,
      `FAQ "${label.slice(0, 50)}" ha ${sentences} frasi (atteso ${SENTENCE_MIN}-${SENTENCE_MAX})`,
    );
  }
  const bold = countBold(answer);
  if (bold > BOLD_MAX) {
    fail(
      scope,
      `E2${lineHint ? ':L' + lineHint : ''}`,
      `FAQ "${label.slice(0, 50)}" ha ${bold} bold markdown (max ${BOLD_MAX})`,
    );
  }
  if (hasMarkdownLink(answer)) {
    fail(
      scope,
      `E3${lineHint ? ':L' + lineHint : ''}`,
      `FAQ "${label.slice(0, 50)}" contiene link markdown [text](url)`,
    );
  }
  if (hasBareUrl(answer)) {
    fail(
      scope,
      `E3${lineHint ? ':L' + lineHint : ''}`,
      `FAQ "${label.slice(0, 50)}" contiene URL nudo (http/https)`,
    );
  }
  if (hasAnchorTag(answer)) {
    fail(
      scope,
      `E3${lineHint ? ':L' + lineHint : ''}`,
      `FAQ "${label.slice(0, 50)}" contiene tag <a>`,
    );
  }
}

// ─────────────────────────── PARTE A: Blog markdown ───────────────────────────

function validateBlogSources(fileName, body) {
  const lines = body.split('\n');
  const fontiIdxs = [];
  const faqIdx = lines.findIndex((l) => /^##\s+Domande frequenti/i.test(l.trim()));

  lines.forEach((l, i) => {
    if (l.trim() === '## Fonti e riferimenti') fontiIdxs.push(i);
  });

  // A1
  if (fontiIdxs.length === 0) {
    fail(fileName, 'A1', 'manca H2 "## Fonti e riferimenti"');
    return;
  }
  if (fontiIdxs.length > 1) {
    fail(fileName, 'A1', `H2 "## Fonti e riferimenti" presente ${fontiIdxs.length} volte (deve essere una sola)`);
  }

  const fontiIdx = fontiIdxs[0];

  // A2 — deve stare dopo la FAQ (se presente)
  if (faqIdx !== -1 && fontiIdx < faqIdx) {
    fail(fileName, 'A2', `Fonti (riga ${fontiIdx + 1}) precede la FAQ (riga ${faqIdx + 1})`);
  }

  // Estrai le righe "- " dentro la sezione Fonti (fino al prossimo H2 o fine file)
  const sectionLines = [];
  for (let i = fontiIdx + 1; i < lines.length; i++) {
    const l = lines[i];
    if (/^##\s/.test(l.trim())) break;
    sectionLines.push(l);
  }
  const bulletLines = sectionLines.filter((l) => /^- \S/.test(l.trim()) || /^-\s\S/.test(l));

  // A3
  if (bulletLines.length < BLOG_SOURCES_MIN || bulletLines.length > BLOG_SOURCES_MAX) {
    fail(
      fileName,
      'A3',
      `${bulletLines.length} voci trovate (atteso ${BLOG_SOURCES_MIN}-${BLOG_SOURCES_MAX})`,
    );
  }

  // A4, A5, A6
  bulletLines.forEach((raw, idx) => {
    const line = raw.trim();
    const body = line.replace(/^- /, '');

    // A4 formato: inizia maiuscola, contiene " — "
    if (!/^[A-Z\u00C0-\u017F]/.test(body)) {
      fail(fileName, 'A4', `voce #${idx + 1} non inizia con maiuscola: "${body.slice(0, 60)}"`);
    }
    if (!body.includes(` ${EM_DASH} `)) {
      fail(
        fileName,
        'A4',
        `voce #${idx + 1} manca em dash " ${EM_DASH} " (U+2014): "${body.slice(0, 80)}"`,
      );
    } else {
      const [before, after] = body.split(` ${EM_DASH} `);
      if (!before || !before.trim()) {
        fail(fileName, 'A4', `voce #${idx + 1} testo vuoto prima dell'em dash`);
      }
      if (!after || !after.trim()) {
        fail(fileName, 'A4', `voce #${idx + 1} testo vuoto dopo l'em dash`);
      }
    }

    // A5 no link/URL/<a>
    if (/\[.*?\]\(.*?\)/.test(body)) {
      fail(fileName, 'A5', `voce #${idx + 1} contiene link markdown`);
    }
    if (/https?:\/\//.test(body)) {
      fail(fileName, 'A5', `voce #${idx + 1} contiene URL nudo`);
    }
    if (/<a[\s>]/i.test(body)) {
      fail(fileName, 'A5', `voce #${idx + 1} contiene tag <a>`);
    }

    // A6 no troncamento
    if (/\.\.\.$/.test(body) || /\becc\.?$/i.test(body)) {
      fail(fileName, 'A6', `voce #${idx + 1} termina con "..." o "ecc."`);
    }
  });
}

// ──────────────────────── PARTE C: Blog FAQ word count + facts ────────────────────────

function validateBlogFaq(fileName, body) {
  const lines = body.split('\n');
  const faqIdx = lines.findIndex((l) => /^##\s+Domande frequenti/i.test(l.trim()));
  if (faqIdx === -1) return; // alcuni blog potrebbero non avere FAQ

  // Fine sezione = prossimo H2 o EOF
  let faqEnd = lines.length;
  for (let i = faqIdx + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i].trim())) {
      faqEnd = i;
      break;
    }
  }

  // Raggruppa Q&A: ogni H3 inizia una domanda, la risposta e' tutto il testo
  // fino al prossimo H3 o fine sezione.
  const qa = [];
  let currentQ = null;
  let currentA = [];
  for (let i = faqIdx + 1; i < faqEnd; i++) {
    const line = lines[i];
    if (/^###\s/.test(line.trim())) {
      if (currentQ !== null) qa.push({ q: currentQ, a: currentA.join(' ').trim(), line: i });
      currentQ = line.trim().replace(/^###\s+/, '');
      currentA = [];
    } else if (currentQ !== null) {
      currentA.push(line);
    }
  }
  if (currentQ !== null) qa.push({ q: currentQ, a: currentA.join(' ').trim(), line: faqEnd });

  qa.forEach(({ q, a, line }) => {
    const wc = countWords(a);
    if (wc < WORD_MIN || wc > WORD_MAX) {
      fail(
        fileName,
        `C1:L${line}`,
        `FAQ "${q.slice(0, 50)}" ha ${wc} parole (atteso ${WORD_MIN}-${WORD_MAX})`,
      );
    }
    if (!hasFactualSignal(a)) {
      fail(fileName, `D1:L${line}`, `FAQ "${q.slice(0, 50)}" senza fatto specifico`);
    }
    checkFaqStructural(fileName, q, a, line);
  });
}

// ──────────────────────── PARTE B: Landing prerenderizzata ────────────────────────

function validateLandingPrerender() {
  if (!existsSync(DIST_HTML)) {
    fail('dist/index.html', 'B0', 'file non trovato — eseguire `npm run build` prima di verify-sources');
    return;
  }
  const html = readFileSync(DIST_HTML, 'utf-8');
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  // B1
  const allH2 = Array.from(doc.querySelectorAll('h2'));
  const fontiH2 = allH2.find((h) => (h.textContent || '').replace(/\s+/g, ' ').trim() === 'Fonti e riferimenti');
  if (!fontiH2) {
    fail('dist/index.html', 'B1', 'manca <h2> con testo esatto "Fonti e riferimenti"');
    return;
  }

  // B2 — risali alla section parent con aria-labelledby
  let sectionEl = fontiH2.parentElement;
  while (sectionEl && sectionEl.tagName !== 'SECTION') {
    sectionEl = sectionEl.parentElement;
  }
  if (!sectionEl) {
    fail('dist/index.html', 'B2', 'l\'h2 "Fonti e riferimenti" non ha un <section> antenato');
  } else {
    const aria = sectionEl.getAttribute('aria-labelledby');
    const id = fontiH2.getAttribute('id');
    if (!aria || !id || aria !== id) {
      fail(
        'dist/index.html',
        'B2',
        `aria-labelledby="${aria}" non matcha id h2="${id}"`,
      );
    }
  }

  // B3 — lista dentro la section
  const list = sectionEl ? sectionEl.querySelector('ul, ol') : null;
  if (!list) {
    fail('dist/index.html', 'B3', 'nessun <ul>/<ol> dentro la section Fonti');
    return;
  }

  // B4
  const items = Array.from(list.querySelectorAll(':scope > li'));
  if (items.length < LANDING_SOURCES_MIN || items.length > LANDING_SOURCES_MAX) {
    fail(
      'dist/index.html',
      'B4',
      `${items.length} <li> trovati (atteso ${LANDING_SOURCES_MIN}-${LANDING_SOURCES_MAX})`,
    );
  }

  // B5
  items.forEach((li, idx) => {
    const text = (li.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text.includes(` ${EM_DASH} `)) {
      fail('dist/index.html', 'B5', `<li> #${idx + 1} senza em dash: "${text.slice(0, 80)}"`);
    }
    if (li.querySelector('a')) {
      fail('dist/index.html', 'B5', `<li> #${idx + 1} contiene <a>`);
    }
    if (/https?:\/\//.test(text)) {
      fail('dist/index.html', 'B5', `<li> #${idx + 1} contiene URL: "${text.slice(0, 80)}"`);
    }
  });
}

// ──────────────────────── PARTE C+D: Landing FAQ word count + facts ────────────────────────

async function validateLandingFaq() {
  // Parsing regex di src/lib/landing-faq.ts (evita compilazione TS).
  // Il file e' sufficientemente semplice: question: "...", answer: "..."
  const src = readFileSync(LANDING_FAQ_FILE, 'utf-8');
  const reAnswer = /answer:\s*"((?:\\.|[^"\\])*)"/g;
  const reQuestion = /question:\s*"((?:\\.|[^"\\])*)"/g;
  const answers = [];
  const questions = [];
  let m;
  while ((m = reAnswer.exec(src))) {
    answers.push(m[1].replace(/\\"/g, '"'));
  }
  while ((m = reQuestion.exec(src))) {
    questions.push(m[1].replace(/\\"/g, '"'));
  }

  if (answers.length === 0) {
    fail('src/lib/landing-faq.ts', 'C2', 'nessun answer trovato nel parsing regex');
    return;
  }

  answers.forEach((a, i) => {
    const q = questions[i] || `#${i + 1}`;
    const wc = countWords(a);
    if (wc < WORD_MIN || wc > WORD_MAX) {
      fail(
        'src/lib/landing-faq.ts',
        `C2[${i}]`,
        `"${q.slice(0, 50)}" ha ${wc} parole (atteso ${WORD_MIN}-${WORD_MAX})`,
      );
    }
    if (!hasFactualSignal(a)) {
      fail(
        'src/lib/landing-faq.ts',
        `D1[${i}]`,
        `"${q.slice(0, 50)}" senza fatto specifico`,
      );
    }
    checkFaqStructural('src/lib/landing-faq.ts', `[${i}] ${q}`, a);
  });
}

// ─────────────────────────────────── MAIN ───────────────────────────────────

async function main() {
  console.log(`\n🔍 verify-sources (Epic 79.5) — validazione Fonti + FAQ\n`);

  // Parte A + C Blog
  const files = readdirSync(CONTENT_DIR)
    .filter((f) => f.startsWith('blog-') && f.endsWith('.md'))
    .sort();

  for (const file of files) {
    const full = join(CONTENT_DIR, file);
    const body = stripFrontmatter(readFileSync(full, 'utf-8'));
    validateBlogSources(file, body);
    validateBlogFaq(file, body);
  }

  // Parte B Landing prerender (best-effort: se dist manca, avvisa ma non blocca A/C/D)
  validateLandingPrerender();

  // Parte C+D Landing FAQ
  await validateLandingFaq();

  if (errors.length === 0) {
    console.log(`✅ verify-sources: 13 blog + landing validati, 0 errori.\n`);
    process.exit(0);
  }

  errors.forEach((e) => console.error(e));
  console.error(`\n❌ verify-sources: ${errors.length} errori.\n`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
