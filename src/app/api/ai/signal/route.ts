import { NextRequest, NextResponse } from 'next/server';
import { getTrendingTokens, getTokenData } from '@/lib/market-data';
import { analyzeToken } from '@/lib/ai-engine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { tokens } = body;
    
    const signals = [];
    
    if (tokens && Array.isArray(tokens) && tokens.length > 0) {
      // Analyze specific tokens
      for (const addr of tokens.slice(0, 5)) {
        try {
          const tokenData = await getTokenData(addr);
          if (tokenData) {
            const analysis = await analyzeToken(tokenData);
            signals.push({
              tokenAddress: tokenData.baseToken.address,
              tokenSymbol: tokenData.baseToken.symbol,
              tokenName: tokenData.baseToken.name,
              currentPrice: parseFloat(tokenData.priceUsd),
              action: analysis.action,
              confidence: analysis.confidence,
              reasoning: analysis.reasoning
            });
          }
        } catch (e) {
          console.error('Error analyzing token:', e);
        }
      }
    } else {
      // Analyze trending tokens
      const trending = await getTrendingTokens();
      
      for (const token of trending.slice(0, 5)) {
        try {
          const analysis = await analyzeToken(token);
          signals.push({
            tokenAddress: token.baseToken.address,
            tokenSymbol: token.baseToken.symbol,
            tokenName: token.baseToken.name,
            currentPrice: parseFloat(token.priceUsd),
            action: analysis.action,
            confidence: analysis.confidence,
            reasoning: analysis.reasoning
          });
        } catch (e) {
          console.error('Error analyzing token:', e);
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      signals
    });
  } catch (error) {
    console.error('Signal route error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const trending = await getTrendingTokens();
    const signals = [];
    
    for (const token of trending.slice(0, 5)) {
      try {
        const analysis = await analyzeToken(token);
        signals.push({
          tokenAddress: token.baseToken.address,
          tokenSymbol: token.baseToken.symbol,
          tokenName: token.baseToken.name,
          currentPrice: parseFloat(token.priceUsd),
          action: analysis.action,
          confidence: analysis.confidence
        });
      } catch (e) {
        console.error('Error analyzing token:', e);
      }
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
