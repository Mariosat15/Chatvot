"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { AlertCircle, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The game wizard's field primitives.
 *
 * Extracted from `ProviderContestWizard.tsx` when the steps became separate files: three of
 * them need a number box and a date box, and a third copy is how two steps end up with
 * differently-behaved inputs for the same kind of value.
 */

/** Label row, optional icon, optional right-hand action (the AI buttons use this), hint. */
export function FieldShell({
  label,
  icon: Icon,
  iconClassName = "text-blue-400",
  hint,
  action,
  htmlFor,
  children,
}: {
  label: string;
  icon?: LucideIcon;
  iconClassName?: string;
  hint?: ReactNode;
  action?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <Label
          htmlFor={htmlFor}
          className="text-gray-300 flex items-center gap-2"
        >
          {Icon && <Icon className={`h-4 w-4 ${iconClassName}`} />}
          {label}
        </Label>
        {action}
      </div>
      {children}
      {hint && (
        <p className="text-xs text-gray-500 mt-2 flex items-start gap-1">
          <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <span>{hint}</span>
        </p>
      )}
    </div>
  );
}

export function DateField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: ReactNode;
}) {
  return (
    <FieldShell label={label} hint={hint}>
      <Input
        type="datetime-local"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-gray-800 border-gray-600 text-gray-100 h-12"
      />
    </FieldShell>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  icon,
  iconClassName,
  hint,
  min,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number) => void;
  icon?: LucideIcon;
  iconClassName?: string;
  hint?: ReactNode;
  min?: number;
}) {
  return (
    <FieldShell
      label={label}
      icon={icon}
      iconClassName={iconClassName}
      hint={hint}
    >
      <Input
        type="number"
        min={min}
        value={value === undefined ? "" : String(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="bg-gray-800 border-gray-600 text-gray-100 h-12"
      />
    </FieldShell>
  );
}

/** A refusal. Red, listed, and never collapsed into one sentence. */
export function Problem({
  title,
  lines,
}: {
  title: string;
  lines: string[];
}) {
  return (
    <div className="rounded-xl border border-red-600/50 bg-red-500/10 p-4">
      <div className="flex items-center gap-2 text-red-300 font-semibold text-sm mb-2">
        <AlertTriangle className="h-4 w-4" />
        {title}
      </div>
      <ul className="text-sm text-red-200/90 space-y-1 list-disc list-inside">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Advisory, and kept visually distinct from `Problem` on purpose.
 *
 * The pre-flight separates refusals from warnings because three of its items are legitimate
 * things to do anyway - drafting ahead of a launch, a stale sandbox round, the per-round cost.
 * Rendering both in the same red box turns every warning into a blocker in the operator's
 * head, and an operator who cannot tell the difference starts ignoring both.
 */
export function Notice({
  title,
  lines,
}: {
  title: string;
  lines: string[];
}) {
  return (
    <div className="rounded-xl border border-amber-600/50 bg-amber-500/10 p-4">
      <div className="flex items-center gap-2 text-amber-300 font-semibold text-sm mb-2">
        <AlertTriangle className="h-4 w-4" />
        {title}
      </div>
      <ul className="text-sm text-amber-200/90 space-y-1 list-disc list-inside">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
