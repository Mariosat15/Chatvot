import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/auth';
import { writeFile, mkdir, access, stat } from 'fs/promises';
import { constants } from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    await requireAdminAuth();

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const field = formData.get('field') as string;

    console.log(`📤 [Upload] Received upload request for field: ${field}, file: ${file?.name}, size: ${file?.size}`);

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
    
    console.log(`📁 [Upload] cwd: ${process.cwd()}`);
    console.log(`📁 [Upload] Trying directories:`, possibleUploadDirs);
    
    // Find the first writable directory or create it
    let uploadDir: string | null = null;
    for (const dir of possibleUploadDirs) {
      try {
        await mkdir(dir, { recursive: true });
        // Verify we can write to this directory
        const testFile = path.join(dir, '.write-test');
        await writeFile(testFile, 'test');
        // Clean up test file (ignore errors)
        try { await import('fs/promises').then(fs => fs.unlink(testFile)); } catch {}
        uploadDir = dir;
        console.log(`✅ [Upload] Using writable directory: ${uploadDir}`);
        break;
      } catch (e) {
        console.warn(`❌ [Upload] Cannot use directory ${dir}:`, e);
        continue;
      }
    }
    
    if (!uploadDir) {
      console.error(`❌ [Upload] No writable directory found!`);
      return NextResponse.json(
        { error: 'No writable upload directory available' },
        { status: 500 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    console.log(`📦 [Upload] Buffer size: ${buffer.length} bytes`);

    // Write file
    const filePath = path.join(uploadDir, filename);
    await writeFile(filePath, buffer);
    console.log(`💾 [Upload] File written to: ${filePath}`);
    
    // Verify the file was written
    try {
      await access(filePath, constants.R_OK);
      const fileStats = await stat(filePath);
      console.log(`✅ [Upload] File verified: ${filePath}, size: ${fileStats.size} bytes`);
    } catch (verifyError) {
      console.error(`❌ [Upload] File verification failed:`, verifyError);
      return NextResponse.json(
        { error: 'File was not saved correctly' },
        { status: 500 }
      );
    }

    // Return API-served path (works in production without rebuild)
    // Use API route for dynamic serving, with timestamp for cache-busting
    const publicPath = `/api/assets/images/${filename}?t=${timestamp}`;
    console.log(`🔗 [Upload] Returning path: ${publicPath}`);

    return NextResponse.json({
      success: true,
      path: publicPath,
      filename,
      uploadDir, // Include for debugging
      fileSize: buffer.length,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('❌ [Upload] Error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}

