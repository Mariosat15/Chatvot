"use client";

import { useState } from "react";
import { Trophy, Loader2, Undo2 } from "lucide-react";

/**
 * The per-Game-Master competition creation override, and the badge that reports what
 * actually applies.
 *
 * WHY THIS IS A COMPONENT RATHER THAN THE BADGE IT REPLACED
 * ---------------------------------------------------------
 * The badge here used to read `gm.limits.canCreateCompetitions` and carry the tooltip
 * "Based on {package} package settings". That was true of the value it was handed and wrong
 * about the platform: `competitionCreationOverride` outranks the package in
 * `resolveCreationLimits`, which is what both creation routes call, so an administrator's
 * explicit deny rendered as a green "Comps: ON" while every create attempt was refused.
 *
 * The fix is not in this file. The route now resolves through the same function the gate
 * uses and returns `creationDecidedBy`, so this component reports a decision rather than
 * making one. What it must never do is re-derive the answer from the package and the
 * override itself - that is a second copy of a precedence rule, which is the shape behind
 * four separate defects in this codebase.
 */

interface CreationLimits {
  canCreateCompetitions: boolean;
  allowedGameTypes?: readonly string[];
  creationDecidedBy?:
    | "admin_override"
    | "current_package"
    | "cached_limits"
    | "default";
}

interface Props {
  gm: {
    id: string;
    packageName: string;
    limits: CreationLimits;
    competitionCreationOverride?: "enabled" | "disabled" | null;
  };
  onAction: (
    gmId: string,
    action: string,
    extraData?: Record<string, unknown>,
  ) => Promise<void>;
  actionLoading: boolean;
}

/**
 * Where the effective answer came from, in the operator's words.
 *
 * `default` is deliberately spelled out rather than folded into the package case: it means
 * nothing anywhere has an opinion, which is a different fact from a package that grants
 * creation, and it is the one an operator should check before assuming a grant exists.
 */
function sourceLabel(gm: Props["gm"]): string {
  switch (gm.limits?.creationDecidedBy) {
    case "admin_override":
      return "Set by an administrator for this Game Master";
    case "current_package":
      return `From the ${gm.packageName} package`;
    case "cached_limits":
      return "From this subscription's stored limits (package unavailable)";
    default:
      return "Platform default - nothing has been configured";
  }
}

export default function CompetitionCreationControl({
  gm,
  onAction,
  actionLoading,
}: Props) {
  const [busy, setBusy] = useState<string | null>(null);

  const allowed = gm.limits?.canCreateCompetitions !== false;
  const override = gm.competitionCreationOverride ?? null;
  const games = gm.limits?.allowedGameTypes ?? [];

  const send = async (
    key: string,
    override: "enabled" | "disabled" | null,
  ) => {
    setBusy(key);
    try {
      await onAction(gm.id, "toggleCompetitionCreation", { override });
    } finally {
      setBusy(null);
    }
  };

  const disabled = actionLoading || busy !== null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <div
          className={`flex items-center gap-2 px-4 py-2 rounded ${
            allowed
              ? "bg-green-600/20 text-green-400 border border-green-600/50"
              : "bg-gray-600/20 text-gray-400 border border-gray-600/50"
          }`}
          title={sourceLabel(gm)}
        >
          <Trophy className="h-4 w-4" />
          {allowed ? "Comps: ON" : "Comps: OFF"}
          {override && (
            <span className="text-[10px] uppercase tracking-wide opacity-70">
              override
            </span>
          )}
        </div>

        {/* Reason both directions are offered rather than one toggle: an override that
            AGREES with the package is a legitimate and useful thing to set, because it
            survives the package being edited later. A single toggle can only ever express
            "the opposite of what applies now", so it cannot set that. */}
        {override === null ? (
          <>
            <button
              onClick={() => void send("on", "enabled")}
              disabled={disabled}
              className="px-3 py-2 text-xs rounded bg-green-700/80 text-white hover:bg-green-700 disabled:opacity-50"
              title="Allow this Game Master to create competitions regardless of their package"
            >
              {busy === "on" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                "Force on"
              )}
            </button>
            <button
              onClick={() => void send("off", "disabled")}
              disabled={disabled}
              className="px-3 py-2 text-xs rounded bg-red-700/80 text-white hover:bg-red-700 disabled:opacity-50"
              title="Stop this Game Master creating competitions regardless of their package"
            >
              {busy === "off" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                "Force off"
              )}
            </button>
          </>
        ) : (
          <button
            onClick={() => void send("clear", null)}
            disabled={disabled}
            className="flex items-center gap-1 px-3 py-2 text-xs rounded bg-gray-700 text-white hover:bg-gray-600 disabled:opacity-50"
            title="Remove the override and follow the package again"
          >
            {busy === "clear" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <Undo2 className="h-3 w-3" />
                Clear override
              </>
            )}
          </button>
        )}
      </div>

      <p className="text-[11px] text-gray-500">
        {sourceLabel(gm)}
        {allowed && games.length > 0 && (
          <>
            {" · "}
            {/* Reason the games are shown beside the switch: creation being allowed and
                creation being possible are different facts. A Game Master with creation ON
                and only "trading" granted still cannot create a game contest, and without
                this line the refusal they receive has no visible cause on this screen. */}
            Games: {games.join(", ")}
          </>
        )}
      </p>
    </div>
  );
}
