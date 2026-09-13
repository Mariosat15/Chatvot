/**
 * Tests for the model mirror guard.
 *
 * Two things have to be true for this guard to be worth having, and both are tested
 * below:
 *   1. It FAILS on the kinds of drift that actually happened in this repository.
 *   2. It does NOT cry wolf on differences that do not matter - comments, key order,
 *      formatting, and Mongoose options that do not change the document shape. A guard
 *      that blocks commits for cosmetic reasons gets bypassed, and then it guards
 *      nothing.
 *
 * The last test runs the guard over the real repository, which is what CI enforces.
 */
import { describe, it, expect } from "vitest";
import path from "path";
import { comparePair, buildReport } from "@/tools/model-mirror/compare";
import { extractSchemaShape } from "@/tools/model-mirror/parse-schema";

const BASE = `
import { Schema, model } from "mongoose";
const ThingSchema = new Schema({
  name: { type: String, required: true },
  status: { type: String, enum: ["active", "closed"] },
  sectionVisibility: {
    hero: { type: Boolean, default: true },
    gameMaster: { type: Boolean, default: true },
  },
  winners: [{ rank: Number, userId: String }],
});
export default model("Thing", ThingSchema);
`;

describe("the guard fails on drift that really happened", () => {
  it("reports a top-level field missing from the admin copy", () => {
    const admin = BASE.replace(
      `  name: { type: String, required: true },\n`,
      "",
    );

    const result = comparePair("thing.model.ts", BASE, admin);

    expect(result.identical).toBe(false);
    expect(result.fieldDrift).toEqual([{ path: "name", side: "main-only" }]);
  });

  it("reports a top-level field missing from the main copy", () => {
    const main = BASE.replace(
      `  name: { type: String, required: true },\n`,
      "",
    );

    const result = comparePair("thing.model.ts", main, BASE);

    expect(result.identical).toBe(false);
    expect(result.fieldDrift).toEqual([{ path: "name", side: "admin-only" }]);
  });

  it("reports a missing ENUM VALUE, which a field-name check would miss", () => {
    // This is the platform-financials shape: same field, fewer allowed values. The
    // field-name comparison passes, so only a value comparison catches it - and this is
    // the case that rejects the write rather than dropping a field.
    const admin = BASE.replace(
      `enum: ["active", "closed"]`,
      `enum: ["active"]`,
    );

    const result = comparePair("thing.model.ts", BASE, admin);

    expect(result.identical).toBe(false);
    expect(result.fieldDrift).toEqual([]);
    expect(result.enumDrift).toEqual([
      { path: "status", value: "closed", side: "main-only" },
    ]);
  });

  it("reports a nested path missing from one copy", () => {
    // The hero-settings shape: the parent path exists on both sides, one child does not.
    const admin = BASE.replace(
      `    gameMaster: { type: Boolean, default: true },\n`,
      "",
    );

    const result = comparePair("thing.model.ts", BASE, admin);

    expect(result.fieldDrift).toEqual([
      { path: "sectionVisibility.gameMaster", side: "main-only" },
    ]);
  });

  it("reports a field missing from inside an array subdocument", () => {
    const admin = BASE.replace(
      `winners: [{ rank: Number, userId: String }]`,
      `winners: [{ rank: Number }]`,
    );

    const result = comparePair("thing.model.ts", BASE, admin);

    expect(result.fieldDrift).toEqual([
      { path: "winners.userId", side: "main-only" },
    ]);
  });
});

