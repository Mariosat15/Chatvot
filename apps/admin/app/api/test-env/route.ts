import { NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/auth';
import fs from 'fs/promises';
import path from 'path';

export async function GET() {
  try {
    await requireAdminAuth();

    const envPath = path.join(process.cwd(), '.env');
    
    console.log('🔍 Testing .env file access...');
    console.log('📍 Path:', envPath);

    // Check if file exists
    let fileExists = false;
    try {
      await fs.access(envPath);
      fileExists = true;
      console.log('✅ .env file exists');
    } catch {
      console.log('❌ .env file does not exist');
    }

    // Try to read file
    let content = '';
    let canRead = false;
    try {
      content = await fs.readFile(envPath, 'utf-8');
      canRead = true;
      console.log('✅ Can read .env file');
    } catch (error) {
      console.log('❌ Cannot read .env file:', error);
    }

    // Try to write test file
    let canWrite = false;
    try {
      const testPath = path.join(process.cwd(), '.env.test');
      await fs.writeFile(testPath, 'TEST=true', 'utf-8');
      await fs.unlink(testPath);
      canWrite = true;
      console.log('✅ Can write to project directory');
    } catch (error) {
      console.log('❌ Cannot write to project directory:', error);
    }

    return NextResponse.json({
      success: true,
      envPath,
      fileExists,
      canRead,
      canWrite,
      contentLength: content.length,
      linesCount: content.split('\n').length,
      preview: content.substring(0, 200) + '...',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({
      success: false,
      error: String(error),
    }, { status: 500 });
  }
}

