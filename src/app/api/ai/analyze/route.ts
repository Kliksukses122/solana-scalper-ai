import { NextRequest, NextResponse } from 'next/server';
import { analyzeToken } from '@/lib/ai-engine';
import { getTokenData } from '@/lib/market-data';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { tokenAddress } = body;

    if (!tokenAddress) {
      return NextResponse.json(
        { error: 'Token address is required' },
        { status: 400 }
      );
    }

    // Fetch token data from DexScreener
    const tokenData = await getTokenData(tokenAddress);
    
    if (!tokenData) {
      return NextResponse.json(
        { error: 'Token not found' },
        { status: 404 }
      );
    }

    // Run AI analysis
    const analysis = await analyzeToken(tokenData);

    return NextResponse.json({
      success: true,
      token: {
        address: tokenData.baseToken.address,
        symbol: tokenData.baseToken.symbol,
        name: tokenData.baseToken.name,
        priceUsd: tokenData.priceUsd
      },
      analysis
    });

  } catch (error) {
    console.error('AI analyze error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
