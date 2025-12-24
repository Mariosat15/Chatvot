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
    const sanitizedFilename = path.basename(filename);
    
    // Try multiple possible locations for the file
    // Include admin app's public folder since that's where admin uploads go
    const possiblePaths = [
      path.join(process.cwd(), 'public', 'assets', 'images', sanitizedFilename),
      path.join(process.cwd(), 'apps', 'admin', 'public', 'assets', 'images', sanitizedFilename),
      path.join('/var/www/chartvolt', 'public', 'assets', 'images', sanitizedFilename),
      path.join('/var/www/chartvolt', 'apps', 'admin', 'public', 'assets', 'images', sanitizedFilename),
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
      console.error(`Branding image not found: ${sanitizedFilename}`);
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
    };
    const contentType = contentTypes[ext || 'png'] || 'image/png';
    
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error serving branding image:', error);
    return NextResponse.json({ error: 'Failed to serve image' }, { status: 500 });
  }
}

