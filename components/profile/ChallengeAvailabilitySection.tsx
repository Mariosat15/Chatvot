"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Swords } from "lucide-react";
import { toast } from "sonner";
import { WILLING_TO_BE_CHALLENGED_BY_DEFAULT } from "@/lib/services/games/challenge-willingness";

/**
 * Who may challenge this player, and at what.
 *
 * TWO SWITCHES, NOT ONE, and the difference is the whole point of the screen.
 * The master switch is `UserPresence.acceptingChallenges`, which has existed and
 * been enforced by the challenge create route since long before this component -
 * and had NO UI at all, so it was a setting no player could reach. The per-game
 * switches are `UserGamePreference.willingToBeChallenged`, which is a player
 * saying they will trade but not race.
 *
 * The master switch writes through `PUT /api/user/presence`, which already owns
 * that field; only the per-game rows go through `/api/user/challenge-availability`.
 * A second writer of one field is the "one rule, two copies" shape in its
 * smallest form.
 *
 * The rules module it imports is model-free, which is a requirement rather than
 * a tidiness preference - see R58, where a client component naming a
 * driver-reaching module took the admin app's build down.
 */

interface GameAvailability {
  gameKey: string;
  label: string;
  willing: boolean;
  unavailableReason?: string;
}

export default function ChallengeAvailabilitySection() {
  const [loading, setLoading] = useState(true);
  const [acceptingChallenges, setAcceptingChallenges] = useState(
    WILLING_TO_BE_CHALLENGED_BY_DEFAULT,
  );
  const [games, setGames] = useState<GameAvailability[]>([]);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/user/challenge-availability");
      if (!response.ok) throw new Error("Failed to load");
      const data = await response.json();
      setAcceptingChallenges(data.acceptingChallenges !== false);
      setGames(Array.isArray(data.games) ? data.games : []);
    } catch {
      toast.error("Could not load your challenge settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** The master switch. Writes to the route that owns the field. */
  const toggleMaster = async () => {
    const next = !acceptingChallenges;
    setSavingKey("__master__");
    try {
      // Reason: PUT, never PATCH. PATCH on this route is the presence HEARTBEAT -
      // it sets `status: "online"` and moves `lastHeartbeat` - so using it here
      // would make changing a setting indistinguishable from playing.
      const response = await fetch("/api/user/presence", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acceptingChallenges: next }),
      });
      if (!response.ok) throw new Error("Failed to save");
      setAcceptingChallenges(next);
      toast.success(
        next ? "Challenges enabled" : "You will not receive challenges",
      );
    } catch {
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setSavingKey(null);
    }
  };

  const toggleGame = async (game: GameAvailability) => {
    const next = !game.willing;
    setSavingKey(game.gameKey);
    try {
      const response = await fetch("/api/user/challenge-availability", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameKey: game.gameKey, willing: next }),
      });
      if (!response.ok) throw new Error("Failed to save");
      setGames((current) =>
        current.map((row) =>
          row.gameKey === game.gameKey ? { ...row, willing: next } : row,
        ),
      );
    } catch {
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="bg-dark-700/50 rounded-2xl p-6 shadow-xl border border-dark-600">
      <div className="flex items-center gap-3 mb-6">
        <Swords className="h-6 w-6 text-orange-500" />
        <h2 className="text-2xl font-bold text-white">Challenge Requests</h2>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading your settings…</span>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-dark-800/50 rounded-lg border border-dark-600">
            <div>
              <p className="text-white font-medium">
                Accept challenges from other players
              </p>
              <p className="text-sm text-gray-400">
                {acceptingChallenges
                  ? "Other players can challenge you one against one"
                  : "Nobody can challenge you, at any game"}
              </p>
            </div>
            <Toggle
              on={acceptingChallenges}
              saving={savingKey === "__master__"}
              onClick={toggleMaster}
            />
          </div>

          {/* Reason: the per-game rows are dimmed rather than removed when the
              master switch is off. They still describe real stored settings, and
              a control that vanishes reads as lost rather than as inapplicable -
              the same reasoning as the game picker disabling a title instead of
              hiding it. */}
          <div
            className={
              acceptingChallenges ? "space-y-2" : "space-y-2 opacity-50"
            }
          >
            <p className="text-sm text-gray-400">
              {acceptingChallenges
                ? "Choose which games you are happy to be challenged at."
                : "These apply again once you accept challenges."}
            </p>
            {games.map((game) => (
              <div
                key={game.gameKey}
                className="flex items-center justify-between p-4 bg-dark-800/50 rounded-lg border border-dark-600"
              >
                <div>
                  <p className="text-white font-medium">{game.label}</p>
                  <p className="text-sm text-gray-400">
                    {game.unavailableReason
                      ? game.unavailableReason
                      : game.willing
                        ? "Open to challenges"
                        : "Not accepting challenges at this game"}
                  </p>
                </div>
                <Toggle
                  on={game.willing}
                  saving={savingKey === game.gameKey}
                  disabled={
                    !acceptingChallenges || Boolean(game.unavailableReason)
                  }
                  onClick={() => toggleGame(game)}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({
  on,
  saving,
  disabled,
  onClick,
}: {
  on: boolean;
  saving: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const locked = saving || disabled;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={locked}
      aria-pressed={on}
      className={`relative w-14 h-7 shrink-0 rounded-full transition-colors ${
        on ? "bg-cyan-500" : "bg-dark-600"
      } ${locked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform ${
          on ? "translate-x-7" : "translate-x-0"
        }`}
      />
      {saving && (
        <Loader2 className="absolute top-1.5 left-1/2 -translate-x-1/2 h-4 w-4 animate-spin text-white" />
      )}
    </button>
  );
}
