/**
 * The one catalogue of remedial actions an operator can take from Incident Management.
 *
 * Model-free on purpose. The hub is `"use client"` and must not pull a Mongoose model
 * into the browser (R58). The ids, which subject they apply to, and the sentences an
 * operator reads before confirming live here, and the server door reads the same Map.
 *
 * Consequences are not restated. Pause and emergency-cancel import `contestControlCopy`.
 * Ending a round imports `RESOLUTION_ACTIONS`. A second copy of either sentence is how
 * a puzzle contest gets told its positions will be closed.
 */

import { contestControlCopy } from "@/lib/admin/contest-control-copy";
import {
  MIN_REASON_LENGTH,
  RESOLUTION_ACTIONS,
  type ResolutionAction,
} from "@/lib/admin/round-resolution-actions";

export { MIN_REASON_LENGTH };

export type IncidentSubjectKind = "competition" | "challenge" | "round" | "system";

export type IncidentActionSection =
  | "competitions"
  | "challenges"
  | "round-inspector";

export interface IncidentSubjectFacts {
  kind: IncidentSubjectKind;
  status: string;
  isPaused: boolean;
  isProviderGame: boolean;
  hasFinalLeaderboard: boolean;
  needsDecision: boolean;
}

export interface ApplicableIncidentAction {
  id: string;
  label: string;
  section: IncidentActionSection;
  movesMoney: boolean;
  irreversible: boolean;
  consequences: readonly string[];
}

interface IncidentActionDefinition {
  id: string;
  label: string;
  kind: Exclude<IncidentSubjectKind, "system">;
  section: IncidentActionSection;
  movesMoney: boolean;
  irreversible: boolean;
  applies: (subject: IncidentSubjectFacts) => boolean;
  consequences: (subject: IncidentSubjectFacts) => readonly string[];
  refusedBecause: (subject: IncidentSubjectFacts) => string;
}

const LIVE_CHALLENGE = ["pending", "accepted", "active"];

function sameKind(
  action: IncidentActionDefinition,
  subject: IncidentSubjectFacts,
): boolean {
  return action.kind === subject.kind;
}

/**
 * A round an operator still has to end: unresolved, or live and already past expiry.
 * The inspector query in `listRoundsNeedingAttention` asks the same question of Mongo.
 */
export function roundNeedsDecision(
  status: string,
  expiresAt?: Date | string | null,
): boolean {
  if (status === "unresolved") return true;
  if (status !== "pending" && status !== "launched") return false;
  if (!expiresAt) return false;
  const at = expiresAt instanceof Date ? expiresAt.getTime() : Date.parse(expiresAt);
  return Number.isFinite(at) && at < Date.now();
}

function roundConsequences(actionId: ResolutionAction): readonly string[] {
  const meta = RESOLUTION_ACTIONS.get(actionId);
  return meta ? [meta.consequence] : [];
}

