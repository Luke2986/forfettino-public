import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from "https://esm.sh/pdf-lib@1.17.1";

// --- Rate limiting (in-memory sliding window) ---
const RATE_LIMIT_MAX = 5; // max PDF generations per window
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const rateLimitMap = new Map<string, number[]>();

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(userId) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) return true;
  recent.push(now);
  rateLimitMap.set(userId, recent);
  return false;
}

const ALLOWED_ORIGINS = [
  "https://forfettino.lovable.app",
  "https://forfettino.it",
  "http://localhost:5173",
  "http://localhost:8080",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function jsonResponse(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

// ── Fiscal deadlines 2026 (hardcoded) ──

type Gestione = "separata" | "artigiani" | "commercianti";

interface Deadline {
  date: string;       // "DD mese YYYY"
  day: number;
  month: number;      // 1-based
  bucket: string;
  label: string;
  description: string;
  gestione: Gestione[] | "tutte";
}

const DEADLINES: Deadline[] = [
  {
    date: "16 febbraio 2026", day: 16, month: 2, bucket: "inps_q1",
    label: "Rata INPS Q1",
    description: "Contributo fisso trimestrale INPS. Importo calcolato sul minimale contributivo della gestione di appartenenza.",
    gestione: "tutte",
  },
  {
    date: "18 maggio 2026", day: 18, month: 5, bucket: "inps_q2",
    label: "Rata INPS Q2",
    description: "Contributo fisso trimestrale INPS. Importo calcolato sul minimale contributivo della gestione di appartenenza.",
    gestione: "tutte",
  },
  {
    date: "20 luglio 2026", day: 20, month: 7, bucket: "june",
    label: "Saldo imposta sostitutiva + I acconto",
    description: "Saldo dell'imposta sostitutiva (5% o 15%) sul reddito dell'anno precedente, al netto degli acconti. Primo acconto pari al 40% dell'imposta dell'anno precedente. Termine prorogato per forfettari e soggetti ISA (ordinario 30 giugno); differimento al 20 agosto con maggiorazione 0,80%.",
    gestione: "tutte",
  },
  {
    date: "20 luglio 2026", day: 20, month: 7, bucket: "june",
    label: "Saldo INPS + I acconto INPS",
    description: "Saldo contributi INPS eccedenti il minimale + primo acconto proporzionale all'eccedenza dell'anno precedente. Stessa scadenza dell'imposta (20 luglio 2026, proroga forfettari/ISA).",
    gestione: "tutte",
  },
  {
    date: "20 luglio 2026", day: 20, month: 7, bucket: "diritto_camerale",
    label: "Diritto camerale annuale",
    description: "Diritto annuale alla Camera di Commercio. Dovuto solo per iscritti alla gestione artigiani o commercianti (non gestione separata). Segue il termine dei versamenti redditi (20 luglio 2026 per forfettari e soggetti ISA).",
    gestione: ["artigiani", "commercianti"],
  },
  {
    date: "20 agosto 2026", day: 20, month: 8, bucket: "inps_q3",
    label: "Rata INPS Q3",
    description: "Contributo fisso trimestrale INPS. Importo calcolato sul minimale contributivo della gestione di appartenenza.",
    gestione: "tutte",
  },
  {
    date: "16 novembre 2026", day: 16, month: 11, bucket: "inps_q4",
    label: "Rata INPS Q4",
    description: "Contributo fisso trimestrale INPS. Ultima rata dell'anno, importo calcolato sul minimale contributivo.",
    gestione: "tutte",
  },
  {
    date: "30 novembre 2026", day: 30, month: 11, bucket: "november",
    label: "II acconto imposta sostitutiva",
    description: "Secondo acconto dell'imposta sostitutiva, pari al 60% dell'imposta dell'anno precedente. Non rateizzabile.",
    gestione: "tutte",
  },
  {
    date: "30 novembre 2026", day: 30, month: 11, bucket: "november",
    label: "II acconto INPS",
    description: "Secondo acconto contributi INPS eccedenti, proporzionale all'eccedenza dell'anno precedente.",
    gestione: "tutte",
  },
];

// ── Colors per gestione ──

const COLORS = {
  separata:     { r: 0.12, g: 0.56, b: 0.81 },  // teal-blue
  artigiani:    { r: 0.80, g: 0.52, b: 0.10 },   // amber
  commercianti: { r: 0.58, g: 0.29, b: 0.78 },   // violet
  tutte:        { r: 0.30, g: 0.34, b: 0.40 },    // slate
} as const;

const GESTIONE_LABELS: Record<string, string> = {
  separata: "Gestione Separata",
  artigiani: "Gestione Artigiani",
  commercianti: "Gestione Commercianti",
};

const MONTH_NAMES = [
  "", "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_LEFT = 50;
const MARGIN_RIGHT = 50;
const MARGIN_TOP = 60;
const MARGIN_BOTTOM = 60;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

const FOOTER_TEXT = "Calcola quanto devi pagare su forfettino.it";
const FOOTER_CREDIT = "Generato da Forfettino.it";

function drawFooter(page: PDFPage, font: PDFFont) {
  const footerY = 30;
  page.drawText(FOOTER_TEXT, {
    x: MARGIN_LEFT,
    y: footerY,
    size: 8,
    font,
    color: rgb(0.4, 0.45, 0.5),
  });
  const creditWidth = font.widthOfTextAtSize(FOOTER_CREDIT, 8);
  page.drawText(FOOTER_CREDIT, {
    x: PAGE_WIDTH - MARGIN_RIGHT - creditWidth,
    y: footerY,
    size: 8,
    font,
    color: rgb(0.4, 0.45, 0.5),
  });
}

function isRelevant(deadline: Deadline, gestione?: Gestione): boolean {
  if (!gestione) return true;
  if (deadline.gestione === "tutte") return true;
  return deadline.gestione.includes(gestione);
}

function getDeadlineColor(deadline: Deadline, gestione?: Gestione) {
  if (deadline.gestione === "tutte") {
    return gestione ? COLORS[gestione] : COLORS.tutte;
  }
  // Specific gestione deadline — use first matching color
  const g = deadline.gestione[0];
  return COLORS[g] ?? COLORS.tutte;
}

async function generatePdf(gestione?: Gestione): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // ── Cover page ──
  const cover = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - 200;

  // Logo text
  cover.drawText("FORFETTINO", {
    x: MARGIN_LEFT,
    y: y,
    size: 36,
    font: boldFont,
    color: rgb(0.05, 0.58, 0.53), // teal-600
  });
  y -= 50;

  cover.drawText("Scadenziario Forfettario 2026", {
    x: MARGIN_LEFT,
    y: y,
    size: 24,
    font: boldFont,
    color: rgb(0.15, 0.15, 0.18),
  });
  y -= 35;

  if (gestione) {
    cover.drawText(GESTIONE_LABELS[gestione], {
      x: MARGIN_LEFT,
      y: y,
      size: 16,
      font,
      color: rgb(COLORS[gestione].r, COLORS[gestione].g, COLORS[gestione].b),
    });
    y -= 30;
  }

  y -= 20;
  cover.drawText("Tutte le scadenze fiscali per il regime forfettario,", {
    x: MARGIN_LEFT, y, size: 12, font, color: rgb(0.35, 0.38, 0.42),
  });
  y -= 18;
  cover.drawText("con date esatte e spiegazioni pratiche.", {
    x: MARGIN_LEFT, y, size: 12, font, color: rgb(0.35, 0.38, 0.42),
  });

  // Legenda colori on cover (only if no specific gestione)
  if (!gestione) {
    y -= 50;
    cover.drawText("Legenda colori per gestione:", {
      x: MARGIN_LEFT, y, size: 11, font: boldFont, color: rgb(0.2, 0.2, 0.25),
    });
    y -= 22;
    for (const [key, label] of Object.entries(GESTIONE_LABELS)) {
      const c = COLORS[key as Gestione];
      // Color dot
      cover.drawCircle({
        x: MARGIN_LEFT + 6, y: y + 3, size: 5,
        color: rgb(c.r, c.g, c.b),
      });
      cover.drawText(label, {
        x: MARGIN_LEFT + 18, y, size: 10, font, color: rgb(0.3, 0.33, 0.38),
      });
      y -= 18;
    }
    // "Tutte" entry
    const ct = COLORS.tutte;
    cover.drawCircle({
      x: MARGIN_LEFT + 6, y: y + 3, size: 5,
      color: rgb(ct.r, ct.g, ct.b),
    });
    cover.drawText("Comune a tutte le gestioni", {
      x: MARGIN_LEFT + 18, y, size: 10, font, color: rgb(0.3, 0.33, 0.38),
    });
  }

  drawFooter(cover, font);

  // ── Calendar pages — group deadlines by month ──
  const deadlinesByMonth = new Map<number, Deadline[]>();
  for (const d of DEADLINES) {
    if (!isRelevant(d, gestione)) continue;
    const existing = deadlinesByMonth.get(d.month) ?? [];
    existing.push(d);
    deadlinesByMonth.set(d.month, existing);
  }

  // Only create pages for months that have deadlines
  const sortedMonths = [...deadlinesByMonth.keys()].sort((a, b) => a - b);

  let currentPage: PDFPage | null = null;
  let curY = 0;

  function ensureSpace(needed: number): PDFPage {
    if (!currentPage || curY - needed < MARGIN_BOTTOM) {
      currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      drawFooter(currentPage, font);
      curY = PAGE_HEIGHT - MARGIN_TOP;
    }
    return currentPage;
  }

  for (const month of sortedMonths) {
    const monthDeadlines = deadlinesByMonth.get(month)!;

    // Month header — always start fresh section, ensure space
    const page = ensureSpace(80);
    // Month title with decorative line
    page.drawText(MONTH_NAMES[month].toUpperCase(), {
      x: MARGIN_LEFT,
      y: curY,
      size: 16,
      font: boldFont,
      color: rgb(0.05, 0.58, 0.53),
    });
    curY -= 6;
    page.drawLine({
      start: { x: MARGIN_LEFT, y: curY },
      end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: curY },
      thickness: 1.5,
      color: rgb(0.05, 0.58, 0.53),
    });
    curY -= 20;

    for (const deadline of monthDeadlines) {
      // Each deadline needs ~60px
      const p = ensureSpace(70);
      const dc = getDeadlineColor(deadline, gestione);

      // Color dot + date
      p.drawCircle({
        x: MARGIN_LEFT + 5, y: curY + 3, size: 4,
        color: rgb(dc.r, dc.g, dc.b),
      });

      p.drawText(deadline.date, {
        x: MARGIN_LEFT + 16,
        y: curY,
        size: 10,
        font: boldFont,
        color: rgb(0.2, 0.22, 0.25),
      });
      curY -= 16;

      // Label
      p.drawText(deadline.label, {
        x: MARGIN_LEFT + 16,
        y: curY,
        size: 11,
        font: boldFont,
        color: rgb(dc.r, dc.g, dc.b),
      });
      curY -= 14;

      // Description — wrap text
      const descLines = wrapText(deadline.description, font, 9, CONTENT_WIDTH - 20);
      for (const line of descLines) {
        const pg = ensureSpace(14);
        pg.drawText(line, {
          x: MARGIN_LEFT + 16,
          y: curY,
          size: 9,
          font,
          color: rgb(0.35, 0.38, 0.42),
        });
        curY -= 13;
      }

      curY -= 10; // spacing between deadlines
    }

    curY -= 10; // extra spacing between months
  }

  return await pdfDoc.save();
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? current + " " + word : word;
    const width = font.widthOfTextAtSize(test, fontSize);
    if (width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405);
  }

  try {
    // Rate limit by IP or fallback identifier
    const clientId = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "anonymous";
    if (isRateLimited(clientId)) {
      return jsonResponse(req, { error: "Troppe richieste. Riprova tra poco." }, 429);
    }

    const body = await req.json().catch(() => ({}));
    const gestione = body.gestione as Gestione | undefined;

    // Validate gestione if provided
    if (gestione && !["separata", "artigiani", "commercianti"].includes(gestione)) {
      return jsonResponse(req, { error: "Invalid gestione. Must be 'separata', 'artigiani', or 'commercianti'" }, 400);
    }

    console.log(`Generating scadenziario PDF${gestione ? ` for ${gestione}` : " (all gestioni)"}`);

    const pdfBytes = await generatePdf(gestione);

    // Convert to base64 (chunked to avoid stack overflow on large arrays)
    let binary = "";
    for (let i = 0; i < pdfBytes.length; i++) {
      binary += String.fromCharCode(pdfBytes[i]);
    }
    const pdf_base64 = btoa(binary);

    return jsonResponse(req, {
      pdf_base64,
      filename: "scadenziario-forfettario-2026.pdf",
    });
  } catch (err) {
    console.error("PDF generation error:", err);
    return jsonResponse(req, { error: "Failed to generate PDF" }, 500);
  }
});
