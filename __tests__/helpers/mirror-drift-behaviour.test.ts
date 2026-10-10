/**
 * Establishes what a schema that is MISSING a field actually does to that field, using
 * a real MongoDB rather than reasoning about Mongoose's documentation.
 *
 * Reason this exists: the Stage 0 plan justifies fixing the admin model mirrors, and
 * the justification decides how urgent the work is. Measuring it changed the answer.
 * The plan had said a save from the app with the narrower schema strips fields the
 * other app wrote. It does not. What actually happens, in descending order of harm:
 *
 *   1. A missing ENUM VALUE rejects the entire write. The record is never created.
 *   2. The narrower app cannot WRITE the field at all - the assignment is dropped in
 *      silence, so a feature that sets it simply does not work. This is real and live:
 *      the main app wrote failedAt/failedReason on every failed withdrawal for months
 *      into a schema that never declared them.
 *   3. replaceOne / findOneAndReplace DO destroy undeclared fields, because they send
 *      a whole document.
 *   4. An ordinary save() of a loaded document does NOT destroy them.
 *   5. Reads do NOT hide them - they survive in the document either way.
 *
 * So drift is a write-side defect, not a read-side one. That is why the guard has to
 * compare enum values and not just field names.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import mongoose, { Schema } from "mongoose";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
} from "./mongo-test-server";

/** Stands in for the app that declares every field - e.g. the main app. */
const WIDE_DEFINITION = {
  name: String,
  gameMasterTitle: String,
  sectionVisibility: {
    liveStats: Boolean,
    gameMaster: Boolean,
  },
};

/** Stands in for the app whose copy has drifted - e.g. apps/admin. */
const NARROW_DEFINITION = {
  name: String,
  sectionVisibility: {
    liveStats: Boolean,
  },
};

const COLLECTION = "mirrortests";

let modelCounter = 0;
function uniqueName(prefix: string): string {
  modelCounter += 1;
  return `${prefix}_${modelCounter}`;
}

function wideModel() {
  return mongoose.model(
    uniqueName("Wide"),
    new Schema(WIDE_DEFINITION, { collection: COLLECTION }),
  );
}

function narrowModel() {
  return mongoose.model(
    uniqueName("Narrow"),
    new Schema(NARROW_DEFINITION, { collection: COLLECTION }),
  );
}

/** Reads the stored document straight from the driver, bypassing every schema. */
async function readRaw(): Promise<Record<string, unknown> | null> {
  const db = mongoose.connection.db;
  if (!db) throw new Error("not connected");
  return db.collection(COLLECTION).findOne({});
}

async function seedWideDocument(): Promise<void> {
  await wideModel().create({
    name: "landing",
    gameMasterTitle: "Become a Game Master",
    sectionVisibility: { liveStats: true, gameMaster: true },
  });
}

