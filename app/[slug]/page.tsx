import { notFound } from "next/navigation";
import { Metadata } from "next";
import Link from "next/link";
import { connectToDatabase } from "@/database/mongoose";
import SitePage from "@/database/models/site-page.model";
import type { ISitePageSection } from "@/database/models/site-page.model";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import CompanySettings from "@/database/models/company-settings.model";

// Reason: force-dynamic ensures the page always fetches fresh DB content
// so admin edits are reflected immediately without a rebuild.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Reason: Static assets like favicon.ico, robots.txt, sitemap.xml can be
// caught by this dynamic route. Return 404 immediately for non-page slugs.
const STATIC_ASSET_PATTERN =
  /\.(ico|png|jpg|jpeg|gif|svg|webp|xml|txt|json|js|css|woff2?|ttf|eot|map)$/i;

// ─── Branding loader ────────────────────────────────────────────────────────
interface Branding {
  siteName: string;
  tagline: string;
  logo: string;
  email: string;
  registrationNumber: string;
  country: string;
}

async function loadBranding(): Promise<Branding> {
  try {
    const [wl, cs] = await Promise.all([
      WhiteLabel.findOne().lean<Record<string, unknown>>(),
      CompanySettings.findOne().lean<Record<string, unknown>>(),
    ]);

    const DEFAULT_LOGO = "/assets/images/logo.png";
    const rawLogo = (wl?.appLogo as string) || "";
    const logo = rawLogo && rawLogo !== DEFAULT_LOGO ? rawLogo : "";

    return {
      siteName: (cs?.companyName as string) || "ChartVolt",
      tagline: (cs?.tagline as string) || "Where Champions Trade",
      logo,
      email: (cs?.email as string) || "",
      registrationNumber: (cs?.registrationNumber as string) || "",
      country: (cs?.country as string) || "",
    };
  } catch {
    return {
      siteName: "ChartVolt",
      tagline: "Where Champions Trade",
      logo: "",
      email: "",
      registrationNumber: "",
      country: "",
    };
  }
}

/**
 * Generate dynamic metadata from the page's SEO fields.
 */
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  if (STATIC_ASSET_PATTERN.test(slug)) return { title: "Not Found" };
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

// ─── Section Renderer ───────────────────────────────────────────────────────
// Reason: Maps each section type to a styled block that looks professional.
// Headings are numbered with a left accent border, lists have check icons,
// dividers are subtle gradient lines, and paragraphs use comfortable spacing.

