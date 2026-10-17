/**
 * Chargeback defense packet — DOCX (Word) renderer.
 *
 * Turns the AI-generated narrative + the frozen evidence snapshot into a
 * single, Microsoft Word-compatible document an admin can download,
 * sign, and submit to the acquirer.
 *
 * Every section is laid out with proper headings, paragraphs, and
 * tables so the output is readable even without re-formatting in Word.
 *
 * This renderer is pure (no DB, no network) — callers pass the data in.
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type {
  ChargebackFacts,
  EvidenceSnapshot,
} from "./chargeback-evidence.markdown";
import { fmtDate, resolveReasonHint } from "./chargeback-evidence.markdown";
import type { AINarrativeSections } from "./chargeback-ai-narrative.service";

// ─── Helpers ────────────────────────────────────────────────────

function p(text: string, opts: { bold?: boolean; italic?: boolean } = {}): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        bold: opts.bold,
        italics: opts.italic,
        font: "Calibri",
        size: 22, // 11pt
      }),
    ],
    spacing: { after: 120 },
  });
}

function h1(text: string): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 240, after: 120 },
  });
}

function h2(text: string): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 100 },
  });
}

function title(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        bold: true,
        size: 40, // 20pt
        font: "Calibri",
      }),
    ],
    alignment: AlignmentType.CENTER,
    spacing: { after: 240 },
  });
}

function subtitle(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        italics: true,
        size: 22,
        color: "666666",
        font: "Calibri",
      }),
    ],
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
  });
}

/**
 * Split a block of prose (may contain newlines) into Word paragraphs.
 * Empty lines create a paragraph gap.
 */
function proseBlock(text: string | undefined | null): Paragraph[] {
  if (!text) return [p("(not available)", { italic: true })];
  const lines = String(text).split(/\r?\n/);
  const out: Paragraph[] = [];
  let buf: string[] = [];
  const flush = () => {
    if (buf.length > 0) {
      out.push(p(buf.join(" ")));
      buf = [];
    }
  };
  for (const line of lines) {
    if (line.trim() === "") {
      flush();
      out.push(new Paragraph({ children: [], spacing: { after: 80 } }));
    } else {
      buf.push(line.trim());
    }
  }
  flush();
  if (out.length === 0) out.push(p(String(text)));
  return out;
}

function cell(text: string, opts: { bold?: boolean; width?: number } = {}): TableCell {
  return new TableCell({
    width: opts.width
      ? { size: opts.width, type: WidthType.PERCENTAGE }
      : undefined,
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: text ?? "—",
            bold: opts.bold,
            size: 20, // 10pt
            font: "Calibri",
          }),
        ],
        spacing: { after: 0 },
      }),
    ],
  });
}

function kvRow(label: string, value: string | undefined | null): TableRow {
  return new TableRow({
    children: [
      cell(label, { bold: true, width: 35 }),
      cell(value || "—", { width: 65 }),
    ],
  });
}

function twoColTable(rows: TableRow[]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
      left: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
      right: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
      insideHorizontal: {
        style: BorderStyle.SINGLE,
        size: 4,
        color: "EEEEEE",
      },
      insideVertical: {
        style: BorderStyle.SINGLE,
        size: 4,
        color: "EEEEEE",
      },
    },
  });
}

function dataTable(
  headers: string[],
  rows: Array<Array<string | undefined | null>>,
): Table {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h) => cell(h, { bold: true })),
  });
  const bodyRows = rows.map(
    (r) => new TableRow({ children: r.map((c) => cell(c || "—")) }),
  );
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...bodyRows],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
      left: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
      right: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
      insideHorizontal: {
        style: BorderStyle.SINGLE,
        size: 4,
        color: "EEEEEE",
      },
      insideVertical: {
        style: BorderStyle.SINGLE,
        size: 4,
        color: "EEEEEE",
      },
    },
  });
}

function spacer(after = 160): Paragraph {
  return new Paragraph({ children: [], spacing: { after } });
}

// ─── Section builders ───────────────────────────────────────────

function buildHeader(
  cb: ChargebackFacts,
  snap: EvidenceSnapshot,
  source: "ai" | "fallback",
): Array<Paragraph | Table> {
  const hint = resolveReasonHint(cb.reasonCode);
  return [
    title("Chargeback Defense Packet"),
    subtitle(
      `Generated ${fmtDate(
        (snap.generatedAt as Date) || new Date(),
      )} · Narrative source: ${source === "ai" ? "AI-assisted" : "template"}`,
    ),
    twoColTable([
      kvRow("Case ID", cb.chargebackCaseId || cb.id),
      kvRow("Provider", cb.provider),
      kvRow("Provider transaction", cb.providerTransactionId),
      kvRow("Reason code", cb.reasonCode),
      kvRow("Reason label", hint.label),
      kvRow("Disputed amount", `${cb.amount} ${cb.currency}`),
      kvRow("Chargeback received", fmtDate(cb.receivedAt)),
    ]),
    spacer(),
  ];
}

