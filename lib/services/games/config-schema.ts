/**
 * The `configSchema` subset a provider may declare, and the validator for it.
 *
 * A provider publishes each title's settings as JSON Schema (`01` section 3), the admin
 * contest wizard generates its form from that schema, and the operator's answers are
 * validated against the same schema before a contest is saved. One declaration drives both,
 * which is what makes a new title bookable with no release.
 *
 * WHY THIS IS HAND-WRITTEN RATHER THAN A JSON SCHEMA LIBRARY. Neither app carries a
 * validator today, and full JSON Schema is far larger than this needs: the spec's example
 * uses object/properties, four scalar types, `minimum`, `maximum`, `enum`, `default` and
 * `required`. Pulling in a general validator to cover a page of grammar would add a
 * dependency whose unused 90% is attack surface on a path that parses third-party input.
 *
 * IT FAILS CLOSED ON ANYTHING IT DOES NOT UNDERSTAND, and that is the whole design.
 * A validator that ignores an unrecognised keyword is worse than none: a provider declaring
 * `oneOf`, `pattern` or a nested object would get settings that passed validation while
 * never being checked, and the operator would see a form missing the fields that constrain
 * them. So an unsupported construct is a REFUSAL, surfaced to the operator as "this
 * provider's schema is not supported", not a silent pass.
 *
 * The consequence is deliberate: a provider who needs richer settings forces a conversation
 * and a release, rather than quietly getting no validation.
 */

export type ConfigFieldType = "integer" | "number" | "string" | "boolean";

export interface ConfigField {
  name: string;
  type: ConfigFieldType;
  required: boolean;
  title?: string;
  description?: string;
  minimum?: number;
  maximum?: number;
  /** Present only for string fields with an enum. Renders as a select. */
  options?: string[];
  default?: unknown;
}

export type ParseResult =
  | { ok: true; fields: ConfigField[] }
  | { ok: false; error: string };

const SUPPORTED_ROOT_KEYS = new Set([
  "type",
  "properties",
  "required",
  "title",
  "description",
  "additionalProperties",
]);

const SUPPORTED_FIELD_KEYS = new Set([
  "type",
  "minimum",
  "maximum",
  "enum",
  "default",
  "title",
  "description",
]);

