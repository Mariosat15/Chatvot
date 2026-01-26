import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { connectToDatabase } from '@/database/mongoose';
import Incident from '@/database/models/incident.model';

/**
 * GET /api/incidents/[id]
 * Get a single incident by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await connectToDatabase();

    const incident = await Incident.findById(id);
    if (!incident) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      incident,
    });

  } catch (error) {
    console.error('Error getting incident:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/incidents/[id]
 * Update an incident
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const {
      status,
      severity,
      priority,
      assignedTo,
      assignedToEmail,
      resolution,
      tags,
      notes,
    } = body;

    await connectToDatabase();

    const incident = await Incident.findById(id);
    if (!incident) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }

    const changes: string[] = [];

    // Track changes for audit
    if (status && status !== incident.status) {
      changes.push(`status: ${incident.status} -> ${status}`);
      incident.status = status;
      
      if (status === 'resolved') {
        incident.resolvedAt = new Date();
        incident.resolvedBy = auth.adminId;
        incident.resolvedByEmail = auth.email;
      }
    }

    if (severity && severity !== incident.severity) {
      changes.push(`severity: ${incident.severity} -> ${severity}`);
      incident.severity = severity;
    }

    if (priority && priority !== incident.priority) {
      changes.push(`priority: ${incident.priority} -> ${priority}`);
      incident.priority = priority;
    }

    if (assignedTo !== undefined) {
      changes.push(`assignedTo: ${incident.assignedTo || 'none'} -> ${assignedTo || 'unassigned'}`);
      incident.assignedTo = assignedTo || undefined;
      incident.assignedToEmail = assignedToEmail || undefined;
    }

    if (resolution) {
      incident.resolution = {
        ...incident.resolution,
        ...resolution,
      };
      changes.push('resolution updated');
    }

    if (tags) {
      incident.tags = tags;
      changes.push('tags updated');
    }

    // Add audit entry
    if (changes.length > 0) {
      incident.auditLog.push({
        timestamp: new Date(),
        action: 'incident_updated',
        by: auth.adminId || 'admin',
        byEmail: auth.email,
        details: `Updated: ${changes.join(', ')}${notes ? `. Notes: ${notes}` : ''}`,
      });
    }

    await incident.save();

    console.log(`📋 [Incident] Updated ${id}: ${changes.join(', ')}`);

    return NextResponse.json({
      success: true,
      incident,
      changes,
    });

  } catch (error) {
    console.error('Error updating incident:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/incidents/[id]
 * Delete an incident (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await connectToDatabase();

    const incident = await Incident.findById(id);
    if (!incident) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }

    // Only allow deletion of open incidents with no compensations
    if (incident.resolution?.compensations?.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete incident with compensations' },
        { status: 400 }
      );
    }

    await Incident.findByIdAndDelete(id);

    console.log(`📋 [Incident] Deleted: ${id}`);

    return NextResponse.json({
      success: true,
      message: 'Incident deleted',
    });

  } catch (error) {
    console.error('Error deleting incident:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
