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

/**
 * The roles a setting may declare, so the platform can understand one of a title's own
 * settings WITHOUT knowing its name.
 *
 * WHY THIS KEYWORD EXISTS AT ALL. The platform has to know how long one attempt lasts. It
 * decides when the last attempt of a contest may start, what the operator is told about the
 * two clocks relating, and how much result grace a contest needs. Until now it used
 * `maxDurationSeconds` from the catalogue - the title's CEILING - because the alternative was
 * reading a setting by name, and `durationSeconds` is Circuit Sprint's name for it. A platform
 * that reads `durationSeconds` works for one provider's titles and silently does the wrong
 * thing for the next one, which is the whole failure mode the schema-driven form exists to
 * avoid. A test forbids that name appearing in platform code, and it should stay forbidden.
 *
 * The ceiling was not a free choice either: reserving 300 seconds on a contest configured for
 * 120 refused every attempt of any contest shorter than five minutes, from the instant it
 * opened, while a countdown beside it said minutes remained.
 *
 * A DECLARED ROLE RESOLVES BOTH. The provider says which of its settings is the play clock;
 * the platform reads that field generically, exactly as the form already branches on a field's
 * declared TYPE rather than its name. Neither side learns the other's vocabulary.
 *
 * `format` is real JSON Schema rather than an invented `x-` keyword, so a provider using a
 * standard validator is not surprised by it - but the recognised VALUES are ours, and an
 * unrecognised one is a refusal like every other unsupported construct here. A format we
 * silently ignored would be worse than none: the provider would believe they had told us
 * something load-bearing.
 */
