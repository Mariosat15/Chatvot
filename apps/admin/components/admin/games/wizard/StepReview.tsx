"use client";

import type { ReactNode } from "react";
import type { ContestDraft } from "../contest-draft";
import type { ContestableTitle } from "../contest-types";
import { Notice, Problem } from "./fields";

/**
 * Step six: what the pre-flight said, a summary of the answers, and the publish decision.
 *
 * REFUSALS AND WARNINGS ARE SEPARATE, and that separation is load-bearing rather than
 * cosmetic. Three pre-flight items are advisory - the platform master switch being off,
 * a stale sandbox round, the per-round cost - and turning any of them into a blocker pushes
 * an operator to switch external games on platform-wide just to draft a contest.
 */
export function StepReview({
  draft,
  patch,
  title,
  errors,
  warnings,
  currencySymbol,
}: {
  draft: ContestDraft;
  patch: (changes: Partial<ContestDraft>) => void;
  title?: ContestableTitle;
  errors: string[];
  warnings: string[];
  currencySymbol: string;
}) {
  return (
    <>
      {errors.length > 0 && (
        <Problem title="This contest cannot be created yet" lines={errors} />
      )}

      {warnings.length > 0 && (
        <Notice title="Worth knowing" lines={warnings} />
      )}

      {errors.length === 0 && (
        <>
          <div className="rounded-xl border border-gray-700 bg-gray-900/60 divide-y divide-gray-800">
            <SummaryRow label="Game">
              {title?.displayName ?? "-"}
              {title ? (
                <span className="text-gray-500"> / {title.providerName}</span>
              ) : null}
            </SummaryRow>
            <SummaryRow label="Name">{draft.name || "-"}</SummaryRow>
            <SummaryRow label="Runs">
              {draft.startTime && draft.endTime
                ? `${new Date(draft.startTime).toLocaleString()} to ${new Date(
                    draft.endTime,
                  ).toLocaleString()}`
                : "-"}
            </SummaryRow>
            <SummaryRow label="Entry fee">
              {currencySymbol}
              {draft.entryFee}
              <span className="text-gray-500">
                {" "}
                / {draft.platformFeePercentage}% platform fee
              </span>
            </SummaryRow>
            <SummaryRow label="Players">
              {draft.minParticipants} to {draft.maxParticipants}
            </SummaryRow>
            <SummaryRow label="Prizes">
              {draft.prizeDistribution.length} rank
              {draft.prizeDistribution.length === 1 ? "" : "s"}
              <span className="text-gray-500">
                {" "}
                /{" "}
                {draft.prizeDistribution
                  .map((share) => `${share.percentage}%`)
                  .join(" / ")}
              </span>
            </SummaryRow>
            <SummaryRow label="Attempts">
              {draft.attemptsPolicy === "single"
                ? "One each"
                : `${draft.attemptsPolicy === "best_of_n" ? "Best" : "Total"} of ${
                    draft.attemptsAllowed ?? "-"
                  }`}
            </SummaryRow>
          </div>

          {/*
            CORRECTED 7 SEP 2026, TWICE. It first ended "Publishing arrives with the
            player-facing game screens", which was true when written and false from 5
            September. It then described an unconditional draft, which stopped being true the
            moment publishing became a checkbox - and a review step that describes the wrong
            outcome is worse than one that describes none, because it is read as confirmation.
          */}
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-700 bg-gray-800/60 p-4">
            <input
              type="checkbox"
              checked={draft.publishOnSave}
              onChange={(e) => patch({ publishOnSave: e.target.checked })}
              className="mt-0.5 h-4 w-4 accent-yellow-500"
            />
            <span className="text-xs text-gray-300">
              <strong className="text-white">
                Publish immediately, so players can enter it
              </strong>
              <span className="mt-1 block text-gray-400">
                {draft.publishOnSave
                  ? "The contest is checked once more against what was actually saved, then made visible. If that second check refuses it, the contest is kept as a draft and the reasons are shown here."
                  : "The contest is saved as a draft. Players cannot see or join a draft - press Publish on the contest list when you are ready."}
              </span>
            </span>
          </label>
        </>
      )}
    </>
  );
}

function SummaryRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-200 text-right">{children}</span>
    </div>
  );
}
