import type { ChecklistItem, ChecklistId } from "@/data/protezione-content";

export type ChecklistState = "ho" | "non-ho" | "non-so";

const stateSymbols: Record<ChecklistState, string> = {
  ho: "✓",
  "non-ho": "✗",
  "non-so": "?",
};

const stateLabels: Record<ChecklistState, string> = {
  ho: "Ce l'ho",
  "non-ho": "Non ce l'ho",
  "non-so": "Non so",
};

const DISCLAIMER =
  "Forfettino ti aiuta a orientarti, ma non sostituisce un professionista. " +
  "Per decisioni specifiche, parlane con il tuo commercialista o un consulente assicurativo autorizzato.";

/** Mini-nota per ogni voce (1 riga che spiega PERCHÉ serve).
 *  Tipizzata su ChecklistId per garantire completezza a compile-time. */
const miniNotes: Record<ChecklistId, string> = {
  infortuni: "Protegge il reddito quando non puoi lavorare per infortunio o malattia.",
  rc: "Protegge il patrimonio personale da cause clienti per errori professionali.",
  mutua: "Alternativa a porta aperta alle assicurazioni, detraibile al 19% anche per forfettari.",
  "tutela-legale": "Copre recupero crediti, difesa penale e controversie con fornitori.",
  pensione: "Colma il gap tra la pensione INPS e il tenore di vita desiderato.",
  cyber: "Copre ripristino sistemi, violazione dati e assistenza emergenza IT.",
  tcm: "Protegge i familiari con un capitale in caso di decesso del titolare.",
};

/** Estrae data locale in formato YYYY-MM-DD senza conversione UTC.
 *  Segue la convenzione progetto (vedi MEMORY.md § Timezone & Date Safety). */
function toLocalISODate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function generateChecklistPdf(
  items: ChecklistItem[],
  states: Record<string, ChecklistState>,
): Promise<void> {
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = 210;
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  const innerWidth = contentWidth - 4; // indent area for descriptions/notes
  let y = 20;

  // ── Header ──
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("FORFETTINO", pageWidth / 2, y, { align: "center" });
  y += 10;

  doc.setFontSize(14);
  doc.text("Checklist di Protezione Freelancer", pageWidth / 2, y, { align: "center" });
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const now = new Date();
  const displayDate = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
  doc.text(`Generata il ${displayDate}`, pageWidth / 2, y, {
    align: "center",
  });
  y += 4;

  // ── Separator ──
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // ── Items ──
  doc.setFontSize(11);
  for (const item of items) {
    const state = states[item.id] ?? "non-so";
    const symbol = stateSymbols[state];
    const label = stateLabels[state];

    // Check if we need a new page
    if (y > 245) {
      doc.addPage();
      y = 20;
    }

    // State symbol + label
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`${symbol} ${item.label}`, margin, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`[${label}]  —  ${item.priceRange}`, margin + contentWidth, y, { align: "right" });
    y += 5;

    // Description — wrapped to avoid overflow
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    const descLines = doc.splitTextToSize(item.description, innerWidth);
    doc.text(descLines, margin + 2, y);
    y += descLines.length * 4;

    // Mini-nota — wrapped to avoid overflow
    const note = miniNotes[item.id];
    if (note) {
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      const noteLines = doc.splitTextToSize(note, innerWidth);
      doc.text(noteLines, margin + 2, y);
      y += noteLines.length * 3.5;
    }

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    y += 3;
  }

  // ── Disclaimer ──
  y += 5;
  if (y > 250) {
    doc.addPage();
    y = 20;
  }
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  doc.setFontSize(8);
  doc.setTextColor(130, 130, 130);
  const disclaimerLines = doc.splitTextToSize(DISCLAIMER, contentWidth);
  doc.text(disclaimerLines, margin, y);
  y += disclaimerLines.length * 4 + 4;

  // ── CTA — page break guard ──
  if (y > 270) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(9);
  doc.setTextColor(0, 128, 128);
  doc.text("Scarica la Guida Completa alla Protezione Freelancer su Forfettino.it/guide-per-te", pageWidth / 2, y, {
    align: "center",
  });

  // ── Footer ──
  doc.setFontSize(8);
  doc.setTextColor(160, 160, 160);
  doc.text("Generato da Forfettino.it — Il tuo copilota fiscale", pageWidth / 2, 285, {
    align: "center",
  });

  const today = toLocalISODate(new Date());
  doc.save(`checklist-protezione-${today}.pdf`);
}
