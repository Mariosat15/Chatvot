/**
 * POST /api/fraud/ai-report
 *
 * Generates an AI-powered investigation report for a specific fraud alert.
 * The AI analyzes all evidence, identifies involved accounts, describes their
 * actions, and recommends admin actions.
 *
 * Reason: Admins need quick, structured summaries of complex multi-account
 * fraud investigations. This endpoint uses OpenAI to produce a detailed
 * report without hallucination by grounding the model strictly in the
 * provided evidence data.
 */

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { connectToDatabase } from "@/database/mongoose";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import { verifyAdminAuth } from "@/lib/admin/auth";
import mongoose from "mongoose";

// ─── OpenAI Config ──────────────────────────────────────────
async function getAIConfig() {
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
    console.log("ℹ️ AI config not found in database, checking environment");
  }

  return {
    apiKey: process.env.OPENAI_API_KEY || null,
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    enabled: !!process.env.OPENAI_API_KEY,
  };
}

// ─── Resolve user IDs to names/emails ────────────────────────
async function resolveUserIds(
  userIds: string[],
): Promise<Map<string, { name: string; email: string }>> {
  const result = new Map<string, { name: string; email: string }>();
  if (userIds.length === 0) return result;

  const db = mongoose.connection.db;
  if (!db) return result;

  const { ObjectId } = await import("mongodb");
  const userCollection = db.collection("user");

  const orConditions: Record<string, unknown>[] = userIds
    .slice(0, 50)
    .map((uid: string) => {
      const conditions: Record<string, unknown>[] = [{ id: uid }];
      if (ObjectId.isValid(uid) && String(new ObjectId(uid)) === uid) {
        conditions.push({ _id: new ObjectId(uid) });
      }
      return { $or: conditions };
    });

  const users = await userCollection
    .find({ $or: orConditions })
    .project({ id: 1, _id: 1, name: 1, email: 1 })
    .toArray();

  for (const user of users) {
    const resolvedId = String(user.id || user._id?.toString());
    const entry = {
      name: String(user.name || "Unknown"),
      email: String(user.email || "No email"),
    };
    result.set(resolvedId, entry);
    const objectIdStr = user._id?.toString();
    if (objectIdStr && objectIdStr !== resolvedId) {
      result.set(objectIdStr, entry);
    }
  }

  return result;
}

// ─── Evidence Summarizer ─────────────────────────────────────
// Reason: Fraud alert evidence.data can be enormous (100k+ tokens).
// We extract only the fields relevant for analysis and cap array sizes.
const MAX_ARRAY_ITEMS = 5; // Show at most 5 examples from any array
const MAX_DETECTION_HISTORY = 10; // Show at most 10 detection history entries
const MAX_EVIDENCE_ITEMS = 15; // Show at most 15 evidence items
const MAX_CHAR_PER_EVIDENCE = 2000; // Cap serialized data per evidence item

