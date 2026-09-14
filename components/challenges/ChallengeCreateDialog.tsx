"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Swords, Loader2, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import ActionTermsDialog, {
  ACTION_TERM_SLUGS,
} from "@/components/ActionTermsDialog";
import ChallengeGamePicker from "@/components/challenges/ChallengeGamePicker";
import ChallengeBattleSettings from "@/components/challenges/create/ChallengeBattleSettings";
import ChallengeRulesColumn from "@/components/challenges/create/ChallengeRulesColumn";
import ChallengePrizeSummary from "@/components/challenges/create/ChallengePrizeSummary";
import type {
  ChallengeFormData,
  ChallengeSettings,
} from "@/components/challenges/create/types";
import type { ChallengeableTitle } from "@/lib/services/games/challengeable-titles.service";
import {
  challengeSubtitle,
  challengeQualificationCopy,
  type ChallengeGameSelection,
} from "@/lib/services/games/challenge-game-copy";

interface ChallengeCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  challengedUser: {
    userId: string;
    username: string;
  } | null;
}

export default function ChallengeCreateDialog({
  open,
  onOpenChange,
  challengedUser,
}: ChallengeCreateDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [settings, setSettings] = useState<ChallengeSettings | null>(null);
  const [titles, setTitles] = useState<ChallengeableTitle[]>([]);
  const [selection, setSelection] = useState<ChallengeGameSelection>({
    type: "trading",
  });
  /**
   * The chosen game's own settings - board size, difficulty, playing time, whatever this title
   * happens to take.
   *
   * SEEDED FROM THE TITLE'S OWN DEFAULTS AND REPLACED WHOLE when the game changes, never
   * merged: values from the previous game's schema are meaningless against the new one, so
   * carrying them over submits keys the new schema does not declare - which the create route
   * then refuses, naming a field the player never saw.
   */
  const [gameSettings, setGameSettings] = useState<Record<string, unknown>>({});

  /**
   * The one place a pick changes the form, and it moves THREE things together: the game, its
   * settings and the length.
   *
   * THE LENGTH IS PART OF THE PICK because an operator may set one per title (13 Sep 2026) - a
   * ten-minute game and a two-hour one want different challenge windows, and the owner's report
   * was a player choosing ten minutes for a game whose round could not fit inside it. Leaving
   * the duration behind would mean the pre-chosen settings arrived with a window nobody chose
   * for them, which is the same defect one field along.
   *
   * GOING BACK TO TRADING RESTORES THE PLATFORM DEFAULT rather than keeping the game's. A
   * trading challenge has no title to ask, so a length inherited from a game the player has
   * since deselected is a value with no author - and it is silent, because any duration inside
   * the bounds is accepted.
   *
   * THE VALUES ARE READ OFF THE TITLE, NEVER RECOMPUTED HERE. `defaults` is resolved by
   * `listChallengeableTitles`, which clamps to the platform bounds and drops a stored setting
   * the schema no longer accepts; re-deriving either in the browser is a second copy of a rule
   * the server enforces, and the two disagree in the direction that pre-fills a value the create
   * route then refuses.
   */
  const chooseGame = (next: ChallengeGameSelection) => {
    setSelection(next);
    setGameSettings(next.type === "provider" ? next.title.defaults.settings : {});
    setFormData((prev) => ({
      ...prev,
      duration:
        next.type === "provider"
          ? next.title.defaults.durationMinutes
          : settings?.defaultDurationMinutes ?? prev.duration,
    }));
  };

  const [formData, setFormData] = useState<ChallengeFormData>({
    entryFee: 10,
    duration: 60,
    startingCapital: 10000,
    rankingMethod: "pnl",
    tieBreaker1: "trades_count",
    tieBreaker2: "",
    minimumTrades: 1,
    disqualifyOnLiquidation: true,
  });

  const patchForm = (patch: Partial<ChallengeFormData>) =>
    setFormData((prev) => ({ ...prev, ...patch }));

  // Market status state
  const [marketStatus, setMarketStatus] = useState<{
    isOpen: boolean;
    message: string;
    loading: boolean;
  }>({
    isOpen: true,
    message: "",
    loading: true,
  });

  // Fetch challenge settings and market status
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch("/api/challenges/settings");
        if (res.ok) {
          const data = await res.json();
          setSettings(data.settings);
          setFormData((prev) => ({
            ...prev,
            entryFee: data.settings.minEntryFee || 10,
            duration: data.settings.defaultDurationMinutes || 60,
            startingCapital: data.settings.defaultStartingCapital || 10000,
          }));
        }
      } catch (error) {
        console.error("Failed to fetch settings:", error);
      }
    };

    // Reason: the picker's own list. An empty result (no provider enabled, or
    // `externalGamesEnabled` off platform-wide) makes `ChallengeGamePicker` render nothing,
    // so a failed or empty fetch leaves the dialog exactly as it behaved before this
    // feature existed - Trading only, no picker visible.
    const fetchTitles = async () => {
      try {
        const res = await fetch("/api/challenges/games");
        if (res.ok) {
          const data = await res.json();
          setTitles(data.titles || []);
        }
      } catch (error) {
        console.error("Failed to fetch challengeable titles:", error);
      }
    };

    const fetchMarketStatus = async () => {
      try {
        const res = await fetch("/api/trading/market-status");
        if (res.ok) {
          const data = await res.json();
          const isOpen = data.isOpen ?? data.status?.toLowerCase() === "open";
          setMarketStatus({
            isOpen,
            message: isOpen
              ? "Forex market is open"
              : `Forex market is ${data.status || "closed"}`,
            loading: false,
          });
        } else {
          fallbackMarketCheck();
        }
      } catch (error) {
        console.error("Failed to fetch market status:", error);
        fallbackMarketCheck();
      }
    };

    // Reason: Fallback time-based check when API is unavailable
    const fallbackMarketCheck = () => {
      const now = new Date();
      const utcDay = now.getUTCDay();
      const utcHour = now.getUTCHours();
      const isClosed =
        utcDay === 6 ||
        (utcDay === 0 && utcHour < 22) ||
        (utcDay === 5 && utcHour >= 22);
      setMarketStatus({
        isOpen: !isClosed,
        message: isClosed
          ? "Forex market is closed (Weekend)"
          : "Forex market is open",
        loading: false,
      });
    };

    if (open) {
      // Reason: a fresh challenge every time the dialog opens - a player reopening it
      // after cancelling a provider pick should not find the previous game still chosen.
      setSelection({ type: "trading" });
      setGameSettings({});
      fetchSettings();
      fetchTitles();
      fetchMarketStatus();
    }
  }, [open]);

  const platformFee = settings?.platformFeePercentage || 10;
  const prizePool = formData.entryFee * 2;
  const platformFeeAmount = Math.floor(prizePool * (platformFee / 100));
  const winnerPrize = prizePool - platformFeeAmount;

  const handleSubmit = async () => {
    if (!challengedUser) return;
    setShowTerms(true);
  };

  const proceedAfterTerms = async () => {
    setShowTerms(false);
    if (!challengedUser) return;

    setLoading(true);
    try {
      // Reason: the trading-only fields (starting capital, ranking method, tiebreakers,
      // minimum trades) are meaningless for a provider game and are conditionally required
      // on the OTHER side (`startingCapital`) or simply unused by settlement (`rules.*`), so
      // they are sent only for a trading selection rather than being defaulted here and
      // ignored server-side. `providerKey` / `gameCode` are the lookup key the create route
      // resolves into `gameType` / `gameKey` / `gameConfig` - never sent for trading, which
      // has no provider.
      const gamePayload =
        selection.type === "trading"
          ? {
              startingCapital: formData.startingCapital,
              rankingMethod: formData.rankingMethod,
              tieBreaker1: formData.tieBreaker1,
              tieBreaker2: formData.tieBreaker2 || undefined,
              minimumTrades: formData.minimumTrades,
            }
          : {
              providerKey: selection.title.providerKey,
              gameCode: selection.title.gameCode,
              // Reason: the game's own settings, validated server-side against the STORED
              // schema by `resolveChallengeProviderGame` - never trusted as sent, and never
              // silently dropped either: an unknown or out-of-range value is refused with the
              // field named, so the player is told which control to change.
              settings: gameSettings,
            };

      const response = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengedId: challengedUser.userId,
          entryFee: formData.entryFee,
          duration: formData.duration,
          ...gamePayload,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create challenge");
      }

      toast.success(`Challenge sent to ${challengedUser.username}!`);
      onOpenChange(false);
      router.push("/challenges");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to send challenge",
      );
    } finally {
      setLoading(false);
    }
  };

  if (!challengedUser) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-gray-950 border-orange-500/30 max-sm:border-0 p-0 gap-0 overflow-hidden"
        fullScreenMobile
        size="lg"
      >
        {/* ─── Themed Header ─── */}
        <div className="relative overflow-hidden px-6 pt-6 pb-4 bg-gradient-to-br from-orange-600/20 via-gray-950 to-red-900/10 border-b border-orange-500/20">
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-orange-500 to-red-500 rounded-full blur-3xl opacity-10 -translate-y-16 translate-x-16" />
          <div className="relative flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Swords className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                Challenge {challengedUser.username}
              </h2>
              <p className="text-xs text-gray-400">
                {challengeSubtitle(selection)}
              </p>
            </div>
          </div>
        </div>

        {/* ─── Body ─── */}
        <div className="px-6 py-5 space-y-5 max-h-[calc(100vh-220px)] sm:max-h-[65vh] overflow-y-auto">
          <ChallengeGamePicker
            titles={titles}
            selection={selection}
            onSelect={chooseGame}
            disabled={loading}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <ChallengeBattleSettings
              settings={settings}
              selection={selection}
              formData={formData}
              onChange={patchForm}
              gameSettings={gameSettings}
              onGameSettingChange={(name, value) =>
                setGameSettings((prev) => ({ ...prev, [name]: value }))
              }
              disabled={loading}
            />

            <ChallengeRulesColumn
              selection={selection}
              formData={formData}
              onChange={patchForm}
            />
          </div>

          <ChallengePrizeSummary
            prizePool={prizePool}
            platformFeePercentage={platformFee}
            platformFeeAmount={platformFeeAmount}
            winnerPrize={winnerPrize}
          />

          {/* ═══ Warnings ═══ */}
          {/* Reason: a market-hours check only means anything for a game that trades
              against a live market. A provider round has none, so gating a provider
              challenge on the forex market being open would refuse a puzzle at 2am on a
              Saturday for no reason connected to the game being played. */}
          {selection.type === "trading" &&
            !marketStatus.loading &&
            !marketStatus.isOpen && (
              <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/25 rounded-xl p-3">
                <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-400">
                    Market Closed
                  </p>
                  <p className="text-xs text-red-300/80 mt-0.5">
                    {marketStatus.message || "Forex market is currently closed."}{" "}
                    Challenges cannot be created while the market is closed.
                  </p>
                </div>
              </div>
            )}

          <div className="flex items-start gap-2.5 bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-3">
            <span className="text-sm shrink-0 mt-px">⚠️</span>
            <p className="text-xs text-yellow-300/80">
              {challengeQualificationCopy(
                selection,
                challengedUser.username,
                formData.minimumTrades,
              )}
            </p>
          </div>
        </div>

        {/* ─── Footer ─── */}
        <DialogFooter className="px-6 py-4 border-t border-gray-800 bg-gray-950/80">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-gray-700 text-gray-400 hover:text-white hover:border-gray-600"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              loading ||
              formData.entryFee < 1 ||
              (selection.type === "trading" && !marketStatus.isOpen)
            }
            className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold shadow-lg shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Swords className="h-4 w-4 mr-2" />
                Send Challenge
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Action Terms Dialog */}
      <ActionTermsDialog
        slug={ACTION_TERM_SLUGS.CHALLENGE}
        open={showTerms}
        onAccept={proceedAfterTerms}
        onDecline={() => setShowTerms(false)}
      />
    </Dialog>
  );
}
