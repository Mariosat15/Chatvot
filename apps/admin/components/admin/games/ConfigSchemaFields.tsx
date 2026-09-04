"use client";

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

          <RangeHint field={field} />
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

  // integer and number.
  //
  // The empty string is passed through as "" rather than coerced to 0. Reason: an operator
  // clearing the box means "I have not chosen", and 0 is a choice - one that would pass a
  // `minimum: 0` check and silently become the stored setting.
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
