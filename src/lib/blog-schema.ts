/**
 * Blog schema utilities — extract FAQ/HowTo from markdown and build JSON-LD.
 * Pure functions, zero dependencies. Reusable across all blog articles.
 */

import { GEO_SOURCES, formatGeoSource, type GeoSource } from "@/lib/geo-sources";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FaqItem {
  question: string;
  answer: string;
}

export interface HowToData {
  name: string;
  steps: { name: string; text: string }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip markdown formatting (bold, links, inline code) to produce plain text. */
export function stripMarkdown(md: string): string {
  return (
    md
      // bold/italic: **text** or __text__ or *text* or _text_
      .replace(/(\*{1,2}|_{1,2})(.+?)\1/g, "$2")
      // links: [text](url)
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      // inline code: `code`
      .replace(/`([^`]+)`/g, "$1")
      // list markers: "- item" or "1. item"
      .replace(/^(\s*[-*]\s+|\s*\d+\.\s+)/gm, "")
      // horizontal rules
      .replace(/^---+$/gm, "")
      // trim leftover whitespace
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/**
 * Extract text content from a markdown section — collects all paragraphs
 * between headings, skipping table rows and code blocks.
 */
function extractParagraphs(sectionBody: string): string {
  const lines = sectionBody.split("\n");
  const paragraphLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip table rows, code fences, empty lines
    if (trimmed.startsWith("|") || trimmed.startsWith("```") || trimmed === "") {
      // If we already collected text, stop (take only the intro paragraph)
      if (paragraphLines.length > 0) break;
      continue;
    }
    paragraphLines.push(trimmed);
  }
  return paragraphLines.join(" ");
}

// ---------------------------------------------------------------------------
// Extraction: FAQ
// ---------------------------------------------------------------------------

/**
 * Extract FAQ items from markdown content.
 * Looks for a `## Domande frequenti` section, then parses each `### Question`
 * with its answer text (paragraphs between H3s).
 */
