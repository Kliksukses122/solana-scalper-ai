import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'AI analyze endpoint is working',
    timestamp: new Date().toISOString()
  });
}

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
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`
    );
    
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch token data from DexScreener' },
        { status: 500 }
      );
    }

    const data = await response.json();
    
    if (!data.pairs || data.pairs.length === 0) {
      return NextResponse.json(
        { error: 'No pairs found for this token' },
        { status: 404 }
      );
    }

    // Get the best pair
    const pair = data.pairs.find(
      (p: any) => p.quoteToken?.symbol === 'SOL' && p.chainId === 'solana'
    ) || data.pairs[0];

    // Generate analysis
    const priceChange24h = pair.priceChange?.h24 || 0;
    const priceChange1h = pair.priceChange?.h1 || 0;
    const volume24h = pair.volume?.h24 || 0;
    const liquidity = pair.liquidity?.usd || 0;
    
    let action = 'HOLD';
    let confidence = 50;
    let reasoning = 'Neutral market conditions';
    
    if (priceChange1h > 10 && priceChange24h > 0) {
      action = 'BUY';
      confidence = 70;
      reasoning = `Strong momentum: +${priceChange1h.toFixed(1)}% in 1h`;
    } else if (priceChange1h < -10) {
      action = 'SELL';
      confidence = 60;
      reasoning = `Dumping: ${priceChange1h.toFixed(1)}% in 1h`;
    } else if (priceChange24h > 50 && liquidity > 100000) {
      action = 'BUY';
      confidence = 65;
      reasoning = `Strong 24h: +${priceChange24h.toFixed(1)}%`;
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
        riskLevel: liquidity < 50000 ? 'HIGH' : 'MEDIUM'
      }
    });

  } catch (error) {
    console.error('AI analyze error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
