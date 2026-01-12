import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/auth';
import { aiKnowledgeService } from '@/lib/services/ai-knowledge.service';

// POST - Scrape a URL and add to knowledge base
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminAuth();
    
    const body = await request.json();
    const { url, name, category, description, followLinks, maxPages } = body;
    
    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }
    
    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }
    
    // Fetch the webpage
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ChartVolt-Bot/1.0; Knowledge Indexer)',
      },
    });
    
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch URL: ${response.statusText}` },
        { status: 400 }
      );
    }
    
    const html = await response.text();
    
    // Extract text content from HTML
    const content = extractTextFromHtml(html, url);
    
    if (!content || content.trim().length < 50) {
      return NextResponse.json(
        { error: 'Could not extract meaningful content from the URL' },
        { status: 400 }
      );
    }
    
    // Create knowledge source
    const source = await aiKnowledgeService.createSource({
      name: name || extractTitleFromHtml(html) || new URL(url).hostname,
      type: 'url',
      content,
      websiteUrl: url,
      metadata: {
        title: extractTitleFromHtml(html),
        description: description || extractDescriptionFromHtml(html),
        category: category || 'General',
      },
      createdBy: admin.adminId || 'system',
    });
    
    return NextResponse.json({
      success: true,
      source,
      message: 'URL scraped and indexed successfully',
      contentLength: content.length,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error scraping URL:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to scrape URL' },
      { status: 500 }
    );
  }
}

/**
 * Extract text content from HTML, preserving structure
 */
function extractTextFromHtml(html: string, url: string): string {
  // Remove script and style tags
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  
  // Convert headings to markdown
  text = text
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n')
    .replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n##### $1\n')
    .replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n###### $1\n');
  
  // Convert lists
  text = text
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1')
    .replace(/<ul[^>]*>|<\/ul>|<ol[^>]*>|<\/ol>/gi, '\n');
  
  // Convert paragraphs and breaks
  text = text
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<hr\s*\/?>/gi, '\n---\n');
  
  // Convert links (keep text and URL)
  text = text.replace(/<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)');
  
  // Convert strong/em
  text = text
    .replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**')
    .replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*');
  
  // Convert code blocks
  text = text
    .replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n```\n$1\n```\n')
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');
  
  // Remove remaining HTML tags
  text = text.replace(/<[^>]+>/g, ' ');
  
  // Clean up whitespace
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
  
  // Add source URL as metadata
  text = `[Source URL: ${url}]\n\n${text}`;
  
  return text;
}

/**
 * Extract title from HTML
 */
function extractTitleFromHtml(html: string): string | undefined {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    return titleMatch[1]
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim();
  }
  return undefined;
}

/**
 * Extract meta description from HTML
 */
function extractDescriptionFromHtml(html: string): string | undefined {
  const metaMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i)
    || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i);
  if (metaMatch) {
    return metaMatch[1].trim();
  }
  return undefined;
}
