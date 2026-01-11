import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

// POST - Execute a dev command
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, scriptName } = body;

    // Get the project root directory dynamically
    // When running in the admin app, process.cwd() returns apps/admin
    // We need to go up two levels to get to the main project root
    let projectRoot = process.cwd();
    
    // Check if we're in the admin app subdirectory
    if (projectRoot.includes('apps/admin') || projectRoot.includes('apps\\admin')) {
      projectRoot = path.resolve(projectRoot, '../..');
    }
    
    const isWindows = process.platform === 'win32';

    let command: string;

    if (action === 'clear-cache') {
      // Clear .next cache
      if (isWindows) {
        command = `powershell.exe -Command "if (Test-Path '.next') { Remove-Item -Recurse -Force '.next'; Write-Host 'Cache cleared!' } else { Write-Host '.next folder not found' }"`;
      } else {
        command = 'rm -rf .next && echo "Cache cleared!"';
      }
    } else if (action === 'run-script' && scriptName) {
      // Validate script name to prevent command injection
      if (!/^[\w.-]+\.(ts|js|mjs|cjs)$/.test(scriptName)) {
        return NextResponse.json({ error: 'Invalid script name' }, { status: 400 });
      }

      const ext = scriptName.split('.').pop()?.toLowerCase();

      if (ext === 'ts') {
        command = `npx tsx test-scripts/${scriptName}`;
      } else {
        command = `node test-scripts/${scriptName}`;
      }
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Execute the command with timeout
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: projectRoot,
        timeout: 60000, // 60 seconds
        maxBuffer: 1024 * 1024 * 10, // 10MB
        env: { ...process.env },
        shell: isWindows ? 'powershell.exe' : '/bin/bash',
      });

      return NextResponse.json({
        success: true,
        output: stdout + (stderr ? `\n[stderr]: ${stderr}` : ''),
        command,
        projectRoot,
        platform: process.platform,
      });
    } catch (execError: unknown) {
      const error = execError as { stdout?: string; stderr?: string; message?: string; killed?: boolean };
      return NextResponse.json({
        success: false,
        output: (error.stdout || '') + (error.stderr ? `\n[stderr]: ${error.stderr}` : ''),
        error: error.killed ? 'Command timed out after 60 seconds' : (error.message || 'Command failed'),
        command,
        projectRoot,
        platform: process.platform,
      });
    }

  } catch (error) {
    console.error('Error executing dev command:', error);
    return NextResponse.json(
      { error: 'Failed to execute command', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
