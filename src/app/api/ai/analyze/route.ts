import { NextRequest, NextResponse } from 'next/server';

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

    // Step 1: Fetch token data from DexScreener
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`
    );
    
    if (!response.ok) {
      return NextResponse.json(
        { step: 'fetch_token', error: 'Failed to fetch token data' },
        { status: 500 }
      );
    }

    const data = await response.json();
    
    if (!data.pairs || data.pairs.length === 0) {
      return NextResponse.json(
        { step: 'parse_token', error: 'No pairs found for token' },
        { status: 404 }
      );
    }

    // Get the SOL pair
    const pair = data.pairs.find(
      (p: any) => p.quoteToken?.symbol === 'SOL' && p.chainId === 'solana'
    ) || data.pairs[0];

    // Step 2: Simple analysis without AI (for now)
    const priceChange24h = pair.priceChange?.h24 || 0;
    const priceChange1h = pair.priceChange?.h1 || 0;
    const volume24h = pair.volume?.h24 || 0;
    const liquidity = pair.liquidity?.usd || 0;
    
    // Simple algorithm for recommendation
    let action = 'HOLD';
    let confidence = 50;
    let reasoning = 'Neutral market conditions';
    
    if (priceChange1h > 10 && priceChange24h > 0) {
      action = 'BUY';
      confidence = 70;
      reasoning = `Strong momentum: +${priceChange1h.toFixed(1)}% in 1h, +${priceChange24h.toFixed(1)}% in 24h. Good volume: $${(volume24h/1e6).toFixed(2)}M`;
    } else if (priceChange1h < -10) {
      action = 'SELL';
      confidence = 60;
      reasoning = `Dumping: ${priceChange1h.toFixed(1)}% in 1h. Consider exiting.`;
    } else if (priceChange24h > 50 && liquidity > 100000) {
      action = 'BUY';
      confidence = 65;
      reasoning = `Strong 24h performance: +${priceChange24h.toFixed(1)}%. Good liquidity: $${(liquidity/1e3).toFixed(0)}K`;
    }

    return NextResponse.json({
      success: true,
      token: {
        address: pair.baseToken?.address,
        symbol: pair.baseToken?.symbol,
        name: pair.baseToken?.name,
        priceUsd: pair.priceUsd
      },
      analysis: {
        action,
        confidence,
        reasoning,
        marketSentiment: priceChange24h > 0 ? 'BULLISH' : 'BEARISH',
        riskLevel: liquidity < 50000 ? 'HIGH' : liquidity < 200000 ? 'MEDIUM' : 'LOW',
        metrics: {
          priceChange24h,
          priceChange1h,
          volume24h,
          liquidity
        }
      }
    });

  } catch (error) {
    console.error('AI analyze error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: String(error),
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