const SUPPORTED_TYPES = new Set<string>([
  "integer",
  "number",
  "string",
  "boolean",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Turns a provider's `configSchema` into a field list the form can render.
 *
 * An ABSENT or EMPTY schema is valid and means "this game takes no settings" - a reflex
 * game legitimately has none. That is different from an unparseable schema, and the two
 * must not collapse into the same answer: one is a game with no options, the other is a
 * game we cannot safely configure.
 */
export function parseConfigSchema(raw: unknown): ParseResult {
  if (raw === undefined || raw === null) return { ok: true, fields: [] };

  if (!isRecord(raw)) {
    return { ok: false, error: "The settings schema is not an object." };
  }

  const unknownRoot = Object.keys(raw).filter(
    (key) => !SUPPORTED_ROOT_KEYS.has(key),
  );
  if (unknownRoot.length > 0) {
    return {
      ok: false,
      error: `The settings schema uses unsupported keywords: ${unknownRoot.join(", ")}.`,
    };
  }

  if (raw.type !== undefined && raw.type !== "object") {
    return {
      ok: false,
      error: `The settings schema must describe an object, not "${String(raw.type)}".`,
    };
  }

  if (raw.properties === undefined) return { ok: true, fields: [] };
  if (!isRecord(raw.properties)) {
    return { ok: false, error: "The settings schema's properties are not an object." };
  }

  const requiredNames = new Set<string>();
  if (raw.required !== undefined) {
    if (!Array.isArray(raw.required) || raw.required.some((n) => typeof n !== "string")) {
      return {
        ok: false,
        error: "The settings schema's required list must be an array of names.",
      };
    }
    for (const name of raw.required) requiredNames.add(name);
  }

  const fields: ConfigField[] = [];

  for (const [name, rawField] of Object.entries(raw.properties)) {
    if (!isRecord(rawField)) {
      return { ok: false, error: `Setting "${name}" is not described by an object.` };
    }

    const unknownField = Object.keys(rawField).filter(
      (key) => !SUPPORTED_FIELD_KEYS.has(key),
    );
    if (unknownField.length > 0) {
      return {
        ok: false,
        error: `Setting "${name}" uses unsupported keywords: ${unknownField.join(", ")}.`,
      };
    }

    const type = rawField.type;
    if (typeof type !== "string" || !SUPPORTED_TYPES.has(type)) {
      return {
        ok: false,
        error: `Setting "${name}" has an unsupported type "${String(type)}".`,
      };
    }

    let options: string[] | undefined;
    if (rawField.enum !== undefined) {
      if (
        !Array.isArray(rawField.enum) ||
        rawField.enum.length === 0 ||
        rawField.enum.some((v) => typeof v !== "string")
      ) {
        return {
          ok: false,
          error: `Setting "${name}" has an enum that is not a non-empty list of strings.`,
        };
      }
      if (type !== "string") {
        // Reason: an enum on a numeric field would render as a select of numbers, which the
        // form does not build. Refusing is honest; rendering a free-text box beside a
        // declared enum would let an operator enter a value the provider rejects at launch.
        return {
          ok: false,
          error: `Setting "${name}" declares an enum on a ${type} field, which is not supported.`,
        };
      }
      options = rawField.enum as string[];
    }

    const minimum = numberOrUndefined(rawField.minimum);
    const maximum = numberOrUndefined(rawField.maximum);
    if (
      minimum !== undefined &&
      maximum !== undefined &&
      minimum > maximum
    ) {
      return {
        ok: false,
        error: `Setting "${name}" has a minimum above its maximum.`,
      };
    }

    fields.push({
      name,
      type: type as ConfigFieldType,
      required: requiredNames.has(name),
      title: typeof rawField.title === "string" ? rawField.title : undefined,
      description:
        typeof rawField.description === "string" ? rawField.description : undefined,
      minimum,
      maximum,
      options,
      default: rawField.default,
    });
  }

  // Reason: a name in `required` with no matching property is a provider mistake that
  // would otherwise produce a form the operator can never complete - the field is demanded
  // and never rendered.
  for (const name of requiredNames) {
    if (!fields.some((field) => field.name === name)) {
      return {
        ok: false,
        error: `The settings schema requires "${name}" but does not describe it.`,
      };
    }
  }

  return { ok: true, fields };
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  /** Present when ok. Contains ONLY declared fields, coerced to their declared types. */
  values: Record<string, unknown>;
}

/**
 * Validates operator answers against a parsed field list.
 *
 * UNDECLARED KEYS ARE DROPPED, NOT REJECTED, and the asymmetry with schema parsing is
 * intentional. An unsupported schema keyword means we cannot validate correctly, so it must
 * refuse. A stray key in the submitted values is just noise from a form or a stale client,
 * and passing it through to the provider is the actual risk - so it is discarded and the
 * saved settings contain exactly the declared fields.
 */
export function validateConfigValues(
  fields: ConfigField[],
  submitted: Record<string, unknown>,
): ValidationResult {
  const errors: string[] = [];
  const values: Record<string, unknown> = {};

  for (const field of fields) {
    const label = field.title ?? field.name;
    const raw = Object.prototype.hasOwnProperty.call(submitted, field.name)
      ? submitted[field.name]
      : undefined;

    const missing = raw === undefined || raw === null || raw === "";

    if (missing) {
      if (field.default !== undefined) {
        values[field.name] = field.default;
      } else if (field.required) {
        errors.push(`${label} is required.`);
      }
      continue;
    }

    if (field.type === "boolean") {
      if (typeof raw !== "boolean") {
        errors.push(`${label} must be true or false.`);
        continue;
      }
      values[field.name] = raw;
      continue;
    }

    if (field.type === "string") {
      if (typeof raw !== "string") {
        errors.push(`${label} must be text.`);
        continue;
      }
      if (field.options && !field.options.includes(raw)) {
        errors.push(`${label} must be one of: ${field.options.join(", ")}.`);
        continue;
      }
      values[field.name] = raw;
      continue;
    }

    // integer | number. A form submits strings, so coerce rather than reject outright -
    // but reject anything that is not fully numeric, so "10abc" cannot become 10.
    const numeric = typeof raw === "number" ? raw : Number(String(raw).trim());
    if (!Number.isFinite(numeric)) {
      errors.push(`${label} must be a number.`);
      continue;
    }
    if (field.type === "integer" && !Number.isInteger(numeric)) {
      errors.push(`${label} must be a whole number.`);
      continue;
    }
    if (field.minimum !== undefined && numeric < field.minimum) {
      errors.push(`${label} must be at least ${field.minimum}.`);
      continue;
    }
    if (field.maximum !== undefined && numeric > field.maximum) {
      errors.push(`${label} must be at most ${field.maximum}.`);
      continue;
    }
    values[field.name] = numeric;
  }

  return { ok: errors.length === 0, errors, values };
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
