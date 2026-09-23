"use client";

import { useEffect, useState } from "react";
import { Gamepad2, Loader2, Swords } from "lucide-react";
import GMCreateCompetitionContent from "@/app/(root)/gamemaster/create-competition/page-content";
import ProviderContestCreateForm, {
  type ContestableTitleOption,
} from "@/components/gamemaster/ProviderContestCreateForm";
import type { TitleLevel } from "@/lib/constants/levels";

type Selection =
  | { type: "trading" }
  | { type: "provider"; title: ContestableTitleOption };

/**
 * Routes the Game Master create screen between trading and provider titles.
 *
 * When the package only allows trading (the default), this renders the existing trading
 * wizard with no picker - same friction rule as the admin game picker. When `provider` is
 * granted and at least one title is contestable, a choose-game step appears first.
 */
export default function CreateCompetitionGate({
  levelLadder,
}: {
  levelLadder: TitleLevel[];
}) {
  const [loading, setLoading] = useState(true);
  const [providerAllowed, setProviderAllowed] = useState(false);
  const [titles, setTitles] = useState<ContestableTitleOption[]>([]);
  const [maxUsers, setMaxUsers] = useState(100);
  const [selection, setSelection] = useState<Selection | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/gamemaster/creation-options");
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.success) {
          setProviderAllowed(false);
          setSelection({ type: "trading" });
          return;
        }
        const allowed = Array.isArray(data.allowedGameTypes)
          ? data.allowedGameTypes
          : ["trading"];
        const list = Array.isArray(data.titles) ? data.titles : [];
        const canProvider = allowed.includes("provider") && list.length > 0;
        setProviderAllowed(canProvider);
        setTitles(list);
        setMaxUsers(data.maxUsersPerCompetition ?? 100);
        if (!canProvider) {
          setSelection({ type: "trading" });
        }
      } catch {
        if (!cancelled) {
          setSelection({ type: "trading" });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-gray-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (selection?.type === "trading") {
    return (
      <>
        {providerAllowed && (
          <div className="border-b border-gray-800 bg-gray-950 px-4 py-2 text-center">
            <button
              type="button"
              className="text-sm text-cyan-400 hover:underline"
              onClick={() => setSelection(null)}
            >
              Choose a different game
            </button>
          </div>
        )}
        <GMCreateCompetitionContent levelLadder={levelLadder} />
      </>
    );
  }

  if (selection?.type === "provider") {
    return (
      <ProviderContestCreateForm
        title={selection.title}
        maxUsersPerCompetition={maxUsers}
        onBack={() => setSelection(null)}
      />
    );
  }

  // Picker — only reached when provider is allowed and titles exist.
  return (
    <div className="min-h-screen bg-gray-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-lg space-y-4">
        <div className="flex items-center gap-2">
          <Gamepad2 className="h-5 w-5 text-cyan-400" />
          <h1 className="text-xl font-bold">Choose a game</h1>
        </div>
        <p className="text-sm text-gray-400">
          Create a trading contest or a contest on one of your enabled games.
        </p>

        <button
          type="button"
          onClick={() => setSelection({ type: "trading" })}
          className="flex w-full items-center gap-3 rounded-xl border border-gray-700 bg-gray-900/60 p-4 text-left hover:border-cyan-600"
        >
          <Swords className="h-5 w-5 text-orange-400" />
          <div>
            <div className="font-medium">Trading</div>
            <div className="text-xs text-gray-400">
              Live forex market · highest P&amp;L wins
            </div>
          </div>
        </button>

        {titles.map((title) => {
          const disabled = !title.schema.ok;
          return (
            <button
              key={title.gameKey}
              type="button"
              disabled={disabled}
              onClick={() => setSelection({ type: "provider", title })}
              className="flex w-full items-center gap-3 rounded-xl border border-gray-700 bg-gray-900/60 p-4 text-left hover:border-cyan-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Gamepad2 className="h-5 w-5 text-cyan-400" />
              <div>
                <div className="font-medium">{title.displayName}</div>
                <div className="text-xs text-gray-400">
                  {title.providerName}
                  {title.category ? ` · ${title.category}` : ""}
                  {disabled && title.schema.ok === false
                    ? ` — ${title.schema.error}`
                    : ""}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
