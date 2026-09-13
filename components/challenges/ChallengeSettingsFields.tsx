"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ConfigField } from "@/lib/services/games/config-schema";

/**
 * A provider game's own settings, on the player's "create a challenge" dialog.
 *
 * THIS IS THE OWNER'S "the screen must adapt to any game settings", AND IT IS THE SAME CLAIM
 * `apps/admin/components/admin/games/ConfigSchemaFields.tsx` MAKES FOR AN OPERATOR: a provider
 * adds a title with three settings we have never seen, and this renders three controls for
 * them. There is no per-game code and there must never be - the moment a `switch` on game code,
 * a `field.name === "boardSize"` or a metric name appears here, every future title needs a
 * developer again and the acceptance criterion silently stops being true. A test forbids it.
 *
 * A SECOND COMPONENT RATHER THAN THE ADMIN ONE REUSED, and the reason is not styling. That file
 * lives in `apps/admin/components/`, which the main app cannot import at all, and it is built on
 * the admin app's own `Switch` / `Select` primitives. What must NOT be duplicated is the
 * meaning - which fields exist, what their bounds are, what an untouched form contains - so the
 * parser, the validator and `defaultConfigValues` all come from the one shared
 * `config-schema.ts` and the two forms can only differ in appearance.
 *
 * IT RENDERS ONLY WHAT THE PARSER UNDERSTOOD. `parseConfigSchema` fails closed on a keyword it
 * does not support, and `listChallengeableTitles` sends an empty field list in that case while
 * the picker disables the title - so a control reaching this component is one the create route
 * can also validate. A form that renders a control nothing checks collects a value nobody
 * enforces.
 */

interface Props {
  fields: ConfigField[];
  values: Record<string, unknown>;
  onChange: (name: string, value: unknown) => void;
  disabled?: boolean;
}

export default function ChallengeSettingsFields({
  fields,
  values,
  onChange,
  disabled,
}: Props) {
  if (fields.length === 0) {
    // Reason: said rather than left blank. A player who saw settings on the previous game
    // otherwise assumes this one is still loading, or that the dialog is broken.
    return (
      <p className="text-[11px] text-gray-500">
        This game has no settings to choose. Both players get the same round.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {fields.map((field) => (
        <div key={field.name} className="space-y-1.5">
          <Label
            htmlFor={`chal-cfg-${field.name}`}
            className="text-sm text-gray-300"
          >
            {field.title ?? field.name}
          </Label>

          <FieldControl
            field={field}
            value={values[field.name]}
            onChange={(next) => onChange(field.name, next)}
            disabled={disabled}
          />

          <Hint field={field} />
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
  const id = `chal-cfg-${field.name}`;
  const box =
    "bg-gray-800/60 border-gray-700 text-white h-9 disabled:opacity-50";

  if (field.type === "boolean") {
    // Reason: two buttons rather than a switch, because a switch has to render in one position
    // or the other and this dialog seeds a boolean with no declared default as off - the player
    // should be able to see which of the two states they are in without reading a track.
    return (
      <div className="flex gap-1.5">
        {[true, false].map((state) => (
          <button
            key={String(state)}
            type="button"
            disabled={disabled}
            onClick={() => onChange(state)}
            className={`rounded-full px-3 py-1 text-xs transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
              value === state
                ? "bg-blue-500 text-white shadow-md shadow-blue-500/25"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
            }`}
          >
            {state ? "On" : "Off"}
          </button>
        ))}
      </div>
    );
  }

  if (field.options) {
    return (
      <select
        id={id}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        /*
          AN OPAQUE BACKGROUND, NOT THE DIALOG'S TRANSLUCENT ONE (R60). A browser paints a native
          select's list itself, taking the surface from this element's own `background-color`, so
          a `bg-gray-800/60` here composites over the browser's light list and every option is
          white on white - with the highlighted row the only legible one.
        */
        className="h-9 w-full rounded-md border border-gray-700 bg-gray-800 px-3 text-sm text-white transition-colors focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/25 disabled:opacity-50"
      >
        {field.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "string") {
    return (
      <Input
        id={id}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className={box}
      />
    );
  }

  if (field.format === "duration-seconds") {
    return (
      <DurationBox
        id={id}
        field={field}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={box}
      />
    );
  }

  // integer and number.
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
      // Reason: the empty string is passed through rather than coerced to 0. Clearing the box
      // means "I have not chosen"; 0 is a choice, and one that would pass a `minimum: 0` check
      // and silently become the stored setting.
      onChange={(event) => {
        const raw = event.target.value;
        onChange(raw === "" ? "" : Number(raw));
      }}
      disabled={disabled}
      className={box}
    />
  );
}

/**
 * The play clock, in minutes.
 *
 * KEYED ON THE DECLARED `format`, NEVER ON A FIELD NAME OR A GAME CODE. A title says which of its
 * settings is the playing time and this renders that one in minutes; every other integer gets a
 * plain number box. A `field.name === "durationSeconds"` check would be shorter and would quietly
 * make the control one game's rather than the platform's.
 *
 * IT STORES SECONDS THROUGHOUT - the minutes are presentation, so the stored value is exactly
 * what the game's schema declares, and a title whose clock is genuinely in seconds needs no
 * special case at the other end.
 */
function DurationBox({
  id,
  field,
  value,
  onChange,
  disabled,
  className,
}: {
  id: string;
  field: ConfigField;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
  className: string;
}) {
  const seconds = typeof value === "number" ? value : Number(value);
  const usable = Number.isFinite(seconds) ? seconds : undefined;

  const minMinutes =
    field.minimum === undefined ? 1 : Math.max(1, Math.ceil(field.minimum / 60));
  const maxMinutes =
    field.maximum === undefined ? undefined : Math.floor(field.maximum / 60);

  return (
    <Input
      id={id}
      type="number"
      inputMode="numeric"
      step={1}
      min={minMinutes}
      max={maxMinutes}
      value={usable === undefined ? "" : String(Math.round(usable / 60))}
      onChange={(event) => {
        const raw = event.target.value;
        onChange(raw === "" ? "" : Number(raw) * 60);
      }}
      disabled={disabled}
      className={className}
    />
  );
}

/**
 * The bounds and the default, said in the unit the control is showing.
 *
 * A DURATION FIELD'S HINT IS IN MINUTES, because the box is: printing the schema's raw seconds
 * beside a box holding minutes is how somebody types 600 into a field expecting 10.
 */
function Hint({ field }: { field: ConfigField }) {
  const duration = field.format === "duration-seconds";
  const unit = (raw: number) => (duration ? Math.round(raw / 60) : raw);

  const parts: string[] = [];

  if (field.minimum !== undefined && field.maximum !== undefined) {
    parts.push(`between ${unit(field.minimum)} and ${unit(field.maximum)}`);
  } else if (field.minimum !== undefined) {
    parts.push(`at least ${unit(field.minimum)}`);
  } else if (field.maximum !== undefined) {
    parts.push(`at most ${unit(field.maximum)}`);
  }

  if (typeof field.default === "number") {
    parts.push(`default ${unit(field.default)}`);
  } else if (field.default !== undefined && field.type !== "boolean") {
    parts.push(`default ${String(field.default)}`);
  }

  if (duration) parts.push("minutes");

  const description = field.description?.trim();
  if (parts.length === 0 && !description) return null;

  return (
    <p className="text-[11px] text-gray-500">
      {description}
      {description && parts.length > 0 ? " · " : ""}
      {parts.length > 0 ? `${parts.join(", ")}.` : ""}
    </p>
  );
}
