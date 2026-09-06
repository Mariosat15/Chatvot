/**
 * Report what is actually STORED on a provider contest, its participants and its rounds.
 *
 * Report-only. It opens a connection, reads, prints and exits; there is no write path in the
 * file at all, which is the property that makes it safe to point at production.
 *
 * IT USES THE RAW DRIVER ON PURPOSE, and that is the whole reason it exists rather than a
 * `.lean()` query in a scratch file. Mongoose applies schema defaults when it hydrates and
 * strict mode hides paths the schema does not declare, so a Mongoose read answers "what would
 * the application see" - which is a different question from "what is in the document". When a
 * screen is throwing on a missing field, the second question is the one that identifies it,
 * because a field the schema defaults will read as present while nothing is stored.
 *
 * Usage:
 *   npx tsx tools/games/inspect-provider-contest.ts            # every provider contest
 *   npx tsx tools/games/inspect-provider-contest.ts <contestId>
 */

import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

/** Fields the trading screens dereference. An absent one here is a candidate for the throw. */
const TRADING_SHAPED_CONTEST_FIELDS = [
  "startingCapital",
  "startingTradingPoints",
  "rules",
  "leverage",
  "riskLimits",
  "prizeDistribution",
  "registrationDeadline",
  "minParticipants",
  "maxParticipants",
  "currentParticipants",
];

const TRADING_SHAPED_PARTICIPANT_FIELDS = [
  "startingCapital",
  "currentCapital",
  "availableCapital",
  "pnl",
  "pnlPercentage",
  "totalTrades",
  "winningTrades",
  "losingTrades",
  "currentRank",
  "status",
];

function describe(value: unknown): string {
  if (value === undefined) return "ABSENT";
  if (value === null) return "null";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Reads with `Object.hasOwn` rather than a bare index, and that is a correctness point rather
 * than a lint workaround. A bare `doc[field]` walks the prototype chain, so a field name that
 * happens to collide with something on `Object.prototype` would report as present on a
 * document that stores nothing - and "is this field stored" is the only question this tool
 * exists to answer.
 */
function valueOf(doc: Record<string, unknown>, field: string): unknown {
  return Object.hasOwn(doc, field) ? doc[field as keyof typeof doc] : undefined;
}

function report(label: string, doc: Record<string, unknown>, fields: string[]): void {
  console.log(`\n  ${label}`);
  for (const field of fields) {
    const shown = describe(valueOf(doc, field));
    const flag = shown === "ABSENT" ? " <-- not stored" : "";
    console.log(`    ${field.padEnd(24)} ${shown}${flag}`);
  }
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set. Nothing was read.");
    process.exit(1);
  }

  const requested = process.argv[2];

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  if (!db) throw new Error("Connected without a database handle.");

  // Reason: a contest is "provider" by its label OR by carrying provider config, and the
  // interesting case is exactly the row where those two disagree - a labelled contest with no
  // keys cannot launch a round, and `isProviderContest` refuses it while the list screens
  // still show it. Matching either way round is what surfaces that.
  const filter = requested
    ? { _id: new mongoose.Types.ObjectId(requested) }
    : {
        $or: [
          { gameKey: { $nin: [null, "", "trading"] } },
          { "gameConfig.providerKey": { $exists: true } },
        ],
      };

  const contests = await db
    .collection("competitions")
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(10)
    .toArray();

  if (contests.length === 0) {
    console.log("No provider contest found.");
    await mongoose.disconnect();
    return;
  }

  for (const contest of contests) {
    console.log(`\n${"=".repeat(78)}`);
    console.log(`${contest.name ?? "(unnamed)"}  ${contest._id}`);
    console.log(`${"=".repeat(78)}`);
    console.log(`  status            ${describe(contest.status)}`);
    console.log(`  gameKey           ${describe(contest.gameKey)}`);
    console.log(`  gameConfig        ${describe(contest.gameConfig)}`);
    console.log(`  startTime         ${describe(contest.startTime)}`);
    console.log(`  endTime           ${describe(contest.endTime)}`);
    console.log(`  playWindowStart   ${describe(contest.playWindowStart)}`);
    console.log(`  playWindowEnd     ${describe(contest.playWindowEnd)}`);
    console.log(`  attemptsPolicy    ${describe(contest.attemptsPolicy)}`);
    console.log(`  attemptsPerPlayer ${describe(contest.attemptsPerPlayer)}`);
    console.log(`  unresolvedPolicy  ${describe(contest.unresolvedRoundPolicy)}`);

    report(
      "Fields the trading-shaped screens read:",
      contest as Record<string, unknown>,
      TRADING_SHAPED_CONTEST_FIELDS,
    );

    const participants = await db
      .collection("competitionparticipants")
      .find({ competitionId: contest._id })
      .limit(5)
      .toArray();

    console.log(`\n  Participants: ${participants.length}`);
    for (const participant of participants) {
      report(
        `participant ${participant._id} (user ${participant.userId})`,
        participant as Record<string, unknown>,
        [...TRADING_SHAPED_PARTICIPANT_FIELDS, "score", "gameKey"],
      );
    }

    const rounds = await db
      .collection("game_round")
      .find({ contestId: contest._id })
      .limit(5)
      .toArray();
    console.log(`\n  Rounds: ${rounds.length}`);
    for (const round of rounds) {
      console.log(
        `    ${round.roundId} attempt ${round.attemptNumber} ${round.status} score=${describe(round.rawScore)}`,
      );
    }
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Failed to read:", error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
