import LandingPageTemplate from "@/database/models/landing-page-template.model";
import { ALL_LANDING_PAGE_TEMPLATES } from "@/lib/constants/landing-page-templates";
import { connectToDatabase } from "@/database/mongoose";

/**
 * Seed landing page templates to database.
 * Does NOT overwrite existing templates — only inserts missing ones.
 * System templates (isSystem: true) cannot be deleted by admin.
 * This is safe to call on every startup.
 */
export async function seedLandingPageTemplates(): Promise<void> {
  try {
    await connectToDatabase();

    const existingCount = await LandingPageTemplate.countDocuments();

    if (existingCount === 0) {
      // Fresh DB — insert all templates
      console.log(
        `🌱 Seeding ${ALL_LANDING_PAGE_TEMPLATES.length} landing page templates...`,
      );
      const docs = ALL_LANDING_PAGE_TEMPLATES.map((t) => ({
        slug: t.slug,
        name: t.name,
        description: t.description,
        category: t.category,
        thumbnailGradient: t.thumbnailGradient,
        previewColors: t.previewColors,
        sections: t.sections,
        isSystem: true,
        isActive: true,
      }));
      await LandingPageTemplate.insertMany(docs);
      console.log(
        `✅ Seeded ${ALL_LANDING_PAGE_TEMPLATES.length} landing page templates`,
      );
    } else {
      // DB has templates — sync: insert any missing ones
      const existingSlugs = await LandingPageTemplate.distinct("slug");
      const existingSet = new Set(existingSlugs as string[]);

      let added = 0;
      for (const template of ALL_LANDING_PAGE_TEMPLATES) {
        if (!existingSet.has(template.slug)) {
          await LandingPageTemplate.create({
            slug: template.slug,
            name: template.name,
            description: template.description,
            category: template.category,
            thumbnailGradient: template.thumbnailGradient,
            previewColors: template.previewColors,
            sections: template.sections,
            isSystem: true,
            isActive: true,
          });
          added++;
        }
      }

      if (added > 0) {
        console.log(
          `🔄 Landing page templates sync: ${added} added (${existingCount} existed)`,
        );
      } else {
        console.log(
          `ℹ️ Landing page templates already synced (${existingCount} templates found)`,
        );
      }
    }
  } catch (error) {
    console.error("❌ Failed to seed landing page templates:", error);
  }
}
