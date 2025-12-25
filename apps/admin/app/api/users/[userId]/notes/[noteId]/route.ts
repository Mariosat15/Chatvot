import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import UserNote from '@/database/models/user-notes.model';
import { getAdminSession } from '@/lib/admin/auth';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string; noteId: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { noteId } = await params;
    const body = await req.json();
    await connectToDatabase();

    const updateFields: Record<string, any> = {};
    if (body.content !== undefined) updateFields.content = body.content;
    if (body.category !== undefined) updateFields.category = body.category;
    if (body.priority !== undefined) updateFields.priority = body.priority;
    if (body.isPinned !== undefined) updateFields.isPinned = body.isPinned;
    if (body.isInternal !== undefined) updateFields.isInternal = body.isInternal;

    const note = await UserNote.findByIdAndUpdate(
      noteId,
      { $set: updateFields },
      { new: true }
    );

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    return NextResponse.json({ note });
  } catch (error) {
    console.error('Error updating user note:', error);
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string; noteId: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { noteId } = await params;
    await connectToDatabase();

    const note = await UserNote.findByIdAndDelete(noteId);

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user note:', error);
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
  }
}

