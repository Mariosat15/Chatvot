import { notFound } from "next/navigation";
import { Metadata } from "next";
import Link from "next/link";
import { connectToDatabase } from "@/database/mongoose";
import SitePage from "@/database/models/site-page.model";
import type { ISitePageSection } from "@/database/models/site-page.model";

// Reason: force-dynamic ensures the page always fetches fresh DB content
// so admin edits are reflected immediately without a rebuild.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Generate dynamic metadata from the page's SEO fields.
 */
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    await connectToDatabase();
    const page = await SitePage.findOne({
      slug,
      isActive: true,
    }).lean<{ title: string; seoTitle?: string; seoDescription?: string }>();

    if (!page) return { title: "Page Not Found" };

    return {
      title: page.seoTitle || page.title,
      description: page.seoDescription || "",
    };
  } catch {
    return { title: "Page Not Found" };
  }
}

/**
 * Render a single section based on its type.
 */
function SectionRenderer({ section }: { section: ISitePageSection }) {
  switch (section.type) {
    case "heading":
      return (
        <h2 className="text-xl font-bold text-white mt-8 mb-3">
          {section.title || section.content}
        </h2>
      );

    case "paragraph":
      return (
        <p className="text-gray-300 leading-relaxed mb-4">{section.content}</p>
      );

    case "list":
      return (
        <ul className="list-disc list-inside space-y-1.5 mb-4 text-gray-300 ml-4">
          {section.content.split("\n").map((item, i) => (
            <li key={i} className="leading-relaxed">
              {item}
            </li>
          ))}
        </ul>
      );

    case "divider":
      return <hr className="border-gray-700/50 my-6" />;

    case "html":
      return (
        <div
          className="prose prose-invert max-w-none mb-4"
          dangerouslySetInnerHTML={{ __html: section.content }}
        />
      );

    default:
      return null;
  }
}

/**
 * Dynamic site page renderer.
 *
 * Catches routes like /terms, /privacy, /any-custom-slug.
 * Static routes (dashboard, competitions, arena, etc.) take priority
 * in Next.js App Router, so this only fires for unmatched slugs.
 */
export default async function DynamicSitePage({ params }: PageProps) {
  const { slug } = await params;

  try {
    await connectToDatabase();
    const page = await SitePage.findOne({ slug, isActive: true }).lean();

    if (!page) {
      notFound();
    }

    // Sort sections by order
    const sortedSections = [...(page.sections || [])].sort(
      (a, b) => a.order - b.order,
    );

    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950">
        {/* Header / Back navigation */}
        <header className="border-b border-gray-800/50 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
            <Link
              href="/"
              className="text-gray-400 hover:text-white transition-colors text-sm flex items-center gap-1.5"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back to Home
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
          {/* Title */}
          <div className="mb-10">
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
              {page.title}
            </h1>
            {page.subtitle && (
              <p className="text-gray-400 text-lg">{page.subtitle}</p>
            )}
            <div className="mt-3 text-xs text-gray-500">
              Last updated:{" "}
              {new Date(page.updatedAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>
          </div>

          {/* Sections */}
          <div className="bg-gray-900/50 border border-gray-800/50 rounded-2xl p-6 sm:p-10">
            {sortedSections.map((section) => (
              <SectionRenderer
                key={section.id}
                section={section as ISitePageSection}
              />
            ))}
          </div>
        </main>

        {/* Simple Footer */}
        <footer className="border-t border-gray-800/50 mt-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 text-center text-xs text-gray-500">
            © {new Date().getFullYear()} All rights reserved.
          </div>
        </footer>
      </div>
    );
  } catch (error) {
    console.error(`❌ Error rendering page /${slug}:`, error);
    notFound();
  }
}