function summarizeEvidenceData(
  data: Record<string, unknown> | null | undefined,
  evidenceType: string,
): string {
  if (!data) return "(no data)";

  // Extract key fields based on evidence type
  const summary: Record<string, unknown> = {};

  switch (evidenceType) {
    case "device_fingerprint":
      summary.matchedDeviceId = data.matchedDeviceId ?? data.deviceId;
      summary.matchCount = data.matchCount ?? data.accountCount;
      if (Array.isArray(data.accountsDetails)) {
        summary.accountCount = data.accountsDetails.length;
        summary.accounts = data.accountsDetails
          .slice(0, MAX_ARRAY_ITEMS)
          .map((a: Record<string, unknown>) => ({
            userId: a.userId,
            loginCount: a.loginCount,
            lastSeen: a.lastSeen,
          }));
        if (data.accountsDetails.length > MAX_ARRAY_ITEMS) {
          summary.accountsTruncatedFrom = data.accountsDetails.length;
        }
      }
      if (Array.isArray(data.connectedAccountIds)) {
        summary.connectedAccountIds = data.connectedAccountIds.slice(0, 20);
      }
      break;

    case "payment_fingerprint":
      summary.matchType = data.matchType;
      summary.sharedDetail = data.sharedCardLast4 ?? data.sharedPaymentMethod;
      if (Array.isArray(data.connectedAccountIds)) {
        summary.connectedAccountIds = data.connectedAccountIds.slice(0, 20);
      }
      if (Array.isArray(data.transactions)) {
        summary.transactionCount = data.transactions.length;
        summary.transactions = data.transactions.slice(0, MAX_ARRAY_ITEMS);
      }
      break;

    case "mirror_trading":
      summary.userId1 = data.userId1;
      summary.userId2 = data.userId2;
      summary.correlationScore = data.correlationScore ?? data.similarity;
      summary.matchedTradeCount = data.matchedTradeCount ?? data.tradeCount;
      if (Array.isArray(data.matchedTrades)) {
        summary.matchedTradeCount = data.matchedTrades.length;
        summary.sampleTrades = data.matchedTrades.slice(0, 3);
      }
      if (Array.isArray(data.connectedAccountIds)) {
        summary.connectedAccountIds = data.connectedAccountIds.slice(0, 20);
      }
      break;

    case "coordinated_entry":
      summary.competitionId = data.competitionId;
      summary.timingWindowMs = data.timingWindowMs ?? data.windowMs;
      if (Array.isArray(data.entries)) {
        summary.entryCount = data.entries.length;
        summary.entries = data.entries.slice(0, MAX_ARRAY_ITEMS).map(
          (e: Record<string, unknown>) => ({
            userId: e.userId,
            enteredAt: e.enteredAt ?? e.timestamp,
          }),
        );
      }
      if (Array.isArray(data.connectedAccountIds)) {
        summary.connectedAccountIds = data.connectedAccountIds.slice(0, 20);
      }
      break;

    case "trading_similarity":
      summary.userId1 = data.userId1;
      summary.userId2 = data.userId2;
      summary.similarityScore = data.similarityScore ?? data.score;
      summary.commonPairs = data.commonPairs;
      summary.timeOverlap = data.timeOverlap;
      break;

    case "ip_browser_match":
      summary.sharedIP = data.sharedIP ?? data.ipAddress;
      summary.matchedBrowser = data.matchedBrowser ?? data.userAgent;
      if (Array.isArray(data.connectedAccountIds)) {
        summary.connectedAccountIds = data.connectedAccountIds.slice(0, 20);
      }
      break;

    default: {
      // Generic: pick known important keys, skip large nested objects
      /* eslint-disable security/detect-object-injection */
      const importantKeys = [
        "connectedAccountIds",
        "userId",
        "userId1",
        "userId2",
        "confidence",
        "score",
        "matchCount",
        "accountCount",
        "ipAddress",
        "reason",
        "details",
        "competitionId",
      ] as const;
      for (const key of importantKeys) {
        if (data[key] !== undefined) {
          const val = data[key];
          if (Array.isArray(val)) {
            summary[key] = val.slice(0, 10);
          } else {
            summary[key] = val;
          }
        }
      }
      /* eslint-enable security/detect-object-injection */
      // If nothing was extracted, do a limited dump
      if (Object.keys(summary).length === 0) {
        const truncated = JSON.stringify(data).slice(0, MAX_CHAR_PER_EVIDENCE);
        return truncated.length < JSON.stringify(data).length
          ? truncated + "... (truncated)"
          : truncated;
      }
      break;
    }
  }

  const result = JSON.stringify(summary, null, 2);
  if (result.length > MAX_CHAR_PER_EVIDENCE) {
    return result.slice(0, MAX_CHAR_PER_EVIDENCE) + "... (truncated)";
  }
  return result;
}

// Reason: Rough token estimate — 1 token ≈ 4 chars for English text.
// We target ~80k tokens for the user prompt to leave room for system prompt + response.
const MAX_PROMPT_CHARS = 320_000; // ~80k tokens

// ─── System prompt ──────────────────────────────────────────
const SYSTEM_PROMPT = `You are a senior fraud analyst AI for the ChartVolt trading platform.
Your job is to analyze fraud investigation data and produce a structured, precise report.

## CRITICAL RULES
1. **NEVER hallucinate or invent data.** Only use the information provided below.
2. **Be specific** — cite exact user IDs, emails, evidence types, timestamps, and amounts.
3. **Be concise** — admins need actionable information, not filler text.
4. **Identify patterns** — look for coordinated behavior, timing correlations, shared resources.
5. **Risk assessment** — evaluate the severity and confidence of the fraud indicators.
6. **Recommend actions** — suggest specific, proportionate responses.

## OUTPUT FORMAT
Structure your report with these markdown sections:

### 🔍 Executive Summary
A 2-3 sentence overview of the investigation.

### 👥 Accounts Involved
List each account with:
- User ID and email
- Their role in the suspected fraud (e.g., "primary suspect", "linked account", "mirroring target")
- Key actions attributed to them

### 🔗 Fraud Indicators
For each type of fraud detected:
- What was detected
- The evidence supporting it
- Confidence level
- Timeline of events

### ⚠️ Risk Assessment
- Overall risk level (Critical / High / Medium / Low)
- Likelihood of actual fraud vs. false positive
- Potential financial impact

### ✅ Recommended Actions
Numbered list of specific actions the admin should take, in priority order.
Examples: suspend accounts, restrict trading, request KYC re-verification, monitor further, dismiss if false positive.

### 📝 Additional Notes
Any caveats, edge cases, or things to watch for.`;

