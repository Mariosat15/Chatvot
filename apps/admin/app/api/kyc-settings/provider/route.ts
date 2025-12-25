import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import KYCSettings from '@/database/models/kyc-settings.model';
import AuditLog from '@/database/models/audit-log.model';
import { getAdminSession } from '@/lib/admin/auth';
import fs from 'fs/promises';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { provider, apiKey, apiSecret, baseUrl } = body;

    if (provider !== 'veriff') {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }

    if (!apiKey || !apiSecret) {
      return NextResponse.json({ error: 'API Key and Secret are required' }, { status: 400 });
    }

    await connectToDatabase();

    // Update database
    let settings = await KYCSettings.findOne();
    if (!settings) {
      settings = await KYCSettings.create({});
    }

    await KYCSettings.findByIdAndUpdate(settings._id, {
      veriffApiKey: apiKey,
      veriffApiSecret: apiSecret,
      veriffBaseUrl: baseUrl || 'https://stationapi.veriff.com',
    });

    // Update .env file
    try {
      const envPath = path.join(process.cwd(), '..', '..', '.env');
      let envContent = '';
      
      try {
        envContent = await fs.readFile(envPath, 'utf-8');
      } catch {
        // If .env doesn't exist, try the root .env
        const rootEnvPath = path.join(process.cwd(), '.env');
        try {
          envContent = await fs.readFile(rootEnvPath, 'utf-8');
        } catch {
          envContent = '';
        }
      }

      // Update or add environment variables
      const envVars: Record<string, string> = {
        VERIFF_API_KEY: apiKey,
        VERIFF_API_SECRET: apiSecret,
        VERIFF_BASE_URL: baseUrl || 'https://stationapi.veriff.com',
      };

      for (const [key, value] of Object.entries(envVars)) {
        const regex = new RegExp(`^${key}=.*$`, 'm');
        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, `${key}=${value}`);
        } else {
          envContent += `\n${key}=${value}`;
        }
      }

      // Try to write to the main .env file
      const mainEnvPath = path.join(process.cwd(), '..', '..', '.env');
      try {
        await fs.writeFile(mainEnvPath, envContent.trim() + '\n');
      } catch {
        // If that fails, try the root
        const rootEnvPath = path.join(process.cwd(), '.env');
        await fs.writeFile(rootEnvPath, envContent.trim() + '\n');
      }
    } catch (envError) {
      console.error('Error updating .env file:', envError);
      // Continue even if .env update fails - database is updated
    }

    // Create audit log
    await AuditLog.create({
      adminId: session.id,
      adminName: session.name || session.email,
      action: 'kyc_provider_configured',
      targetType: 'settings',
      targetId: 'veriff',
      details: {
        provider: 'veriff',
        environment: baseUrl?.includes('test') ? 'sandbox' : 'production',
        apiKeyPrefix: apiKey.slice(0, 8),
      },
    });

    return NextResponse.json({ 
      success: true,
      message: 'Veriff credentials saved successfully'
    });
  } catch (error) {
    console.error('Error saving KYC provider:', error);
    return NextResponse.json({ error: 'Failed to save provider credentials' }, { status: 500 });
  }
}

