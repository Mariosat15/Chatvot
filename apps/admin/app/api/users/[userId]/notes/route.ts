import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import UserNote from '@/database/models/user-notes.model';
import { getAdminSession } from '@/lib/admin/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = await params;
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const query: Record<string, any> = { userId };
    if (category && category !== 'all') {
      query.category = category;
    }

    const [notes, total] = await Promise.all([
      UserNote.find(query)
        .sort({ isPinned: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      UserNote.countDocuments(query),
    ]);

    return NextResponse.json({
      notes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching user notes:', error);
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = await params;
    const body = await req.json();
    await connectToDatabase();

    const note = await UserNote.create({
      userId,
      adminId: session.id,
      adminName: session.name || session.email || 'Admin',
      content: body.content,
      category: body.category || 'general',
      priority: body.priority || 'medium',
      isInternal: body.isInternal !== false,
      isPinned: body.isPinned || false,
      relatedKYCSessionId: body.relatedKYCSessionId,
      relatedWithdrawalId: body.relatedWithdrawalId,
      relatedTransactionId: body.relatedTransactionId,
    });

    return NextResponse.json({ note });
  } catch (error) {
    console.error('Error creating user note:', error);
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
  }
}

