/**
 * Markdown renderers + reason-code hints for the chargeback defense packet.
 * Kept separate from the data-gathering service so the main file stays
 * under the 500-line limit.
 */

export interface ReasonHint {
  label: string;
  evidenceChecklist: string[];
}

export const REASON_HINTS: Record<string, ReasonHint> = {
  "10.4": {
    label: "Other Fraud — Card Absent Environment",
    evidenceChecklist: [
      "AVS match details",
      "CVV2 match details",
      "3D Secure authentication proof (AAV / CAVV / ECI)",
      "Login history from the same IP / device after the deposit",
      "Previous undisputed deposits by this cardholder",
    ],
  },
  "10.1": {
    label: "EMV Liability Shift — Counterfeit Fraud",
    evidenceChecklist: [
      "Proof transaction was card-not-present (outside EMV scope)",
      "3D Secure authentication proof",
      "AVS / CVV2 match",
    ],
  },
  "13.1": {
    label: "Merchandise / Services Not Received",
    evidenceChecklist: [
      "Proof of service delivery (login sessions, positions opened)",
      "Platform access logs post-purchase",
      "Terms and service agreement accepted at signup",
    ],
  },
  "13.3": {
    label: "Not as Described or Defective Merchandise / Services",
    evidenceChecklist: [
      "Original service description (credits were delivered, redeemable for trades)",
      "Usage proof (trades executed, positions opened)",
      "Refund/withdrawal policy shown at purchase",
    ],
  },
  "13.6": {
    label: "Credit Not Processed",
    evidenceChecklist: [
      "Wallet ledger showing credits actually granted",
      "No prior refund request in support records",
    ],
  },
  "13.7": {
    label: "Cancelled Merchandise / Services",
    evidenceChecklist: [
      "Cancellation policy presented at signup and purchase",
      "No cancellation request on record",
      "Continued platform usage after the alleged cancellation date",
    ],
  },
};

export function resolveReasonHint(code?: string): ReasonHint {
  if (!code) {
    return {
      label: "Unspecified",
      evidenceChecklist: [
        "Transaction log with IP + device + card last 4",
        "AVS / CVV2 match details",
        "Platform usage proof (sessions, trades)",
        "KYC verification record",
        "Terms acceptance record",
      ],
    };
  }
  // eslint-disable-next-line security/detect-unsafe-regex -- simple numeric extractor, bounded input (short chargeback codes)
  const key = code.match(/\d+(?:\.\d+)?/)?.[0];
  // eslint-disable-next-line security/detect-object-injection -- key is a numeric substring checked against a known hint map
  if (key && REASON_HINTS[key]) return REASON_HINTS[key];
  return {
    label: code,
    evidenceChecklist: [
      "Transaction log (IP, device, card last 4)",
      "AVS / CVV2 match details",
      "Platform usage proof (sessions, trades, positions)",
      "KYC verification record",
      "Any prior undisputed deposits from this cardholder",
    ],
  };
}

