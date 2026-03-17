import { NextResponse } from 'next/server';
import { tradingService } from '@/lib/trading-service';

export async function GET() {
  try {
    const portfolio = await tradingService.getPortfolio();
    
    return NextResponse.json({
      success: true,
      portfolio
    });
  } catch (error) {
    console.error('Portfolio route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
