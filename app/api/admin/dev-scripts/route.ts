import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/auth';
import fs from 'fs';
import path from 'path';

// GET - List all test scripts in the test-scripts directory
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the project root directory dynamically
    const projectRoot = process.cwd();
    const scriptsDir = path.join(projectRoot, 'test-scripts');
    
    // Check if directory exists
    if (!fs.existsSync(scriptsDir)) {
      return NextResponse.json({ 
        scripts: [],
        projectRoot,
        scriptsDir,
        message: 'test-scripts directory not found'
      });
    }

    // Read all files in the directory
    const files = fs.readdirSync(scriptsDir);
    
    // Filter for script files and get their info
    const scripts = files
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.ts', '.js', '.mjs', '.cjs'].includes(ext) && !file.endsWith('.d.ts');
      })
      .map(file => {
        const filePath = path.join(scriptsDir, file);
        const stats = fs.statSync(filePath);
        const ext = path.extname(file).toLowerCase();
        
        // Determine the launch command based on file extension
        let launchCommand = '';
        if (ext === '.ts') {
          launchCommand = `npx tsx test-scripts/${file}`;
        } else if (['.js', '.mjs', '.cjs'].includes(ext)) {
          launchCommand = `node test-scripts/${file}`;
        }

        // Try to read first line for description
        let description = '';
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const firstCommentMatch = content.match(/^\/\/\s*(.+)|^\/\*\*?\s*\n?\s*\*?\s*(.+)/m);
          if (firstCommentMatch) {
            description = (firstCommentMatch[1] || firstCommentMatch[2] || '').trim();
          }
        } catch {
          // Ignore read errors
        }

        return {
          name: file,
          path: `test-scripts/${file}`,
          fullPath: filePath,
          extension: ext,
          size: stats.size,
          modified: stats.mtime.toISOString(),
          launchCommand,
          description,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      scripts,
      projectRoot,
      scriptsDir,
      platform: process.platform,
      nodeVersion: process.version,
    });

  } catch (error) {
    console.error('Error listing dev scripts:', error);
    return NextResponse.json(
      { error: 'Failed to list scripts', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