export function fmtDate(d: Date | string | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "—";
  return date.toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

export function kv(label: string, value: unknown): string {
  if (value === null || value === undefined || value === "")
    return `- **${label}:** —`;
  return `- **${label}:** ${String(value)}`;
}

export interface ChargebackFacts {
  id: string;
  provider: string;
  providerTransactionId?: string;
  chargebackCaseId?: string;
  reasonCode?: string;
  amount: number;
  currency: string;
  receivedAt: Date;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- free-form evidence snapshot
export type EvidenceSnapshot = Record<string, any>;

export function buildRebuttalLetter(
  cb: ChargebackFacts,
  snap: EvidenceSnapshot,
): string {
  const tx = snap.transaction || {};
  const ip = tx.clientIp || "(not recorded)";
  const geo = [tx.clientCity, tx.clientRegion, tx.clientCountry]
    .filter(Boolean)
    .join(", ");
  const cardLast4 = tx.cardLast4 ? `ending in ${tx.cardLast4}` : "";
  const priorCount = (snap.priorDeposits || []).length;
  const posCount = snap.trading?.positionsTotal || 0;

  return [
    `# Rebuttal to Chargeback — Case ${cb.chargebackCaseId || cb.id}`,
    ``,
    `To: Acquirer / Dispute Resolution`,
    `From: ChartVolt`,
    `Re: Chargeback dispute on PSP transaction ${cb.providerTransactionId || "(n/a)"}`,
    `Reason code: ${cb.reasonCode || "(not provided)"}`,
    `Amount: ${cb.amount} ${cb.currency}`,
    `Date received: ${fmtDate(cb.receivedAt)}`,
    ``,
    `## Summary`,
    ``,
    `We respectfully dispute this chargeback. The transaction was authorized, authenticated, and the service (platform credits, immediately redeemable for trading activity on our platform) was delivered and consumed by the cardholder.`,
    ``,
    `## Transaction authorization`,
    ``,
    `- Transaction was processed through ${tx.provider || "our PSP"} on ${fmtDate(tx.processedAt)}.`,
    `- Originating IP: ${ip}${geo ? ` (${geo})` : ""}.`,
    `- Card ${cardLast4 || "(last 4 not recorded)"}; AVS: ${tx.avsResult || "—"}; CVV2: ${tx.cvvResult || "—"}; 3DS: ${tx.threeDSStatus || "—"}.`,
    `- Authorization code: ${tx.authCode || "—"}.`,
    ``,
    `## Service delivery`,
    ``,
    `The disputed payment credited the cardholder's ChartVolt wallet. Credits are a digital product, delivered instantly at settlement and redeemable against trading activity on our platform.`,
    ``,
    `- Platform credits were posted to the user's wallet at settlement.`,
    `- The cardholder has opened ${posCount} positions on our platform to date, demonstrating active use of the service paid for.`,
    priorCount > 0
      ? `- The same cardholder has ${priorCount} prior undisputed deposit${priorCount === 1 ? "" : "s"} on record, indicating a legitimate and ongoing commercial relationship.`
      : `- This is the cardholder's first deposit on our platform.`,
    ``,
    `## Cardholder identity`,
    snap.kyc
      ? `- KYC status: ${snap.kyc.status}; full name: ${snap.kyc.fullName || "—"}; document: ${snap.kyc.documentType || "—"}${snap.kyc.documentCountry ? ` (${snap.kyc.documentCountry})` : ""}; decision: ${fmtDate(snap.kyc.decisionTime)}.`
      : `- KYC record: not available.`,
    snap.termsAcceptance
      ? `- Terms & conditions accepted ${fmtDate(snap.termsAcceptance.acceptedAt)} from IP ${snap.termsAcceptance.ipAddress || "—"}${snap.termsAcceptance.version ? ` (v${snap.termsAcceptance.version})` : ""}.`
      : `- Terms & conditions acceptance: not recorded.`,
    ``,
    `## Request`,
    ``,
    `Based on the evidence attached — authenticated card-present data, AVS/CVV matches, KYC record, continued platform use, and (where applicable) prior undisputed deposits — we respectfully request that this chargeback be reversed and the disputed funds returned.`,
    ``,
    `Sincerely,`,
    `ChartVolt Dispute Resolution`,
  ].join("\n");
}

export function buildMarkdownReport(
  cb: ChargebackFacts,
  snap: EvidenceSnapshot,
  rebuttal: string,
): string {
  const tx = snap.transaction || {};
  const lines: string[] = [];

  lines.push(`# Chargeback Defense Packet`);
  lines.push(``);
  lines.push(kv("Case ID", cb.chargebackCaseId || cb.id));
  lines.push(kv("Provider", cb.provider));
  lines.push(kv("Provider tx", cb.providerTransactionId));
  lines.push(kv("Reason code", cb.reasonCode));
  lines.push(kv("Amount", `${cb.amount} ${cb.currency}`));
  lines.push(kv("Received at", fmtDate(cb.receivedAt)));
  lines.push(kv("Generated at", fmtDate(snap.generatedAt as Date)));
  lines.push(``);

  lines.push(`## 1. Reason-code hint`);
  lines.push(``);
  lines.push(kv("Label", snap.reasonHint?.label));
  if (Array.isArray(snap.reasonHint?.evidenceChecklist)) {
    lines.push(``);
    lines.push(`Recommended evidence for this reason code:`);
    for (const e of snap.reasonHint.evidenceChecklist) {
      lines.push(`- ${e}`);
    }
  }
  lines.push(``);

  lines.push(`## 2. Original transaction`);
  lines.push(``);
  lines.push(kv("Transaction ID", tx.transactionId));
  lines.push(kv("Status", tx.status));
  lines.push(kv("Amount", tx.amount));
  lines.push(kv("Processed at", fmtDate(tx.processedAt)));
  lines.push(kv("Client IP", tx.clientIp));
  const geo = [tx.clientCity, tx.clientRegion, tx.clientCountry]
    .filter(Boolean)
    .join(", ");
  lines.push(kv("Geo", geo || undefined));
  lines.push(kv("Card last 4", tx.cardLast4));
  lines.push(kv("Card brand", tx.cardBrand));
  lines.push(kv("AVS", tx.avsResult));
  lines.push(kv("CVV2", tx.cvvResult));
  lines.push(kv("3D Secure", tx.threeDSStatus));
  lines.push(kv("Auth code", tx.authCode));
  lines.push(kv("User agent", tx.userAgent));
  lines.push(``);

  lines.push(`## 3. Wallet snapshot`);
  lines.push(``);
  if (snap.wallet) {
    lines.push(kv("Credit balance", snap.wallet.creditBalance));
    lines.push(kv("Total deposited", snap.wallet.totalDeposited));
    lines.push(kv("Total withdrawn", snap.wallet.totalWithdrawn));
    lines.push(kv("Total refunded", snap.wallet.totalRefunded));
  } else {
    lines.push("- Wallet record not available.");
  }
  lines.push(``);

  lines.push(`## 4. Previous undisputed deposits`);
  lines.push(``);
  if (snap.priorDeposits && snap.priorDeposits.length > 0) {
    lines.push(`| When | Amount | PSP | Card | IP |`);
    lines.push(`| --- | --- | --- | --- | --- |`);
    for (const d of snap.priorDeposits as Array<Record<string, unknown>>) {
      lines.push(
        `| ${fmtDate(d.processedAt as Date)} | ${d.amount} ${d.currency || ""} | ${d.provider || "—"} | ${d.cardLast4 || "—"} | ${d.clientIp || "—"} |`,
      );
    }
  } else {
    lines.push("- No prior undisputed deposits on record.");
  }
  lines.push(``);

  lines.push(`## 5. Cardholder identity`);
  lines.push(``);
  if (snap.kyc) {
    lines.push(kv("KYC status", snap.kyc.status));
    lines.push(kv("Full name", snap.kyc.fullName));
    lines.push(kv("Nationality", snap.kyc.nationality));
    lines.push(kv("Document type", snap.kyc.documentType));
    lines.push(kv("Document country", snap.kyc.documentCountry));
    lines.push(kv("KYC decision at", fmtDate(snap.kyc.decisionTime)));
  } else {
    lines.push("- KYC record not available for this user.");
  }
  lines.push(``);
  if (snap.termsAcceptance) {
    lines.push(
      kv("Terms accepted at", fmtDate(snap.termsAcceptance.acceptedAt)),
    );
    lines.push(kv("Terms acceptance IP", snap.termsAcceptance.ipAddress));
    lines.push(kv("Terms version", snap.termsAcceptance.version));
  } else {
    lines.push("- Terms acceptance not recorded.");
  }
  lines.push(``);

  lines.push(`## 6. Service delivery proof`);
  lines.push(``);
  lines.push(kv("Total positions opened", snap.trading?.positionsTotal));
  if (snap.trading?.recentPositions?.length) {
    lines.push(``);
    lines.push(`Recent positions (up to 10):`);
    lines.push(``);
    lines.push(`| Opened | Symbol | Side | Size | Status |`);
    lines.push(`| --- | --- | --- | --- | --- |`);
    for (const p of snap.trading.recentPositions as Array<
      Record<string, unknown>
    >) {
      lines.push(
        `| ${fmtDate(p.openedAt as Date)} | ${p.symbol || "—"} | ${p.side || "—"} | ${p.size || "—"} | ${p.status || "—"} |`,
      );
    }
  }
  lines.push(``);

  lines.push(`## 7. Recent sign-in sessions`);
  lines.push(``);
  if (snap.sessions && snap.sessions.length > 0) {
    lines.push(`| Last seen | IP | Geo | Status |`);
    lines.push(`| --- | --- | --- | --- |`);
    for (const s of snap.sessions as Array<Record<string, unknown>>) {
      const g =
        [s.city, s.region, s.country].filter(Boolean).join(", ") || "—";
      lines.push(
        `| ${fmtDate(s.lastSeen as Date)} | ${s.ipAddress || "—"} | ${g} | ${s.status || "—"} |`,
      );
    }
  } else {
    lines.push("- No sign-in sessions recorded.");
  }
  lines.push(``);

  lines.push(`## 8. Rebuttal letter`);
  lines.push(``);
  lines.push(rebuttal);

  return lines.join("\n");
}
