"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  FileText,
  ShieldCheck,
  SlidersHorizontal,
  Trophy,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { AccessAndModeStep } from "@/components/gamemaster/AccessAndModeStep";
import FreePrivateReserveSummary from "@/components/gamemaster/FreePrivateReserveSummary";
import type { FundingMode } from "@/lib/services/gamemaster/free-private-competition";
import { WizardFooterNav, WizardProgressRail } from "@/components/gamemaster/WizardProgressRail";
import { gameMasterScheduleError } from "@/lib/services/gamemaster/contest-start-guard";
import type { CompetitionVisibility } from "@/lib/services/gamemaster/competition-visibility";
import { defaultConfigValues, type ConfigField } from "@/lib/services/games/config-schema";
import {
  DEFAULT_GAME_TIE_RULE,
  type GameTieRule,
} from "@/lib/services/games/game-tie-rule";
import type { PlayMode } from "@/lib/services/games/play-shape";
import { defaultContestWindow } from "@/lib/utils/default-contest-window";
import {
  joinUtcDraft,
  utcDraftToIso,
} from "@/components/gamemaster/UtcScheduleFields";
import {
  BasicsStep,
  GameSettingsStep,
  PrizesStep,
  ReviewStep,
  ScheduleStep,
} from "@/components/gamemaster/provider-contest-wizard-steps";
import { ProviderContestLimitBanners } from "@/components/gamemaster/ProviderContestLimitBanners";
import { useProviderContestRules } from "@/components/gamemaster/use-provider-contest-rules";
import {
  NO_GAME_MASTER_DEFAULTS,
  type GameMasterDefaultsLookup,
} from "@/components/gamemaster/competition-defaults-lookup";
import type {
  UnresolvedRoundPolicy,
  UnscoredContestPolicy,
} from "@/lib/services/games/round-types";

export interface ContestableTitleOption {
  providerKey: string;
  providerName: string;
  gameCode: string;
  gameKey: string;
  displayName: string;
  category?: string;
  playMode: PlayMode;
  supportedPlayModes: PlayMode[];
  maxDurationSeconds?: number;
  /** Lobby lead time the create service will copy, resolved server-side. Display only. */
  lobbySeconds?: number;
  schema:
    | { ok: true; fields: ConfigField[] }
    | { ok: false; error: string };
}

interface PrizeShare {
  rank: number;
  percentage: number;
}

interface Props {
  title: ContestableTitleOption;
  visibility: CompetitionVisibility | undefined;
  /** Server's `creatableVisibilities`; the Access & Mode step offers exactly these. */
  visibilityOptions: readonly CompetitionVisibility[];
  onVisibilityChange: (next: CompetitionVisibility) => void;
  /** Private + package + platform switch all allow a Game Master-funded contest. */
  fundingOffered?: boolean;
  fundingMode?: FundingMode;
  onFundingModeChange?: (next: FundingMode) => void;
  walletBalance?: number | null;
  maxUsersPerCompetition: number;
  /** Admin-controlled fee from Challenge Settings â€” display only; create ignores body. */
  platformFeePercentage: number;
  /** Package daily cap â€” banner + Launch gate only; earlier steps stay editable. */
  maxCompetitionsPerDay: number;
  competitionsCreatedToday: number;
  /** Concurrent draft/upcoming/active cap from the package. */
  maxActiveCompetitions: number;
  activeCompetitions: number;
  /** Admin competition defaults for games. Missing means nothing locked. */
  competitionDefaults?: GameMasterDefaultsLookup;
  onBack: () => void;
}

const STEPS = [
  { number: 1, title: "Basic Info", description: "Name and description", icon: FileText },
  { number: 2, title: "Access & Mode", description: "Who can join, how it plays", icon: ShieldCheck },
  { number: 3, title: "Game Settings", description: "Options for this game", icon: SlidersHorizontal },
  { number: 4, title: "Schedule & Entry", description: "Clock, players and fee", icon: Calendar },
  { number: 5, title: "Prizes", description: "Who gets how much", icon: Trophy },
  { number: 6, title: "Launch", description: "Review and create", icon: Zap },
] as const;
const LAST_STEP = STEPS.length;

const DEFAULT_PRIZES: PrizeShare[] = [
  { rank: 1, percentage: 70 },
  { rank: 2, percentage: 20 },
  { rank: 3, percentage: 10 },
];

