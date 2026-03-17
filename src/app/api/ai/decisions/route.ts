import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const tokenAddress = searchParams.get('tokenAddress');
    
    const where = tokenAddress ? { tokenAddress } : {};
    
    const decisions = await db.aIDecision.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit
    });
    
    return NextResponse.json({
      success: true,
      decisions
    });
  } catch (error) {
    console.error('Decisions route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
