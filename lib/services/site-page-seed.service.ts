import SitePage from "@/database/models/site-page.model";
import {
  ALL_DEFAULT_PAGES,
  type DefaultPage,
} from "@/lib/constants/default-pages";
import { connectToDatabase } from "@/database/mongoose";

/**
 * Read saved page defaults from data/defaults/pages.json (file system).
 * Uses dynamic import to avoid bundling fs in client code.
 */
function getDefaultPagesFromFile(): DefaultPage[] | null {
  try {
    const path = require("path");
    const fs = require("fs");
    const cwd = process.cwd();
    const filePath = path.join(cwd, "data", "defaults", "pages.json");
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);
    return Array.isArray(data) && data.length > 0 ? data : null;
  } catch {
    return null;
  }
}

/**
 * Build a seed-ready document from a DefaultPage definition.
 * Reason: Centralizes the mapping so both fresh-DB and sync paths
 * produce identical documents including the new `category` field.
 */
function toSeedDoc(page: DefaultPage) {
  return {
    slug: page.slug,
    title: page.title,
    subtitle: page.subtitle || "",
    sections: page.sections,
    isActive: true,
    isSystem: page.isSystem,
    category: page.category || "page",
    showEveryTime: page.showEveryTime ?? true,
    // Reason: only written when the source declares one - an unversioned page stays
    // unversioned rather than claiming a version nobody assigned (s2.4).
    ...(typeof page.version === "string" && page.version ? { version: page.version } : {}),
    seoTitle: page.seoTitle || "",
    seoDescription: page.seoDescription || "",
  };
}

/**
 * Saved defaults plus any built-in system page the file predates.
 * Reason: `pages.json` is a snapshot of the database on the day an operator saved it, so a
 * system page added to the constants later (the Gamemaster terms, `24` s5.1) would never be
 * seeded on any deployment that has saved defaults - and Join GM fails closed without it.
 * Only missing slugs are added; nothing in the file is overridden.
 */
export function withMissingSystemPages(saved: DefaultPage[]): DefaultPage[] {
  const present = new Set(saved.map((p) => p.slug));
  const missing = ALL_DEFAULT_PAGES.filter((p) => p.isSystem && !present.has(p.slug));
  return missing.length > 0 ? [...saved, ...missing] : saved;
}

type StoredSection = { id?: string; type?: string; title?: string; content?: string; order?: number };

function sectionsKey(sections: StoredSection[] | undefined): string {
  return JSON.stringify(
    (sections ?? [])
      .map((s) => [s.id ?? "", s.type ?? "", s.title ?? "", s.content ?? "", s.order ?? 0])
      .sort((a, b) => Number(a[4]) - Number(b[4])),
  );
}

/**
 * Whether a stored system page is still an earlier built-in wording, untouched, and so may be
 * replaced by the current one.
 * Reason: the seed never overwrites a page, so a built-in wording change (the fairness rules
 * in the competition entry terms) would otherwise reach no existing database. Matching the
 * old text exactly is what keeps an operator's own wording safe - an edited page never matches.
 */
export function upgradeableSystemPage(
  page: DefaultPage,
  stored: { sections?: StoredSection[]; isSystem?: boolean },
): boolean {
  if (!page.isSystem || stored.isSystem === false) return false;
  const previous = page.replacesUneditedSections ?? [];
  if (previous.length === 0) return false;
  const storedKey = sectionsKey(stored.sections);
  if (storedKey === sectionsKey(page.sections)) return false;
  return previous.some((old) => sectionsKey(old) === storedKey);
}

async function upgradeUneditedSystemPages(source: DefaultPage[]): Promise<number> {
  let upgraded = 0;
  for (const page of source) {
    if (!page.replacesUneditedSections?.length) continue;
    const stored = await SitePage.findOne({ slug: page.slug })
      .select("sections isSystem")
      .lean<{ sections?: StoredSection[]; isSystem?: boolean }>();
    if (!stored || !upgradeableSystemPage(page, stored)) continue;
    await SitePage.updateOne(
      { slug: page.slug },
      {
        $set: {
          sections: page.sections,
          ...(typeof page.version === "string" && page.version ? { version: page.version } : {}),
        },
      },
    );
    upgraded++;
  }
  return upgraded;
}

/**
 * Seed default site pages to database.
 * Prefers saved defaults from data/defaults/pages.json,
 * falls back to hardcoded constants in lib/constants/default-pages.ts.
 *
 * Includes both regular pages (terms, privacy) AND action-specific pop-up
 * terms (credit purchase, withdrawal, marketplace, competition, challenge).
 *
 * Does NOT overwrite existing pages — only inserts missing ones.
 * This is safe to call on every startup.
 */
export async function seedSitePages(): Promise<void> {
  try {
    await connectToDatabase();

    const existingCount = await SitePage.countDocuments();

    // Determine source: saved defaults or hardcoded constants
    const savedDefaults = getDefaultPagesFromFile();
    const source = savedDefaults
      ? withMissingSystemPages(savedDefaults)
      : ALL_DEFAULT_PAGES;
    const sourceName = savedDefaults ? "saved defaults" : "constants";

    if (existingCount === 0) {
      // Fresh DB — insert all defaults
      console.log(
        `🌱 Seeding ${source.length} site pages from ${sourceName}...`,
      );
      await SitePage.insertMany(source.map(toSeedDoc));
      console.log(`✅ Seeded ${source.length} site pages`);
    } else {
      // DB has pages — sync: insert any missing system pages
      const existingSlugs = await SitePage.distinct("slug");
      const existingSet = new Set(existingSlugs);

      let added = 0;
      for (const page of source) {
        if (!existingSet.has(page.slug)) {
          await SitePage.create(toSeedDoc(page));
          added++;
        }
      }

      const upgraded = await upgradeUneditedSystemPages(ALL_DEFAULT_PAGES);
      if (upgraded > 0) {
        console.log(`🔄 Site pages sync: ${upgraded} unedited built-in page(s) upgraded`);
      }

      if (added > 0) {
        console.log(
          `🔄 Site pages sync: ${added} added (${existingCount} existed)`,
        );
      } else {
        console.log(
          `ℹ️ Site pages already synced (${existingCount} pages found)`,
        );
      }
    }
  } catch (error) {
    console.error("❌ Failed to seed site pages:", error);
  }
}
