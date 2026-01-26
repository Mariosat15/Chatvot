import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { connectToDatabase } from '@/database/mongoose';
import Incident from '@/database/models/incident.model';
import { auditLogService } from '@/lib/services/audit-log.service';

/**
 * GET /api/incidents
 * List all incidents with filtering and pagination
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const severity = searchParams.get('severity');
    const type = searchParams.get('type');
    const competitionId = searchParams.get('competitionId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    await connectToDatabase();

    // Build query
    const query: Record<string, unknown> = {};
    if (status) query.status = status;
    if (severity) query.severity = severity;
    if (type) query.type = type;
    if (competitionId) query.competitionId = competitionId;

    const [incidents, total] = await Promise.all([
      Incident.find(query)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      Incident.countDocuments(query),
    ]);

    return NextResponse.json({
      success: true,
      incidents,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + incidents.length < total,
      },
    });

  } catch (error) {
    console.error('Error listing incidents:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/incidents
 * Create a new incident
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      competitionId,
      challengeId,
      type,
      severity,
      title,
      description,
      affectedUsers,
      evidence,
      priority,
      tags,
    } = body;

    if (!type || !severity || !title || !description) {
      return NextResponse.json(
        { error: 'type, severity, title, and description are required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const incident = await Incident.create({
      competitionId,
      challengeId,
      type,
      severity,
      status: 'open',
      title,
      description,
      affectedUsers: affectedUsers || [],
      evidence: evidence || {},
      priority: priority || 'medium',
      tags: tags || [],
      createdBy: auth.adminId || 'admin',
      createdByEmail: auth.email,
      auditLog: [{
        timestamp: new Date(),
        action: 'incident_created',
        by: auth.adminId || 'admin',
        byEmail: auth.email,
        details: `Incident created: ${title}`,
      }],
    });

    console.log(`📋 [Incident] Created: ${incident._id} - ${title}`);

    // Log to audit trail
    try {
      await auditLogService.logIncidentCreated(
        {
          id: auth.adminId || 'unknown',
          email: auth.email || 'admin@system',
          name: auth.email?.split('@')[0],
          role: 'admin',
        },
        incident._id.toString(),
        title,
        type,
        severity,
        competitionId
      );
    } catch (auditError) {
      console.error('Failed to log audit entry:', auditError);
    }

    return NextResponse.json({
      success: true,
      incident,
    });

  } catch (error) {
    console.error('Error creating incident:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
