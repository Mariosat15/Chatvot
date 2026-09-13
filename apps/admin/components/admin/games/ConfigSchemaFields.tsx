"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ConfigField } from "@/lib/services/games/config-schema";

/**
 * Renders a provider game's settings form from the game's own schema.
 *
 * THIS COMPONENT IS THE "NO DEVELOPER NEEDED" CLAIM MADE LITERAL. A provider adds a title
 * with three settings we have never seen; this renders three inputs for them. There is no
 * per-game code, and there must never be - the moment a `switch` on game code appears here,
 * every future title needs a developer again and the acceptance criterion silently stops
 * being true.
 *
 * IT RENDERS ONLY WHAT THE PARSER UNDERSTOOD. The parser fails closed on schema keywords it
 * does not support, so a field reaching this component is one we can both display and
 * validate. That pairing matters: a form that renders a control it cannot validate collects
 * a value nothing checks.
 */

interface ConfigSchemaFieldsProps {
  fields: ConfigField[];
  values: Record<string, unknown>;
  onChange: (name: string, value: unknown) => void;
  disabled?: boolean;
}

export function ConfigSchemaFields({
  fields,
  values,
  onChange,
  disabled,
}: ConfigSchemaFieldsProps) {
  if (fields.length === 0) {
    return (
      <p className="text-sm text-gray-400">
        This game has no configurable settings. Nothing to choose here.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {fields.map((field) => (
        <div key={field.name} className="space-y-2">
          <Label htmlFor={`cfg-${field.name}`} className="text-gray-200">
            {field.title ?? field.name}
            {field.required && <span className="text-red-400 ml-1">*</span>}
          </Label>

          {field.description && (
            <p className="text-xs text-gray-400">{field.description}</p>
          )}

          <FieldControl
            field={field}
            value={values[field.name]}
            onChange={(value) => onChange(field.name, value)}
            disabled={disabled}
          />

          {field.format !== "duration-seconds" && <RangeHint field={field} />}
        </div>
      ))}
    </div>
  );
}

function FieldControl({
  field,
  value,
  onChange,
  disabled,
}: {
  field: ConfigField;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}) {
  const id = `cfg-${field.name}`;

  if (field.type === "boolean") {
    return (
      <div className="flex items-center gap-3">
        <Switch
          id={id}
          checked={value === true}
          onCheckedChange={(checked) => onChange(checked)}
          disabled={disabled}
        />
        <span className="text-sm text-gray-300">
          {value === true ? "On" : "Off"}
        </span>
      </div>
    );
  }

  if (field.options) {
    return (
      <Select
        value={typeof value === "string" ? value : ""}
        onValueChange={(next) => onChange(next)}
        disabled={disabled}
      >
        <SelectTrigger id={id} className="bg-gray-900 border-gray-700 text-white">
          <SelectValue placeholder="Choose one" />
        </SelectTrigger>
        <SelectContent>
          {field.options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (field.type === "string") {
    return (
      <Input
        id={id}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="bg-gray-900 border-gray-700 text-white"
      />
    );
  }

  if (field.format === "duration-seconds") {
    return (
      <DurationControl
        id={id}
        field={field}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
    );
  }

  // integer and number.
  return (
    <NumberBox
      id={id}
      field={field}
      value={value}
      onChange={onChange}
      disabled={disabled}
    />
  );
}

/**
 * The lengths an operator is offered for a contest's playing time.
 *
 * A LIST OF MINUTES, BECAUSE THE FIELD IS SECONDS AND NOBODY THINKS IN SECONDS. The owner
 * asked for exactly these, and a free-text box in seconds is what produced the report that
 * started this: "it lets you set the duration like 120" reads as two minutes only if you
 * stop and divide.
 *
 * FILTERED AGAINST THE TITLE'S OWN DECLARED RANGE, never assumed. A title may allow only
 * two to five minutes, and offering an hour that the game then clamps is worse than not
 * offering it - the contest saves with a length the operator did not choose and the round
 * gate reserves that clamped value instead.
 */
const DURATION_PRESET_MINUTES = [1, 5, 10, 20, 30, 60] as const;

const CUSTOM = "custom";

/**
 * The playing-time control: a short list of sensible lengths, plus a way out of the list.
 *
 * KEYED ON THE DECLARED `format`, NOT ON A GAME CODE OR A FIELD NAME. A title says which of
 * its settings is the play clock and this renders that one as a duration; every other integer
 * still gets a plain number box. A `field.name === "durationSeconds"` check here would have
 * been shorter and would have quietly made the control Circuit Sprint's rather than the
 * platform's - the same failure as a `switch` on game code, one layer down.
 *
 * IT STORES SECONDS THROUGHOUT. The minutes are a presentation detail; converting on the way
 * in and out means the stored setting is exactly what the game's schema declares, so a title
 * whose clock happens to be in seconds needs no special case at the other end.
 *
 * IT FALLS BACK TO A PLAIN NUMBER BOX when no preset fits inside the declared range - a title
 * allowing at most 45 seconds cannot be expressed in whole minutes, and a dropdown with no
 * usable options is a control that appears to work and offers nothing.
 *
 * CHOOSING "CUSTOM" IS REMEMBERED, AND IT HAS TO BE STATE RATHER THAN A DERIVED VALUE. The first
 * version had none: it decided it was in custom mode when the stored value matched no preset, and
 * it deliberately did nothing when Custom was picked, so as not to change a value the operator was
 * only inspecting. Both halves are right on their own and together they made the option
 * UNREACHABLE - the default is ten minutes, ten minutes is a preset, so picking Custom left the
 * value alone, the derived mode stayed false, the select snapped back to "10 minutes" and no box
 * appeared. The operator's only way in was to already have a value no preset matched.
 *
 * That is the shape this codebase keeps finding: a control that renders correctly, reports nothing
 * and does nothing. Keeping the value untouched is still the rule; the MODE is what the click
 * changes.
 */
function DurationControl({
  id,
  field,
  value,
  onChange,
  disabled,
}: {
  id: string;
  field: ConfigField;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}) {
  const min = field.minimum ?? 1;
  const max = field.maximum;

  const presets = DURATION_PRESET_MINUTES.filter((minutes) => {
    const seconds = minutes * 60;
    return seconds >= min && (max === undefined || seconds <= max);
  });

  const [customChosen, setCustomChosen] = useState(false);

  const seconds = typeof value === "number" ? value : Number(value);
  const usable = Number.isFinite(seconds) ? seconds : undefined;
  const matched = presets.find((minutes) => minutes * 60 === usable);
  // A stored value no preset matches is custom whether or not anybody clicked, so an edit of a
  // contest saved at seven minutes opens on the box.
  const custom = customChosen || !matched;

  if (presets.length === 0) {
    return (
      <NumberBox
        id={id}
        field={field}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
    );
  }

  const minMinutes = Math.max(1, Math.ceil(min / 60));
  const maxMinutes = max === undefined ? undefined : Math.floor(max / 60);

  return (
    <div className="space-y-2">
      <Select
        value={custom ? CUSTOM : String(matched)}
        onValueChange={(next) => {
          if (next === CUSTOM) {
            // Reason: switching to Custom must not silently change the stored value. The box
            // opens on whatever is already set, so an operator who opens it to look and then
            // changes their mind has not edited the contest. Only the mode changes.
            setCustomChosen(true);
            return;
          }
          setCustomChosen(false);
          onChange(Number(next) * 60);
        }}
        disabled={disabled}
      >
        <SelectTrigger
          id={id}
          className="bg-gray-900 border-gray-700 text-white"
        >
          <SelectValue placeholder="Choose how long players get" />
        </SelectTrigger>
        <SelectContent>
          {presets.map((minutes) => (
            <SelectItem key={minutes} value={String(minutes)}>
              {minutes === 1 ? "1 minute" : `${minutes} minutes`}
            </SelectItem>
          ))}
          <SelectItem value={CUSTOM}>Custom</SelectItem>
        </SelectContent>
      </Select>

      {custom && (
        <div className="space-y-1">
          <Input
            aria-label="Playing time in minutes"
            type="number"
            inputMode="numeric"
            step={1}
            min={minMinutes}
            max={maxMinutes}
            value={usable === undefined ? "" : String(usable / 60)}
            onChange={(event) => {
              const raw = event.target.value;
              onChange(raw === "" ? "" : Number(raw) * 60);
            }}
            disabled={disabled}
            className="bg-gray-900 border-gray-700 text-white"
          />
          <p className="text-xs text-gray-500">
            Minutes.{" "}
            {maxMinutes === undefined
              ? `At least ${minMinutes}.`
              : `Between ${minMinutes} and ${maxMinutes}.`}
          </p>
        </div>
      )}

      <p className="text-xs text-gray-500">
        Every player gets this long once they start, and the contest stops accepting new
        attempts this far before it ends.
      </p>
    </div>
  );
}

/**
 * The plain numeric input, shared by ordinary number fields and the duration fallback.
 *
 * The empty string is passed through as "" rather than coerced to 0. Reason: an operator
 * clearing the box means "I have not chosen", and 0 is a choice - one that would pass a
 * `minimum: 0` check and silently become the stored setting.
 */
function NumberBox({
  id,
  field,
  value,
  onChange,
  disabled,
}: {
  id: string;
  field: ConfigField;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}) {
  return (
    <Input
      id={id}
      type="number"
      inputMode={field.type === "integer" ? "numeric" : "decimal"}
      step={field.type === "integer" ? 1 : "any"}
      min={field.minimum}
      max={field.maximum}
      value={
        typeof value === "number" || typeof value === "string" ? String(value) : ""
      }
      onChange={(event) => {
        const raw = event.target.value;
        onChange(raw === "" ? "" : Number(raw));
      }}
      disabled={disabled}
      className="bg-gray-900 border-gray-700 text-white"
    />
  );
}

function RangeHint({ field }: { field: ConfigField }) {
  const parts: string[] = [];

  if (field.minimum !== undefined && field.maximum !== undefined) {
    parts.push(`between ${field.minimum} and ${field.maximum}`);
  } else if (field.minimum !== undefined) {
    parts.push(`at least ${field.minimum}`);
  } else if (field.maximum !== undefined) {
    parts.push(`at most ${field.maximum}`);
  }

  if (field.default !== undefined) {
    parts.push(`default ${String(field.default)}`);
  }

  if (parts.length === 0) return null;

  return <p className="text-xs text-gray-500">{parts.join(", ")}.</p>;
}

/**
 * Seeds the form with each field's declared default.
 *
 * Exported because the wizard needs it when the operator picks a different game: the values
 * from the previous game's schema are meaningless against the new one, and carrying them
 * over would submit keys the new schema does not declare.
 */
export function defaultConfigValues(
  fields: ConfigField[],
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.default !== undefined) values[field.name] = field.default;
    else if (field.type === "boolean") values[field.name] = false;
  }
  return values;
}
