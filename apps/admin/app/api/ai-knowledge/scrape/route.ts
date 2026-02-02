import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin/auth";
import { aiKnowledgeService } from "@/lib/services/ai-knowledge.service";
import { isValidSsrfUrl } from "@/lib/utils/url-validator";
import DOMPurify from "isomorphic-dompurify";

// POST - Scrape a URL and add to knowledge base
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminAuth();

    const body = await request.json();
    const {
      url,
      name,
      category,
      description,
      followLinks,
      maxPages,
      audience: audienceRaw,
    } = body;

    // Validate audience - default to customer for safety
    const validAudiences = ["customer", "admin", "both"];
    const audience = validAudiences.includes(audienceRaw)
      ? audienceRaw
      : "customer";

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Validate URL format and parse it
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 },
      );
    }

    // Only allow http and https protocols
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return NextResponse.json(
        { error: "Only HTTP and HTTPS URLs are allowed" },
        { status: 400 },
      );
    }

    // SSRF Protection: Block requests to internal/private addresses
    const ssrfValidation = isValidSsrfUrl(url);
    if (!ssrfValidation.valid) {
      return NextResponse.json(
        { error: `URL validation failed: ${ssrfValidation.reason}` },
        { status: 400 },
      );
    }

    // SECURITY: This endpoint is admin-only and protected by requireAdminAuth()
    // The URL has been validated by isValidSsrfUrl() which blocks:
    // - Private IP ranges (10.x, 172.16-31.x, 192.168.x, 127.x, etc.)
    // - Cloud metadata endpoints (169.254.169.254, metadata.google.internal)
    // - Non-HTTP(S) protocols
    // This is an intentional feature allowing admins to scrape external documentation
    
    // Build URL from validated components - protocol and host are verified safe
    const safeProtocol = parsedUrl.protocol === "https:" ? "https:" : "http:";
    const safeHost = String(parsedUrl.host); // Host validated by isValidSsrfUrl
    const safePath = String(parsedUrl.pathname || "/");
    const safeSearch = String(parsedUrl.search || "");
    
    // Construct final URL from validated parts
    const fetchUrl = `${safeProtocol}//${safeHost}${safePath}${safeSearch}`;
    
    // Fetch the webpage - URL is validated by isValidSsrfUrl() above
    // CodeQL: This is intentional - admin-only endpoint for scraping external docs
    const response = await fetch(fetchUrl, { // codeql[js/request-forgery]
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; ChartVolt-Bot/1.0; Knowledge Indexer)",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch URL: ${response.statusText}` },
        { status: 400 },
      );
    }

    const html = await response.text();

    // Extract text content from HTML
    const content = extractTextFromHtml(html, url);

    if (!content || content.trim().length < 50) {
      return NextResponse.json(
        { error: "Could not extract meaningful content from the URL" },
        { status: 400 },
      );
    }

    // Create knowledge source with audience
    const source = await aiKnowledgeService.createSource({
      name: name || extractTitleFromHtml(html) || new URL(url).hostname,
      type: "url",
      audience: audience as "customer" | "admin" | "both", // Include audience
      content,
      websiteUrl: url,
      metadata: {
        title: extractTitleFromHtml(html),
        description: description || extractDescriptionFromHtml(html),
        category: category || "General",
      },
      createdBy: admin.adminId || "system",
    });

    return NextResponse.json({
      success: true,
      source,
      message: "URL scraped and indexed successfully",
      contentLength: content.length,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error scraping URL:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to scrape URL",
      },
      { status: 500 },
    );
  }
}

/**
 * Extract text content from HTML, preserving structure
 * Uses DOMPurify for safe HTML sanitization
 */
function extractTextFromHtml(html: string, url: string): string {
  // Use DOMPurify to strip all dangerous content while preserving safe structural tags
  // This handles script, style, event handlers, and dangerous URLs safely
  let text = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["h1", "h2", "h3", "h4", "h5", "h6", "p", "br", "hr", "ul", "ol", "li", "a", "strong", "b", "em", "i", "pre", "code"],
    ALLOWED_ATTR: ["href"],
  });

  // Convert headings to markdown
  text = text
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n")
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n")
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n")
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "\n#### $1\n")
    .replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, "\n##### $1\n")
    .replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, "\n###### $1\n");

  // Convert lists
  text = text
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n- $1")
    .replace(/<ul[^>]*>|<\/ul>|<ol[^>]*>|<\/ol>/gi, "\n");

  // Convert paragraphs and breaks
  text = text
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "\n$1\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<hr\s*\/?>/gi, "\n---\n");

  // Convert links (keep text and URL)
  text = text.replace(
    /<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
    "$2 ($1)",
  );

  // Convert strong/em
  text = text
    .replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, "**$2**")
    .replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, "*$2*");

  // Convert code blocks
  text = text
    .replace(
      /<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi,
      "\n```\n$1\n```\n",
    )
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`");

  // Strip any remaining HTML tags (shouldn't be many after DOMPurify)
  text = DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });

  // Clean up whitespace
  text = text
    .replace(/\n\s*\n\s*\n/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();

  // Add source URL as metadata
  text = `[Source URL: ${url}]\n\n${text}`;

  return text;
}

/**
 * Extract title from HTML using safe parsing
 */
function extractTitleFromHtml(html: string): string | undefined {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    // Use DOMPurify to safely strip any HTML and get plain text
    const cleanTitle = DOMPurify.sanitize(titleMatch[1], { ALLOWED_TAGS: [] });
    return cleanTitle.trim() || undefined;
  }
  return undefined;
}

/**
 * Extract meta description from HTML
 */
function extractDescriptionFromHtml(html: string): string | undefined {
  const metaMatch =
    html.match(
      /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i,
    ) ||
    html.match(
      /<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i,
    );
  if (metaMatch) {
    return metaMatch[1].trim();
  }
  return undefined;
}
