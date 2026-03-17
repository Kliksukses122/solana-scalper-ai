import { NextRequest, NextResponse } from 'next/server';
import { getTokenMarketData } from '@/lib/market-data';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    
    if (!address) {
      return NextResponse.json(
        { error: 'Token address is required' },
        { status: 400 }
      );
    }

    const marketData = await getTokenMarketData(address);
    
    if (!marketData) {
      return NextResponse.json(
        { error: 'Token not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      token: marketData
    });
  } catch (error) {
    console.error('Token route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
