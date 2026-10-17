"use client";

/**
 * The refusal shown where a destructive action used to run in place.
 *
 * Greyed-out is not enough: an operator needs to be told where the action went
 * and why. Pause and resume are not this component. They stay on the contest
 * because they are reversible and have to be available while someone is watching.
 */

export const INCIDENT_HUB_HREF = "/dashboard?activeTab=incidents";

export default function HubWithheldAction({
  action,
  detail,
}: {
  action: string;
  detail?: string;
}) {
  return (
    <div className="p-4 rounded-lg border border-amber-500/40 bg-amber-500/10 space-y-2">
      <p className="text-sm text-amber-100">
        <strong>{action}</strong> is done from Incident Management, so the reason
        and the outcome are recorded in one place.
      </p>
      {detail ? <p className="text-xs text-amber-100/80">{detail}</p> : null}
      <a
        href={INCIDENT_HUB_HREF}
        className="inline-block text-sm font-medium text-amber-200 underline"
      >
        Open Incident Management
      </a>
    </div>
  );
}
