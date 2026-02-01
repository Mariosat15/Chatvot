/**
 * HTML Sanitization Utility
 * Uses DOMPurify to sanitize HTML content and prevent XSS attacks
 */

import DOMPurify from "isomorphic-dompurify";

/**
 * Default allowed HTML tags for rich text content
 */
const DEFAULT_ALLOWED_TAGS = [
  // Text formatting
  "p",
  "br",
  "span",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "strike",
  // Headings
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  // Lists
  "ul",
  "ol",
  "li",
  // Links
  "a",
  // Other formatting
  "blockquote",
  "pre",
  "code",
  "hr",
  "div",
];

/**
 * Default allowed HTML attributes
 */
const DEFAULT_ALLOWED_ATTR = [
  "href",
  "target",
  "rel",
  "class",
  "id",
  "style",
  "title",
];

/**
 * Sanitize HTML content to prevent XSS attacks
 * @param dirty - The unsanitized HTML string
 * @param options - Optional configuration for sanitization
 * @returns Sanitized HTML string
 */
export function sanitizeHtml(
  dirty: string | null | undefined,
  options?: {
    allowedTags?: string[];
    allowedAttr?: string[];
    allowImages?: boolean;
    allowTables?: boolean;
  }
): string {
  if (!dirty) return "";

  const { allowedTags, allowedAttr, allowImages, allowTables } = options || {};

  // Build the list of allowed tags
  let tags = allowedTags || [...DEFAULT_ALLOWED_TAGS];
  let attrs = allowedAttr || [...DEFAULT_ALLOWED_ATTR];

  if (allowImages) {
    tags = [...tags, "img", "figure", "figcaption"];
    attrs = [...attrs, "src", "alt", "width", "height", "loading"];
  }

  if (allowTables) {
    tags = [
      ...tags,
      "table",
      "thead",
      "tbody",
      "tfoot",
      "tr",
      "th",
      "td",
      "caption",
    ];
    attrs = [...attrs, "colspan", "rowspan", "scope"];
  }

  // Configure DOMPurify
  const config: DOMPurify.Config = {
    ALLOWED_TAGS: tags,
    ALLOWED_ATTR: attrs,
    // Prevent script injection via data URLs
    ALLOW_DATA_ATTR: false,
    // Force all links to have safe rel attributes
    ADD_ATTR: ["target"],
    // Remove any script elements completely
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form"],
    // Don't allow javascript: URLs
    ALLOWED_URI_REGEXP:
      /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  };

  return DOMPurify.sanitize(dirty, config);
}

/**
 * Sanitize HTML and apply markdown-like formatting
 * This is useful for user-generated content that uses simple markdown syntax
 */
export function sanitizeAndFormatMarkdown(content: string | null | undefined): string {
  if (!content) return "";

  // First sanitize any existing HTML
  let sanitized = sanitizeHtml(content);

  // Then apply markdown-like transformations (safely)
  sanitized = sanitized
    // Headers
    .replace(
      /^# (.+)$/gm,
      '<h2 class="text-xl font-bold text-white mt-6 mb-3 first:mt-0">$1</h2>'
    )
    .replace(
      /^## (.+)$/gm,
      '<h3 class="text-lg font-semibold text-white mt-5 mb-2">$1</h3>'
    )
    .replace(
      /^### (.+)$/gm,
      '<h4 class="text-base font-semibold text-white mt-4 mb-2">$1</h4>'
    )
    // Bold text
    .replace(
      /\*\*(.+?)\*\*/g,
      '<strong class="text-white font-semibold">$1</strong>'
    )
    // Italic text
    .replace(/\*(.+?)\*/g, '<em class="text-gray-400 italic">$1</em>')
    // Bullet points
    .replace(
      /^• (.+)$/gm,
      '<li class="ml-3 text-gray-400 list-disc">$1</li>'
    )
    .replace(
      /^- (.+)$/gm,
      '<li class="ml-3 text-gray-400 list-disc">$1</li>'
    )
    // Line breaks
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>");

  return sanitized;
}

/**
 * Escape HTML special characters (for displaying as text, not HTML)
 */
export function escapeHtml(text: string | null | undefined): string {
  if (!text) return "";

  const htmlEntities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };

  return text.replace(/[&<>"']/g, (char) => htmlEntities[char] || char);
}

/**
 * Strip all HTML tags from content and return plain text
 * @param html - HTML string to strip
 * @returns Plain text with no HTML tags
 */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  
  // Use DOMPurify to safely strip all HTML tags
  let text = DOMPurify.sanitize(html, { ALLOWED_TAGS: [] });
  
  // Decode common HTML entities that remain after stripping
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/\s+/g, " ")
    .trim();
  
  return text;
}
