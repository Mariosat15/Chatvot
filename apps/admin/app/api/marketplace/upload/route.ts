import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/auth';
import { writeFile, mkdir, access, stat } from 'fs/promises';
import { constants } from 'fs';
import path from 'path';

// POST - Upload marketplace cosmetic images
export async function POST(request: NextRequest) {
  try {
    await requireAdminAuth();

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const itemSlug = formData.get('slug') as string;
    const cosmeticType = formData.get('cosmeticType') as string || 'avatar';

    console.log(`📤 [Marketplace Upload] Received upload for slug: ${itemSlug}, type: ${cosmeticType}, file: ${file?.name}, size: ${file?.size}`);

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
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
    
    // Generate filename based on cosmetic type and slug with timestamp
    const timestamp = Date.now();
    const safeSlug = (itemSlug || 'item').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    const filename = `${cosmeticType}-${safeSlug}-${timestamp}.${fileExtension}`;
    
    // Create upload directory for marketplace cosmetics
    // Try multiple paths for monorepo compatibility
    const possibleUploadDirs = [
      // Production: /var/www/chartvolt/public/uploads/marketplace
      path.join('/var/www/chartvolt', 'public', 'uploads', 'marketplace'),
      // Monorepo local dev: from apps/admin up to root's public
      path.join(process.cwd(), '..', '..', 'public', 'uploads', 'marketplace'),
      // Fallback: current app's public folder
      path.join(process.cwd(), 'public', 'uploads', 'marketplace'),
    ];
    
    console.log(`📁 [Marketplace Upload] cwd: ${process.cwd()}`);
    console.log(`📁 [Marketplace Upload] Trying directories:`, possibleUploadDirs);
    
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
        console.log(`✅ [Marketplace Upload] Using writable directory: ${uploadDir}`);
        break;
      } catch (e) {
        console.warn(`❌ [Marketplace Upload] Cannot use directory ${dir}:`, e);
        continue;
      }
    }
    
    if (!uploadDir) {
      console.error(`❌ [Marketplace Upload] No writable directory found!`);
      return NextResponse.json(
        { error: 'No writable upload directory available' },
        { status: 500 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    console.log(`📦 [Marketplace Upload] Buffer size: ${buffer.length} bytes`);

    // Write file
    const filePath = path.join(uploadDir, filename);
    await writeFile(filePath, buffer);
    console.log(`💾 [Marketplace Upload] File written to: ${filePath}`);
    
    // Verify the file was written
    try {
      await access(filePath, constants.R_OK);
      const fileStats = await stat(filePath);
      console.log(`✅ [Marketplace Upload] File verified: ${filePath}, size: ${fileStats.size} bytes`);
    } catch (verifyError) {
      console.error(`❌ [Marketplace Upload] File verification failed:`, verifyError);
      return NextResponse.json(
        { error: 'File was not saved correctly' },
        { status: 500 }
      );
    }

    // Return API-served path (works in production without rebuild)
    // Use API route for dynamic serving, with timestamp for cache-busting
    const publicPath = `/api/assets/marketplace/${filename}?t=${timestamp}`;
    console.log(`🔗 [Marketplace Upload] Returning path: ${publicPath}`);

    return NextResponse.json({
      success: true,
      url: publicPath,
      filename,
      uploadDir, // Include for debugging
      fileSize: buffer.length,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('❌ [Marketplace Upload] Error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}