export function extractFaqFromMarkdown(content: string): FaqItem[] {
  // Find the "Domande frequenti" section (case-insensitive)
  const sectionMatch = content.match(
    /^## Domande frequenti\s*$/im,
  );
  if (!sectionMatch || sectionMatch.index === undefined) return [];

  // Get content from the section start to the next H2, horizontal rule, or end
  const sectionStart = sectionMatch.index + sectionMatch[0].length;
  const nextBoundary = content.slice(sectionStart).match(/^(?:## |---\s*$)/m);
  const sectionEnd = nextBoundary && nextBoundary.index !== undefined
    ? sectionStart + nextBoundary.index
    : content.length;
  const sectionContent = content.slice(sectionStart, sectionEnd);

  // Split by H3 headings
  const h3Pattern = /^### (.+)$/gm;
  const faqs: FaqItem[] = [];
  let match: RegExpExecArray | null;
  const h3s: { question: string; startIndex: number }[] = [];

  while ((match = h3Pattern.exec(sectionContent)) !== null) {
    h3s.push({ question: match[1].trim(), startIndex: match.index + match[0].length });
  }

  for (let i = 0; i < h3s.length; i++) {
    const start = h3s[i].startIndex;
    const end = i + 1 < h3s.length ? h3s[i + 1].startIndex - h3s[i + 1].question.length - 4 : sectionContent.length;
    const rawAnswer = sectionContent.slice(start, end).trim();
    const plainAnswer = stripMarkdown(rawAnswer);
    if (plainAnswer) {
      faqs.push({ question: h3s[i].question, answer: plainAnswer });
    }
  }

  return faqs;
}

// ---------------------------------------------------------------------------
// Extraction: HowTo
// ---------------------------------------------------------------------------

/**
 * Extract HowTo data from markdown content.
 * Looks for a `## Calcolo passo-passo` section (prefix match), then parses
 * each `### Step name` with its intro paragraph as step text.
 */
export function extractHowToFromMarkdown(content: string): HowToData | null {
  // Find any H2 containing "passo-passo" or "passo per passo" (case-insensitive)
  const sectionMatch = content.match(
    /^## .*(?:passo-passo|passo per passo)[^\n]*/im,
  );
  if (!sectionMatch || sectionMatch.index === undefined) return null;

  const sectionTitle = sectionMatch[0].replace(/^## /, "").trim();
  const sectionStart = sectionMatch.index + sectionMatch[0].length;

  // Get content from the section start to the next H2 or end
  const nextH2Match = content.slice(sectionStart).match(/^## /m);
  const sectionEnd = nextH2Match && nextH2Match.index !== undefined
    ? sectionStart + nextH2Match.index
    : content.length;
  const sectionContent = content.slice(sectionStart, sectionEnd);

  // Split by H3 headings
  const h3Pattern = /^### (.+)$/gm;
  const steps: { name: string; text: string }[] = [];
  let match: RegExpExecArray | null;
  const h3s: { name: string; startIndex: number }[] = [];

  while ((match = h3Pattern.exec(sectionContent)) !== null) {
    h3s.push({ name: match[1].trim(), startIndex: match.index + match[0].length });
  }

  for (let i = 0; i < h3s.length; i++) {
    const start = h3s[i].startIndex;
    const end = i + 1 < h3s.length ? h3s[i + 1].startIndex - h3s[i + 1].name.length - 4 : sectionContent.length;
    const body = sectionContent.slice(start, end).trim();
    const text = stripMarkdown(extractParagraphs(body));
    if (text) {
      steps.push({ name: h3s[i].name, text });
    }
  }

  if (steps.length === 0) return null;

  return {
    name: sectionTitle,
    steps,
  };
}

// ---------------------------------------------------------------------------
// JSON-LD Builders
// ---------------------------------------------------------------------------

/** Build JSON-LD FAQPage schema from FAQ items. */
export function buildFaqPageSchema(faqs: FaqItem[]): object {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

/** Build JSON-LD HowTo schema from HowTo data. */
export function buildHowToSchema(data: HowToData): object {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: data.name,
    step: data.steps.map((s) => ({
      "@type": "HowToStep",
      name: s.name,
      text: s.text,
    })),
  };
}

// ---------------------------------------------------------------------------
// Citation extraction (story 79.6)
// ---------------------------------------------------------------------------

export interface CitationCreativeWork {
  "@type": "CreativeWork";
  name: string;
}

/**
 * Estrae citazioni dalla sezione "## Fonti e riferimenti" del markdown blog
 * (introdotta da story 79.5) e le mappa su GEO_SOURCES per produrre nodi
 * CreativeWork da inserire in Article.citation dello schema @graph.
 *
 * Ogni voce matcha il formato: "- Institution, reference — title"
 * Se una voce non trova match nel catalogo, viene inclusa comunque con il
 * testo raw (fallback non bloccante).
 */
export function extractCitationsFromMarkdown(content: string): CitationCreativeWork[] {
  const sectionMatch = content.match(/^## Fonti e riferimenti\s*$/im);
  if (!sectionMatch || sectionMatch.index === undefined) return [];

  const sectionStart = sectionMatch.index + sectionMatch[0].length;
  const rest = content.slice(sectionStart);
  // Fine sezione al prossimo H2 o alla fine del documento
  const nextH2 = rest.match(/^## /m);
  const sectionEnd =
    nextH2 && nextH2.index !== undefined ? sectionStart + nextH2.index : content.length;
  const sectionContent = content.slice(sectionStart, sectionEnd);

  // Pre-format all GEO_SOURCES for fast matching
  const sourceFormats = new Map<string, GeoSource>();
  for (const src of Object.values(GEO_SOURCES)) {
    sourceFormats.set(formatGeoSource(src).trim(), src);
  }

  const citations: CitationCreativeWork[] = [];
  const itemPattern = /^- (.+)$/gm;
  let match: RegExpExecArray | null;

  while ((match = itemPattern.exec(sectionContent)) !== null) {
    const raw = match[1].trim();
    const found = sourceFormats.get(raw);
    if (found) {
      citations.push({
        "@type": "CreativeWork",
        name: formatGeoSource(found),
      });
    } else {
      // Fallback non-blocking: raw string
      citations.push({ "@type": "CreativeWork", name: raw });
    }
  }

  return citations;
}
