import LandingPageTemplate from "@/database/models/landing-page-template.model";
import WhiteLabel from "@/database/models/whitelabel.model";
import { ALL_LANDING_PAGE_TEMPLATES } from "@/lib/constants/landing-page-templates";
import { connectToDatabase } from "@/database/mongoose";

/**
 * Fetch a landscape image URL from Pexels for a given search query.
 * Returns empty string if the API key is missing or the request fails.
 */
async function fetchPexelsImage(
  apiKey: string,
  query: string,
): Promise<string> {
  if (!apiKey || !query) return "";
  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape&size=large`;
    const res = await fetch(url, {
      headers: { Authorization: apiKey },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return "";
    const data = await res.json();
    // Reason: Use the "large2x" size (1880px wide) for hero backgrounds.
    const photo = data?.photos?.[0];
    if (!photo) return "";
    return (
      photo.src?.large2x ||
      photo.src?.large ||
      photo.src?.original ||
      ""
    );
  } catch {
    return "";
  }
}

/**
 * Seed landing page templates to database.
 * Does NOT overwrite existing templates — only inserts missing ones.
 * If a Pexels API key is configured, automatically fetches hero background
 * images for each template on first seed.
 * System templates (isSystem: true) cannot be deleted by admin.
 * This is safe to call on every startup.
 */
export async function seedLandingPageTemplates(): Promise<void> {
  try {
    await connectToDatabase();

    // Attempt to get Pexels API key from WhiteLabel settings or .env
    let pexelsApiKey = "";
    try {
      const wl = await WhiteLabel.findOne().select("pexelsApiKey").lean();
      pexelsApiKey =
        (wl as { pexelsApiKey?: string })?.pexelsApiKey ||
        process.env.PEXELS_API_KEY ||
        "";
    } catch {
      pexelsApiKey = process.env.PEXELS_API_KEY || "";
    }

    const existingCount = await LandingPageTemplate.countDocuments();

    if (existingCount === 0) {
      // Fresh DB — insert all templates with Pexels images
      console.log(
        `🌱 Seeding ${ALL_LANDING_PAGE_TEMPLATES.length} landing page templates...`,
      );

      const docs = [];
      for (const t of ALL_LANDING_PAGE_TEMPLATES) {
        // Fetch a hero image from Pexels for each template
        let heroImage = "";
        if (pexelsApiKey && t.pexelsSearchQuery) {
          heroImage = await fetchPexelsImage(pexelsApiKey, t.pexelsSearchQuery);
          if (heroImage) {
            console.log(`  📸 Fetched Pexels image for "${t.name}"`);
          }
        }

        // Clone sections and inject hero image into the hero section
        const sections = t.sections.map((s) => {
          if (s.type === "hero" && heroImage) {
            return {
              ...s,
              content: { ...s.content, backgroundImage: heroImage },
            };
          }
          return { ...s };
        });

        docs.push({
          slug: t.slug,
          name: t.name,
          description: t.description,
          category: t.category,
          thumbnailGradient: t.thumbnailGradient,
          previewColors: t.previewColors,
          sections,
          isSystem: true,
          isActive: true,
        });
      }

      await LandingPageTemplate.insertMany(docs);
      console.log(
        `✅ Seeded ${ALL_LANDING_PAGE_TEMPLATES.length} landing page templates`,
      );
    } else {
      // DB has templates — sync: insert any missing ones + backfill images
      const existingTemplates = await LandingPageTemplate.find().lean();
      const existingMap = new Map(
        existingTemplates.map((t) => [t.slug, t]),
      );

      let added = 0;
      let imagesBackfilled = 0;

      for (const template of ALL_LANDING_PAGE_TEMPLATES) {
        const existing = existingMap.get(template.slug);

        if (!existing) {
          // Template doesn't exist — insert it
          let heroImage = "";
          if (pexelsApiKey && template.pexelsSearchQuery) {
            heroImage = await fetchPexelsImage(
              pexelsApiKey,
              template.pexelsSearchQuery,
            );
          }

          const sections = template.sections.map((s) => {
            if (s.type === "hero" && heroImage) {
              return {
                ...s,
                content: { ...s.content, backgroundImage: heroImage },
              };
            }
            return { ...s };
          });

          await LandingPageTemplate.create({
            slug: template.slug,
            name: template.name,
            description: template.description,
            category: template.category,
            thumbnailGradient: template.thumbnailGradient,
            previewColors: template.previewColors,
            sections,
            isSystem: true,
            isActive: true,
          });
          added++;
        } else if (existing && existing.isSystem) {
          // Reason: System templates should be updated when the codebase changes,
          // since users never edit templates directly — they create pages FROM them.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const heroSection = (existing.sections as any[])?.find(
            (s) => s.type === "hero",
          );
          const hasImage = heroSection?.content?.backgroundImage;

          // Detect if template content has changed (simple section count check)
          const contentChanged =
            existing.sections.length !== template.sections.length ||
            existing.description !== template.description;

          if (contentChanged || !hasImage) {
            // Fetch hero image if needed
            let heroImage = hasImage || "";
            if (
              !heroImage &&
              pexelsApiKey &&
              template.pexelsSearchQuery
            ) {
              heroImage = await fetchPexelsImage(
                pexelsApiKey,
                template.pexelsSearchQuery,
              );
              if (heroImage) {
                console.log(
                  `  📸 Fetched Pexels image for "${template.name}"`,
                );
              }
            }

            const sections = template.sections.map((s) => {
              if (s.type === "hero" && heroImage) {
                return {
                  ...s,
                  content: { ...s.content, backgroundImage: heroImage },
                };
              }
              return { ...s };
            });

            await LandingPageTemplate.updateOne(
              { _id: existing._id },
              {
                $set: {
                  name: template.name,
                  description: template.description,
                  category: template.category,
                  thumbnailGradient: template.thumbnailGradient,
                  previewColors: template.previewColors,
                  sections,
                },
              },
            );

            if (contentChanged) {
              imagesBackfilled++;
              console.log(`  🔄 Updated template "${template.name}"`);
            } else {
              imagesBackfilled++;
              console.log(
                `  📸 Backfilled Pexels image for "${template.name}"`,
              );
            }
          }
        }
      }

      const parts = [];
      if (added > 0) parts.push(`${added} added`);
      if (imagesBackfilled > 0)
        parts.push(`${imagesBackfilled} images backfilled`);

      if (parts.length > 0) {
        console.log(
          `🔄 Landing page templates sync: ${parts.join(", ")} (${existingCount} existed)`,
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