describe("the guard does not cry wolf", () => {
  it("ignores comments, key order, whitespace and Mongoose options", () => {
    // Everything here differs textually. Nothing here changes the document shape or the
    // set of values a field will accept, so none of it may be reported.
    const admin = `
import mongoose from "mongoose";

// Mirrored from the main app. Reordered and reformatted over time.
const ThingSchema = new mongoose.Schema(
  {
    winners: [
      {
        userId: String,
        rank: Number,
      },
    ],
    sectionVisibility: {
      gameMaster: { type: Boolean, default: false },  // different default
      hero: { type: Boolean, default: true, index: true },
    },
    status: {
      type: String,
      enum: ["closed", "active"],   // different order
      default: "active",
    },
    name: { type: String, required: false, trim: true, maxlength: 200 },
  },
  { timestamps: true },
);

export default mongoose.model("Thing", ThingSchema);
`;

    const result = comparePair("thing.model.ts", BASE, admin);

    expect(result.fieldDrift).toEqual([]);
    expect(result.enumDrift).toEqual([]);
    expect(result.identical).toBe(true);
  });

  it("treats the type:{...} subdocument form as equivalent to a nested path", () => {
    // Mongoose accepts both spellings for the same document shape. The two apps do not
    // always use the same one, so the guard must not treat that as drift.
    const nested = `
import { Schema } from "mongoose";
new Schema({
  marginSettings: {
    liquidation: { type: Number, default: 50 },
    call: { type: Number, default: 80 },
  },
});
`;
    const viaTypeKey = `
import { Schema } from "mongoose";
new Schema({
  marginSettings: {
    type: {
      liquidation: { type: Number, default: 50 },
      call: { type: Number, default: 80 },
    },
    required: false,
  },
});
`;

    const result = comparePair("thing.model.ts", nested, viaTypeKey);

    expect(result.fieldDrift).toEqual([]);
    expect(result.identical).toBe(true);
  });

  it("skips an enum it cannot resolve statically instead of guessing", () => {
    const computed = `
import { Schema } from "mongoose";
new Schema({ kind: { type: String, enum: Object.values(Kinds) } });
`;
    const literal = `
import { Schema } from "mongoose";
new Schema({ kind: { type: String, enum: ["a", "b"] } });
`;

    const result = comparePair("thing.model.ts", computed, literal);

    // Reported as unchecked rather than as agreement or as drift, so the limitation is
    // visible in the output instead of being silently assumed away.
    expect(result.skippedEnums).toEqual(["kind"]);
    expect(result.enumDrift).toEqual([]);
    expect(result.identical).toBe(true);
  });
});

describe("the allowlist suppresses only what it names", () => {
  it("suppresses the allowlisted field but still reports its neighbours", () => {
    // admin.model.ts is the one real allowlist entry: the main app never writes an
    // Admin document, so its staff-only fields are deliberate.
    const main = `
import { Schema } from "mongoose";
new Schema({ email: String, password: String, name: String });
`;
    const admin = `
import { Schema } from "mongoose";
new Schema({
  email: String,
  password: String,
  name: String,
  role: String,
  isLockedOut: Boolean,
  somethingNobodyDeclared: String,
});
`;

    const result = comparePair("admin.model.ts", main, admin);

    // role and isLockedOut are named in the allowlist, so they are suppressed.
    expect(result.allowedCount).toBe(2);
    // The field that is NOT named is still reported - the entry is not a blanket pass.
    expect(result.fieldDrift).toEqual([
      { path: "somethingNobodyDeclared", side: "admin-only" },
    ]);
    expect(result.identical).toBe(false);
  });
});

describe("the schema parser", () => {
  it("records array-of-primitive as one field, not as its element", () => {
    const shape = extractSchemaShape(
      `import { Schema } from "mongoose";
       new Schema({ tags: [String], allowed: { type: [String], default: [] } });`,
      "t.ts",
    );

    expect([...shape.fields].sort()).toEqual(["allowed", "tags"]);
  });

  it("attaches an enum declared on an array element to the array path", () => {
    const shape = extractSchemaShape(
      `import { Schema } from "mongoose";
       new Schema({ classes: [{ type: String, enum: ["forex", "crypto"] }] });`,
      "t.ts",
    );

    expect([...shape.fields]).toEqual(["classes"]);
    expect([...(shape.enums.get("classes") ?? [])].sort()).toEqual([
      "crypto",
      "forex",
    ]);
  });
});

describe("the real repository", () => {
  it("has no drift between the two apps' model copies", () => {
    const report = buildReport(path.resolve(__dirname, "..", ".."));

    // Guards the guard: if pair discovery silently broke, this would pass vacuously.
    expect(report.totals.mirrored).toBeGreaterThan(70);

    const summary = report.drifted
      .map(
        (pair) =>
          `${pair.relativePath}: ` +
          [
            ...pair.fieldDrift.map((d) => `${d.path} (${d.side})`),
            ...pair.enumDrift.map(
              (d) => `${d.path}="${d.value}" (${d.side})`,
            ),
          ].join(", "),
      )
      .join("\n");

    expect(summary).toBe("");
  });
});
