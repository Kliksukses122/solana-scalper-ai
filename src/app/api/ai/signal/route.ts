import { NextRequest, NextResponse } from 'next/server';
import { fetchTrendingTokens } from '@/lib/market-data';
import { tokenSecurity } from '@/lib/token-security';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { tokens } = body;
    
    let tokensToAnalyze = [];
    
    if (tokens && Array.isArray(tokens) && tokens.length > 0) {
      // Analyze specific tokens - fetch their data
      const { fetchTokenData } = await import('@/lib/market-data');
      for (const addr of tokens) {
        const tokenData = await fetchTokenData(addr);
        if (tokenData) {
          tokensToAnalyze.push({
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
            priceChange1h: tokenData.priceChange1h,
            priceChange5m: tokenData.priceChange5m,
            age: tokenData.age,
            isNew: tokenData.isNew,
            pumpScore: tokenData.pumpScore,
            volumeToMcap: tokenData.volumeToMcap,
            buysLast5m: tokenData.buysLast5m,
            sellsLast5m: tokenData.sellsLast5m
          });
        }
      }
    } else {
      // Analyze trending tokens
      const trending = await fetchTrendingTokens();
      tokensToAnalyze = trending.map(t => ({
        tokenAddress: t.address,
        tokenSymbol: t.symbol,
        tokenName: t.name,
        logoUrl: t.logoUrl,
        currentPrice: t.currentPrice,
        priceChange24h: t.priceChange24h,
        priceChange7d: t.priceChange24h * 1.5,
        volume24h: t.volume24h,
        volumeChange24h: 0,
        marketCap: t.marketCap,
        liquidity: t.liquidity,
        holders: 0,
        transactions24h: 0,
        buyPressure: t.buysLast5m + t.sellsLast5m > 0 
          ? t.buysLast5m / (t.buysLast5m + t.sellsLast5m) 
          : 0.5,
        socialMentions: 0,
        sentiment: t.priceChange24h > 0 ? 0.5 : -0.5,
        priceChange1h: t.priceChange1h,
        priceChange5m: t.priceChange5m,
        age: t.age,
        isNew: t.isNew,
        pumpScore: t.pumpScore,
        volumeToMcap: t.volumeToMcap,
        buysLast5m: t.buysLast5m,
        sellsLast5m: t.sellsLast5m
      }));
    }
    
    // Generate signals with security check
    const signals = [];
    for (const token of tokensToAnalyze) {
      // Quick security check
      const security = await tokenSecurity.checkToken(token.tokenAddress, token);
      const signal = tokenSecurity.generateEntrySignal(token, security);
      
      signals.push({
        tokenAddress: token.tokenAddress,
        tokenSymbol: token.tokenSymbol,
        tokenName: token.tokenName,
        logoUrl: token.logoUrl,
        currentPrice: token.currentPrice,
        action: signal.shouldEnter ? 'BUY' : 'HOLD',
        confidence: signal.confidence,
        signalStrength: signal.signalStrength,
        securityScore: security.score,
        reasons: signal.reasons,
        warnings: security.warnings
      });
    }
    
    return NextResponse.json({
      success: true,
      signals
    });
  } catch (error) {
    console.error('Signal route error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate signals', details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const trending = await fetchTrendingTokens();
    
    const signals = [];
    for (const token of trending.slice(0, 10)) {
      const security = await tokenSecurity.checkToken(token.address, token);
      const signal = tokenSecurity.generateEntrySignal(token, security);
      
      signals.push({
        tokenAddress: token.address,
        tokenSymbol: token.symbol,
        tokenName: token.name,
        logoUrl: token.logoUrl,
        currentPrice: token.currentPrice,
        action: signal.shouldEnter ? 'BUY' : 'HOLD',
        confidence: signal.confidence,
        signalStrength: signal.signalStrength,
        securityScore: security.score,
        reasons: signal.reasons
      });
    }
    
    return NextResponse.json({
      success: true,
      signals
    });
  } catch (error) {
    console.error('Signal GET error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
