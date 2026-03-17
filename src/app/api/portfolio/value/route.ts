import { NextResponse } from 'next/server';
import { tradingService } from '@/lib/trading-service';

export async function GET() {
  try {
    const value = await tradingService.getPortfolioValue();
    
    return NextResponse.json({
      success: true,
      ...value
    });
  } catch (error) {
    console.error('Portfolio value route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