// ─── Route Handler ──────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdminAuth();
    if (!admin.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { alert } = body;

    if (!alert || !alert._id) {
      return NextResponse.json(
        { success: false, error: "Alert data is required" },
        { status: 400 },
      );
    }

    const config = await getAIConfig();

    if (!config.enabled || !config.apiKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            "AI features are not configured. Please add your OpenAI API key in Settings → Environment Variables.",
        },
        { status: 400 },
      );
    }

    await connectToDatabase();

    // Collect all unique user IDs from the alert
    const allUserIds = new Set<string>();
    if (alert.primaryUserId) allUserIds.add(alert.primaryUserId);
    if (alert.suspiciousUserIds) {
      for (const uid of alert.suspiciousUserIds) allUserIds.add(uid);
    }
    if (alert.evidence) {
      for (const ev of alert.evidence) {
        if (ev.data?.connectedAccountIds) {
          for (const id of ev.data.connectedAccountIds) allUserIds.add(id);
        }
        if (ev.data?.userId1) allUserIds.add(String(ev.data.userId1));
        if (ev.data?.userId2) allUserIds.add(String(ev.data.userId2));
        if (ev.data?.accountsDetails) {
          for (const acct of ev.data.accountsDetails) {
            if (acct.userId) allUserIds.add(String(acct.userId));
          }
        }
      }
    }

    // Resolve user IDs to names/emails
    const userMap = await resolveUserIds(Array.from(allUserIds));

    // Build a human-readable account reference
    const accountReference = Array.from(allUserIds)
      .map((uid) => {
        const resolved = userMap.get(uid);
        if (resolved) {
          return `- ID: ${uid} | Name: ${resolved.name} | Email: ${resolved.email}`;
        }
        return `- ID: ${uid} | (Could not resolve name/email)`;
      })
      .join("\n");

    // Build evidence summary — summarized, not raw dumps
    const evidenceItems = (alert.evidence || []).slice(0, MAX_EVIDENCE_ITEMS);
    const totalEvidenceCount = (alert.evidence || []).length;
    const evidenceSummary = evidenceItems
      .map(
        (ev: { type: string; description: string; data: Record<string, unknown> }, idx: number) =>
          `Evidence #${idx + 1}:\n  Type: ${ev.type}\n  Description: ${ev.description}\n  Key Data: ${summarizeEvidenceData(ev.data, ev.type)}`,
      )
      .join("\n\n");

    // Truncate detection history to most recent entries
    const detectionHistory = alert.detectionHistory || [];
    const recentHistory = detectionHistory.slice(-MAX_DETECTION_HISTORY);

    // Build the user prompt with all investigation data
    let userPrompt = `Analyze the following fraud investigation and produce a detailed report.

## ALERT DETAILS
- Alert ID: ${alert._id}
- Alert Type: ${alert.alertType}
- Title: ${alert.title}
- Description: ${alert.description}
- Severity: ${alert.severity}
- Status: ${alert.status}
- Confidence: ${alert.confidence}%
- Detected At: ${alert.detectedAt}
- Detection Count: ${alert.detectionCount || 1}
- Primary User: ${alert.primaryUserId}

## ACCOUNTS INVOLVED (${allUserIds.size} total)
${accountReference}

## EVIDENCE (${totalEvidenceCount} total items${totalEvidenceCount > MAX_EVIDENCE_ITEMS ? `, showing first ${MAX_EVIDENCE_ITEMS}` : ""})
${evidenceSummary}

${
  recentHistory.length > 0
    ? `## DETECTION HISTORY (${detectionHistory.length} total, showing ${recentHistory.length} most recent)\n${recentHistory
        .map(
          (h: { timestamp: string; triggeredBy: string; ipAddress?: string; details?: string }) =>
            `- ${h.timestamp}: triggered by ${h.triggeredBy}${h.ipAddress ? ` (IP: ${h.ipAddress})` : ""}${h.details ? ` — ${h.details}` : ""}`,
        )
        .join("\n")}`
    : ""
}

${alert.resolution ? `## PREVIOUS RESOLUTION\n${alert.resolution}` : ""}
${alert.actionTaken ? `## PREVIOUS ACTION TAKEN\n${alert.actionTaken}` : ""}

Now produce the investigation report following the exact format specified.`;

    // Reason: Final safety net — if the prompt is still too large after
    // summarization, hard-truncate to stay under the model's context window.
    if (userPrompt.length > MAX_PROMPT_CHARS) {
      console.warn(
        `⚠️ AI report prompt was ${userPrompt.length} chars (~${Math.round(userPrompt.length / 4)} tokens), truncating to ${MAX_PROMPT_CHARS} chars`,
      );
      userPrompt =
        userPrompt.slice(0, MAX_PROMPT_CHARS) +
        "\n\n[NOTE: Some evidence data was truncated due to size limits. Analyze what is available above.]";
    }

    const openai = new OpenAI({ apiKey: config.apiKey });

    const completion = await openai.chat.completions.create({
      model: config.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3, // Low temperature for precision
      max_tokens: 3000,
    });

    const report = completion.choices[0]?.message?.content;

    if (!report) {
      return NextResponse.json(
        { success: false, error: "AI failed to generate a report" },
        { status: 500 },
      );
    }

    const usage = completion.usage;

    return NextResponse.json({
      success: true,
      report,
      usage: {
        inputTokens: usage?.prompt_tokens || 0,
        outputTokens: usage?.completion_tokens || 0,
        model: config.model,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("❌ AI fraud report error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate AI report" },
      { status: 500 },
    );
  }
}
