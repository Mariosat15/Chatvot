import { NextRequest, NextResponse } from 'next/server';
import { readFile, access } from 'fs/promises';
import path from 'path';
import { constants } from 'fs';

/**
 * GET /api/assets/marketplace/[filename]
 * Serve marketplace cosmetic images from the uploads directory
 * This allows the user app to access uploaded cosmetic images (avatars, etc.)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    
    // Sanitize filename to prevent directory traversal
    // Also strip query params
    const sanitizedFilename = path.basename(filename.split('?')[0]);
    
    // Try multiple possible locations for the file
    // Production path comes first for speed in production
    const possiblePaths = [
      // Production: /var/www/chartvolt/public/uploads/marketplace
      path.join('/var/www/chartvolt', 'public', 'uploads', 'marketplace', sanitizedFilename),
      // Production admin fallback
      path.join('/var/www/chartvolt', 'apps', 'admin', 'public', 'uploads', 'marketplace', sanitizedFilename),
      // Local dev: current app's public folder
      path.join(process.cwd(), 'public', 'uploads', 'marketplace', sanitizedFilename),
      // Local dev: admin app's public folder (monorepo)
      path.join(process.cwd(), 'apps', 'admin', 'public', 'uploads', 'marketplace', sanitizedFilename),
    ];
    
    let filePath: string | null = null;
    
    for (const possiblePath of possiblePaths) {
      try {
        await access(possiblePath, constants.R_OK);
        filePath = possiblePath;
        break;
      } catch {
        // File doesn't exist at this path, try next
      }
    }
    
    if (!filePath) {
      console.error(`❌ Marketplace image not found in any location: ${sanitizedFilename}`);
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }
    
    const fileBuffer = await readFile(filePath);
    
    // Determine content type
    const ext = sanitizedFilename.split('.').pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      'ico': 'image/x-icon',
    };
    const contentType = contentTypes[ext || 'png'] || 'image/png';
    
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        // Allow caching for marketplace images (1 hour, revalidate for 1 day)
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('Error serving marketplace image:', error);
    return NextResponse.json({ error: 'Failed to serve image' }, { status: 500 });
  }
}