function SectionRenderer({
  section,
  headingIndex,
}: {
  section: ISitePageSection;
  headingIndex?: number;
}) {
  switch (section.type) {
    case "heading":
      return (
        <div className="mt-10 mb-4 first:mt-0" id={`section-${section.id}`}>
          <div className="flex items-center gap-3">
            {headingIndex !== undefined && (
              <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-sm font-bold">
                {headingIndex}
              </span>
            )}
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {section.title || section.content}
            </h2>
          </div>
          <div className="mt-2 h-px bg-gradient-to-r from-emerald-500/30 via-emerald-500/10 to-transparent" />
        </div>
      );

    case "paragraph":
      return (
        <p className="text-gray-300 leading-[1.8] mb-4 text-[15px]">
          {section.content}
        </p>
      );

    case "list":
      return (
        <ul className="space-y-2 mb-5 ml-1">
          {section.content.split("\n").map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-gray-300 text-[15px] leading-relaxed">
              <span className="flex-shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400/70" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );

    case "divider":
      return (
        <div className="my-8">
          <div className="h-px bg-gradient-to-r from-transparent via-gray-700/50 to-transparent" />
        </div>
      );

    case "html":
      return (
        <div
          className="prose prose-invert prose-emerald max-w-none mb-4 prose-p:text-gray-300 prose-headings:text-white prose-a:text-emerald-400"
          dangerouslySetInnerHTML={{ __html: section.content }}
        />
      );

    default:
      return null;
  }
}

// ─── Table of Contents ──────────────────────────────────────────────────────
function TableOfContents({
  sections,
}: {
  sections: ISitePageSection[];
}) {
  const headings = sections.filter((s) => s.type === "heading");
  if (headings.length < 3) return null; // Don't show TOC for short pages

  return (
    <nav className="mb-10 bg-gray-900/50 border border-gray-800/40 rounded-xl p-5 sm:p-6">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
        </svg>
        Table of Contents
      </h3>
      <ol className="space-y-1.5">
        {headings.map((h, i) => (
          <li key={h.id}>
            <a
              href={`#section-${h.id}`}
              className="text-sm text-gray-400 hover:text-emerald-400 transition-colors flex items-center gap-2 py-0.5"
            >
              <span className="text-emerald-500/60 font-mono text-xs w-5 text-right">{i + 1}.</span>
              <span>{h.title || h.content}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * Premium dynamic site page renderer.
 *
 * Catches routes like /terms, /privacy, /any-custom-slug.
 * Static routes (dashboard, competitions, arena, etc.) take priority
 * in Next.js App Router, so this only fires for unmatched slugs.
 */
export default async function DynamicSitePage({ params }: PageProps) {
  const { slug } = await params;

  // Early exit for static assets that leaked into the dynamic route
  if (STATIC_ASSET_PATTERN.test(slug)) {
    notFound();
  }

  try {
    await connectToDatabase();

    const [page, branding] = await Promise.all([
      SitePage.findOne({ slug, isActive: true }).lean(),
      loadBranding(),
    ]);

    if (!page) {
      notFound();
    }

    // Sort sections by order
    const sortedSections = [...(page.sections || [])].sort(
      (a, b) => a.order - b.order,
    );

    // Calculate heading indices for numbered section badges
    let headingCounter = 0;
    const headingIndices = new Map<string, number>();
    for (const sec of sortedSections) {
      if (sec.type === "heading") {
        headingCounter++;
        headingIndices.set(sec.id, headingCounter);
      }
    }

    const updatedDate = new Date(page.updatedAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    return (
      <div className="min-h-screen bg-[#030712] text-white">
        {/* ─── Branded Header ───────────────────────────────────────────── */}
        <header className="sticky top-0 z-50 border-b border-gray-800/60 bg-[#030712]/90 backdrop-blur-xl">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
              {branding.logo ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={branding.logo}
                  alt={branding.siteName}
                  className="h-8 w-auto"
                />
              ) : (
                <>
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-lg shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/40 transition-shadow">
                    ⚡
                  </div>
                  <span className="text-lg font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent hidden sm:block">
                    {branding.siteName}
                  </span>
                </>
              )}
            </Link>

            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Home
              </Link>
              <Link
                href="/sign-in"
                className="text-sm font-medium px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all"
              >
                Sign In
              </Link>
            </div>
          </div>
        </header>

        {/* ─── Hero Banner ──────────────────────────────────────────────── */}
        <div className="relative overflow-hidden">
          {/* Background gradient effect */}
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 via-transparent to-transparent pointer-events-none" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8 sm:pt-16 sm:pb-10">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
              <Link href="/" className="hover:text-gray-300 transition-colors">Home</Link>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-gray-400">{page.title}</span>
            </nav>

            {/* Page Title */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
              <span className="bg-gradient-to-r from-white via-white to-gray-400 bg-clip-text text-transparent">
                {page.title}
              </span>
            </h1>

            {page.subtitle && (
              <p className="text-gray-400 text-base sm:text-lg max-w-3xl leading-relaxed">
                {page.subtitle}
              </p>
            )}

            {/* Meta info bar */}
            <div className="flex flex-wrap items-center gap-4 mt-6 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Last updated: {updatedDate}
              </span>
              {sortedSections.filter((s) => s.type === "heading").length > 0 && (
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {sortedSections.filter((s) => s.type === "heading").length} sections
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ─── Main Content ─────────────────────────────────────────────── */}
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-10">
            {/* Content Column */}
            <article className="min-w-0">
              {/* Table of Contents (mobile — above content) */}
              <div className="lg:hidden">
                <TableOfContents sections={sortedSections as ISitePageSection[]} />
              </div>

              {/* Page sections */}
              <div className="bg-gray-900/30 border border-gray-800/40 rounded-2xl p-6 sm:p-8 lg:p-10">
                {sortedSections.map((section) => (
                  <SectionRenderer
                    key={section.id}
                    section={section as ISitePageSection}
                    headingIndex={headingIndices.get(section.id)}
                  />
                ))}
              </div>
            </article>

            {/* Sidebar (desktop) */}
            <aside className="hidden lg:block">
              <div className="sticky top-20 space-y-6">
                {/* Table of Contents */}
                <TableOfContents sections={sortedSections as ISitePageSection[]} />

                {/* Contact card */}
                {branding.email && (
                  <div className="bg-gray-900/50 border border-gray-800/40 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Questions?
                    </h3>
                    <p className="text-xs text-gray-400 mb-3">
                      Need help understanding this page? Contact our team.
                    </p>
                    <a
                      href={`mailto:${branding.email}`}
                      className="inline-flex items-center gap-1.5 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      {branding.email}
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                )}

                {/* Quick links */}
                <div className="bg-gray-900/50 border border-gray-800/40 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-white mb-3">Related Pages</h3>
                  <ul className="space-y-2">
                    {[
                      { label: "Terms of Service", href: "/terms" },
                      { label: "Privacy Policy", href: "/privacy" },
                      { label: "Cookie Policy", href: "/cookies" },
                      { label: "Risk Disclaimer", href: "/risk-disclaimer" },
                    ]
                      .filter((l) => l.href !== `/${slug}`)
                      .slice(0, 4)
                      .map((link) => (
                        <li key={link.href}>
                          <Link
                            href={link.href}
                            className="text-sm text-gray-400 hover:text-emerald-400 transition-colors flex items-center gap-2"
                          >
                            <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            {link.label}
                          </Link>
                        </li>
                      ))}
                  </ul>
                </div>
              </div>
            </aside>
          </div>
        </main>

        {/* ─── Footer ───────────────────────────────────────────────────── */}
        <footer className="border-t border-gray-800/50 bg-gray-950/50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {branding.logo ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={branding.logo}
                    alt={branding.siteName}
                    className="h-6 w-auto opacity-60"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-xs">
                      ⚡
                    </div>
                    <span className="text-sm font-medium text-gray-500">
                      {branding.siteName}
                    </span>
                  </div>
                )}
              </div>

              <div className="text-xs text-gray-500 text-center sm:text-right">
                © {new Date().getFullYear()} {branding.siteName}. All rights reserved.
                {branding.registrationNumber && (
                  <span className="block sm:inline sm:ml-2">
                    Reg. No. {branding.registrationNumber}
                    {branding.country ? ` (${branding.country})` : ""}
                  </span>
                )}
              </div>
            </div>
          </div>
        </footer>
      </div>
    );
  } catch (error) {
    console.error(`❌ Error rendering page /${slug}:`, error);
    notFound();
  }
}