function buildNarrativeSection(
  label: string,
  content: string,
): Array<Paragraph> {
  return [h1(label), ...proseBlock(content), spacer()];
}

function buildTransactionTable(
  snap: EvidenceSnapshot,
): Array<Paragraph | Table> {
  const tx = snap.transaction || {};
  const geo = [tx.clientCity, tx.clientRegion, tx.clientCountry]
    .filter(Boolean)
    .join(", ");
  return [
    h2("Original transaction (raw evidence)"),
    twoColTable([
      kvRow("Transaction ID", tx.transactionId),
      kvRow("Status", tx.status),
      kvRow("Processed at", fmtDate(tx.processedAt)),
      kvRow("Amount", tx.amount != null ? `${tx.amount} ${tx.currency || ""}` : "—"),
      kvRow("Client IP", tx.clientIp),
      kvRow("Geo", geo || undefined),
      kvRow("User agent", tx.userAgent),
      kvRow("Card brand", tx.cardBrand),
      kvRow("Card last 4", tx.cardLast4),
      kvRow("AVS result", tx.avsResult),
      kvRow("CVV2 result", tx.cvvResult),
      kvRow("3D Secure status", tx.threeDSStatus),
      kvRow("3DS ECI", tx.threeDSEci),
      kvRow("Authorization code", tx.authCode),
    ]),
    spacer(),
  ];
}

function buildWalletTable(snap: EvidenceSnapshot): Array<Paragraph | Table> {
  if (!snap.wallet) {
    return [
      h2("Wallet snapshot"),
      p("Wallet record not available.", { italic: true }),
      spacer(),
    ];
  }
  return [
    h2("Wallet snapshot"),
    twoColTable([
      kvRow("Credit balance", String(snap.wallet.creditBalance ?? "—")),
      kvRow("Total deposited", String(snap.wallet.totalDeposited ?? "—")),
      kvRow("Total withdrawn", String(snap.wallet.totalWithdrawn ?? "—")),
      kvRow("Total refunded", String(snap.wallet.totalRefunded ?? "—")),
    ]),
    spacer(),
  ];
}

function buildIdentityTable(snap: EvidenceSnapshot): Array<Paragraph | Table> {
  const out: Array<Paragraph | Table> = [h2("Cardholder identity (raw evidence)")];
  if (snap.kyc) {
    out.push(
      twoColTable([
        kvRow("KYC status", snap.kyc.status),
        kvRow("Full name", snap.kyc.fullName),
        kvRow("Nationality", snap.kyc.nationality),
        kvRow("Document type", snap.kyc.documentType),
        kvRow("Document country", snap.kyc.documentCountry),
        kvRow("KYC decision at", fmtDate(snap.kyc.decisionTime)),
      ]),
    );
  } else {
    out.push(p("No KYC record available.", { italic: true }));
  }
  if (snap.termsAcceptance) {
    out.push(
      twoColTable([
        kvRow("Terms accepted at", fmtDate(snap.termsAcceptance.acceptedAt)),
        kvRow("Acceptance IP", snap.termsAcceptance.ipAddress),
        kvRow("Terms version", snap.termsAcceptance.version),
      ]),
    );
  } else {
    out.push(p("No terms-acceptance record on file.", { italic: true }));
  }
  out.push(spacer());
  return out;
}

function buildPriorDepositsTable(
  snap: EvidenceSnapshot,
): Array<Paragraph | Table> {
  const rows: Array<Record<string, unknown>> = Array.isArray(snap.priorDeposits)
    ? snap.priorDeposits
    : [];
  if (rows.length === 0) {
    return [
      h2("Previous undisputed deposits"),
      p("No prior undisputed deposits on record.", { italic: true }),
      spacer(),
    ];
  }
  return [
    h2("Previous undisputed deposits (raw evidence)"),
    dataTable(
      ["When", "Amount", "PSP", "Card", "IP"],
      rows.map((d) => [
        fmtDate(d.processedAt as Date),
        `${d.amount} ${String(d.currency || "")}`,
        String(d.provider || ""),
        String((d as { cardLast4?: string }).cardLast4 || ""),
        String((d as { clientIp?: string }).clientIp || ""),
      ]),
    ),
    spacer(),
  ];
}

function buildTradingTable(snap: EvidenceSnapshot): Array<Paragraph | Table> {
  const total = snap.trading?.positionsTotal ?? 0;
  const rows: Array<Record<string, unknown>> = Array.isArray(
    snap.trading?.recentPositions,
  )
    ? snap.trading.recentPositions
    : [];
  const out: Array<Paragraph | Table> = [h2("Service delivery (raw evidence)")];
  out.push(p(`Total positions opened: ${total}`));
  if (rows.length > 0) {
    out.push(
      dataTable(
        ["Opened", "Symbol", "Side", "Size", "Status"],
        rows.map((r) => [
          fmtDate(r.openedAt as Date),
          String(r.symbol || ""),
          String(r.side || ""),
          String(r.size || ""),
          String(r.status || ""),
        ]),
      ),
    );
  }
  out.push(spacer());
  return out;
}

