"use client";

import { FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AiContentPanel,
  AiFieldButton,
} from "@/components/admin/wizard/AiContentPanel";
import type { ContestDraft } from "../contest-draft";
import type { ContestableTitle } from "../contest-types";
import { FieldShell } from "./fields";

export const DESCRIPTION_WORD_LIMIT = 50;

export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

/**
 * Step two: what the contest is called, with the AI generator wired to both fields.
 *
 * IT COMES AFTER THE GAME IS CHOSEN, AND THAT ORDER IS THE POINT. The generator sends
 * `gameKey` and nothing else about the game; the route looks the catalogue row up and derives
 * every word it tells the model - the title's name, its genre, whether a high or a low score
 * wins. Asking for copy before a game is picked would produce trading vocabulary for a
 * puzzle, which is the defect this ordering avoids rather than a preference.
 *
 * THE FIFTY-WORD LIMIT MATCHES THE TRADING FORM. Not because anything enforces it server-side
 * but because a description is rendered in a card on the player's lobby, and the two wizards
 * disagreeing about how much text fits is how one game's contests start looking broken.
 */
export function StepBasics({
  draft,
  patch,
  title,
}: {
  draft: ContestDraft;
  patch: (changes: Partial<ContestDraft>) => void;
  title?: ContestableTitle;
}) {
  const words = countWords(draft.description);
  const overLimit = words > DESCRIPTION_WORD_LIMIT;

  return (
    <>
      <AiContentPanel
        onGenerate={(data) =>
          patch({
            ...(data.title ? { name: data.title } : {}),
            ...(data.description ? { description: data.description } : {}),
          })
        }
        currentTitle={draft.name}
        currentDescription={draft.description}
        gameKey={title?.gameKey}
        subjectLabel={title?.displayName}
      />

      <FieldShell
        label="Competition Name *"
        icon={FileText}
        htmlFor="contest-name"
        hint="Choose a catchy name that attracts participants"
        action={
          <AiFieldButton
            field="title"
            onGenerate={(data) => data.title && patch({ name: data.title })}
            currentTitle={draft.name}
            gameKey={title?.gameKey}
            subjectLabel={title?.displayName}
          />
        }
      >
        <Input
          id="contest-name"
          value={draft.name}
          onChange={(e) => patch({ name: e.target.value })}
          className="bg-gray-800 border-gray-600 text-gray-100 h-12 text-lg focus:ring-2 focus:ring-blue-500"
          placeholder={
            title ? `e.g., ${title.displayName} Friday Championship` : "e.g., Friday Championship"
          }
        />
      </FieldShell>

      <FieldShell
        label="Description *"
        icon={FileText}
        htmlFor="contest-description"
        hint={`Keep it brief and clear (max ${DESCRIPTION_WORD_LIMIT} words)`}
        action={
          <AiFieldButton
            field="description"
            onGenerate={(data) =>
              data.description && patch({ description: data.description })
            }
            currentDescription={draft.description}
            gameKey={title?.gameKey}
            subjectLabel={title?.displayName}
          />
        }
      >
        <Textarea
          id="contest-description"
          value={draft.description}
          onChange={(e) => patch({ description: e.target.value })}
          rows={5}
          className={`bg-gray-800 border-gray-600 text-gray-100 min-h-[140px] focus:ring-2 focus:ring-blue-500 ${
            overLimit ? "border-red-500" : ""
          }`}
          placeholder={
            title
              ? `Describe the competition briefly. Example: Join our ${title.displayName} showdown - beat the field and win prizes.`
              : "Describe the competition briefly."
          }
        />
        <div className="mt-2 flex justify-end">
          <span
            className={`text-xs ${overLimit ? "text-red-400" : "text-gray-500"}`}
          >
            {words}/{DESCRIPTION_WORD_LIMIT} words
          </span>
        </div>
      </FieldShell>
    </>
  );
}
