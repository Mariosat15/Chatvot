import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { TitleSkillEvidence } from "./skill-evidence.service";
import type { EvidenceNarrative } from "./skill-evidence-ai";
import {
  METHOD_PARAGRAPHS,
  correlationVerdict,
  corr,
  pct,
  spreadVerdict,
} from "../../admin/skill-evidence-copy";

/**
 * Renders the Skill Evidence report as a PDF for regulators and counsel.
 *
 * Every number here is printed from the computed evidence. The narrative is placed around
 * the tables, never inside them (see `skill-evidence-ai.ts`).
 */

// Reason: pdf-lib's standard fonts encode WinAnsi only, and drawing a character outside it
// THROWS - so one curly quote in the AI's prose would fail the whole download.
export function toWinAnsi(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201F]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[\u2022\u00B7]/g, "-")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x20-\x7E\n\u00A0-\u00FF]/g, "");
}

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 56;
const WIDTH = A4.w - MARGIN * 2;
const INK = rgb(0.1, 0.12, 0.16);
const MUTED = rgb(0.4, 0.43, 0.48);
const ACCENT = rgb(0.05, 0.45, 0.35);
const RULE = rgb(0.82, 0.84, 0.87);
const WARN = rgb(0.6, 0.38, 0.02);

class Writer {
  page!: PDFPage;
  y = 0;
  constructor(
    readonly doc: PDFDocument,
    readonly font: PDFFont,
    readonly bold: PDFFont,
  ) {
    this.newPage();
  }

  newPage() {
    this.page = this.doc.addPage([A4.w, A4.h]);
    this.y = A4.h - MARGIN;
  }

  ensure(height: number) {
    if (this.y - height < MARGIN + 24) this.newPage();
  }

  wrap(text: string, size: number, font: PDFFont, width = WIDTH): string[] {
    const out: string[] = [];
    for (const para of toWinAnsi(text).split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const next = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(next, size) > width && line) {
          out.push(line);
          line = word;
        } else line = next;
      }
      out.push(line);
    }
    return out;
  }

  text(text: string, opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; gap?: number; indent?: number } = {}) {
    const size = opts.size ?? 10;
    const font = opts.font ?? this.font;
    const lead = size * 1.4;
    const indent = opts.indent ?? 0;
    for (const line of this.wrap(text, size, font, WIDTH - indent)) {
      this.ensure(lead);
      this.page.drawText(line, { x: MARGIN + indent, y: this.y - size, size, font, color: opts.color ?? INK });
      this.y -= lead;
    }
    this.y -= opts.gap ?? 6;
  }

  heading(text: string, size = 14) {
    this.ensure(size * 3);
    this.y -= 6;
    this.text(text, { size, font: this.bold, color: ACCENT, gap: 4 });
  }

  rule() {
    this.ensure(10);
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: A4.w - MARGIN, y: this.y },
      thickness: 0.6,
      color: RULE,
    });
    this.y -= 10;
  }

  /** A simple table. Column widths are fractions of the text width. */
  table(headers: string[], rows: string[][], widths: number[]) {
    const size = 8.5;
    const lead = size * 1.35;
    const cols = widths.map((f) => f * WIDTH);
    const drawRow = (cells: string[], font: PDFFont, color: ReturnType<typeof rgb>) => {
      const wrapped = cols.map((width, i) => ({ width, lines: this.wrap(cells.at(i) ?? "", size, font, width - 6) }));
      const h = Math.max(...wrapped.map((w) => w.lines.length)) * lead + 4;
      this.ensure(h);
      let x = MARGIN;
      for (const { width, lines } of wrapped) {
        lines.forEach((line, j) =>
          this.page.drawText(line, { x: x + 2, y: this.y - size - j * lead, size, font, color }),
        );
        x += width;
      }
      this.y -= h;
      this.page.drawLine({
        start: { x: MARGIN, y: this.y + 1 },
        end: { x: A4.w - MARGIN, y: this.y + 1 },
        thickness: 0.4,
        color: RULE,
      });
    };
    drawRow(headers, this.bold, MUTED);
    for (const r of rows) drawRow(r, this.font, INK);
    this.y -= 8;
  }
}

export interface ReportMeta {
  period: string;
  generatedAt: Date;
  preparedBy: string;
  minPairs: number;
}

