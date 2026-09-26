"use client";

import { Sparkles } from "lucide-react";
import AIGeneratorDialog from "@/components/admin/AIGeneratorDialog";

/**
 * The "AI Content Generator" banner, shared by both contest wizards.
 *
 * ONE COPY, BECAUSE THE PROP THAT MATTERS IS EASY TO FORGET. `gameKey` is what makes the
 * route describe the right game to the model; a second hand-written copy of this banner
 * that omits it still renders, still generates, and produces trading copy for a puzzle -
 * the same silent-wrong-answer shape as every other "one rule, two copies" defect here.
 *
 * `gameKey` IS A LOOKUP KEY AND NOT VOCABULARY. The route reads the `provider_game` row it
 * names and derives every word from that. Nothing about the game travels from the browser,
 * so a tampered request cannot make the prompt say something the catalogue does not.
 */
export function AiContentPanel({
  onGenerate,
  currentTitle,
  currentDescription,
  gameKey,
  subjectLabel,
}: {
  onGenerate: (data: { title?: string; description?: string }) => void;
  currentTitle: string;
  currentDescription: string;
  gameKey?: string;
  subjectLabel?: string;
}) {
  return (
    <div className="p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-purple-300">
              AI Content Generator
            </h4>
            <p className="text-xs text-gray-400">
              {subjectLabel
                ? `Let AI create a catchy title and description for ${subjectLabel}`
                : "Let AI create a catchy title and description for you"}
            </p>
          </div>
        </div>
        <AIGeneratorDialog
          onGenerate={onGenerate}
          generateType="both"
          currentTitle={currentTitle}
          currentDescription={currentDescription}
          gameKey={gameKey}
          subjectLabel={subjectLabel}
        />
      </div>
    </div>
  );
}

/** The small Generate button that sits on a single field's label row. */
export function AiFieldButton({
  field,
  onGenerate,
  currentTitle,
  currentDescription,
  gameKey,
  subjectLabel,
}: {
  field: "title" | "description";
  onGenerate: (data: { title?: string; description?: string }) => void;
  currentTitle?: string;
  currentDescription?: string;
  gameKey?: string;
  subjectLabel?: string;
}) {
  return (
    <AIGeneratorDialog
      onGenerate={onGenerate}
      generateType={field}
      currentTitle={currentTitle}
      currentDescription={currentDescription}
      gameKey={gameKey}
      subjectLabel={subjectLabel}
    />
  );
}
