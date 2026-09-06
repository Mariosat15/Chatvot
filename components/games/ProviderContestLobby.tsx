import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  Coins,
  Gamepad2,
  Info,
  RotateCcw,
  Trophy,
  Users,
} from "lucide-react";
import { connectToDatabase } from "@/database/mongoose";
import ProviderGame from "@/database/models/games/provider-game.model";
import CompetitionEntryButton from "@/components/trading/CompetitionEntryButton";
import ProviderLeaderboard from "@/components/games/ProviderLeaderboard";
import { getPlayState } from "@/lib/services/games/round-status.service";
import { isProviderContest } from "@/lib/services/games/contest-config";

/**
 * The lobby a player sees for a contest played through a game provider.
 *
 * IT EXISTS BECAUSE THE TRADING LOBBY KEPT WORKING, which is the failure mode this programme
 * keeps meeting. `app/(root)/competitions/[id]/page.tsx` renders charts, margin, leverage,
 * "PnL" and an Enter Terminal button, and for a puzzle contest it rendered all of them without
 * an error - nothing crashed, because the fields a provider contest lacks are either guarded or
 * filled by schema defaults (verified against a real MongoDB in
 * `__tests__/services/provider-contest-lobby-shape.test.ts`, not reasoned about). A player
 * simply read a trading screen for a game with no market. Same shape as the trading-shaped
 * services in `matchmaking.service.ts` and the admin list rendering drafts in the grey it uses
 * for finished contests.
 *
 * IT IS A BRANCH AT THE TOP OF THE PAGE, NOT A FIELD-BY-FIELD GUARD, and that is deliberate.
 * Threading conditionals through 1,100 lines of trading layout would touch every line the live
 * trading lobby depends on to serve a contest type that has never had a player. Branching once
 * leaves the trading path byte-identical, which is the only thing that makes the existing lobby
 * tests meaningful evidence that nothing moved.
 *
 * THREE FACTS `13` SECTION 4 SAYS A PROVIDER LOBBY MUST ANSWER, because a player will hit all
 * three and a lobby that stays silent generates support tickets: when the play window opens and
 * closes, how many attempts are left, and what happens if a round never finishes. The third is
 * the one nobody thinks to show and the one that costs money when it happens.
 */

interface ProviderContestLobbyProps {
  /*
    Loosely typed on purpose, matching what `getCompetitionById` hands the page. Reason it is not
    a hand-written field list: an explicitly-typed shape is exactly where an invented field name
    survives a typecheck - `billsPerRound` on the pre-flight checklist and `scoreDirection` on
    the participant both got that far. Every field read below was checked against
    `competition.model.ts`.
  */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  competition: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  leaderboard: any[];
  isUserIn: boolean;
  isFull: boolean;
  userId: string;
  walletBalance: number;
  currencySymbol: string;
  participantStatus?: string;
  registrationClosed?: boolean;
}

/** What each unresolved-round policy actually means to the player whose round it was. */
const UNRESOLVED_POLICY_COPY: Record<string, string> = {
  score_zero:
    "If your round never reports a result, it is scored zero and the competition still settles on time. You will be told it happened.",
  exclude:
    "If your round never reports a result, you are removed from the ranking and your entry fee is refunded.",
  hold_and_alert:
    "If your round never reports a result, the competition is held and a person reviews it before anyone is paid.",
};

const ATTEMPTS_POLICY_COPY: Record<string, string> = {
  single: "One attempt, and the score from it is final.",
  best_of_n: "Your best attempt counts.",
  sum_of_n: "Every attempt is added together.",
};

function formatUTC(value: Date | string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toUTCString();
}

