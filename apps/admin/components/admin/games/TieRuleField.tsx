"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTerms } from "@/contexts/TerminologyContext";
import {
  GAME_TIE_RULES,
  GAME_TIE_RULE_COPY,
  type GameTieRule,
} from "@/lib/services/games/game-tie-rule";

/**
 * What happens when two players of a game contest finish on the same score.
 *
 * Two choices only, both from `game-tie-rule.ts`, which the create service also reads - so
 * the screen cannot offer trading's capital-weighted split or "first to sign up wins",
 * neither of which means anything fair for a game.
 */
export function TieRuleField({
  value,
  onChange,
}: {
  value: GameTieRule;
  onChange: (value: GameTieRule) => void;
}) {
  const terms = useTerms();
  const copy = GAME_TIE_RULE_COPY.get(value);

  return (
    <div className="space-y-2">
      <Label className="text-gray-200">
        If two {terms.players} have the same {terms.score}
      </Label>
      <Select value={value} onValueChange={(next) => onChange(next as GameTieRule)}>
        <SelectTrigger className="bg-gray-800 border-gray-600 text-gray-100 h-12">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {GAME_TIE_RULES.map((rule) => (
            <SelectItem key={rule} value={rule}>
              {GAME_TIE_RULE_COPY.get(rule)?.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-gray-400">{copy?.description}</p>
    </div>
  );
}
