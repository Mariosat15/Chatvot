import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { connectToDatabase } from '@/database/mongoose';
import Competition from '@/database/models/trading/competition.model';

const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'your-secret-key';

async function verifyAdminToken(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) return null;

    const payload = jwt.verify(token, JWT_SECRET) as { email: string };
    return payload;
  } catch (error) {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdminToken(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    // Get all competitions sorted by start time (newest first)
    const competitions = await Competition.find()
      .sort({ startTime: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      competitions: JSON.parse(JSON.stringify(competitions)),
    });
  } catch (error) {
    console.error('Error fetching competitions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch competitions' },
      { status: 500 }
    );
  }
}

