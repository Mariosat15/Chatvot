import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import {
  startTestMongo,
  stopTestMongo,
  clearTestMongo,
} from "../helpers/mongo-test-server";
import {
  putBrandingAsset,
  readBrandingAsset,
  deleteBrandingAsset,
  MAX_BRANDING_ASSET_BYTES,
} from "@/lib/services/branding-assets.service";
import { encodeBrandingFileKey } from "@/lib/utils/branding-file-key";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import { BrandingAsset } from "@/database/models/branding-asset.model";
import { migrateBrandingFiles } from "../../tools/branding/migrate-branding-files-core";

/**
 * Every uploaded image used to be base64-encoded into one entry of the `brandingFiles` map on
 * the single shared `WhiteLabel` document. On 8 September 2026 that document reached
 * 17,070,874 bytes on a game-logo upload, MongoDB refused the write, and from that moment NO
 * image on the platform could be stored - the operator's screen said the file had saved to
 * disk but could not be copied to the database, which is exactly what had happened.
 *
 * The store is now one document per file. These tests are behavioural, against a real
 * MongoDB, because every claim here is about what is STORED: a structural check cannot see
 * the difference between a write that reported success and one that landed, which is the
 * distinction the whole defect turns on.
 */

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAA0lEQVQI12P4z8BQDwAEgAF/QualzQAAAABJRU5ErkJggg==",
  "base64",
);

beforeAll(async () => {
  const uri = await startTestMongo();
  // Reason: the service calls `connectToDatabase()`, which throws when `MONGODB_URI` is
  // unset - and the message it throws reads like a defect in the code under test.
  process.env.MONGODB_URI = uri;
}, 120_000);

afterAll(async () => {
  await stopTestMongo();
});

afterEach(async () => {
  await clearTestMongo();
});

/** Writes a legacy map entry exactly as the upload routes did before 8 September 2026. */
async function writeLegacyEntry(filename: string, data: Buffer): Promise<void> {
  const settings = new WhiteLabel();
  settings.brandingFiles = new Map();
  settings.brandingFiles.set(encodeBrandingFileKey(filename), {
    data: data.toString("base64"),
    contentType: "image/png",
    updatedAt: new Date(),
  });
  await settings.save();
}

describe("where an uploaded image is stored", () => {
  it("puts each image in its own document, so no single document can fill up", async () => {
    // Reason: this is the whole fix, and it is worth asserting as a COUNT rather than as
    // "the image can be read back". Two images in two documents is the property; two
    // images that happen to be readable is also true of the store that broke.
    await putBrandingAsset("game-logo-a.png", PNG, "image/png");
    await putBrandingAsset("game-logo-b.png", PNG, "image/png");

    expect(await BrandingAsset.countDocuments()).toBe(2);
  });

  it("does not touch the settings document at all", async () => {
    // Reason: the failure the owner hit was a write to `WhiteLabel`. A fix that still wrote
    // there - a smaller entry, a compressed one - would fail again on the next upload, so
    // the assertion is that the shared document is not written, not that it is smaller.
    const before = new WhiteLabel();
    await before.save();
    const stamp = before.updatedAt;

    await putBrandingAsset("game-logo.png", PNG, "image/png");

    const after = await WhiteLabel.findById(before._id).select("+brandingFiles");
    expect(after?.updatedAt).toEqual(stamp);
    expect(after?.brandingFiles?.size ?? 0).toBe(0);
  });

  it("replaces rather than duplicates when the same filename is stored twice", async () => {
    const bigger = Buffer.concat([PNG, PNG]);
    await putBrandingAsset("logo.png", PNG, "image/png");
    await putBrandingAsset("logo.png", bigger, "image/png");

    expect(await BrandingAsset.countDocuments({ filename: "logo.png" })).toBe(1);
    const stored = await readBrandingAsset("logo.png");
    expect(stored?.data.length).toBe(bigger.length);
  });

  it("refuses a file over the per-file limit, rather than failing at the driver", async () => {
    // Reason: a limit the caller can report is the difference between "this picture is too
    // big", which an operator can act on, and "the platform has run out of pictures", which
    // is what the shared document said. The number is a backstop below MongoDB's 16MB
    // document cap with base64's one-third inflation accounted for.
    const oversize = Buffer.alloc(MAX_BRANDING_ASSET_BYTES + 1);
    await expect(
      putBrandingAsset("huge.png", oversize, "image/png"),
    ).rejects.toThrow(/limit/i);
    expect(await BrandingAsset.countDocuments()).toBe(0);
  });

  it("stores the decoded size, not the base64 length", async () => {
    await putBrandingAsset("logo.png", PNG, "image/png");
    const row = await BrandingAsset.findOne({ filename: "logo.png" });
    expect(row?.bytes).toBe(PNG.length);
  });
});

