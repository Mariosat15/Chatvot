"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coins,
  FileText,
  Gamepad2,
  Loader2,
  SlidersHorizontal,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import {
  WizardPreview,
  WizardPreviewRow,
  WizardShell,
  WizardStepCard,
  WizardStepRail,
  type WizardStep,
} from "@/components/admin/wizard/WizardShell";
import { resolveAttemptSeconds } from "@/lib/services/games/config-schema";
import { playShapeRules } from "@/lib/services/games/play-shape";
import { defaultConfigValues } from "./ConfigSchemaFields";
import type { ContestableTitle } from "./contest-types";
import {
  type ContestDraft,
  describeDurationSeconds,
  describeRoundFit,
  emptyDraft,
  toRequestBody,
} from "./contest-draft";
import { StepChooseGame } from "./wizard/StepChooseGame";
import {
  DESCRIPTION_WORD_LIMIT,
  StepBasics,
  countWords,
} from "./wizard/StepBasics";
import { StepSettings } from "./wizard/StepSettings";
import { StepSchedule } from "./wizard/StepSchedule";
import { StepPrizes } from "./wizard/StepPrizes";
import { StepReview } from "./wizard/StepReview";
import { formatVolts } from "@/lib/utils/format-volts";

/**
 * Creating a competition on a provider game.
 *
 * SIX STEPS ON THE TRADING FORM'S CHROME, WHICH IS A DEVIATION FROM THE FOUR THIS SCREEN HAD
 * AND FROM THE FOUR CHAPTER 12 ASKED FOR, recorded rather than absorbed. The owner's report
 * was that the two wizards looked like two different products, and the fix for that is the
 * shared shell in `components/admin/wizard/` - but four steps on a seven-step rail still
 * reads as a cut-down form. The steps below mirror trading's grouping one-for-one where the
 * question is the same (basics, money, clock, prizes, launch) and replace its three
 * trading-only steps with the two a game needs: which title, and that title's own settings.
 *
 * NO TRADING FIELD APPEARS, which is chapter 12's acceptance criterion and the reason this is
 * a separate wizard rather than a branch inside the 2,900-line trading form. There is also no
 * market card in the sidebar: a puzzle does not care whether the forex market is open.
 *
 * THE STEP BODIES LIVE IN `./wizard/`. This file owns the state, the order, the two network
 * calls and the navigation; that split keeps every file under the 500-line limit and means a
 * step can be reordered without touching what it renders.
 */

interface ProviderContestWizardProps {
  titles: ContestableTitle[];
}

/**
 * Defined here, in a client component, and it must stay that way: `icon` is a React
 * component, and handing a function across a server/client boundary is what took the trading
 * lobby down on 6 September (R39). Nothing server-rendered may build this list.
 */
const STEPS: readonly WizardStep[] = [
  {
    title: "Game",
    description: "Choose the title",
    icon: Gamepad2,
    accent: "purple",
  },
  {
    title: "Basic Info",
    description: "Name and description",
    icon: FileText,
    accent: "blue",
  },
  {
    title: "Game Settings",
    description: "The game's own options",
    icon: SlidersHorizontal,
    accent: "orange",
  },
  {
    title: "Schedule & Entry",
    description: "Clock, fee and players",
    icon: Calendar,
    accent: "green",
  },
  {
    title: "Prizes & Rules",
    description: "Distribution and edge cases",
    icon: Trophy,
    accent: "yellow",
  },
  {
    title: "Launch",
    description: "Review and create",
    icon: Zap,
    accent: "green",
  },
];

const STEP_GAME = 0;
const STEP_BASICS = 1;
const STEP_SETTINGS = 2;
const STEP_SCHEDULE = 3;
const STEP_PRIZES = 4;
const STEP_REVIEW = 5;