export async function renderSkillEvidencePdf(
  titles: TitleSkillEvidence[],
  narrative: EvidenceNarrative,
  meta: ReportMeta,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Skill Evidence Report - ${meta.period}`);
  doc.setSubject("Statistical evidence on skill versus chance, by game title");
  doc.setCreator("ChartVolt Admin");
  const w = new Writer(
    doc,
    await doc.embedFont(StandardFonts.Helvetica),
    await doc.embedFont(StandardFonts.HelveticaBold),
  );

  w.text("Skill Evidence Report", { size: 22, font: w.bold, gap: 2 });
  w.text("Statistical evidence on whether skill or chance determines results, by game title", { size: 11, color: MUTED, gap: 12 });
  w.table(
    ["Item", "Detail"],
    [
      ["Reporting period", `${meta.period} (by the date each competition ended)`],
      ["Generated", `${meta.generatedAt.toISOString().replace("T", " ").slice(0, 16)} UTC`],
      ["Prepared by", meta.preparedBy],
      ["Titles covered", String(titles.length)],
      [
        "Narrative",
        narrative.source === "ai"
          ? "Drafted with AI assistance from the figures in this report. All figures are computed directly from settled results. Review before submission."
          : "Rule-based summary (AI drafting unavailable). All figures are computed directly from settled results.",
      ],
    ],
    [0.25, 0.75],
  );

  w.heading("1. Executive summary");
  w.text(narrative.executiveSummary);

  w.heading("2. Method");
  for (const p of METHOD_PARAGRAPHS) w.text(p);
  w.text(`Minimum sample. A title needs at least ${meta.minPairs} repeat comparisons before its correlations are quoted as evidence.`);

  w.heading("3. Results by title");
  if (titles.length === 0) w.text("No settled game competitions ended in this period.", { color: MUTED });
  titles.forEach((t, i) => {
    w.rule();
    w.heading(`3.${i + 1} ${t.displayName}`, 12);
    w.text(
      `${t.contests} settled competitions - ${t.entries} entries - ${t.players} players, of whom ${t.repeatPlayers} played more than once.`,
      { color: MUTED },
    );
    if (!t.sufficient) {
      w.text(
        `Small sample: ${t.stability.pairs} repeat comparisons, fewer than ${meta.minPairs}. These figures are early indications and should not be relied on as evidence yet.`,
        { color: WARN, font: w.bold },
      );
    }
    w.table(
      ["Measure", "Result", "Luck would give", "Reading"],
      [
        ["Score stability (do good players stay good?)", corr(t.stability.correlation), "0.00", correlationVerdict(t.stability.correlation).label],
        ["Experience vs winning (does practice help?)", corr(t.experience.correlation), "0.00", correlationVerdict(t.experience.correlation).label],
        [
          "Repeat winners (do the same people keep winning?)",
          `${t.winners.repeatWinners} of ${t.winners.distinctWinners} winners, ${t.winners.wins} wins`,
          `about ${t.winners.expectedRepeatWinnersByChance} repeat, ${t.winners.expectedDistinctWinnersByChance} different`,
          spreadVerdict(t.winners).label,
        ],
        ["Share of wins taken by the top 10% of winners", pct(t.winners.topWinnerShare), "-", "-"],
      ],
      [0.38, 0.2, 0.17, 0.25],
    );
    w.table(
      ["Experience", "Entries", "Average finish", "Win rate", "Luck win rate"],
      t.experience.buckets.map((b) => [b.label, String(b.entries), pct(b.meanPercentile), pct(b.winRate), pct(b.chanceWinRate)]),
      [0.28, 0.14, 0.2, 0.18, 0.2],
    );
    w.text("Average finish: 100% always first, 0% always last, 50% is what luck gives.", { size: 8, color: MUTED });
    w.text("Finding", { font: w.bold, gap: 2 });
    w.text(narrative.findings.get(t.gameKey) ?? "");
  });

  w.heading("4. Limitations");
  for (const l of narrative.limitations) w.text(`- ${l}`, { indent: 8 });

  w.heading("5. Conclusion");
  w.text(narrative.conclusion);

  const pages = doc.getPages();
  pages.forEach((p, i) =>
    p.drawText(toWinAnsi(`Skill Evidence Report - ${meta.period} - Page ${i + 1} of ${pages.length}`), {
      x: MARGIN,
      y: MARGIN / 2,
      size: 8,
      font: w.font,
      color: MUTED,
    }),
  );
  return doc.save();
}