describe("what a drifted model copy does to the fields it does not declare", () => {
  beforeAll(async () => {
    await startTestMongo();
  }, 120_000);

  afterAll(async () => {
    await stopTestMongo();
  });

  afterEach(async () => {
    await clearTestMongo();
    for (const name of Object.keys(mongoose.models)) {
      if (name.startsWith("Wide_") || name.startsWith("Narrow_")) {
        Reflect.deleteProperty(mongoose.models, name);
      }
    }
  });

  // ---- Harm 1: the severe one -------------------------------------------------

  it("rejects the whole write when an enum value is missing from its copy", async () => {
    const wide = mongoose.model(
      uniqueName("Wide"),
      new Schema(
        { kind: { type: String, enum: ["refund", "custom_expense"] } },
        { collection: COLLECTION },
      ),
    );
    const narrow = mongoose.model(
      uniqueName("Narrow"),
      new Schema(
        { kind: { type: String, enum: ["refund"] } },
        { collection: COLLECTION },
      ),
    );

    await expect(wide.create({ kind: "custom_expense" })).resolves.toBeTruthy();

    // Reason: this is the difference that matters most, and the reason the guard
    // compares enum VALUES rather than only field names. A missing field is silent;
    // a missing enum value fails the write, so the money transaction that needed
    // recording is never recorded at all.
    await expect(narrow.create({ kind: "custom_expense" })).rejects.toThrow(
      /validation failed/i,
    );
  });

  // ---- Harm 2: silent write loss ----------------------------------------------

  it("drops an undeclared field on create - the write never reaches the database", async () => {
    await narrowModel().create({
      name: "landing",
      gameMasterTitle: "Become a Game Master",
      sectionVisibility: { liveStats: true, gameMaster: true },
    } as Record<string, unknown>);

    const raw = await readRaw();

    expect(raw?.name).toBe("landing");
    expect(raw).not.toHaveProperty("gameMasterTitle");
    // Nested paths are filtered too, even though the parent path does exist.
    expect(raw?.sectionVisibility).toEqual({ liveStats: true });
  });

  it("drops an undeclared field assigned onto a loaded document before save", async () => {
    await seedWideDocument();

    // This is exactly what apps/admin/app/api/hero-settings/route.ts does: load the
    // singleton, Object.assign the request body over it, save. An admin UI that posted
    // a field the admin schema lacks would appear to succeed and change nothing.
    const Narrow = narrowModel();
    const loaded = await Narrow.findOne({ name: "landing" });
    if (!loaded) throw new Error("expected the document");
    Object.assign(loaded, { gameMasterTitle: "Edited by admin" });
    await loaded.save();

    const raw = await readRaw();
    expect(raw?.gameMasterTitle).toBe("Become a Game Master");
  });

  it("drops an undeclared field in an update operator", async () => {
    await seedWideDocument();

    await narrowModel().updateOne(
      { name: "landing" },
      { $set: { gameMasterTitle: "Edited by admin" } },
    );

    const raw = await readRaw();
    expect(raw?.gameMasterTitle).toBe("Become a Game Master");
  });

  // ---- Harm 3: replacement really does destroy --------------------------------

  it("deletes the undeclared field when it replaces the document", async () => {
    await seedWideDocument();

    await narrowModel().replaceOne(
      { name: "landing" },
      { name: "landing-replaced" },
    );

    const raw = await readRaw();

    expect(raw?.name).toBe("landing-replaced");
    // Reason: replaceOne and findOneAndReplace send a whole document. Anything the
    // narrower schema could not set is absent from that document, so it is removed.
    expect(raw).not.toHaveProperty("gameMasterTitle");
  });

  // ---- What does NOT happen, recorded so the plan stops claiming it ------------

  it("does NOT delete the undeclared field on an ordinary save of a loaded document", async () => {
    await seedWideDocument();

    const Narrow = narrowModel();
    const loaded = await Narrow.findOne({ name: "landing" });
    if (!loaded) throw new Error("expected the document");
    loaded.set("name", "landing-edited");
    await loaded.save();

    const raw = await readRaw();

    expect(raw?.name).toBe("landing-edited");
    // Reason: save() issues $set for modified paths only, so untouched fields the
    // schema never declared survive. Correcting this was the point of the exercise -
    // the plan had claimed the opposite and used it to rank the defect's severity.
    expect(raw?.gameMasterTitle).toBe("Become a Game Master");
    expect(raw?.sectionVisibility).toEqual({
      liveStats: true,
      gameMaster: true,
    });
  });

  it("does NOT hide the undeclared field from reads, hydrated or lean", async () => {
    await seedWideDocument();
    const Narrow = narrowModel();

    const hydrated = await Narrow.findOne({ name: "landing" });
    const asObject = hydrated?.toObject() as Record<string, unknown>;
    const lean = (await Narrow.findOne({ name: "landing" }).lean()) as Record<
      string,
      unknown
    >;

    // Reason: strict mode filters what is WRITTEN, not what is loaded. Both read
    // shapes still carry the value, so a read looks perfectly healthy while every
    // write through the same model silently drops the field. Never use a read to
    // argue that two model copies agree - that is what the guard is for.
    expect(asObject.gameMasterTitle).toBe("Become a Game Master");
    expect(lean.gameMasterTitle).toBe("Become a Game Master");
  });

  it("DOES hide the undeclared field from ordinary property access", async () => {
    await seedWideDocument();
    const Narrow = narrowModel();

    const hydrated = (await Narrow.findOne({ name: "landing" })) as unknown as {
      gameMasterTitle?: string;
    } | null;

    // Reason: this is the read that application code actually writes, and it is the
    // one exception to the test above. Mongoose defines getters only for declared
    // paths, so the value sits in the document's internals, reachable through
    // toObject() and .lean(), but `doc.field` is undefined. That combination is what
    // makes drift so hard to spot: a debug dump of the document shows the value,
    // while the line of code next to it reads undefined and takes the wrong branch.
    //
    // Measured consequence in this repo: three admin routes did
    // `settings?.brandingFiles?.has(filename)` against a schema that did not declare
    // brandingFiles, so the guard was permanently false and the branch never ran.
    expect(hydrated?.gameMasterTitle).toBeUndefined();
  });
});
