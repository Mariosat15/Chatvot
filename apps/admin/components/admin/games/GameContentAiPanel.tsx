"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AI_NEVER_WRITABLE_CONTENT_FIELDS } from "@/lib/admin/game-content-fields";
import type { GameContentSuggestion } from "@/lib/admin/ai-game-content-suggestion";

/**
 * The content assistant on the game page screen (task document 19).
 *
 * IT PROPOSES; IT NEVER WRITES. Every suggestion lands in a card the operator reads, and
 * applying one is a press. Generating straight into the form is the tempting version and it
 * destroys the operator's own text on a button they pressed to see what it would say.
 *
 * `gameKey` IS THE ONLY THING SENT. The route reads the catalogue row that key finds and
 * derives every word from it, so nothing about the game travels from this browser - the same
 * rule as the contest wizard's panel, and the reason a second hand-written copy of either
 * would be a defect rather than duplication.
 *
 * IT SAYS WHAT IT WILL NOT WRITE, which is not decoration. The two long fields directly below
 * it are the rules summary and how to play, and an assistant that silently skips the two
 * biggest boxes on the screen reads as broken. Saying so - and saying why - is the difference
 * between a scoped feature and one that looks half-finished.
 */
export default function GameContentAiPanel({
  gameKey,
  onApply,
}: {
  gameKey: string;
  onApply: (patch: Partial<GameContentSuggestion>) => void;
}) {
  const [steer, setSteer] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggestion, setSuggestion] = useState<GameContentSuggestion | null>(null);

  const generate = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/ai/generate-game-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameKey, steer }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "Something went wrong. Please contact support.");
        return;
      }
      setSuggestion(data.suggestion);
    } catch {
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-purple-500/30 bg-gradient-to-r from-purple-500/10 to-pink-500/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 p-2">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-purple-300">Write this page for me</h4>
            <p className="text-xs text-gray-400">
              Marketing copy only. The rules and how to play come from the provider —{" "}
              {AI_NEVER_WRITABLE_CONTENT_FIELDS.get("rulesSummary")}.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Input
          value={steer}
          maxLength={200}
          placeholder="Optional: a tone or angle, e.g. “retro arcade, short and punchy”"
          className="min-w-[16rem] flex-1"
          onChange={(event) => setSteer(event.target.value)}
        />
        <Button type="button" onClick={generate} disabled={busy}>
          {busy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Generate
        </Button>
      </div>

      {suggestion && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wide text-white/40">Suggestions</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                onApply(suggestion);
                toast.success("Applied. Nothing is saved until you press Save content.");
              }}
            >
              Use all
            </Button>
          </div>

          <Suggested
            label="Title"
            value={suggestion.displayName}
            onUse={() => onApply({ displayName: suggestion.displayName })}
          />
          <Suggested
            label="Tagline"
            value={suggestion.tagline}
            onUse={() => onApply({ tagline: suggestion.tagline })}
          />
          <Suggested
            label="Description"
            value={suggestion.description}
            onUse={() => onApply({ description: suggestion.description })}
          />
          <Suggested
            label="Highlights"
            value={suggestion.highlights.map((row) => `${row.title} — ${row.detail}`).join(" · ")}
            onUse={() => onApply({ highlights: suggestion.highlights })}
          />
        </div>
      )}
    </div>
  );
}

/**
 * One proposed value.
 *
 * A field the model produced nothing for is shown as unavailable rather than hidden, so the
 * operator can tell "it had no idea" from "that field is not part of this".
 */
function Suggested({
  label,
  value,
  onUse,
}: {
  label: string;
  value: string;
  onUse: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-white/50">{label}</p>
        <p className="mt-0.5 break-words text-sm text-white/85">
          {value === "" ? <span className="text-white/30">Nothing suggested</span> : value}
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={value === ""}
        onClick={onUse}
      >
        <Check className="mr-1.5 h-3.5 w-3.5" />
        Use
      </Button>
    </div>
  );
}
