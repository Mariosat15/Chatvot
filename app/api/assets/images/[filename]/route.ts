import { NextRequest, NextResponse } from 'next/server';
import { readFile, access } from 'fs/promises';
import path from 'path';
import { constants } from 'fs';

/**
 * GET /api/assets/images/[filename]
 * Serve branding images from the assets directory
 * This works even after builds in production
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
      // Production: /var/www/chartvolt/public/assets/images
      path.join('/var/www/chartvolt', 'public', 'assets', 'images', sanitizedFilename),
      // Production admin fallback
      path.join('/var/www/chartvolt', 'apps', 'admin', 'public', 'assets', 'images', sanitizedFilename),
      // Local dev: current app's public folder
      path.join(process.cwd(), 'public', 'assets', 'images', sanitizedFilename),
      // Local dev: admin app's public folder (monorepo)
      path.join(process.cwd(), 'apps', 'admin', 'public', 'assets', 'images', sanitizedFilename),
    ];
    
    let filePath: string | null = null;
    
    for (const possiblePath of possiblePaths) {
      try {
        await access(possiblePath, constants.R_OK);
        filePath = possiblePath;
        console.log(`✅ Found image at: ${possiblePath}`);
        break;
      } catch {
        // File doesn't exist at this path, try next
        console.log(`⚠️ Image not at: ${possiblePath}`);
      }
    }
    
    if (!filePath) {
      console.error(`❌ Branding image not found in any location: ${sanitizedFilename}`);
      console.error(`   Searched paths:`, possiblePaths);
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
        // No caching for branding images to allow updates
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Error serving branding image:', error);
    return NextResponse.json({ error: 'Failed to serve image' }, { status: 500 });
  }
}

