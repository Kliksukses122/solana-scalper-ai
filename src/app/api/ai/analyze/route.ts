import { NextRequest, NextResponse } from 'next/server';
import { aiEngine } from '@/lib/ai-engine';
import { fetchTokenData } from '@/lib/market-data';

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

    // Fetch token data
    const tokenData = await fetchTokenData(tokenAddress);
    
    if (!tokenData) {
      return NextResponse.json(
        { error: 'Token not found' },
        { status: 404 }
      );
    }

    // Prepare data for AI analysis
    const marketData = {
      tokenAddress: tokenData.address,
      tokenSymbol: tokenData.symbol,
      tokenName: tokenData.name,
      logoUrl: tokenData.logoUrl,
      currentPrice: tokenData.currentPrice,
      priceChange24h: tokenData.priceChange24h,
      priceChange7d: tokenData.priceChange24h * 1.5,
      volume24h: tokenData.volume24h,
      volumeChange24h: 0,
      marketCap: tokenData.marketCap,
      liquidity: tokenData.liquidity,
      holders: 0,
      transactions24h: 0,
      buyPressure: tokenData.buysLast5m + tokenData.sellsLast5m > 0 
        ? tokenData.buysLast5m / (tokenData.buysLast5m + tokenData.sellsLast5m) 
        : 0.5,
      socialMentions: 0,
      sentiment: tokenData.priceChange24h > 0 ? 0.5 : -0.5,
      // Scalper metrics
      priceChange1h: tokenData.priceChange1h,
      priceChange5m: tokenData.priceChange5m,
      age: tokenData.age,
      isNew: tokenData.isNew,
      pumpScore: tokenData.pumpScore,
      volumeToMcap: tokenData.volumeToMcap,
      buysLast5m: tokenData.buysLast5m,
      sellsLast5m: tokenData.sellsLast5m
    };

    // Run AI analysis
    const decision = await aiEngine.analyzeToken(marketData);

    return NextResponse.json({
      success: true,
      token: {
        address: tokenData.address,
        symbol: tokenData.symbol,
        name: tokenData.name,
        logoUrl: tokenData.logoUrl,
        currentPrice: tokenData.currentPrice
      },
      analysis: decision
    });

  } catch (error) {
    console.error('AI analyze error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