describe("reading an image back", () => {
  it("finds one stored in the collection", async () => {
    await putBrandingAsset("logo.png", PNG, "image/png");
    const found = await readBrandingAsset("logo.png");
    expect(found?.contentType).toBe("image/png");
    expect(found?.data.equals(PNG)).toBe(true);
  });

  it("still finds one left in the legacy map", async () => {
    // Reason: the fallback is what stops the change losing every image uploaded before it.
    // A reader wired only to the new collection passes every test above and serves nothing
    // an operator uploaded in the platform's whole history to date.
    await writeLegacyEntry("old-hero.png", PNG);

    const found = await readBrandingAsset("old-hero.png");
    expect(found?.data.equals(PNG)).toBe(true);
  });

  it("prefers the collection when both stores hold the same filename", async () => {
    // Reason: a file re-uploaded since the change exists in both places, and the map's copy
    // is the stale one. Seeded with DIFFERENT bytes on purpose - with identical bytes the
    // wrong branch returns the right answer and the test cannot tell them apart.
    const newer = Buffer.concat([PNG, PNG]);
    await writeLegacyEntry("logo.png", PNG);
    await putBrandingAsset("logo.png", newer, "image/png");

    const found = await readBrandingAsset("logo.png");
    expect(found?.data.length).toBe(newer.length);
  });

  it("returns null for a filename neither store has", async () => {
    expect(await readBrandingAsset("never-uploaded.png")).toBeNull();
  });
});

describe("deleting an image", () => {
  it("removes it from both stores, so it cannot be served back", async () => {
    // Reason: missing either store leaves the asset routes restoring a file the operator
    // has deleted - and restoring it to disk, so it comes back permanently.
    await writeLegacyEntry("hero.png", PNG);
    await putBrandingAsset("hero.png", PNG, "image/png");

    expect(await deleteBrandingAsset("hero.png")).toBe(true);
    expect(await readBrandingAsset("hero.png")).toBeNull();
  });

  it("reports false when there was nothing to remove", async () => {
    expect(await deleteBrandingAsset("absent.png")).toBe(false);
  });
});

describe("the settings document stops carrying every image", () => {
  it("an ordinary settings read does not fetch the map", async () => {
    // Reason: 67 files call `WhiteLabel.findOne()`, and until 8 September 2026 every one of
    // them transferred a base64 copy of every image ever uploaded - by then the far side of
    // 16MB. `select: false` is the fix, and it is only safe because the four routes that do
    // want the map now go through one service.
    await writeLegacyEntry("old.png", PNG);

    const plain = await WhiteLabel.findOne();
    expect(plain?.brandingFiles).toBeUndefined();

    const asked = await WhiteLabel.findOne().select("+brandingFiles");
    expect(asked?.brandingFiles?.size).toBe(1);
  });
});

describe("the migration out of the map", () => {
  it("copies an entry across and clears it, so the document shrinks", async () => {
    await writeLegacyEntry("old-hero.png", PNG);

    const outcome = await migrateBrandingFiles(mongoose.connection, { apply: true });

    expect(outcome.cleared).toBe(1);
    const stored = await BrandingAsset.findOne({ filename: "old-hero.png" });
    expect(stored?.data).toBe(PNG.toString("base64"));

    const settings = await WhiteLabel.findOne().select("+brandingFiles");
    expect(settings?.brandingFiles?.size ?? 0).toBe(0);
  });

  it("changes nothing at all without --apply", async () => {
    // Reason: report-only is the only mode this has ever been run in, and the report must
    // be trustworthy enough to decide on. A dry run that copies is not a dry run.
    await writeLegacyEntry("old-hero.png", PNG);

    const outcome = await migrateBrandingFiles(mongoose.connection, { apply: false });

    expect(outcome.clearable).toBe(1);
    expect(outcome.cleared).toBe(0);
    expect(await BrandingAsset.countDocuments()).toBe(0);
    const settings = await WhiteLabel.findOne().select("+brandingFiles");
    expect(settings?.brandingFiles?.size).toBe(1);
  });

  it("never overwrites a newer collection entry with the map's stale copy", async () => {
    // Reason: the map's copy of a re-uploaded file is the OLD picture. Copying it over the
    // new one restores an image the operator has already replaced - and it reads as
    // correct, because the migration's job is to copy. Seeded with different bytes, or the
    // wrong behaviour produces the right result.
    const newer = Buffer.concat([PNG, PNG]);
    await writeLegacyEntry("logo.png", PNG);
    await putBrandingAsset("logo.png", newer, "image/png");

    await migrateBrandingFiles(mongoose.connection, { apply: true });

    const stored = await readBrandingAsset("logo.png");
    expect(stored?.data.length).toBe(newer.length);
    // The stale map entry is still cleared, because it is the stale one.
    const settings = await WhiteLabel.findOne().select("+brandingFiles");
    expect(settings?.brandingFiles?.size ?? 0).toBe(0);
  });

  it("leaves an entry with no data, and reports it", async () => {
    // Reason: there is nothing to copy, and clearing it would be the only operation in the
    // migration that destroys information rather than moving it.
    const settings = new WhiteLabel();
    await settings.save();
    // Reason: the key is built with the real helper, never as a literal. A hard-coded
    // encoded string passes even if the migration's decode and the writers' encode have
    // stopped agreeing, which is the one thing that would strand every legacy image.
    await mongoose.connection.collection("whitelabels").updateOne(
      { _id: settings._id },
      {
        $set: {
          [`brandingFiles.${encodeBrandingFileKey("broken.png")}`]: {
            contentType: "image/png",
          },
        },
      },
    );

    const outcome = await migrateBrandingFiles(mongoose.connection, { apply: true });

    expect(outcome.files).toEqual([
      { filename: "broken.png", bytes: 0, outcome: "empty" },
    ]);
    const reread = await WhiteLabel.findOne().select("+brandingFiles");
    expect(reread?.brandingFiles?.size).toBe(1);
  });

  it("reports the space the map is holding, which is why it must be drained", async () => {
    await writeLegacyEntry("old.png", PNG);
    const outcome = await migrateBrandingFiles(mongoose.connection, { apply: false });
    expect(outcome.totalBytes).toBe(PNG.length);
  });

  it("does nothing when there is no settings document", async () => {
    const outcome = await migrateBrandingFiles(mongoose.connection, { apply: true });
    expect(outcome.files).toEqual([]);
    expect(outcome.cleared).toBe(0);
  });
});

