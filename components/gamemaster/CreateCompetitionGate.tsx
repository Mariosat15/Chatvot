"use client";

import { useEffect, useState } from "react";
import { Gamepad2, Loader2, Swords } from "lucide-react";
import GMCreateCompetitionContent from "@/app/(root)/gamemaster/create-competition/page-content";
import ProviderContestCreateForm, {
  type ContestableTitleOption,
} from "@/components/gamemaster/ProviderContestCreateForm";
import type { TitleLevel } from "@/lib/constants/levels";
import type { FundingMode } from "@/lib/services/gamemaster/free-private-competition";
import {
  NO_GAME_MASTER_DEFAULTS,
  readGameMasterDefaults,
  type GameMasterDefaultsLookup,
} from "@/components/gamemaster/competition-defaults-lookup";
import {
  COMPETITION_VISIBILITIES,
  type CompetitionVisibility,
} from "@/lib/services/gamemaster/competition-visibility";

// Reason: the response is JSON, so an unrecognised value is dropped here rather than being
// rendered as a choice the create route would refuse.
function readCreatableVisibilities(value: unknown): CompetitionVisibility[] {
  if (!Array.isArray(value)) return ["public"];
  return COMPETITION_VISIBILITIES.filter((v) => value.includes(v));
}

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
  const [platformFeePercentage, setPlatformFeePercentage] = useState(10);
  const [maxCompetitionsPerDay, setMaxCompetitionsPerDay] = useState(1);
  const [competitionsCreatedToday, setCompetitionsCreatedToday] = useState(0);
  const [maxActiveCompetitions, setMaxActiveCompetitions] = useState(10);
  const [activeCompetitions, setActiveCompetitions] = useState(0);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [tradingDefaults, setTradingDefaults] =
    useState<GameMasterDefaultsLookup>(NO_GAME_MASTER_DEFAULTS);
  const [providerDefaults, setProviderDefaults] =
    useState<GameMasterDefaultsLookup>(NO_GAME_MASTER_DEFAULTS);
  const [visibilityOptions, setVisibilityOptions] = useState<
    CompetitionVisibility[]
  >(["public"]);
  // Reason: nothing is pre-selected when there is a real choice - the owner asked that a
  // Game Master must pick access and funding before continuing (2 Oct 2026).
  const [visibility, setVisibility] = useState<CompetitionVisibility | undefined>(
    undefined,
  );
  const [canFreePrivate, setCanFreePrivate] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [fundingMode, setFundingMode] = useState<FundingMode | undefined>(undefined);

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
        setTradingDefaults(readGameMasterDefaults(data.competitionDefaults?.trading));
        setProviderDefaults(readGameMasterDefaults(data.competitionDefaults?.provider));
        const creatable = readCreatableVisibilities(data.creatableVisibilities);
        setVisibilityOptions(creatable);
        // A single option is a fact, not a choice; with several the Game Master must pick.
        // An empty list means nothing is creatable; send nothing and let the route name why.
        setVisibility(creatable.length === 1 ? creatable[0] : undefined);
        setCanFreePrivate(data.canCreateFreePrivate === true);
        setWalletBalance(
          typeof data.walletBalance === "number" && Number.isFinite(data.walletBalance)
            ? data.walletBalance
            : null,
        );
        setMaxUsers(data.maxUsersPerCompetition ?? 100);
        setMaxCompetitionsPerDay(data.maxCompetitionsPerDay ?? 1);
        setCompetitionsCreatedToday(data.competitionsCreatedToday ?? 0);
        setMaxActiveCompetitions(data.maxActiveCompetitions ?? 10);
        setActiveCompetitions(data.activeCompetitions ?? 0);
        if (
          typeof data.platformFeePercentage === "number" &&
          Number.isFinite(data.platformFeePercentage)
        ) {
          setPlatformFeePercentage(data.platformFeePercentage);
        }
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

  // Reason: funding is offered only on a private contest; switching back to public must not
  // leave a hidden "funded" choice that the create route would then refuse.
  const fundingOffered = visibility === "gm_private" && canFreePrivate;

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
        {/* Access and funding are a step inside this wizard, not strips above it. */}
        <GMCreateCompetitionContent
          levelLadder={levelLadder}
          visibility={visibility}
          visibilityOptions={visibilityOptions}
          onVisibilityChange={setVisibility}
          fundingOffered={fundingOffered}
          fundingMode={fundingMode}
          onFundingModeChange={setFundingMode}
          walletBalance={walletBalance}
          competitionDefaults={tradingDefaults}
        />
      </>
    );
  }

  if (selection?.type === "provider") {
    return (
      <>
        {/* Visibility is a step inside this wizard (Access & Mode), not a strip above it. */}
        <ProviderContestCreateForm
          title={selection.title}
          visibility={visibility}
          visibilityOptions={visibilityOptions}
          onVisibilityChange={setVisibility}
          fundingOffered={fundingOffered}
          fundingMode={fundingMode}
          onFundingModeChange={setFundingMode}
          walletBalance={walletBalance}
          maxUsersPerCompetition={maxUsers}
          platformFeePercentage={platformFeePercentage}
          maxCompetitionsPerDay={maxCompetitionsPerDay}
          competitionsCreatedToday={competitionsCreatedToday}
          maxActiveCompetitions={maxActiveCompetitions}
          activeCompetitions={activeCompetitions}
          competitionDefaults={providerDefaults}
          onBack={() => setSelection(null)}
        />
      </>
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
