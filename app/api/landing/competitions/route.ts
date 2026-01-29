import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import mongoose from 'mongoose';

/**
 * GET /api/landing/competitions
 * Returns active and upcoming competitions for the landing page
 * No auth required - public endpoint
 */
export async function GET() {
  try {
    await connectToDatabase();
    const db = mongoose.connection.db;
    
    if (!db) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Get active and upcoming competitions
    const competitions = await db.collection('competitions').find({
      status: { $in: ['active', 'upcoming'] },
    }).sort({ 
      status: 1, // Active first, then upcoming
      startTime: 1 
    }).limit(6).toArray();

    // Format competitions for display
    const formattedCompetitions = competitions.map(comp => {
      const now = new Date();
      const startTime = new Date(comp.startTime);
      const endTime = new Date(comp.endTime);
      
      // Calculate time remaining or until start
      let timeLabel = '';
      let timeValue = '';
      
      if (comp.status === 'active') {
        const msRemaining = endTime.getTime() - now.getTime();
        timeLabel = 'Ends in';
        timeValue = formatTimeRemaining(msRemaining);
      } else {
        const msUntilStart = startTime.getTime() - now.getTime();
        timeLabel = 'Starts in';
        timeValue = formatTimeRemaining(msUntilStart);
      }

      // Determine status badge
      let statusBadge = 'OPEN';
      let statusColor = 'blue';
      
      if (comp.status === 'active') {
        statusBadge = 'LIVE';
        statusColor = 'green';
      } else if (comp.currentParticipants >= comp.maxParticipants) {
        statusBadge = 'FULL';
        statusColor = 'red';
      } else if (startTime.getTime() - now.getTime() < 60 * 60 * 1000) {
        statusBadge = 'STARTING';
        statusColor = 'yellow';
      }

      return {
        id: comp._id.toString(),
        name: comp.name,
        description: comp.description?.slice(0, 100) || '',
        prizePool: comp.prizePool || 0,
        prizePoolFormatted: formatCurrency(comp.prizePool || 0),
        entryFee: comp.entryFee || 0,
        entryFeeFormatted: formatCurrency(comp.entryFee || 0),
        currentParticipants: comp.currentParticipants || 0,
        maxParticipants: comp.maxParticipants || 100,
        participantsPercentage: Math.round(((comp.currentParticipants || 0) / (comp.maxParticipants || 100)) * 100),
        status: comp.status,
        statusBadge,
        statusColor,
        timeLabel,
        timeValue,
        startTime: comp.startTime,
        endTime: comp.endTime,
        competitionType: comp.competitionType || 'time_based',
        rankingMethod: comp.rules?.rankingMethod || 'pnl',
        // First place prize percentage
        firstPlacePercentage: comp.prizeDistribution?.[0]?.percentage || 50,
      };
    });

    // Separate active and upcoming
    const activeCompetitions = formattedCompetitions.filter(c => c.status === 'active');
    const upcomingCompetitions = formattedCompetitions.filter(c => c.status === 'upcoming');

    return NextResponse.json({
      active: activeCompetitions,
      upcoming: upcomingCompetitions,
      total: formattedCompetitions.length,
      updatedAt: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    console.error('Error fetching landing competitions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch competitions' },
      { status: 500 }
    );
  }
}

function formatTimeRemaining(ms: number): string {
  if (ms < 0) return 'Ended';
  
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  
  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return '$' + (amount / 1000000).toFixed(1) + 'M';
  }
  if (amount >= 1000) {
    return '$' + (amount / 1000).toFixed(0) + 'K';
  }
  return '$' + amount.toLocaleString();
}
