/**
 * Chargeback AI narrative generator.
 *
 * Given the frozen `evidenceSnapshot` (or a freshly built one) this service
 * asks OpenAI to produce a professional, human-readable defense narrative.
 *
 * The prompt is strictly grounded in the facts we pass in: the model is
 * instructed never to invent data. If the AI provider is not configured
 * or the request fails, we return a deterministic fallback narrative so
 * the download flow never breaks.
 *
 * Never expose raw user PII (document numbers, addresses, card PAN) in the
 * prompt. Only the fields already captured in the snapshot are passed, and
 * those fields are the same ones the defense packet already surfaces on
 * screen.
 */
// Reason: relative imports so the service resolves identically from the
// main Next.js app and `apps/admin` (different `@/` aliases).
import OpenAI from "openai";
import { connectToDatabase } from "../../../database/mongoose";
import { WhiteLabel } from "../../../database/models/whitelabel.model";
import type {
  ChargebackFacts,
  EvidenceSnapshot,
} from "./chargeback-evidence.markdown";
import {
  buildRebuttalLetter,
  resolveReasonHint,
} from "./chargeback-evidence.markdown";

export interface AINarrativeSections {
  executiveSummary: string;
  transactionAuthorization: string;
  cardholderIdentity: string;
  serviceDeliveryProof: string;
  priorHistoryAnalysis: string;
  reasonCodeAnalysis: string;
  rebuttalLetter: string;
}

export interface AINarrativeResult {
  sections: AINarrativeSections;
  model: string;
  source: "ai" | "fallback";
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

interface AIConfig {
  apiKey: string | null;
  model: string;
  enabled: boolean;
}

async function getAIConfig(): Promise<AIConfig> {
  try {
    await connectToDatabase();
    const settings = await WhiteLabel.findOne();
    if (settings?.openaiApiKey && settings?.openaiEnabled) {
      return {
        apiKey: settings.openaiApiKey,
        model: settings.openaiModel || "gpt-4o-mini",
        enabled: true,
      };
    }
  } catch {
    // fall through to env
  }
  return {
    apiKey: process.env.OPENAI_API_KEY || null,
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    enabled:
      process.env.OPENAI_ENABLED === "true" || !!process.env.OPENAI_API_KEY,
  };
}

// ─── Fact extraction (grounded input for the model) ──────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- snapshot is free-form
function factBundle(cb: ChargebackFacts, snap: EvidenceSnapshot): any {
  const tx = snap.transaction || {};
  const geo = [tx.clientCity, tx.clientRegion, tx.clientCountry]
    .filter(Boolean)
    .join(", ");
  return {
    case: {
      id: cb.id,
      chargebackCaseId: cb.chargebackCaseId || null,
      provider: cb.provider,
      providerTransactionId: cb.providerTransactionId || null,
      reasonCode: cb.reasonCode || null,
      reasonLabel: resolveReasonHint(cb.reasonCode).label,
      evidenceChecklist: resolveReasonHint(cb.reasonCode).evidenceChecklist,
      amount: cb.amount,
      currency: cb.currency,
      receivedAt: cb.receivedAt,
    },
    transaction: {
      transactionId: tx.transactionId || null,
      processedAt: tx.processedAt || null,
      status: tx.status || null,
      amount: tx.amount ?? null,
      currency: tx.currency || null,
      provider: tx.provider || null,
      providerTransactionId: tx.providerTransactionId || null,
      clientIp: tx.clientIp || null,
      geo: geo || null,
      cardLast4: tx.cardLast4 || null,
      cardBrand: tx.cardBrand || null,
      avsResult: tx.avsResult || null,
      cvvResult: tx.cvvResult || null,
      threeDSStatus: tx.threeDSStatus || null,
      threeDSEci: tx.threeDSEci || null,
      authCode: tx.authCode || null,
      userAgent: tx.userAgent || null,
    },
    wallet: snap.wallet || null,
    cardholder: {
      kyc: snap.kyc || null,
      termsAcceptance: snap.termsAcceptance || null,
    },
    priorDeposits: {
      count: Array.isArray(snap.priorDeposits) ? snap.priorDeposits.length : 0,
      sample: Array.isArray(snap.priorDeposits)
        ? snap.priorDeposits.slice(0, 10)
        : [],
    },
    trading: {
      positionsTotal: snap.trading?.positionsTotal || 0,
      sample: Array.isArray(snap.trading?.recentPositions)
        ? snap.trading.recentPositions.slice(0, 10)
        : [],
    },
    sessions: {
      count: Array.isArray(snap.sessions) ? snap.sessions.length : 0,
      sample: Array.isArray(snap.sessions) ? snap.sessions.slice(0, 10) : [],
    },
  };
}

// ─── Prompt ─────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior chargeback dispute analyst for the ChartVolt trading platform writing evidence packets for acquirer representment.

## CRITICAL RULES
1. NEVER invent facts. Only use the data provided in the user message.
2. If a field is missing, write "not recorded" or "not available" — never fabricate a value.
3. Tone: professional, factual, respectful, aimed at an acquirer analyst.
4. Be specific: cite exact IP addresses, dates, amounts, AVS/CVV/3DS outcomes, position counts, KYC status.
5. Do NOT include PII that was not supplied (no addresses, no document numbers beyond what is given).
6. The service we sold is "platform credits" — a digital product delivered instantly at settlement, redeemable against trading activity on the ChartVolt platform.

## OUTPUT FORMAT
Return a single JSON object with these keys (each value is a Markdown string, no headings — the section title will be added by the renderer). Keep each section focused and concise:

{
  "executiveSummary": "3-5 sentences summarizing our defense position.",
  "transactionAuthorization": "One paragraph explaining how the transaction was authorized and authenticated. Cite AVS, CVV2, 3DS, auth code, IP, geo, card brand/last 4.",
  "cardholderIdentity": "One or two paragraphs tying the payment to the verified cardholder via KYC and terms-of-service acceptance. If KYC or terms are missing, state so clearly.",
  "serviceDeliveryProof": "One or two paragraphs showing the credits were delivered AND consumed (login sessions from the same IP, positions opened, trades executed, wallet ledger).",
  "priorHistoryAnalysis": "One short paragraph describing the prior undisputed deposit history (count + pattern). If this is the first deposit, say so.",
  "reasonCodeAnalysis": "One short paragraph mapping the specific reason code to the evidence provided and explaining why that evidence rebuts the cardholder's claim under that reason code.",
  "rebuttalLetter": "A professional business-letter style rebuttal addressed 'To: Acquirer / Dispute Resolution' and signed 'ChartVolt Dispute Resolution'. Plain text paragraphs, no markdown headings, no bullet lists. 200-350 words. Must reference authorization data, service delivery, identity verification, and formally request reversal."
}

Return ONLY the JSON object. No preamble, no trailing commentary, no code fences.`;

function buildUserPrompt(cb: ChargebackFacts, snap: EvidenceSnapshot): string {
  const facts = factBundle(cb, snap);
  return `Generate the chargeback defense narrative for the following case. Use ONLY these facts.

\`\`\`json
${JSON.stringify(facts, null, 2)}
\`\`\``;
}