describe("the two copies of the service", () => {
  it("are byte-identical", () => {
    // Reason: `check:mirrors` compares MODELS, so it has no opinion about this file - and a
    // write side and a read side disagreeing about where the bytes live is the "one rule,
    // two copies" shape behind several defects here already. The admin app is the only
    // writer and the player app is a reader, so a drift is exactly the case where images
    // save and never appear.
    const main = fs.readFileSync(
      path.join(process.cwd(), "lib/services/branding-assets.service.ts"),
      "utf8",
    );
    const admin = fs.readFileSync(
      path.join(process.cwd(), "apps/admin/lib/services/branding-assets.service.ts"),
      "utf8",
    );
    expect(admin).toBe(main);
  });

  it("declare the same model, so both apps read one collection", () => {
    const main = fs.readFileSync(
      path.join(process.cwd(), "database/models/branding-asset.model.ts"),
      "utf8",
    );
    const admin = fs.readFileSync(
      path.join(process.cwd(), "apps/admin/database/models/branding-asset.model.ts"),
      "utf8",
    );
    expect(admin).toBe(main);
    // An explicit collection name, because a guessed pluralisation is how one app writes to
    // `brandingassets` while the other reads `branding_asset` with everything green.
    expect(main).toContain('collection: "branding_asset"');
  });
});

describe("no writer reaches past the service", () => {
  const writers = [
    "apps/admin/lib/admin/game-artwork-storage.ts",
    "apps/admin/app/api/images/upload/route.ts",
    "apps/admin/app/api/hero-settings/upload/route.ts",
  ];
  const readers = [
    "app/api/assets/images/[filename]/route.ts",
    "app/api/assets/hero/[filename]/route.ts",
    "apps/admin/app/api/assets/images/[filename]/route.ts",
    "apps/admin/app/api/assets/hero/[filename]/route.ts",
  ];

  /** Comments name `brandingFiles` deliberately, so a bare match reads prose as code. */
  function withoutComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  }

  it.each([...writers, ...readers])("%s does not touch brandingFiles itself", (file) => {
    // Reason: the field is `select: false` now, so a route reaching for it directly reads
    // `undefined` and reports the image as missing - no error, no log line, and it looks
    // exactly like a file that was never uploaded.
    const source = withoutComments(
      fs.readFileSync(path.join(process.cwd(), file), "utf8"),
    );
    expect(source).not.toContain("brandingFiles");
  });

  it.each(writers)("%s stores through putBrandingAsset", (file) => {
    const source = withoutComments(
      fs.readFileSync(path.join(process.cwd(), file), "utf8"),
    );
    expect(source).toMatch(/putBrandingAsset\(/);
  });

  it.each(readers)("%s reads through readBrandingAsset", (file) => {
    const source = withoutComments(
      fs.readFileSync(path.join(process.cwd(), file), "utf8"),
    );
    expect(source).toMatch(/readBrandingAsset\(/);
  });
});