const DEFINITIONS: IncidentActionDefinition[] = [
  {
    id: "pause_contest",
    label: "Pause",
    kind: "competition",
    section: "competitions",
    movesMoney: false,
    irreversible: false,
    applies: (s) => s.kind === "competition" && s.status === "active" && !s.isPaused,
    consequences: (s) => contestControlCopy(s.isProviderGame).pauseConsequences,
    refusedBecause: (s) =>
      s.status !== "active"
        ? `Pause applies to a live contest, and this one is ${s.status}.`
        : "This contest is already paused.",
  },
  {
    id: "resume_contest",
    label: "Resume",
    kind: "competition",
    section: "competitions",
    movesMoney: false,
    irreversible: false,
    applies: (s) => s.kind === "competition" && s.status === "active" && s.isPaused,
    consequences: (s) => {
      const copy = contestControlCopy(s.isProviderGame);
      return [
        `The pause is lifted. ${copy.activityNoun} can continue.`,
        "Nothing already recorded is changed.",
      ];
    },
    refusedBecause: (s) =>
      s.status !== "active"
        ? `Resume applies to a live contest, and this one is ${s.status}.`
        : "This contest is not paused.",
  },
  {
    id: "emergency_cancel",
    label: "Emergency cancel and refund",
    kind: "competition",
    section: "competitions",
    movesMoney: true,
    irreversible: true,
    applies: (s) => s.kind === "competition" && s.status === "active",
    consequences: (s) => contestControlCopy(s.isProviderGame).emergencyConsequences,
    refusedBecause: (s) =>
      `Emergency cancel applies to a live contest, and this one is ${s.status}.`,
  },
  {
    id: "cancel_upcoming",
    label: "Cancel and refund",
    kind: "competition",
    section: "competitions",
    movesMoney: true,
    irreversible: true,
    applies: (s) => s.kind === "competition" && s.status === "upcoming",
    consequences: () => [
      "Cancel the contest before it starts",
      "Refund every participant their full entry fee",
      "This cannot be undone",
    ],
    refusedBecause: (s) =>
      `Cancel-and-refund applies to an upcoming contest, and this one is ${s.status}.`,
  },
  {
    id: "re_settle",
    label: "Re-settle from remaining scores",
    kind: "competition",
    section: "competitions",
    movesMoney: true,
    irreversible: true,
    applies: (s) =>
      s.kind === "competition" &&
      s.status === "completed" &&
      s.isProviderGame &&
      s.hasFinalLeaderboard,
    consequences: () => [
      "Void the disputed rounds so their scores stop counting",
      "Re-rank the contest and pay the corrected board",
      "Claw back prizes that were already paid",
      "This cannot be undone",
    ],
    refusedBecause: (s) => {
      if (!s.isProviderGame) {
        return "Re-settle is for a game contest. A trading contest is corrected with adjust results.";
      }
      if (s.status !== "completed") {
        return `Re-settle applies to a completed contest, and this one is ${s.status}.`;
      }
      return "This contest has no settled leaderboard to rebuild.";
    },
  },
  {
    id: "adjust_results",
    label: "Adjust settled results",
    kind: "competition",
    section: "competitions",
    movesMoney: true,
    irreversible: true,
    applies: (s) =>
      s.kind === "competition" && s.status === "completed" && s.hasFinalLeaderboard,
    consequences: () => [
      "Change the stored ranks and prizes",
      "Move credits so each winner holds the corrected prize",
      "This cannot be undone",
    ],
    refusedBecause: (s) =>
      s.status !== "completed"
        ? `Adjusting results applies to a completed contest, and this one is ${s.status}.`
        : "This contest has no settled leaderboard to adjust.",
  },
  {
    id: "resolve_round_void",
    label: "Void round",
    kind: "round",
    section: "round-inspector",
    movesMoney: false,
    irreversible: true,
    applies: (s) => s.kind === "round" && s.needsDecision,
    consequences: () => roundConsequences("void"),
    refusedBecause: () => "This round does not need a decision.",
  },
  {
    id: "resolve_round_abandon",
    label: "Mark round abandoned",
    kind: "round",
    section: "round-inspector",
    movesMoney: false,
    irreversible: true,
    applies: (s) => s.kind === "round" && s.needsDecision,
    consequences: () => roundConsequences("abandon"),
    refusedBecause: () => "This round does not need a decision.",
  },
  {
    id: "resolve_round_expire",
    label: "Mark round expired",
    kind: "round",
    section: "round-inspector",
    movesMoney: false,
    irreversible: true,
    applies: (s) => s.kind === "round" && s.needsDecision,
    consequences: () => roundConsequences("expire"),
    refusedBecause: () => "This round does not need a decision.",
  },
  {
    id: "cancel_challenge",
    label: "Cancel challenge and refund",
    kind: "challenge",
    section: "challenges",
    movesMoney: true,
    irreversible: true,
    applies: (s) => s.kind === "challenge" && LIVE_CHALLENGE.includes(s.status),
    consequences: () => [
      "Cancel the challenge",
      "Refund both seats when anyone has already paid",
      "This cannot be undone",
    ],
    refusedBecause: (s) =>
      `Cancel applies to a pending, accepted or live challenge, and this one is ${s.status}.`,
  },
];

/** Request-supplied ids are looked up here. A Map has no prototype chain. */
export const INCIDENT_ACTIONS = new Map<string, IncidentActionDefinition>(
  DEFINITIONS.map((definition) => [definition.id, definition]),
);

export function incidentActionIds(): string[] {
  return [...INCIDENT_ACTIONS.keys()];
}

export function actionsForSubject(
  subject: IncidentSubjectFacts,
): ApplicableIncidentAction[] {
  const offered: ApplicableIncidentAction[] = [];
  for (const action of INCIDENT_ACTIONS.values()) {
    if (!action.applies(subject)) continue;
    offered.push({
      id: action.id,
      label: action.label,
      section: action.section,
      movesMoney: action.movesMoney,
      irreversible: action.irreversible,
      consequences: action.consequences(subject),
    });
  }
  return offered;
}

/**
 * Why this action cannot run on this subject. Unknown ids are named, never dropped.
 */
export function explainInapplicable(
  actionId: string,
  subject: IncidentSubjectFacts,
): string {
  const action = INCIDENT_ACTIONS.get(actionId);
  if (!action) {
    return `Unknown action "${actionId}". Choose one of: ${incidentActionIds().join(", ")}.`;
  }
  if (!sameKind(action, subject)) {
    return `${action.label} applies to a ${action.kind}, and this incident is about a ${subject.kind}.`;
  }
  return action.refusedBecause(subject);
}

/** The resolution action a round catalogue id delegates to, if it is one. */
export function resolutionActionFor(
  actionId: string,
): ResolutionAction | null {
  if (actionId === "resolve_round_void") return "void";
  if (actionId === "resolve_round_abandon") return "abandon";
  if (actionId === "resolve_round_expire") return "expire";
  return null;
}