export const CONFIG_FIELD_FORMATS = ["duration-seconds"] as const;
export type ConfigFieldFormat = (typeof CONFIG_FIELD_FORMATS)[number];

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
  /** A declared role. See `CONFIG_FIELD_FORMATS`. */
  format?: ConfigFieldFormat;
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
  "format",
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

    let format: ConfigFieldFormat | undefined;
    if (rawField.format !== undefined) {
      if (
        typeof rawField.format !== "string" ||
        !CONFIG_FIELD_FORMATS.includes(rawField.format as ConfigFieldFormat)
      ) {
        return {
          ok: false,
          error: `Setting "${name}" declares an unsupported format "${String(rawField.format)}".`,
        };
      }
      // Reason: every recognised format so far describes a quantity, and the platform reads
      // the value as a number. A `duration-seconds` on a string field would parse here and
      // then produce `NaN` at the one place that matters - the gate deciding when the last
      // attempt may start - which fails open rather than visibly.
      if (type !== "integer" && type !== "number") {
        return {
          ok: false,
          error: `Setting "${name}" declares the format "${rawField.format}" on a ${type} field, which is not supported.`,
        };
      }
      format = rawField.format as ConfigFieldFormat;
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
      format,
    });
  }

  // Reason: a declared role has to identify ONE field or it identifies none. Two settings
  // both claiming to be the play clock would leave the gate picking whichever the object
  // happened to enumerate first - a coin flip that reads as working, and that could change
  // between titles from the same provider. Refusing puts the question back where it can be
  // answered.
  const duplicateFormats = CONFIG_FIELD_FORMATS.filter(
    (candidate) => fields.filter((field) => field.format === candidate).length > 1,
  );
  if (duplicateFormats.length > 0) {
    return {
      ok: false,
      error: `The settings schema declares more than one field with the format: ${duplicateFormats.join(", ")}.`,
    };
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

/**
 * How long one attempt lasts, according to the settings this contest was saved with.
 *
 * THE ONE READER OF A GAME'S OWN SETTING, AND IT NEVER NAMES ONE. The field is found by the
 * role the title declared (`CONFIG_FIELD_FORMATS`), so a second provider whose clock is called
 * `timeLimit` or `sessionLength` works with no release. Callers must go through this rather
 * than reaching into `settings` themselves, or the name leaks back into platform code one
 * screen at a time.
 *
 * UNDEFINED MEANS "THIS TITLE DID NOT SAY", NEVER A GUESS. A title with no declared clock -
 * a puzzle you finish when you finish - has no answer here, and every caller falls back to
 * the catalogue ceiling, which is the behaviour that existed before this function did. An
 * invented default would put a deadline in front of players that no game enforces.
 *
 * THE VALUE IS CLAMPED TO THE DECLARED RANGE because that is what the provider will do with
 * it. `resolveConfig` on the game side clamps rather than refusing, deliberately, so a stored
 * setting that fell out of range when a schema narrowed produces a SHORTER round than the
 * number says. Reserving the unclamped figure would then hold back time the attempt never
 * uses; reserving the clamped one matches what actually runs.
 */
export function resolvePlayDurationSeconds(
  fields: ConfigField[],
  settings: Record<string, unknown> | undefined,
): number | undefined {
  const field = fields.find((candidate) => candidate.format === "duration-seconds");
  if (!field) return undefined;

  const submitted =
    settings && Object.prototype.hasOwnProperty.call(settings, field.name)
      ? settings[field.name]
      : undefined;

  const raw =
    submitted === undefined || submitted === null || submitted === ""
      ? field.default
      : submitted;

  const numeric = typeof raw === "number" ? raw : Number(String(raw ?? "").trim());
  if (!Number.isFinite(numeric) || numeric <= 0) return undefined;

  const clamped = Math.min(
    field.maximum ?? numeric,
    Math.max(field.minimum ?? numeric, numeric),
  );
  return clamped > 0 ? Math.ceil(clamped) : undefined;
}

/**
 * How long one attempt of THIS contest lasts - the single question four different screens and
 * two gates were each answering differently.
 *
 * The declared play clock when the title has one, and the catalogue ceiling when it does not.
 *
 * THE FALLBACK DIRECTION IS THE SAFE ONE AND IS NOT ARBITRARY. The ceiling is always greater
 * than or equal to the configured length, so falling back to it RESERVES MORE time, never
 * less. A caller that ends up on the fallback refuses an attempt that would in fact have
 * fitted - which someone notices and complains about - where the opposite mistake admits an
 * attempt the contest end cuts short, and nobody notices until a player disputes a prize.
 *
 * IT RETURNS UNDEFINED RATHER THAN A NUMBER WHEN NEITHER IS KNOWN, and callers must keep
 * treating that as "apply no gate". A title whose length nobody can state is not a title with
 * a length of zero, and a zero here produces a cut-off equal to the contest end: it reads
 * correctly on screen and gates nothing.
 */
export function resolveAttemptSeconds(
  fields: ConfigField[],
  settings: Record<string, unknown> | undefined,
  catalogueMaxSeconds: number | undefined,
): number | undefined {
  const declared = resolvePlayDurationSeconds(fields, settings);
  if (declared !== undefined) return declared;
  return typeof catalogueMaxSeconds === "number" && catalogueMaxSeconds > 0
    ? catalogueMaxSeconds
    : undefined;
}

/**
 * The same answer, from a raw `configSchema` that has not been parsed yet.
 *
 * A convenience for the two services that read a `provider_game` row directly and have no
 * other use for the parsed field list. It swallows a parse failure into the fallback ON
 * PURPOSE: an unparseable schema is already refused at contest creation, so a contest holding
 * one is a contest that predates the schema changing - and refusing to launch a round that a
 * player has paid for, because of a provider's later edit, is the wrong end to fail at. The
 * fallback over-reserves, which is the visible direction.
 */
export function resolveAttemptSecondsFromSchema(
  rawSchema: unknown,
  settings: Record<string, unknown> | undefined,
  catalogueMaxSeconds: number | undefined,
): number | undefined {
  const parsed = parseConfigSchema(rawSchema);
  return resolveAttemptSeconds(
    parsed.ok ? parsed.fields : [],
    settings,
    catalogueMaxSeconds,
  );
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
