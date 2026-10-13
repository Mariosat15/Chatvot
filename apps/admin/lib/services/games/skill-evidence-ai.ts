import OpenAI from "openai";
import { connectToDatabase } from "@/database/mongoose";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import type { TitleSkillEvidence } from "./skill-evidence.service";
import {
  correlationVerdict,
  corr,
  pct,
  spreadVerdict,
} from "../../admin/skill-evidence-copy";

/**
 * The narrative for the regulator PDF: an executive summary, one finding per title, the
 * limitations and a conclusion.
 *
 * THE AI WRITES WORDS, NEVER NUMBERS THE REPORT RELIES ON. Every figure in the PDF tables is
 * printed from the computed evidence. The model is handed those same figures and told to
 * quote only them. A model that invents a correlation inside a regulatory filing is a
 * misstatement with our name on it, so the tables are the record and the prose is
 * commentary on it.
 *
 * If AI is switched off, has no key, or returns something unusable, a rule-based narrative
 * built from the same verdicts is used and the PDF says so. A report that cannot be
 * downloaded because a third-party API is down is worse than a plainer one.
 */

export interface EvidenceNarrative {
  source: "ai" | "rules";
  executiveSummary: string;
  findings: Map<string, string>;
  limitations: string[];
  conclusion: string;
}

const MAX_TEXT = 2500;

function clean(v: unknown): string {
  return typeof v === "string" ? v.trim().slice(0, MAX_TEXT) : "";
}

async function getAIConfig() {
  try {
    await connectToDatabase();
    const s = await WhiteLabel.findOne().select("openaiApiKey openaiModel openaiEnabled").lean<{
      openaiApiKey?: string;
      openaiModel?: string;
      openaiEnabled?: boolean;
    }>();
    if (s) {
      return {
        apiKey: s.openaiApiKey || null,
        model: s.openaiModel || "gpt-4o-mini",
        enabled: s.openaiEnabled ?? false,
      };
    }
  } catch {
    // Fall through to the environment, as every other admin AI route does.
  }
  return {
    apiKey: process.env.OPENAI_API_KEY || null,
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    enabled: process.env.OPENAI_ENABLED === "true",
  };
}

/** The compact fact sheet the model is allowed to quote from. */
export function factSheet(titles: TitleSkillEvidence[], minPairs: number) {
  return titles.map((t) => ({
    gameKey: t.gameKey,
    title: t.displayName,
    contests: t.contests,
    entries: t.entries,
    players: t.players,
    repeatPlayers: t.repeatPlayers,
    sampleSufficient: t.sufficient,
    repeatPairs: t.stability.pairs,
    minimumPairsForEvidence: minPairs,
    scoreStability: corr(t.stability.correlation),
    scoreStabilityVerdict: correlationVerdict(t.stability.correlation).label,
    experienceVsWinning: corr(t.experience.correlation),
    experienceVerdict: correlationVerdict(t.experience.correlation).label,
    wins: t.winners.wins,
    distinctWinners: t.winners.distinctWinners,
    repeatWinners: t.winners.repeatWinners,
    repeatWinnersExpectedByLuck: t.winners.expectedRepeatWinnersByChance,
    differentWinnersExpectedByLuck: t.winners.expectedDistinctWinnersByChance,
    topTenPercentWinShare: pct(t.winners.topWinnerShare),
    spreadVerdict: spreadVerdict(t.winners).label,
    byExperience: t.experience.buckets.map((b) => ({
      group: b.label,
      entries: b.entries,
      averageFinish: pct(b.meanPercentile),
      winRate: pct(b.winRate),
      luckWinRate: pct(b.chanceWinRate),
    })),
  }));
}

