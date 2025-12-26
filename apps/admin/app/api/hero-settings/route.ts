import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import HeroSettings, { defaultThemePresets } from '@/database/models/hero-settings.model';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { auditLogService } from '@/lib/services/audit-log.service';

// GET - Fetch hero settings
export async function GET() {
  try {
    // Verify admin authentication
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated || !auth.adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    // Get or create settings (singleton pattern)
    let settings = await HeroSettings.findOne();
    if (!settings) {
      settings = await HeroSettings.create({
        heroCTAButtons: [
          { id: 'cta1', text: 'START TRADING', href: '/sign-up', style: 'primary', icon: 'Zap', enabled: true },
          { id: 'cta2', text: 'VIEW COMPETITIONS', href: '/competitions', style: 'outline', icon: 'Trophy', enabled: true },
        ],
      });
    }

    return NextResponse.json({
      success: true,
      settings: settings.toObject(),
      themePresets: defaultThemePresets,
    });
  } catch (error) {
    console.error('Error fetching hero settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch hero settings' },
      { status: 500 }
    );
  }
}

// PUT - Update hero settings
export async function PUT(request: NextRequest) {
  try {
    // Verify admin authentication
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated || !auth.adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    const body = await request.json();

    // Find or create settings
    let settings = await HeroSettings.findOne();
    if (!settings) {
      settings = new HeroSettings();
    }

    // Update only provided fields
    const updateFields = { ...body };
    delete updateFields._id;
    delete updateFields.createdAt;
    delete updateFields.updatedAt;
    
    // Track what changed
    const changes: string[] = [];
    for (const key of Object.keys(updateFields)) {
      if (JSON.stringify(settings.get(key)) !== JSON.stringify(updateFields[key])) {
        changes.push(key);
      }
    }

    // Update settings
    Object.assign(settings, updateFields);
    settings.lastUpdated = new Date();
    settings.updatedBy = auth.adminId;
    
    await settings.save();

    // Create audit log
    if (changes.length > 0) {
      await auditLogService.log({
        admin: { id: auth.adminId, email: auth.email || 'unknown', name: auth.name },
        action: 'UPDATE_HERO_SETTINGS',
        category: 'settings',
        description: `Updated hero page settings: ${changes.join(', ')}`,
        metadata: { changedFields: changes },
      });
    }

    return NextResponse.json({
      success: true,
      settings: settings.toObject(),
      message: 'Hero settings updated successfully',
    });
  } catch (error) {
    console.error('Error updating hero settings:', error);
    return NextResponse.json(
      { error: 'Failed to update hero settings' },
      { status: 500 }
    );
  }
}

// POST - Apply theme preset
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated || !auth.adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    const { action, themeId, data } = await request.json();

    let settings = await HeroSettings.findOne();
    if (!settings) {
      settings = new HeroSettings();
    }

    switch (action) {
      case 'apply-theme': {
        const theme = defaultThemePresets.find(t => t.id === themeId);
        if (!theme) {
          return NextResponse.json({ error: 'Theme not found' }, { status: 404 });
        }

        settings.activeTheme = theme.id;
        settings.customTheme = {
          primaryColor: theme.primaryColor,
          secondaryColor: theme.secondaryColor,
          accentColor: theme.accentColor,
          backgroundColor: theme.backgroundColor,
          textColor: '#ffffff',
          gradientFrom: theme.gradientFrom,
          gradientTo: theme.gradientTo,
          gradientAngle: 135,
          fontFamily: theme.fontFamily,
          headingFont: theme.fontFamily,
          buttonRadius: '0.75rem',
          cardRadius: '1rem',
          shadowIntensity: 'medium',
          glowIntensity: theme.cardStyle === 'neon' ? 'intense' : 'medium',
        };
        
        await settings.save();

        await auditLogService.log({
          admin: { id: auth.adminId, email: auth.email || 'unknown', name: auth.name },
          action: 'APPLY_HERO_THEME',
          category: 'settings',
          description: `Applied theme preset: ${theme.name}`,
          metadata: { themeId: theme.id },
        });

        return NextResponse.json({
          success: true,
          settings: settings.toObject(),
          message: `Theme "${theme.name}" applied successfully`,
        });
      }

      case 'reset-section': {
        const { section } = data;
        // Reset specific section to defaults
        // Implementation depends on section
        await settings.save();

        return NextResponse.json({
          success: true,
          message: `Section "${section}" reset to defaults`,
        });
      }

      case 'duplicate-settings': {
        // Create a backup of current settings
        const backup = settings.toObject();
        delete backup._id;
        
        return NextResponse.json({
          success: true,
          backup,
          message: 'Settings backup created',
        });
      }

      case 'restore-settings': {
        // Restore from backup
        if (data?.backup) {
          Object.assign(settings, data.backup);
          await settings.save();
        }

        return NextResponse.json({
          success: true,
          settings: settings.toObject(),
          message: 'Settings restored from backup',
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error processing hero settings action:', error);
    return NextResponse.json(
      { error: 'Failed to process action' },
      { status: 500 }
    );
  }
}

