/**
 * The content assistant for one catalogue title (task document 19).
 *
 * A SEPARATE ROUTE FROM `generate-competition`, AND THE GRANT IS THE REASON RATHER THAN THE
 * PROMPT. That route is guarded by `competitions`, because the wizard that calls it is a
 * competitions screen. This one is called from the games catalogue, which is granted by
 * `game-providers` - so folding it into the other route would either lock out every operator
 * who runs the catalogue and not contests, or widen a grant to cover a screen it was never
 * given for. The section is always the one owning the screen that calls it, which is the rule
 * R51 established when all five AI routes turned out to have no authorization at all.
 */

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { connectToDatabase } from "@/database/mongoose";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import ProviderGame from "@/database/models/games/provider-game.model";
import { guardSection } from "@/lib/admin/section-route-guard";
import { gameContentVocabulary } from "@/lib/admin/ai-game-content-vocabulary";
import {
  parseGameContentSuggestion,
  suggestionIsEmpty,
} from "@/lib/admin/ai-game-content-suggestion";
import {
  VOCABULARY_SELECT,
  type CatalogueVocabularySource,
} from "@/lib/admin/ai-contest-vocabulary";

interface AIConfig {
  apiKey: string | null;
  model: string;
  enabled: boolean;
}

async function getAIConfig(): Promise<AIConfig> {
  try {
    await connectToDatabase();
    const settings = await WhiteLabel.findOne();
    if (settings) {
      return {
        apiKey: settings.openaiApiKey || null,
        model: settings.openaiModel || "gpt-4o-mini",
        enabled: settings.openaiEnabled ?? false,
      };
    }
  } catch {
    console.log("ℹ️ AI config not found in database, checking environment");
  }

  return {
    apiKey: process.env.OPENAI_API_KEY || null,
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    enabled: process.env.OPENAI_ENABLED === "true",
  };
}

export async function POST(request: NextRequest) {
  const guard = await guardSection("game-providers");
  if (!guard.ok) return guard.response;

  try {
    /*
      `gameKey` IS A LOOKUP KEY AND NOTHING ELSE, exactly as on the contest route. Every word
      the model is told about the game comes from the row this key finds. A caller-supplied
      name, genre or scoring rule would be arbitrary text in a system prompt, and it would
      also let the screen's own state drift from a catalogue somebody has since edited.

      `steer` is the operator's own sentence and is the one thing that legitimately comes from
      the browser - it is the whole point of the box. It goes in the USER message, never the
      system one, so it cannot restate the rules the system message just set.
    */
    const { gameKey, steer } = await request.json();

    if (typeof gameKey !== "string" || gameKey.trim() === "") {
      return NextResponse.json(
        { error: "Which game this is for is missing." },
        { status: 400 },
      );
    }

    const config = await getAIConfig();

    if (!config.enabled) {
      return NextResponse.json(
        { error: "AI features are disabled. Enable them in Environment Variables." },
        { status: 400 },
      );
    }

    if (!config.apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key is not configured. Add it in Environment Variables." },
        { status: 400 },
      );
    }

    await connectToDatabase();
    // The projection and the type are the shared ones, never spelled out here: a field this
    // route selects and the contest route does not is one assistant describing the game from
    // a smaller set of facts, with nothing failing. See `VOCABULARY_SELECT`.
    const title = await ProviderGame.findOne({ gameKey: gameKey.trim() })
      .select(VOCABULARY_SELECT)
      .lean<CatalogueVocabularySource>();

    // Reason: refused rather than answered generically. Writing page copy for a game we
    // cannot describe means writing it from the game's key, which is how a puzzle gets copy
    // about racing - fluent, confident and wrong, with nothing in a log. Same reasoning as
    // the contest route refusing an unknown key instead of falling back to trading.
    if (!title) {
      return NextResponse.json(
        {
          error:
            "That game is not in the catalogue, so its page copy cannot be written. Sync the provider's catalogue and try again.",
        },
        { status: 400 },
      );
    }

    const vocabulary = gameContentVocabulary(title);
    const openai = new OpenAI({ apiKey: config.apiKey });

    const userPrompt =
      typeof steer === "string" && steer.trim() !== ""
        ? `Write the page copy. The operator asks for this tone or angle: "${steer.trim()}"`
        : "Write the page copy.";

    const completion = await openai.chat.completions.create({
      model: config.model,
      messages: [
        { role: "system", content: vocabulary.systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 700,
    });

    const suggestion = parseGameContentSuggestion(
      completion.choices[0]?.message?.content || "",
    );

    // An empty suggestion is reported as one rather than returned as four blank boxes, which
    // would read to an operator as the assistant having deliberately proposed nothing.
    if (suggestionIsEmpty(suggestion)) {
      return NextResponse.json(
        { error: "The assistant did not produce anything usable. Try again." },
        { status: 502 },
      );
    }

    return NextResponse.json({ suggestion });
  } catch (error) {
    console.error("Game content generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI generation failed" },
      { status: 500 },
    );
  }
}
