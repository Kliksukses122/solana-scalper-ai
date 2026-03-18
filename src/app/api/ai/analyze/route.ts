import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory cache for rate limiting
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'AI Analyze API is ready',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    usage: 'POST with { "tokenAddress": "SOL_TOKEN_ADDRESS" }'
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { tokenAddress } = body;

    if (!tokenAddress) {
      return NextResponse.json(
        { success: false, error: 'Token address is required' },
        { status: 400 }
      );
    }

    // Check cache first
    const cached = cache.get(tokenAddress);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    // Fetch token data from DexScreener API
    const apiUrl = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;
    
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: `DexScreener API error: ${response.status}` },
        { status: 500 }
      );
    }

    const data = await response.json();
    
    if (!data.pairs || data.pairs.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No trading pairs found for this token' },
        { status: 404 }
      );
    }

    // Find the best Solana pair
    const solPair = data.pairs.find(
      (p: any) => p.quoteToken?.symbol === 'SOL' && p.chainId === 'solana'
    );
    const pair = solPair || data.pairs[0];

    // Extract metrics
    const priceUsd = parseFloat(pair.priceUsd || '0');
    const priceChange24h = pair.priceChange?.h24 || 0;
    const priceChange1h = pair.priceChange?.h1 || 0;
    const priceChange5m = pair.priceChange?.m5 || 0;
    const volume24h = pair.volume?.h24 || 0;
    const liquidityUsd = pair.liquidity?.usd || 0;
    const txns24h = pair.txns?.h24 || { buys: 0, sells: 0 };
    const buys = txns24h.buys || 0;
    const sells = txns24h.sells || 0;
    
    // Calculate buy pressure
    const totalTxns = buys + sells;
    const buyPressure = totalTxns > 0 ? (buys / totalTxns) * 100 : 50;

    // Generate trading signal
    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let confidence = 50;
    let reasoning = '';
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';

    // Analysis logic
    if (priceChange1h > 20 && buyPressure > 60) {
      action = 'BUY';
      confidence = 75;
      reasoning = `Strong momentum: +${priceChange1h.toFixed(1)}% in 1h with ${(buyPressure).toFixed(0)}% buy pressure`;
    } else if (priceChange5m > 10 && buyPressure > 70) {
      action = 'BUY';
      confidence = 70;
      reasoning = `Quick pump: +${priceChange5m.toFixed(1)}% in 5m, high buy pressure`;
    } else if (priceChange1h < -15) {
      action = 'SELL';
      confidence = 65;
      reasoning = `Dump detected: ${priceChange1h.toFixed(1)}% in 1h`;
    } else if (priceChange5m < -10) {
      action = 'SELL';
      confidence = 60;
      reasoning = `Rapid decline: ${priceChange5m.toFixed(1)}% in 5m`;
    } else if (priceChange24h > 100 && liquidityUsd > 100000) {
      action = 'BUY';
      confidence = 65;
      reasoning = `Strong 24h: +${priceChange24h.toFixed(0)}%, good liquidity $${(liquidityUsd/1e3).toFixed(0)}K`;
    } else {
      action = 'HOLD';
      confidence = 50;
      reasoning = 'No strong signal - waiting for better entry';
    }

    // Risk assessment
    if (liquidityUsd < 10000) {
      riskLevel = 'HIGH';
      confidence = Math.min(confidence, 40);
      reasoning += ' ⚠️ Low liquidity';
    } else if (liquidityUsd < 50000) {
      riskLevel = 'MEDIUM';
    } else {
      riskLevel = 'LOW';
    }

    const result = {
      success: true,
      token: {
        address: pair.baseToken?.address || tokenAddress,
        symbol: pair.baseToken?.symbol || 'UNKNOWN',
        name: pair.baseToken?.name || 'Unknown Token',
        priceUsd: pair.priceUsd || '0',
        logoUrl: pair.info?.imageUrl || null
      },
      analysis: {
        action,
        confidence,
        reasoning,
        marketSentiment: priceChange24h > 0 ? 'BULLISH' : priceChange24h < -10 ? 'BEARISH' : 'NEUTRAL',
        riskLevel,
        stopLoss: action === 'BUY' ? priceUsd * 0.95 : null,
        takeProfit: action === 'BUY' ? priceUsd * 1.15 : null
      },
      metrics: {
        priceChange24h,
        priceChange1h,
        priceChange5m,
        volume24h,
        liquidityUsd,
        buyPressure: buyPressure.toFixed(1),
        buysLast24h: buys,
        sellsLast24h: sells
      }
    };

    // Cache the result
    cache.set(tokenAddress, { data: result, timestamp: Date.now() });

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('AI analyze error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error?.message || String(error)
      },
      { status: 500 }
    );
  }
}
