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
    seoTitle: page.seoTitle || "",
    seoDescription: page.seoDescription || "",
  };
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
    const source = savedDefaults ?? ALL_DEFAULT_PAGES;
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