export function ProviderContestWizard({ titles }: ProviderContestWizardProps) {
  const router = useRouter();
  const { settings } = useAppSettings();
  const [step, setStep] = useState<number>(STEP_GAME);
  const [draft, setDraft] = useState<ContestDraft>(emptyDraft);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  const unit = settings?.credits?.name;
  // Reason: `.at()` rather than STEPS[step] so the lookup is total. A computed index into an
  // array is also what the object-injection lint rule flags, and silencing that rule here
  // would silence it for whatever is added beside this line later.
  const currentStep = STEPS.at(step) ?? STEPS[0];

  const selected = titles.find(
    (t) => t.providerKey === draft.providerKey && t.gameCode === draft.gameCode,
  );

  /**
   * The title's schema fields and the ceiling, in the shape the payload builders want.
   *
   * Built once here so the pre-flight request and the create request cannot disagree about
   * which title they are describing - the grace period is derived from it, and two call sites
   * assembling it separately is how one of them ends up sending the ceiling.
   */
  const titleFacts = {
    schemaFields: selected?.schema.ok ? selected.schema.fields : undefined,
    maxDurationSeconds: selected?.maxDurationSeconds,
  };

  const playTime = resolveAttemptSeconds(
    titleFacts.schemaFields ?? [],
    draft.settings,
    titleFacts.maxDurationSeconds,
  );

  function patch(changes: Partial<ContestDraft>) {
    setDraft((current) => ({ ...current, ...changes }));
  }

  function selectTitle(title: ContestableTitle) {
    // The previous game's answers are discarded, never merged. Reason: they are keyed by
    // that schema's field names, so carrying them over would submit settings the new game
    // does not declare - which the validator drops silently, leaving the review step
    // showing values that will not be stored.
    // The play shape's forced values are written into the DRAFT, not merely enforced by the
    // server. Both are needed and they are not the same guarantee: the server force is what
    // makes a direct API call safe, and this is what stops the review step showing "best of
    // three" on a contest that is about to be stored as one attempt. A screen that disagrees
    // with what will be saved is worse than either control being wrong, because the operator
    // has no way to tell which one is lying.
    const shape = playShapeRules(title.playMode);

    patch({
      providerKey: title.providerKey,
      gameCode: title.gameCode,
      settings: title.schema.ok ? defaultConfigValues(title.schema.fields) : {},
      ...(shape.forcedAttemptsPolicy
        ? { attemptsPolicy: shape.forcedAttemptsPolicy, attemptsAllowed: undefined }
        : {}),
      ...(shape.forcedRoundStartPolicy
        ? { roundStartPolicy: shape.forcedRoundStartPolicy }
        : {}),
    });
    setErrors([]);
    setWarnings([]);
  }

  async function runPreflight() {
    if (!selected) return;
    setSubmitting(true);
    setErrors([]);
    setWarnings([]);
    try {
      const response = await fetch("/api/games/contests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "preflight",
          ...toRequestBody(draft, titleFacts),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "The check could not be run.");
        return;
      }
      setErrors(data.errors ?? []);
      setWarnings(data.warnings ?? []);
      setStep(STEP_REVIEW);
    } catch {
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * Publishes the contest that was just created, and reports honestly if it cannot.
   *
   * A SECOND REQUEST, NOT A FLAG ON THE FIRST, and that is the load-bearing part. The publish
   * route re-runs the whole pre-flight against the STORED record - which asks the question
   * creation could not, namely whether the settings actually persisted, and catches a draft
   * whose title or provider was switched off between the two steps. A `publish: true`
   * parameter on create would have skipped that and published on the strength of the check
   * the caller's own input had already passed.
   *
   * A REFUSAL HERE LEAVES A DRAFT, NOT A FAILURE. The contest exists and is correct; only its
   * visibility is outstanding, and the list screen's own publish button is the way to retry.
   * Saying "created but not published" is the whole message - a bare error would send an
   * operator back to the wizard to create a second copy of a contest that already exists.
   */
  async function publishCreated(competitionId: string): Promise<boolean> {
    try {
      const response = await fetch(
        `/api/games/contests/${competitionId}/publish`,
        { method: "POST" },
      );
      const data = await response.json();

      if (!response.ok) {
        const refusals: string[] = data.errors ?? [];
        setErrors(
          refusals.length > 0
            ? refusals
            : [data.error ?? "The contest could not be published."],
        );
        toast.warning(
          "Contest created, but it could not be published yet. It is saved as a draft - publish it from the competitions list once the problems below are fixed.",
        );
        return false;
      }

      toast.success("Contest created and published. Players can enter it now.");
      for (const warning of (data.warnings ?? []) as string[]) {
        toast.warning(warning);
      }
      return true;
    } catch {
      toast.warning(
        "Contest created, but publishing failed. It is saved as a draft - publish it from the competitions list.",
      );
      return false;
    }
  }

  async function submit() {
    setSubmitting(true);
    try {
      const response = await fetch("/api/games/contests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          ...toRequestBody(draft, titleFacts),
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        setErrors(data.errors ?? []);
        toast.error(data.error ?? "The contest could not be created.");
        return;
      }

      if (draft.publishOnSave && data.competitionId) {
        const published = await publishCreated(String(data.competitionId));
        if (!published) return;
      } else {
        toast.success("Draft contest created. Players cannot see it yet.");
      }

      router.push("/?activeTab=competitions");
    } catch {
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setSubmitting(false);
    }
  }

  /** Why the operator cannot move on yet, or null when they can. */
  function blockedReason(): string | null {
    if (step === STEP_GAME && !selected) return "Choose a game first.";
    if (step === STEP_BASICS) {
      if (!draft.name.trim()) return "The contest needs a name.";
      if (countWords(draft.description) > DESCRIPTION_WORD_LIMIT)
        return `The description is over ${DESCRIPTION_WORD_LIMIT} words.`;
    }
    if (step === STEP_SETTINGS && selected && !selected.schema.ok)
      return "This game's settings cannot be read.";

    /*
      A CONTEST NOBODY COULD START AN ATTEMPT IN IS REFUSED HERE, not only by the pre-flight.

      The server refuses it either way, so this is not the guard - it is the difference between
      finding out on the step where both numbers live and finding out two steps later, on a
      review screen, with no field to change. The owner hit exactly the shipped version of
      this: the contest saved, opened, and refused every round.

      ONLY WHILE THE CONTEST RESERVES THE FULL PLAYING TIME. Under `until_window_closes` a
      short contest is legitimate - every attempt is simply cut short and scored on what the
      player managed - so blocking it would refuse a contest the platform supports.
    */
    if (step === STEP_SCHEDULE) {
      const fit = describeRoundFit({
        startTime: draft.startTime,
        endTime: draft.endTime,
        schemaFields: titleFacts.schemaFields,
        settings: draft.settings,
        maxDurationSeconds: titleFacts.maxDurationSeconds,
        roundStartPolicy: draft.roundStartPolicy,
      });
      if (fit?.windowTooShort && fit.reservesFullRound) {
        return `Play is set to ${describeDurationSeconds(
          fit.reservedSeconds,
        )} but the contest only runs for ${describeDurationSeconds(
          fit.windowSeconds,
        )}, so nobody could start an attempt.`;
      }
    }

    return null;
  }

  const blocked = blockedReason();

  const nav = (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          if (step > STEP_GAME) setStep((s) => s - 1);
          else router.push("/?activeTab=competitions");
        }}
        disabled={submitting}
        className="border-gray-600 hover:bg-gray-700"
      >
        <ChevronLeft className="h-4 w-4 mr-2" />
        {step === STEP_GAME ? "Cancel" : "Previous"}
      </Button>

      {step < STEP_PRIZES && (
        <Button
          type="button"
          onClick={() => setStep((s) => s + 1)}
          disabled={blocked !== null}
          title={blocked ?? undefined}
          className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-gray-900 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next Step
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      )}

      {step === STEP_PRIZES && (
        <Button
          type="button"
          onClick={runPreflight}
          disabled={submitting}
          className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-gray-900 font-semibold"
        >
          {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Check and review
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      )}

      {step === STEP_REVIEW && (
        <Button
          type="button"
          onClick={submit}
          disabled={submitting || errors.length > 0}
          className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-gray-900 font-bold"
        >
          {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {draft.publishOnSave ? "Create and publish" : "Create draft"}
        </Button>
      )}
    </>
  );

  return (
    <WizardShell
      sidebar={
        <>
          <WizardStepRail steps={STEPS} currentIndex={step} />

          {/*
            THE PREVIEW SHOWS GAME FACTS, NOT TRADING ONES. The trading form's card reports
            starting capital and leverage, neither of which exists here; the equivalent
            questions for a game are which title, how long an attempt can run and how many
            attempts a player gets. Every value comes off the catalogue row or the draft, so
            a title nobody has seen yet fills this in with its own numbers.
          */}
          <WizardPreview>
            <WizardPreviewRow
              icon={Gamepad2}
              iconClassName="text-purple-400"
              label="Game"
              value={selected?.displayName ?? "Not chosen"}
            />
            <WizardPreviewRow
              icon={Users}
              label="Participants"
              value={`${draft.minParticipants} - ${draft.maxParticipants}`}
            />
            <WizardPreviewRow
              icon={Coins}
              iconClassName="text-green-400"
              label="Entry Fee"
              value={formatVolts(draft.entryFee, { unit })}
            />
            <WizardPreviewRow
              icon={Trophy}
              iconClassName="text-yellow-400"
              label="Prize ranks"
              value={draft.prizeDistribution.length}
            />
            {/*
              THE CHOSEN PLAYING TIME, NOT THE CATALOGUE CEILING. This row said "up to 300s"
              while the operator had set two minutes, because it read the title's maximum -
              a number that appears on no other screen and that nobody chose. The preview's
              job is to reflect the draft back, so it reads the same resolved value the gate
              and the clock note use.
            */}
            <WizardPreviewRow
              icon={Clock}
              iconClassName="text-blue-400"
              label="Play time"
              value={playTime ? describeDurationSeconds(playTime) : "-"}
            />
          </WizardPreview>

          {selected && (
            <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
              <p className="text-xs text-gray-400">
                Settings, scoring and round length all come from{" "}
                <strong className="text-gray-200">
                  {selected.providerName}
                </strong>
                &apos;s catalogue, so this form changes with the game.
              </p>
            </div>
          )}
        </>
      }
    >
      <WizardStepCard step={currentStep} footer={nav}>
        {step === STEP_GAME && (
          <StepChooseGame
            titles={titles}
            selected={selected}
            onSelect={selectTitle}
          />
        )}

        {step === STEP_BASICS && (
          <StepBasics draft={draft} patch={patch} title={selected} />
        )}

        {step === STEP_SETTINGS && selected && (
          <StepSettings draft={draft} patch={patch} title={selected} />
        )}

        {step === STEP_SCHEDULE && (
          <StepSchedule
            draft={draft}
            patch={patch}
            title={selected}
            unit={unit}
          />
        )}

        {step === STEP_PRIZES && (
          <StepPrizes draft={draft} patch={patch} title={selected} />
        )}

        {step === STEP_REVIEW && (
          <StepReview
            draft={draft}
            patch={patch}
            title={selected}
            errors={errors}
            warnings={warnings}
            unit={unit}
          />
        )}
      </WizardStepCard>
    </WizardShell>
  );
}