export default async function ProviderContestLobby({
  competition,
  leaderboard,
  isUserIn,
  isFull,
  userId,
  walletBalance,
  currencySymbol,
  participantStatus,
  registrationClosed,
}: ProviderContestLobbyProps) {
  await connectToDatabase();

  /*
    The player-facing name comes from the catalogue, which is the editable content layer - never
    from `providerKey`, and never from `gameKey`, which is an internal join key that happens to
    read like English and would leak our own naming onto a player screen. Also never the
    provider's brand: `13` section 4 requires provider-neutral labels, because the player is
    playing a ChartVolt game.
  */
  /*
    `displayName` and `scoreType`, both of which `provider-game.model.ts` really declares. The
    first draft of this read `tagline` as well - a field the model does NOT have, which would have
    rendered nothing for ever while looking entirely correct. Sixth instance of the class, after
    `billsPerRound` on the pre-flight checklist, `publishedAt` on the publish update,
    `scoreDirection` on the participant, `suspensionEndsAt` on the restriction and `referenceId`
    on the wallet transaction: **an unverified field name is a claim, not a fact**, and a
    hand-written `.lean<{...}>()` generic is precisely where one survives a typecheck, because
    the compiler checks the generic rather than the schema.
  */
  const title = await ProviderGame.findOne({
    providerKey: competition?.gameConfig?.providerKey,
    gameCode: competition?.gameConfig?.gameCode,
  })
    .select("displayName scoreType")
    .lean<{ displayName?: string; scoreType?: string } | null>();

  /*
    Attempts and the live round are only meaningful for someone holding a seat, and `getPlayState`
    is the authoritative source for both - the same function the play route and the launch API
    use, so this lobby cannot disagree with the screen it links to about how many attempts are
    left. A player without a seat gets a refusal here, which is correct and is simply not shown.
  */
  const playState =
    isUserIn && userId
      ? await getPlayState(String(competition._id), userId)
      : null;
  const state = playState?.success ? playState.state : null;

  /*
    THE LABEL DECIDES THE SCREEN; THE KEYS DECIDE WHETHER PLAY CAN WORK. The page routes here on
    the label alone, because a contest labelled provider with no provider key is still not a
    trading contest and must not be shown trading panels. But it cannot launch a round, so the
    Play control has to say so rather than fail on the click. Same distinction the admin
    competitions list draws between `hasProviderGameLabel` and `isProviderContest`, and giving
    the two questions two names is what stops the strict helper being reused for the first.
  */
  const canLaunch = isProviderContest(competition);

  const playWindowStart = formatUTC(competition.playWindowStart);
  const playWindowEnd = formatUTC(competition.playWindowEnd);
  const attemptsCopy = competition.attemptsPolicy
    ? ATTEMPTS_POLICY_COPY[competition.attemptsPolicy as string]
    : undefined;
  const unresolvedCopy = competition.unresolvedRoundPolicy
    ? UNRESOLVED_POLICY_COPY[competition.unresolvedRoundPolicy as string]
    : undefined;

  const gameName = title?.displayName ?? "Game";

  /*
    The column heading comes from the game's own score type, which is the smallest possible step
    towards `13` section 4's per-game ranking labels. It is NOT the full `ranking-config.service`
    pass - that is still outstanding - but "Score" on a time trial is the trading-shaped-label
    problem in miniature, and a heading is cheap to get right here.

    Note what it does not do: it does not reformat the number. `05` section 2 requires the raw
    score to be displayed as stored, because any transformation makes a dispute unanswerable.
  */
  const scoreLabel = title?.scoreType === "duration_ms" ? "Time" : "Score";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link
        href="/competitions"
        className="mb-6 inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200"
      >
        <ArrowLeft className="h-4 w-4" />
        All competitions
      </Link>

      <div className="mb-6">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1">
          <Gamepad2 className="h-3.5 w-3.5 text-blue-300" />
          <span className="text-xs font-medium text-blue-200">{gameName}</span>
        </div>
        <h1 className="text-2xl font-semibold text-white">{competition.name}</h1>
        {competition.description && (
          <p className="mt-2 max-w-2xl text-sm text-gray-400">
            {competition.description}
          </p>
        )}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Fact
          icon={<Trophy className="h-4 w-4 text-amber-300" />}
          label="Prize pool"
          value={`${currencySymbol}${(competition.prizePool ?? 0).toLocaleString()}`}
        />
        <Fact
          icon={<Coins className="h-4 w-4 text-emerald-300" />}
          label="Entry fee"
          value={
            competition.entryFee
              ? `${currencySymbol}${competition.entryFee.toLocaleString()}`
              : "Free"
          }
        />
        <Fact
          icon={<Users className="h-4 w-4 text-sky-300" />}
          label="Players"
          value={`${competition.currentParticipants ?? 0} / ${competition.maxParticipants ?? 0}`}
        />
        {/*
          The score, not PnL. A puzzle has no profit and loss, and `05` section 10 makes this a
          binding rule rather than a style point: every figure is either generalised across
          games or explicitly scoped to one. There is no third option, and the failure mode of
          getting it wrong is not a crash - a trading-only figure keeps computing and keeps
          rendering.
        */}
        <Fact
          icon={<Gamepad2 className="h-4 w-4 text-violet-300" />}
          label="Your score"
          value={state ? state.participantScore.toLocaleString() : "-"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <ProviderLeaderboard
            rows={leaderboard}
            currentUserId={userId}
            scoreLabel={scoreLabel}
          />
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
            <CompetitionEntryButton
              competition={competition}
              userBalance={walletBalance}
              isUserIn={isUserIn}
              isFull={isFull}
              participantStatus={participantStatus}
              registrationClosed={registrationClosed}
            />

            {/*
              A control that cannot work must refuse with its reason rather than be quietly
              disabled - third instance of the rule, after a provider enabled with no adapter and
              the Edit button withheld from a provider contest. A greyed-out button teaches the
              player nothing and sends them to support; this at least tells an operator what is
              missing.
            */}
            {isUserIn && !canLaunch && (
              <p className="mt-3 text-xs text-amber-300">
                This competition is missing the game details needed to start a
                round. Nothing has been charged for an attempt. Please contact
                support.
              </p>
            )}
          </div>

          {(playWindowStart || playWindowEnd) && (
            <Panel icon={<Clock className="h-4 w-4 text-gray-400" />} title="Play window">
              {playWindowStart && <Line label="Opens" value={playWindowStart} />}
              {playWindowEnd && <Line label="Closes" value={playWindowEnd} />}
              <p className="mt-2 text-xs text-gray-500">
                The play window can be narrower than the competition itself, so
                check both.
              </p>
            </Panel>
          )}

          {state && (
            <Panel
              icon={<RotateCcw className="h-4 w-4 text-gray-400" />}
              title="Your attempts"
            >
              <Line
                label="Remaining"
                value={`${state.attemptsRemaining} of ${state.attemptsPermitted}`}
              />
              {attemptsCopy && (
                <p className="mt-2 text-xs text-gray-500">{attemptsCopy}</p>
              )}
              <p className="mt-2 text-xs text-gray-500">
                An attempt is used the moment a round opens, even if you leave
                before finishing.
              </p>
            </Panel>
          )}

          {unresolvedCopy && (
            <Panel
              icon={<Info className="h-4 w-4 text-gray-400" />}
              title="If a round does not finish"
            >
              <p className="text-xs text-gray-400">{unresolvedCopy}</p>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

function Fact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-3">
      <div className="mb-1 flex items-center gap-2">
        {icon}
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className="text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function Panel({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-medium text-gray-200">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-300">{value}</span>
    </div>
  );
}