function buildSessionsTable(snap: EvidenceSnapshot): Array<Paragraph | Table> {
  const rows: Array<Record<string, unknown>> = Array.isArray(snap.sessions)
    ? snap.sessions
    : [];
  if (rows.length === 0) {
    return [
      h2("Recent sign-in sessions"),
      p("No recent sessions recorded.", { italic: true }),
      spacer(),
    ];
  }
  return [
    h2("Recent sign-in sessions (raw evidence)"),
    dataTable(
      ["Last seen", "IP", "Geo", "Status"],
      rows.map((s) => [
        fmtDate(s.lastSeen as Date),
        String(s.ipAddress || ""),
        [
          (s as { city?: string }).city,
          (s as { region?: string }).region,
          (s as { country?: string }).country,
        ]
          .filter(Boolean)
          .join(", "),
        String(s.status || ""),
      ]),
    ),
    spacer(),
  ];
}

function buildEvidenceChecklist(cb: ChargebackFacts): Array<Paragraph> {
  const hint = resolveReasonHint(cb.reasonCode);
  const items = hint.evidenceChecklist || [];
  const out: Paragraph[] = [
    h2("Recommended evidence checklist (reason-code specific)"),
    p(`Reason code: ${cb.reasonCode || "(unspecified)"} — ${hint.label}`, {
      italic: true,
    }),
  ];
  for (const item of items) {
    out.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `• ${item}`,
            size: 22,
            font: "Calibri",
          }),
        ],
        spacing: { after: 60 },
      }),
    );
  }
  out.push(spacer());
  return out;
}

// ─── Public API ─────────────────────────────────────────────────

export interface BuildDocxInput {
  cb: ChargebackFacts;
  snapshot: EvidenceSnapshot;
  narrative: AINarrativeSections;
  source: "ai" | "fallback";
}

/**
 * Build a Word-format defense packet. Returns a Buffer ready for download
 * with content-type `application/vnd.openxmlformats-officedocument.wordprocessingml.document`.
 */
export async function buildDefensePacketDocx(
  input: BuildDocxInput,
): Promise<Buffer> {
  const { cb, snapshot, narrative, source } = input;

  const children: Array<Paragraph | Table> = [];

  // 1) Header block
  children.push(...buildHeader(cb, snapshot, source));

  // 2) AI narrative
  children.push(
    ...buildNarrativeSection("Executive Summary", narrative.executiveSummary),
  );
  children.push(
    ...buildNarrativeSection(
      "Transaction Authorization",
      narrative.transactionAuthorization,
    ),
  );
  children.push(
    ...buildNarrativeSection(
      "Cardholder Identity",
      narrative.cardholderIdentity,
    ),
  );
  children.push(
    ...buildNarrativeSection(
      "Service Delivery Proof",
      narrative.serviceDeliveryProof,
    ),
  );
  children.push(
    ...buildNarrativeSection(
      "Prior Deposit History",
      narrative.priorHistoryAnalysis,
    ),
  );
  children.push(
    ...buildNarrativeSection(
      "Reason-Code Analysis",
      narrative.reasonCodeAnalysis,
    ),
  );

  // 3) Raw evidence tables — same data as in the snapshot, formatted
  // for human reading instead of JSON.
  children.push(h1("Raw Evidence"));
  children.push(...buildTransactionTable(snapshot));
  children.push(...buildWalletTable(snapshot));
  children.push(...buildIdentityTable(snapshot));
  children.push(...buildPriorDepositsTable(snapshot));
  children.push(...buildTradingTable(snapshot));
  children.push(...buildSessionsTable(snapshot));
  children.push(...buildEvidenceChecklist(cb));

  // 4) Rebuttal letter — a formal letter block at the end.
  children.push(h1("Rebuttal Letter"));
  children.push(...proseBlock(narrative.rebuttalLetter));

  const doc = new Document({
    title: `Chargeback Defense — ${cb.chargebackCaseId || cb.id}`,
    description: "Defense packet generated by ChartVolt Admin",
    styles: {
      default: {
        heading1: {
          run: { bold: true, size: 30, color: "1F3A5F", font: "Calibri" },
          paragraph: { spacing: { before: 240, after: 120 } },
        },
        heading2: {
          run: { bold: true, size: 26, color: "2C5282", font: "Calibri" },
          paragraph: { spacing: { before: 200, after: 100 } },
        },
      },
    },
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return buffer as Buffer;
}
