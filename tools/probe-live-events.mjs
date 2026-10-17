// Probes for __tests__/live/live-events.test.ts: inject a defect, expect
// exactly one failing test, restore. Run: node tools/probe-live-events.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const probes = [
  ["apps/admin/lib/services/live-event-hooks.ts", "const COALESCE_MS = 250;", "const COALESCE_MS = 251;"],
  ["database/models/trading/competition.model.ts", 'attachLiveEventHooks(CompetitionSchema, "competitions");', ""],
  ["apps/admin/database/models/trading/challenge.model.ts", "attachLiveEventHooks(ChallengeSchema, \"challenges\", challengeAudience);", ""],
  ["lib/services/live-event-hooks.ts", "if (changedCount(result) > 0)", "if (true)"],
  ["lib/services/live-event-hooks.ts", "openToAnyone === true", "openToAnyone === false"],
  ["worker/jobs/challenge-finalize.job.ts", "announceLiveChange(\"challenges\"", "void (\"challenges\""],
  ["components/challenges/ChallengePopup.tsx", 'message.type === "live"', 'message.type === "lives"'],
  ["hooks/useUnreadMessages.ts", 'useLiveTopic("messages"', 'useLiveTopic("message"'],
];

let bad = 0;
for (const [file, from, to] of probes) {
  const original = readFileSync(file, "utf8");
  if (!original.includes(from)) {
    console.log(`PROBE DID NOT APPLY: ${file} :: ${from}`);
    bad++;
    continue;
  }
  writeFileSync(file, original.replace(from, to), "utf8");
  if (readFileSync(file, "utf8") === original) throw new Error(`unchanged ${file}`);
  let out = "";
  try {
    out = execSync("npx vitest run __tests__/live/live-events.test.ts", { encoding: "utf8", stdio: "pipe" });
  } catch (e) {
    out = `${e.stdout}${e.stderr}`;
  } finally {
    writeFileSync(file, original, "utf8");
  }
  const failed = Number(/(\d+) failed/.exec(out.replace(/\s+/g, " "))?.[1] ?? 0);
  console.log(`${failed >= 1 ? "RED" : "GREEN"} x${failed}  ${file} :: ${from}`);
  if (failed < 1) bad++;
}
process.exit(bad ? 1 : 0);
