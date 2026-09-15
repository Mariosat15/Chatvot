"use client";

import { useCallback, useEffect, useState } from "react";
import { Languages, Loader2, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  TERMS,
  TERMINOLOGY_TOKENS,
  type TerminologyOverrides,
  type TerminologyToken,
} from "@/lib/constants/terminology";

/**
 * The display-word overrides screen (X6.5, chapter 14 section 2).
 *
 * THE ONE THING TO GET RIGHT HERE IS THAT AN UNTOUCHED BOX IS EMPTY, not pre-filled with the
 * default. A form seeded with the resolved pack saves all twenty-three defaults as explicit
 * overrides the first time anybody presses Save, after which a later correction to a default
 * word reaches every deployment except the ones that opened this screen. So the default is a
 * PLACEHOLDER, the value is the stored override, and clearing a box is how an operator
 * un-renames a token - which is why the route treats a blank as an instruction to `$unset`
 * rather than as a value to store.
 *
 * It reads `TERMS` directly for those placeholders rather than `useTerms()`, deliberately:
 * the hook hands back the RESOLVED pack, so a renamed token would show its own new word as
 * the placeholder and an operator could never see what the platform says by default.
 */

/**
 * The default word for each token, indexed through a `Map`.
 *
 * A `Map` rather than reading `TERMS[token]` directly, for the reason the catalogue's own
 * guard exists: object indexing walks the prototype chain, so a key that is not a token can
 * return something truthy. It is also what keeps this file free of object-injection warnings,
 * which matters because the pre-commit hook lints at `--max-warnings=0`.
 */
const DEFAULTS = new Map<string, string>(Object.entries(TERMS));

/** The field groups. Every token must appear in exactly one - asserted by a test, because a
 * token added to the catalogue and forgotten here is a word no operator can ever change. */
const GROUPS: { heading: string; blurb: string; tokens: TerminologyToken[] }[] = [
  {
    heading: "Contests",
    blurb: "The many-player paid format, and the two-player one.",
    tokens: ["contest", "contests", "challenge", "challenges", "practice"],
  },
  {
    heading: "People",
    blurb: "What a person playing on the platform is called.",
    tokens: ["player", "players", "opponent"],
  },
  {
    heading: "Performance",
    blurb: "The cross-game ranking words. Not profit and loss - a puzzle has none.",
    tokens: ["score", "leaderboard", "rank"],
  },
  {
    heading: "Money labels",
    blurb:
      "The words beside a figure. The figure, its unit and its symbol are set under Currency.",
    tokens: ["entryFee", "prizePool", "prize"],
  },
  {
    heading: "Play structure",
    blurb: "A round is one go at a game; an attempt is a round a player is entitled to.",
    tokens: ["round", "rounds", "attempt", "attempts"],
  },
  {
    heading: "Catalogue",
    blurb: "The titles players can enter a contest at.",
    tokens: ["game", "games"],
  },
  {
    heading: "Progression",
    blurb: "The ladder and what climbs it.",
    tokens: ["level", "levels", "points"],
  },
];

export default function TerminologySettingsSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Map<string, string>>(new Map());

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/terminology");
      if (!response.ok) throw new Error("Failed to load terminology");
      const data = await response.json();
      setDraft(toDraft(data.overrides));
    } catch (error) {
      console.error("Error loading terminology overrides:", error);
      toast.error("Could not load the wording settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Reason: every token is sent, including the emptied ones - a cleared box has to reach
      // the server as a key with a blank value so it can be `$unset`. Omitting it would leave
      // the old override stored while the screen shows it gone, which is the "appears to save"
      // failure this codebase keeps finding.
      const overrides = Object.fromEntries(
        TERMINOLOGY_TOKENS.map((token) => [token, draft.get(token) ?? ""]),
      );

      const response = await fetch("/api/terminology", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrides }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error ?? "Something went wrong. Please contact support.",
        );
      }

      setDraft(toDraft(data?.overrides));
      toast.success("Wording saved. Reload a screen to see the new words.");
    } catch (error) {
      console.error("Error saving terminology overrides:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please contact support.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-indigo-500/50 rounded-2xl shadow-2xl shadow-indigo-500/10 overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 p-6">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-white rounded-xl blur-lg opacity-50"></div>
              <div className="relative h-12 w-12 bg-white rounded-xl flex items-center justify-center shadow-xl">
                <Languages className="h-6 w-6 text-indigo-600" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Wording</h2>
              <p className="text-indigo-100 text-sm">
                Rename the words operators and players read. Leave a box empty to
                use the default shown in it.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-8">
          {GROUPS.map((group) => (
            <div key={group.heading} className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-100">
                  {group.heading}
                </h3>
                <p className="text-sm text-gray-400">{group.blurb}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {group.tokens.map((token) => (
                  <div key={token}>
                    <Label className="text-gray-300" htmlFor={`term-${token}`}>
                      {DEFAULTS.get(token)}
                    </Label>
                    <Input
                      id={`term-${token}`}
                      value={draft.get(token) ?? ""}
                      placeholder={DEFAULTS.get(token)}
                      onChange={(event) =>
                        setDraft((previous) =>
                          new Map(previous).set(token, event.target.value),
                        )
                      }
                      className="mt-2 bg-gray-700 border-gray-600 text-gray-100"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-700">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save wording
            </Button>

            <Button
              variant="outline"
              disabled={saving}
              onClick={() => setDraft(new Map())}
              className="border-gray-600 text-gray-300"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Clear all overrides
            </Button>

            <p className="text-xs text-gray-500">
              Clearing empties every box. Nothing changes until you press Save.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Stored overrides to form state.
 *
 * Indexed through a `Map` rather than by reading the response object directly, because the
 * keys come off a parsed HTTP body: `body["__proto__"]` returns a truthy `Object.prototype`
 * that survives a `!value` test and then fails somewhere unrelated.
 */
function toDraft(overrides: unknown): Map<string, string> {
  const source = new Map<string, unknown>(
    overrides && typeof overrides === "object" && !Array.isArray(overrides)
      ? Object.entries(overrides as TerminologyOverrides)
      : [],
  );

  const draft = new Map<string, string>();
  for (const token of TERMINOLOGY_TOKENS) {
    const value = source.get(token);
    draft.set(token, typeof value === "string" ? value : "");
  }

  return draft;
}
