import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { connectToDatabase } from '@/database/mongoose';
import Competition from '@/database/models/trading/competition.model';
import CompetitionParticipant from '@/database/models/trading/competition-participant.model';
import mongoose from 'mongoose';
import { auditLogService } from '@/lib/services/audit-log.service';

const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'your-secret-key';

async function verifyAdminToken(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) return null;

    const payload = jwt.verify(token, JWT_SECRET) as { email: string };
    return payload;
  } catch {
    return null;
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await verifyAdminToken(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid competition ID' }, { status: 400 });
    }

    await connectToDatabase();

    // Check if competition exists
    const competition = await Competition.findById(id);
    if (!competition) {
      return NextResponse.json({ error: 'Competition not found' }, { status: 404 });
    }

    // Check if competition is active with participants
    if (competition.status === 'active' && competition.currentParticipants > 0) {
      return NextResponse.json(
        { error: 'Cannot delete active competition with participants. Cancel it first.' },
        { status: 400 }
      );
    }

    // Delete all participants
    await CompetitionParticipant.deleteMany({ competitionId: id });

    // Delete the competition
    await Competition.findByIdAndDelete(id);

    console.log(`✅ Competition deleted: ${competition.name} (ID: ${id})`);

    // Log audit action
    try {
      await auditLogService.logCompetitionDeleted(
        {
          id: 'admin',
          email: admin.email,
          name: admin.email.split('@')[0],
          role: 'admin',
        },
        id,
        competition.name
      );
    } catch (auditError) {
      console.error('Failed to log audit action:', auditError);
    }

    return NextResponse.json({
      success: true,
      message: 'Competition deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting competition:', error);
    return NextResponse.json(
      { error: 'Failed to delete competition' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await verifyAdminToken(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid competition ID' }, { status: 400 });
    }

    await connectToDatabase();

    const competition = await Competition.findById(id).lean();
    
    if (!competition) {
      return NextResponse.json({ error: 'Competition not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      competition: JSON.parse(JSON.stringify(competition)),
    });
  } catch (error) {
    console.error('Error fetching competition:', error);
    return NextResponse.json(
      { error: 'Failed to fetch competition' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await verifyAdminToken(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid competition ID' }, { status: 400 });
    }

    await connectToDatabase();

    const competition = await Competition.findById(id);
    if (!competition) {
      return NextResponse.json({ error: 'Competition not found' }, { status: 404 });
    }

    // Don't allow editing if competition has started and has participants
    if (competition.status === 'active' && competition.currentParticipants > 0) {
      return NextResponse.json(
        { error: 'Cannot edit active competition with participants' },
        { status: 400 }
      );
    }

    const updateData = await request.json();

    // Update the competition
    Object.assign(competition, updateData);
    await competition.save();

    console.log(`✅ Competition updated: ${competition.name} (ID: ${id})`);

    // Log audit action
    try {
      await auditLogService.logCompetitionUpdated(
        {
          id: 'admin',
          email: admin.email,
          name: admin.email.split('@')[0],
          role: 'admin',
        },
        id,
        competition.name,
        updateData
      );
    } catch (auditError) {
      console.error('Failed to log audit action:', auditError);
    }

    return NextResponse.json({
      success: true,
      message: 'Competition updated successfully',
      competition: JSON.parse(JSON.stringify(competition)),
    });
  } catch (error) {
    console.error('Error updating competition:', error);
    return NextResponse.json(
      { error: 'Failed to update competition' },
      { status: 500 }
    );
  }
}

