import { NextResponse } from 'next/server';
import { tradingService } from '@/lib/trading-service';

export async function GET() {
  try {
    const status = await tradingService.getAgentStatus();
    
    return NextResponse.json({
      success: true,
      status
    });
  } catch (error) {
    console.error('Status route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