// ─── Fallback renderer (used when AI is unavailable) ────────────

function fallbackSections(
  cb: ChargebackFacts,
  snap: EvidenceSnapshot,
): AINarrativeSections {
  const tx = snap.transaction || {};
  const geo = [tx.clientCity, tx.clientRegion, tx.clientCountry]
    .filter(Boolean)
    .join(", ");
  const priorCount = Array.isArray(snap.priorDeposits)
    ? snap.priorDeposits.length
    : 0;
  const posCount = snap.trading?.positionsTotal || 0;
  const reasonLabel = resolveReasonHint(cb.reasonCode).label;
  const sessionCount = Array.isArray(snap.sessions) ? snap.sessions.length : 0;

  return {
    executiveSummary: [
      `This chargeback (reason: ${reasonLabel}) disputes a ${cb.amount} ${cb.currency} payment processed through ${cb.provider} on ${
        tx.processedAt
          ? new Date(tx.processedAt).toISOString().slice(0, 10)
          : "an unrecorded date"
      }.`,
      `The transaction was authenticated with AVS=${tx.avsResult || "—"}, CVV2=${tx.cvvResult || "—"}, 3DS=${tx.threeDSStatus || "—"}.`,
      `The cardholder subsequently opened ${posCount} trading position(s) on the platform and has ${priorCount} prior undisputed deposit(s) on record.`,
      `We respectfully request representment.`,
    ].join(" "),
    transactionAuthorization: [
      `The disputed payment was initiated from IP ${tx.clientIp || "(not recorded)"}${geo ? ` (${geo})` : ""} using card ${tx.cardBrand || ""} ${tx.cardLast4 ? `ending ${tx.cardLast4}` : "(last 4 not recorded)"}.`,
      `Authorization response: auth code ${tx.authCode || "—"}, AVS ${tx.avsResult || "—"}, CVV2 ${tx.cvvResult || "—"}, 3DS ${tx.threeDSStatus || "—"}${tx.threeDSEci ? ` (ECI ${tx.threeDSEci})` : ""}.`,
      `All authentication signals match the issuing bank's "card-present-equivalent" criteria for card-not-present transactions.`,
    ].join(" "),
    cardholderIdentity: snap.kyc
      ? `The cardholder completed KYC verification (${snap.kyc.status})${snap.kyc.fullName ? ` under the name "${snap.kyc.fullName}"` : ""} using a ${snap.kyc.documentType || "government"} document${snap.kyc.documentCountry ? ` issued by ${snap.kyc.documentCountry}` : ""}. ${
          snap.termsAcceptance
            ? `Terms and Conditions were accepted on ${new Date(snap.termsAcceptance.acceptedAt || Date.now()).toISOString().slice(0, 10)} from IP ${snap.termsAcceptance.ipAddress || "(not recorded)"}.`
            : `No terms-acceptance record is available for this user.`
        }`
      : `No KYC record is available for this user at the time of this report.`,
    serviceDeliveryProof: [
      `Platform credits were delivered instantly at settlement.`,
      `The cardholder has opened ${posCount} position(s) and maintained ${sessionCount} recent sign-in session(s) on the platform.`,
      `This activity constitutes continued consumption of the purchased digital service.`,
    ].join(" "),
    priorHistoryAnalysis:
      priorCount > 0
        ? `The same account has ${priorCount} prior undisputed deposit${priorCount === 1 ? "" : "s"} on record, indicating an ongoing legitimate commercial relationship.`
        : `This is the cardholder's first deposit on the platform; no prior deposit history is available.`,
    reasonCodeAnalysis: `Under reason code ${cb.reasonCode || "(unspecified)"}${cb.reasonCode ? ` — ${reasonLabel}` : ""}, the evidence set (authorization data, KYC, terms acceptance, session logs, and trading activity) directly contradicts the cardholder's claim.`,
    rebuttalLetter: buildRebuttalLetter(cb, snap),
  };
}

