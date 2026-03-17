import { NextRequest, NextResponse } from 'next/server';
import { tradingService } from '@/lib/trading-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    
    const history = await tradingService.getTradeHistory(limit);
    
    return NextResponse.json({
      success: true,
      trades: history
    });
  } catch (error) {
    console.error('History route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