export function rulesNarrative(
  titles: TitleSkillEvidence[],
  minPairs: number,
  period: string,
): EvidenceNarrative {
  const findings = new Map<string, string>();
  for (const t of titles) {
    const s = correlationVerdict(t.stability.correlation).label.toLowerCase();
    const e = correlationVerdict(t.experience.correlation).label.toLowerCase();
    const w = spreadVerdict(t.winners).label.toLowerCase();
    findings.set(
      t.gameKey,
      `${t.displayName}: ${t.contests} settled contests and ${t.entries} entries from ${t.players} players. ` +
        `Score stability is ${corr(t.stability.correlation)} (${s}); experience against winning is ` +
        `${corr(t.experience.correlation)} (${e}); ${t.winners.repeatWinners} players won more than once against ` +
        `about ${t.winners.expectedRepeatWinnersByChance} expected by luck (${w}).` +
        (t.sufficient ? "" : ` The sample is below the ${minPairs}-comparison threshold, so these are early indications only.`),
    );
  }
  const thin = titles.filter((t) => !t.sufficient).map((t) => t.displayName);
  return {
    source: "rules",
    executiveSummary:
      `This report covers ${titles.length} game title(s) over the period: ${period}. ` +
      "For each title it measures whether the same players keep finishing well, whether experience predicts results, " +
      "and whether wins are concentrated more than luck would allow, each against a pure-luck baseline.",
    findings,
    limitations: [
      ...(thin.length
        ? [`Sample too small to quote as evidence for: ${thin.join(", ")} (fewer than ${minPairs} repeat comparisons).`]
        : []),
      "Correlations describe association, not cause; they indicate whether results behave as skill or luck would predict.",
      "Only settled competitions are included; challenges and practice play are not.",
    ],
    conclusion:
      "Figures should be read title by title. Titles meeting the sample threshold with clear signs of skill support the " +
      "position that skill predominates; titles below the threshold require more settled play before a conclusion is drawn.",
  };
}

const SYSTEM_PROMPT = `You are drafting the narrative of a statistical report for a gaming regulator and legal counsel.
The report assesses, per game title, whether skill or chance predominates in determining results.

STRICT RULES:
- Use ONLY the figures in the JSON you are given. Never invent, round differently, or estimate a number.
- Quote each verdict exactly as given (e.g. "Weak sign of skill"); do not upgrade or soften it.
- Where sampleSufficient is false, say plainly that the sample is too small to rely on.
- Plain, formal English a non-statistician can follow. No marketing language. No promises.
- Do not give legal conclusions; describe what the evidence shows.

Return JSON only, in exactly this shape:
{"executiveSummary": string (120-220 words),
 "findings": [{"gameKey": string, "finding": string (60-150 words)}],
 "limitations": [string, ...] (2-5 items),
 "conclusion": string (60-150 words)}`;

export async function draftNarrative(
  titles: TitleSkillEvidence[],
  minPairs: number,
  period: string,
): Promise<EvidenceNarrative> {
  const fallback = rulesNarrative(titles, minPairs, period);
  const config = await getAIConfig();
  if (!config.enabled || !config.apiKey || titles.length === 0) return fallback;

  try {
    const openai = new OpenAI({ apiKey: config.apiKey });
    const completion = await openai.chat.completions.create({
      model: config.model,
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 2500,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({ period, titles: factSheet(titles, minPairs) }),
        },
      ],
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}") as Record<string, unknown>;

    // Reason: findings are keyed by a model-supplied gameKey, so they are collected into a
    // Map and only keys we sent are kept. An object lookup would walk the prototype chain,
    // and an unknown key would attach prose to no title.
    const known = new Set(titles.map((t) => t.gameKey));
    const findings = new Map<string, string>();
    if (Array.isArray(parsed.findings)) {
      for (const f of parsed.findings as Record<string, unknown>[]) {
        const key = clean(f?.gameKey);
        const text = clean(f?.finding);
        if (known.has(key) && text) findings.set(key, text);
      }
    }
    const limitations = Array.isArray(parsed.limitations)
      ? (parsed.limitations as unknown[]).map(clean).filter(Boolean).slice(0, 6)
      : [];
    const executiveSummary = clean(parsed.executiveSummary);
    const conclusion = clean(parsed.conclusion);

    if (!executiveSummary || !conclusion) return fallback;
    for (const [k, v] of fallback.findings) if (!findings.has(k)) findings.set(k, v);

    return {
      source: "ai",
      executiveSummary,
      findings,
      limitations: limitations.length ? limitations : fallback.limitations,
      conclusion,
    };
  } catch (error) {
    console.warn("⚠️ Skill evidence AI narrative failed, using rule-based text:", error);
    return fallback;
  }
}