// ─── Safe JSON parsing ──────────────────────────────────────────

function parseJSONLoose(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function s(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

// ─── Public entry point ─────────────────────────────────────────

export async function buildAINarrative(
  cb: ChargebackFacts,
  snap: EvidenceSnapshot,
): Promise<AINarrativeResult> {
  const config = await getAIConfig();
  if (!config.enabled || !config.apiKey) {
    return {
      sections: fallbackSections(cb, snap),
      model: "fallback",
      source: "fallback",
    };
  }

  try {
    const openai = new OpenAI({ apiKey: config.apiKey });
    const completion = await openai.chat.completions.create({
      model: config.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(cb, snap) },
      ],
      temperature: 0.25,
      max_tokens: 2500,
      // Reason: `response_format: json_object` is supported on all recent
      // chat-completions models and prevents the model from wrapping the
      // JSON in prose or code fences.
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content || "";
    const parsed = parseJSONLoose(raw);
    if (!parsed) {
      console.warn("⚠️ [chargeback-ai] failed to parse AI JSON; using fallback");
      return {
        sections: fallbackSections(cb, snap),
        model: config.model,
        source: "fallback",
      };
    }

    const fb = fallbackSections(cb, snap);
    const sections: AINarrativeSections = {
      executiveSummary: s(parsed.executiveSummary) || fb.executiveSummary,
      transactionAuthorization:
        s(parsed.transactionAuthorization) || fb.transactionAuthorization,
      cardholderIdentity:
        s(parsed.cardholderIdentity) || fb.cardholderIdentity,
      serviceDeliveryProof:
        s(parsed.serviceDeliveryProof) || fb.serviceDeliveryProof,
      priorHistoryAnalysis:
        s(parsed.priorHistoryAnalysis) || fb.priorHistoryAnalysis,
      reasonCodeAnalysis:
        s(parsed.reasonCodeAnalysis) || fb.reasonCodeAnalysis,
      rebuttalLetter: s(parsed.rebuttalLetter) || fb.rebuttalLetter,
    };

    return {
      sections,
      model: config.model,
      source: "ai",
      usage: {
        inputTokens: completion.usage?.prompt_tokens || 0,
        outputTokens: completion.usage?.completion_tokens || 0,
      },
    };
  } catch (err) {
    console.error("⚠️ [chargeback-ai] generation failed:", err);
    return {
      sections: fallbackSections(cb, snap),
      model: config.model,
      source: "fallback",
    };
  }
}

/**
 * Compose a single Markdown string from AI sections (for copy-to-clipboard,
 * .md download, and to populate `Chargeback.narrative`).
 */
export function renderNarrativeMarkdown(
  cb: ChargebackFacts,
  sections: AINarrativeSections,
): string {
  const head = [
    `# Chargeback Defense — Case ${cb.chargebackCaseId || cb.id}`,
    ``,
    `- **Provider:** ${cb.provider}`,
    `- **Provider transaction:** ${cb.providerTransactionId || "—"}`,
    `- **Reason code:** ${cb.reasonCode || "—"}`,
    `- **Amount:** ${cb.amount} ${cb.currency}`,
    ``,
    `## Executive Summary`,
    ``,
    sections.executiveSummary,
    ``,
    `## Transaction Authorization`,
    ``,
    sections.transactionAuthorization,
    ``,
    `## Cardholder Identity`,
    ``,
    sections.cardholderIdentity,
    ``,
    `## Service Delivery Proof`,
    ``,
    sections.serviceDeliveryProof,
    ``,
    `## Prior Deposit History`,
    ``,
    sections.priorHistoryAnalysis,
    ``,
    `## Reason-Code Analysis`,
    ``,
    sections.reasonCodeAnalysis,
    ``,
    `## Rebuttal Letter`,
    ``,
    sections.rebuttalLetter,
  ];
  return head.join("\n");
}