/**
 * Game Master wizard for creating a provider contest.
 *
 * Mirrors the trading GM multi-step chrome. Platform fee is locked to admin
 * Challenge Settings â€” never editable; create route ignores any body fee.
 */
export default function ProviderContestCreateForm({
  title,
  visibility,
  visibilityOptions,
  onVisibilityChange,
  fundingOffered = false,
  fundingMode = "player_paid",
  onFundingModeChange,
  walletBalance = null,
  maxUsersPerCompetition,
  platformFeePercentage,
  maxCompetitionsPerDay,
  competitionsCreatedToday,
  maxActiveCompetitions,
  activeCompetitions,
  competitionDefaults = NO_GAME_MASTER_DEFAULTS,
  onBack,
}: Props) {
  const router = useRouter();
  // Reason: every option starts at the admin's value; a locked one keeps it because its
  // input is hidden. The create route applies the same defaults again, so this is display.
  const defaults = competitionDefaults;
  const fields = title.schema.ok ? title.schema.fields : [];
  const [step, setStep] = useState(1);
  const [settings, setSettings] = useState<Record<string, unknown>>(() =>
    defaultConfigValues(fields),
  );
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [entryFee, setEntryFee] = useState(() =>
    String(defaults.valueOf<number>("entryFee", 10)),
  );
  const [maxParticipants, setMaxParticipants] = useState(() =>
    String(
      defaults.isLocked("maxParticipants")
        ? defaults.valueOf<number>("maxParticipants", 20)
        : Math.min(defaults.valueOf<number>("maxParticipants", 20), maxUsersPerCompetition),
    ),
  );
  // Reason: owner, 2 Oct 2026 - the calendar opens on TODAY, about an hour ahead, so a Game
  // Master starting today only changes the time. One shared rule for every wizard.
  const [openingWindow] = useState(() => defaultContestWindow(60));
  const [startTime, setStartTime] = useState(() =>
    joinUtcDraft(openingWindow.startDate, openingWindow.startTime),
  );
  const [endTime, setEndTime] = useState(() =>
    joinUtcDraft(openingWindow.endDate, openingWindow.endTime),
  );
  // Reason: the admin's play-style default only applies to a game that supports it (a game set
  // to Both); any other game keeps its own style, exactly as the create service falls back.
  const adminPlayMode = defaults.valueOf<PlayMode>("playMode", title.playMode);
  const playModeLocked = defaults.isLocked("playMode");
  const rules = useProviderContestRules({
    initialPlayMode: title.supportedPlayModes.includes(adminPlayMode)
      ? adminPlayMode
      : title.playMode,
    supportedPlayModes: title.supportedPlayModes,
    fields,
    settings,
    maxDurationSeconds: title.maxDurationSeconds,
    startTime,
    endTime,
    defaults,
  });
  const [prizes, setPrizes] = useState<PrizeShare[]>(() =>
    defaults.valueOf<PrizeShare[]>("prizeDistribution", DEFAULT_PRIZES),
  );
  const [tieRule, setTieRule] = useState<GameTieRule>(() =>
    defaults.valueOf<GameTieRule>("tieRule", DEFAULT_GAME_TIE_RULE),
  );
  // Not offered on this form; the admin's choice (or the shipped default) is what is sent.
  const unresolvedRoundPolicy = defaults.valueOf<UnresolvedRoundPolicy>(
    "unresolvedRoundPolicy",
    "score_zero",
  );
  const unscoredContestPolicy = defaults.valueOf<UnscoredContestPolicy>(
    "unscoredContestPolicy",
    "unclaimed_pool",
  );
  const [submitting, setSubmitting] = useState(false);

  const canPickMode = title.supportedPlayModes.length > 1 && !playModeLocked;
  const fee = Number.isFinite(platformFeePercentage)
    ? platformFeePercentage
    : 10;

  const remainingToday = Math.max(
    0,
    maxCompetitionsPerDay - competitionsCreatedToday,
  );
  const remainingActive = Math.max(
    0,
    maxActiveCompetitions - activeCompetitions,
  );
  const canCreate = remainingToday > 0 && remainingActive > 0;
  const blockedByActive = remainingActive <= 0;
  const blockedByDaily = remainingToday <= 0 && !blockedByActive;

  const prizeTotal = prizes.reduce((s, p) => s + Number(p.percentage || 0), 0);
  const entryNum = Number(entryFee) || 0;
  const maxNum = Number(maxParticipants) || 0;
  const estimatedPool =
    entryNum * maxNum * (1 - Math.min(100, Math.max(0, fee)) / 100);

  function validateStep(n: number): string | null {
    if (n === 1) {
      if (!name.trim()) return "Give the competition a name.";
      if (!description.trim()) return "Add a short description.";
    }
    if (n === 2) {
      if (!visibility || !visibilityOptions.includes(visibility)) {
        return visibilityOptions.length === 0
          ? "Your package does not allow creating a competition. Please contact support."
          : "Choose who can join.";
      }
    }
    if (n === 3 && !title.schema.ok) {
      return "This game cannot be configured yet.";
    }
    if (n === 4) {
      if (!startTime || !endTime) return "Set start and end times.";
      // Reason: drafts are UTC wall-clock (`YYYY-MM-DDTHH:mm`); bare `new Date(draft)` is local.
      // No tolerance here: the server allows a minute for a slow submit, the form does not.
      const scheduleError = gameMasterScheduleError(
        new Date(utcDraftToIso(startTime)),
        new Date(utcDraftToIso(endTime)),
        new Date(),
      );
      if (scheduleError) return scheduleError;
      if (entryNum < 0) return "Entry fee cannot be negative.";
      if (maxNum < 2) return "At least 2 players are required.";
      if (maxNum > maxUsersPerCompetition) {
        // Reason: a locked player limit has no input to correct, so say whose numbers clash.
        return defaults.isLocked("maxParticipants")
          ? `The platform's player limit (${maxNum}) is above your package's limit (${maxUsersPerCompetition}). Please contact support.`
          : `Max players cannot exceed ${maxUsersPerCompetition}.`;
      }
      const roundError = rules.scheduleError();
      if (roundError) return roundError;
    }
    if (n === 5 && Math.abs(prizeTotal - 100) > 0.01) {
      return "Prize shares must add up to 100%.";
    }
    return null;
  }

  function goNext() {
    // Reason: either package cap blocks the whole wizard from step 1 â€” same as trading GM.
    if (!canCreate) {
      toast.error(
        blockedByActive
          ? "Active competition limit reached"
          : "Daily competition limit reached",
      );
      return;
    }
    const err = validateStep(step);
    if (err) {
      toast.error(err);
      return;
    }
    setStep((s) => Math.min(LAST_STEP, s + 1));
  }

  async function handleCreate() {
    if (!canCreate) {
      toast.error(
        blockedByActive
          ? "Active competition limit reached"
          : "Daily competition limit reached",
      );
      return;
    }
    for (let n = 1; n < LAST_STEP; n++) {
      const err = validateStep(n);
      if (err) {
        toast.error(err);
        setStep(n);
        return;
      }
    }
    if (!title.schema.ok) {
      toast.error("This game cannot be configured yet.");
      return;
    }

    setSubmitting(true);
    try {
      // Reason: append :00Z so the instant matches the UTC clock on the schedule step.
      const startIso = utcDraftToIso(startTime);
      const endIso = utcDraftToIso(endTime);
      const res = await fetch("/api/gamemaster/competitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameType: "provider",
          name: name.trim(),
          description: description.trim(),
          providerKey: title.providerKey,
          gameCode: title.gameCode,
          visibility,
          fundingMode,
          settings,
          entryFee: entryNum,
          maxParticipants: maxNum,
          // Fee omitted â€” server stamps Challenge Settings.
          startTime: startIso,
          endTime: endIso,
          playWindowStart: startIso,
          playWindowEnd: endIso,
          // Play style, attempts, last-start rule and the grace derived from the playing
          // time, exactly as the schedule step showed them.
          ...rules.requestFields,
          unresolvedRoundPolicy,
          unscoredContestPolicy,
          tieRule,
          perRoundCostAcknowledged: true,
          prizeDistribution: prizes,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Could not create the contest.");
        if (Array.isArray(data.errors)) {
          data.errors.forEach((msg: string) => toast.error(msg));
        }
        return;
      }
      toast.success("Competition created successfully!");
      router.push(`/competitions/${data.competition?.id ?? data.competitionId}`);
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-8">
        <button
          type="button"
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Choose a different game
        </button>

        <div className="mb-6">
          <h1 className="text-2xl font-bold">{title.displayName}</h1>
          <p className="text-sm text-gray-400">
            {title.providerName}
            {title.category ? ` Â· ${title.category}` : ""}
            {" Â· "}
            {remainingToday} / {maxCompetitionsPerDay} remaining today
            {" Â· "}
            {remainingActive} / {maxActiveCompetitions} active slots
          </p>
        </div>

        <ProviderContestLimitBanners
          blockedByActive={blockedByActive}
          blockedByDaily={blockedByDaily}
          activeCompetitions={activeCompetitions}
          maxActiveCompetitions={maxActiveCompetitions}
          competitionsCreatedToday={competitionsCreatedToday}
          maxCompetitionsPerDay={maxCompetitionsPerDay}
        />

        {!title.schema.ok ? (
          <p className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-sm text-red-200">
            This game cannot be configured: {title.schema.error}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <aside className="lg:col-span-1">
              <WizardProgressRail
                heading="Creation Progress"
                steps={STEPS}
                step={step}
                onStep={setStep}
              />
            </aside>

            <div className="lg:col-span-2">
              <div className="overflow-hidden rounded-2xl border border-gray-700/50 bg-gradient-to-br from-gray-800 to-gray-900 shadow-2xl">
                {step === 1 && (
                  <BasicsStep
                    name={name}
                    description={description}
                    onName={setName}
                    onDescription={setDescription}
                  />
                )}
                {step === 2 && (
                  <AccessAndModeStep
                    visibilityOptions={visibilityOptions}
                    visibility={visibility}
                    onVisibility={onVisibilityChange}
                    canPickMode={canPickMode}
                    playMode={rules.playMode}
                    supportedPlayModes={title.supportedPlayModes}
                    onPlayMode={rules.selectPlayMode}
                    disabled={submitting}
                    fundingOffered={fundingOffered}
                    fundingMode={fundingMode}
                    onFundingMode={onFundingModeChange}
                  />
                )}
                {step === 3 && (
                  <GameSettingsStep
                    fields={fields}
                    settings={settings}
                    onSetting={(fieldName, value) =>
                      setSettings((prev) => ({ ...prev, [fieldName]: value }))
                    }
                    disabled={submitting}
                  />
                )}
                {step === 4 && (
                  <ScheduleStep
                    startTime={startTime}
                    endTime={endTime}
                    entryFee={entryFee}
                    maxParticipants={maxParticipants}
                    maxUsersPerCompetition={maxUsersPerCompetition}
                    fee={fee}
                    estimatedPool={estimatedPool}
                    onStart={setStartTime}
                    onEnd={setEndTime}
                    onEntryFee={setEntryFee}
                    onMaxParticipants={setMaxParticipants}
                    rules={rules}
                    defaults={defaults}
                    lobbySeconds={title.lobbySeconds}
                    disabled={submitting}
                  />
                )}
                {(step === 4 || step === LAST_STEP) && fundingMode === "gm_funded" && (
                  <div className="px-6 pb-6">
                    <FreePrivateReserveSummary
                      entryFee={entryNum}
                      maxParticipants={maxNum}
                      walletBalance={walletBalance}
                    />
                  </div>
                )}
                {step === 5 && (
                  <PrizesStep
                    prizes={prizes}
                    prizeTotal={prizeTotal}
                    fee={fee}
                    onChange={setPrizes}
                    tieRule={tieRule}
                    onTieRule={setTieRule}
                    defaults={defaults}
                  />
                )}
                {step === LAST_STEP && (
                  <ReviewStep
                    name={name}
                    displayName={title.displayName}
                    startTime={startTime}
                    endTime={endTime}
                    entryFee={entryFee}
                    maxParticipants={maxParticipants}
                    fee={fee}
                    prizes={prizes}
                    rules={rules}
                    tieRule={tieRule}
                  />
                )}

                <WizardFooterNav
                  isFirst={step === 1}
                  isLast={step === LAST_STEP}
                  canCreate={canCreate}
                  submitting={submitting}
                  onPrevious={() => setStep((s) => s - 1)}
                  onNext={goNext}
                  onCreate={handleCreate}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
