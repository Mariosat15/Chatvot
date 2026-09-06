"use client";

import { CheckCircle2, Inbox, XCircle } from "lucide-react";

/**
 * Everything needed to judge one stuck round.
 *
 * THE PROVIDER EVENT LIST IS THE POINT OF THIS PANEL, and it is why the round row alone is not
 * enough. When a round is stuck the question is almost never "what does our database say" - it
 * is "did the provider ever tell us anything, and if so what was wrong with it".
 *
 * `provider_event` stores every callback BEFORE any validation runs, so a rejected delivery
 * still leaves evidence, and `processingResult` names which of the eleven gates refused it.
 * Without that an operator can only guess between three problems with three different owners:
 * the provider never called at all, the signature did not verify, or the score was outside the
 * declared range. **No events at all is itself the most informative result** - it means the
 * provider never delivered, which is a conversation with them rather than a bug here.
 */

interface ProviderEventRow {
  eventId: string;
  eventType?: string;
  processingResult?: string;
  processingError?: string;
  signatureValid?: boolean;
  receivedAt?: string;
}

export interface RoundDetail {
  round?: {
    status?: string;
    rawScore?: number;
    resultSource?: string;
    resultReceivedAt?: string;
    pollAttempts?: number;
    lastPolledAt?: string;
    expiresAt?: string;
    integrityFlags?: string[];
    providerRoundId?: string;
  };
  events?: ProviderEventRow[];
  contest?: {
    name?: string;
    status?: string;
    unresolvedRoundPolicy?: string;
    attemptsPolicy?: string;
    playWindowEnd?: string;
  };
  participant?: { username?: string; score?: number; status?: string };
  stillUnresolved?: number;
}

/** Green only for the one result that means a score landed. */
function resultTone(result?: string) {
  if (result === "scored") return "text-emerald-400";
  if (result === "duplicate_ignored") return "text-slate-400";
  return "text-red-400";
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm text-slate-200">{value}</p>
    </div>
  );
}

export function RoundDetailPanel({ detail }: { detail: RoundDetail }) {
  const { round, events = [], contest, participant } = detail;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field
          label="Score on the round"
          value={
            typeof round?.rawScore === "number" ? (
              round.rawScore
            ) : (
              <span className="text-slate-500">none reported</span>
            )
          }
        />
        <Field
          label="Score on the contest entry"
          value={
            typeof participant?.score === "number" ? (
              participant.score
            ) : (
              <span className="text-slate-500">no entry</span>
            )
          }
        />
        <Field
          label="Result arrived by"
          value={round?.resultSource ?? <span className="text-slate-500">not yet</span>}
        />
        <Field label="Poll attempts" value={round?.pollAttempts ?? 0} />
      </div>

      {contest && (
        <div className="grid gap-4 rounded border border-slate-700 bg-slate-900/40 p-3 sm:grid-cols-3">
          <Field label="Contest" value={contest.name ?? "—"} />
          <Field label="Contest status" value={contest.status ?? "—"} />
          {/* The setting that decides whether this round can stop a payout. Shown because it is
              the difference between "resolve when convenient" and "players are waiting". */}
          <Field
            label="If a result never arrives"
            value={contest.unresolvedRoundPolicy ?? "—"}
          />
        </div>
      )}

      {round?.integrityFlags && round.integrityFlags.length > 0 && (
        <div className="rounded border border-orange-500/30 bg-orange-500/10 p-3">
          <p className="text-xs font-semibold text-orange-300">
            Integrity flags raised by the provider
          </p>
          <p className="mt-1 text-xs text-orange-200/90">
            {round.integrityFlags.join(", ")}
          </p>
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Provider deliveries for this round
        </p>

        {events.length === 0 ? (
          <div className="flex items-start gap-2 rounded border border-slate-700 bg-slate-900/40 p-3">
            <Inbox className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <div>
              <p className="text-sm text-slate-300">
                The provider has never sent a result for this round.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Nothing was rejected — nothing arrived. This is a question for the provider
                rather than a problem on this side.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((event) => (
              <div
                key={event.eventId}
                className="rounded border border-slate-700 bg-slate-900/40 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`flex items-center gap-1 text-sm ${resultTone(event.processingResult)}`}
                  >
                    {event.processingResult === "scored" ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <XCircle className="h-3 w-3" />
                    )}
                    {event.processingResult ?? "not processed"}
                  </span>
                  <span className="text-xs text-slate-500">
                    {event.receivedAt
                      ? new Date(event.receivedAt).toLocaleString()
                      : "unknown time"}
                  </span>
                </div>

                {event.processingError && (
                  <p className="mt-2 text-xs text-red-300/90">{event.processingError}</p>
                )}

                <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                  <span className="font-mono">{event.eventId}</span>
                  {/* Explicitly three-valued. `false` means the signature was checked and
                      failed, which is a possible attack; `undefined` means it was never
                      reached, usually because an earlier gate refused first. Collapsing them
                      into "invalid" would invent an attack out of a configuration error. */}
                  {event.signatureValid === false && (
                    <span className="text-red-400">signature failed</span>
                  )}
                  {event.signatureValid === undefined && (
                    <span>signature not checked</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
