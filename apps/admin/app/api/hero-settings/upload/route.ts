import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { auditLogService } from '@/lib/services/audit-log.service';

// POST - Upload hero images
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated || !auth.adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string; // 'hero', 'logo', 'favicon', 'screenshot', 'testimonial'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'video/mp4', 'video/webm'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }

    // Validate file size (max 10MB for images, 50MB for videos)
    const maxSize = file.type.startsWith('video/') ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large' }, { status: 400 });
    }

    // Create upload directory
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'hero');
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Generate unique filename
    const ext = file.name.split('.').pop();
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const filename = `${type}-${timestamp}-${randomStr}.${ext}`;
    const filepath = path.join(uploadDir, filename);

    // Write file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    // Create audit log
    await auditLogService.log({
      admin: { id: auth.adminId, email: auth.email || 'unknown', name: auth.name },
      action: 'UPLOAD_HERO_IMAGE',
      category: 'content',
      description: `Uploaded ${type} image: ${filename}`,
      metadata: { filename, type, size: file.size },
    });

    return NextResponse.json({
      success: true,
      url: `/uploads/hero/${filename}`,
      filename,
      message: 'File uploaded successfully',
    });
  } catch (error) {
    console.error('Error uploading hero image:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}

// DELETE - Delete hero image
export async function DELETE(request: NextRequest) {
  try {
    // Verify admin authentication
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated || !auth.adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { filename } = await request.json();

    if (!filename) {
      return NextResponse.json({ error: 'No filename provided' }, { status: 400 });
    }

    // Security: Ensure filename doesn't contain path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    const filepath = path.join(process.cwd(), 'public', 'uploads', 'hero', filename);

    // Check if file exists and delete
    if (existsSync(filepath)) {
      const { unlink } = await import('fs/promises');
      await unlink(filepath);
    }

    // Create audit log
    await auditLogService.log({
      admin: { id: auth.adminId, email: auth.email || 'unknown', name: auth.name },
      action: 'DELETE_HERO_IMAGE',
      category: 'content',
      description: `Deleted hero image: ${filename}`,
      metadata: { filename },
    });

    return NextResponse.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting hero image:', error);
    return NextResponse.json(
      { error: 'Failed to delete file' },
      { status: 500 }
    );
  }
}

