import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

export const CHALLENGE_DIALOG = "components/challenges/ChallengeCreateDialog.tsx";
export const CHALLENGE_DIALOG_PARTS = "components/challenges/create";

/**
 * Comments stripped before matching, always.
 *
 * Every file on this screen argues in prose about the thing it must not do - the settings form
 * explains why a `field.name === "boardSize"` check is forbidden, and names one to explain it.
 * A bare match reads the warning as the offence and fails a correct file for discussing the
 * mistake, which is the kind of guard the first person it inconveniences deletes.
 */
export function readChallengeCode(path: string): string {
  return readFileSync(join(ROOT, path), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/**
 * The create dialog together with every part it is built from.
 *
 * Reason: the dialog was 728 lines and was split on 14 September 2026. Several guards read it
 * structurally - that a pick seeds the settings, that the field list comes off the chosen
 * title, that no game code appears anywhere - and every one of those would have started
 * passing VACUOUSLY the moment the markup moved into a sibling file, with nothing failing and
 * nothing in a log. Reading the directory rather than naming the parts is the same choice the
 * admin wizard's `readWizardScreen` makes, and for the same reason: a list is a second place
 * to forget when a fourth part arrives.
 */
export function readChallengeCreateScreen(): string {
  const parts = readdirSync(join(ROOT, CHALLENGE_DIALOG_PARTS)).filter(
    (name) => name.endsWith(".ts") || name.endsWith(".tsx"),
  );
  if (parts.length === 0) {
    throw new Error(`No dialog parts under ${CHALLENGE_DIALOG_PARTS}`);
  }
  return [
    readChallengeCode(CHALLENGE_DIALOG),
    ...parts.map((name) =>
      readChallengeCode(`${CHALLENGE_DIALOG_PARTS}/${name}`),
    ),
  ].join("\n");
}
