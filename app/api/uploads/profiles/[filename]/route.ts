import { NextRequest, NextResponse } from 'next/server';
import { readFile, access } from 'fs/promises';
import path from 'path';
import { constants } from 'fs';

/**
 * GET /api/uploads/profiles/[filename]
 * Serve profile images from the uploads directory
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    
    // Sanitize filename to prevent directory traversal
    const sanitizedFilename = path.basename(filename);
    
    console.log(`📸 Serving profile image: ${sanitizedFilename}, cwd: ${process.cwd()}`);
    
    // Try multiple possible locations for the file
    const possiblePaths = [
      path.join(process.cwd(), 'public', 'uploads', 'profiles', sanitizedFilename),
      path.join(process.cwd(), 'uploads', 'profiles', sanitizedFilename),
      path.join('/var/www/chartvolt', 'public', 'uploads', 'profiles', sanitizedFilename),
      path.join('/var/www/chartvolt', 'uploads', 'profiles', sanitizedFilename),
      // Also try the .next directory in case running from there
      path.join(process.cwd(), '..', 'public', 'uploads', 'profiles', sanitizedFilename),
    ];
    
    let filePath: string | null = null;
    
    for (const possiblePath of possiblePaths) {
      try {
        await access(possiblePath, constants.R_OK);
        filePath = possiblePath;
        console.log(`✅ Found profile image at: ${possiblePath}`);
        break;
      } catch {
        // File doesn't exist at this path, try next
      }
    }
    
    if (!filePath) {
      console.error(`❌ Profile image not found: ${sanitizedFilename}`);
      console.error(`   Searched paths: ${possiblePaths.join(', ')}`);
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
    };
    const contentType = contentTypes[ext || 'jpg'] || 'image/jpeg';
    
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error serving profile image:', error);
    return NextResponse.json({ error: 'Failed to serve image' }, { status: 500 });
  }
}

