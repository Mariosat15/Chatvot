import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    await requireAdminAuth();

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const field = formData.get('field') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!field) {
      return NextResponse.json(
        { error: 'Field name is required' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File must be an image' },
        { status: 400 }
      );
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size must be less than 5MB' },
        { status: 400 }
      );
    }

    // Get file extension
    const fileExtension = file.name.split('.').pop() || 'png';
    
    // Generate filename based on field with timestamp for cache-busting
    const timestamp = Date.now();
    const filename = `${field}-${timestamp}.${fileExtension}`;
    
    // Create upload directory if it doesn't exist
    // Try multiple paths for monorepo compatibility
    const possibleUploadDirs = [
      // Production: /var/www/chartvolt/public/assets/images
      path.join('/var/www/chartvolt', 'public', 'assets', 'images'),
      // Monorepo local dev: from apps/admin up to root's public
      path.join(process.cwd(), '..', '..', 'public', 'assets', 'images'),
      // Fallback: current app's public folder
      path.join(process.cwd(), 'public', 'assets', 'images'),
    ];
    
    // Find the first writable directory or create it
    let uploadDir = possibleUploadDirs[0];
    for (const dir of possibleUploadDirs) {
      try {
        await mkdir(dir, { recursive: true });
        uploadDir = dir;
        console.log(`📁 Using upload directory: ${uploadDir}`);
        break;
      } catch (e) {
        console.warn(`Could not create/use directory ${dir}:`, e);
        continue;
      }
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Write file
    const filePath = path.join(uploadDir, filename);
    await writeFile(filePath, buffer);

    // Return API-served path (works in production without rebuild)
    // Use API route for dynamic serving, with timestamp for cache-busting
    const publicPath = `/api/assets/images/${filename}?t=${timestamp}`;

    return NextResponse.json({
      success: true,
      path: publicPath,
      filename,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}

