import { NextRequest, NextResponse } from 'next/server';
import { fetchTokenData } from '@/lib/market-data';
import { db } from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tokenAddress, tokenSymbol } = body;
    
    if (!tokenAddress) {
      return NextResponse.json(
        { error: 'Token address is required' },
        { status: 400 }
      );
    }

    // Fetch real token data from DexScreener
    const tokenData = await fetchTokenData(tokenAddress);
    
    if (!tokenData) {
      return NextResponse.json(
        { error: 'Token not found' },
        { status: 404 }
      );
    }

    // Get config
    const config = await db.agentConfig.findFirst();
    const stopLossPercent = config?.stopLossPercent || 3;
    const takeProfitPercent = config?.takeProfitPercent || 10;

    // Generate AI analysis using z-ai-web-dev-sdk
    const zai = await ZAI.create();
    
    const prompt = `You are an expert SCALPER AI trading agent specializing in Solana memecoins. Analyze this token for a quick scalp trade.

TOKEN DATA:
- Symbol: ${tokenData.symbol}
- Name: ${tokenData.name}
- Current Price: $${tokenData.currentPrice.toFixed(10)}
- 24h Price Change: ${tokenData.priceChange24h.toFixed(2)}%
- 1h Price Change: ${tokenData.priceChange1h?.toFixed(2) || 0}%
- 5m Price Change: ${tokenData.priceChange5m?.toFixed(2) || 0}%
- 24h Volume: $${tokenData.volume24h.toLocaleString()}
- Market Cap: $${tokenData.marketCap.toLocaleString()}
- Liquidity: $${tokenData.liquidity.toLocaleString()}
- Token Age: ${tokenData.age}
- Is New Token: ${tokenData.isNew ? 'YES' : 'NO'}
- Pump Score: ${tokenData.pumpScore}/100
- Buys Last 5m: ${tokenData.buysLast5m}
- Sells Last 5m: ${tokenData.sellsLast5m}

SCALPING PARAMETERS:
- Stop Loss: ${stopLossPercent}%
- Take Profit: ${takeProfitPercent}%

SCALPING RULES:
1. Pump score > 70 = STRONG BUY
2. Pump score 50-70 = BUY
3. Pump score < 30 = AVOID
4. Check buy/sell ratio in last 5 minutes
5. New tokens have higher risk but higher reward

Respond in JSON only:
{
  "action": "BUY" | "SELL" | "HOLD",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation",
  "marketSentiment": "BULLISH" | "BEARISH" | "NEUTRAL",
  "riskLevel": "LOW" | "MEDIUM" | "HIGH",
  "priceTarget": number or null,
  "stopLossPrice": number or null,
  "scalpingSignal": "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL",
  "urgencyLevel": "IMMEDIATE" | "HIGH" | "MEDIUM" | "LOW"
}`;

    let analysis;
    
    try {
      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'system', content: 'You are a professional scalper AI. Always respond with valid JSON only.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.5,
        max_tokens: 500
      });

      const responseContent = completion.choices[0]?.message?.content || '';
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON in response');
      }
    } catch (e) {
      // Fallback analysis based on pump score
      const pumpScore = tokenData.pumpScore || 0;
      const priceChange5m = tokenData.priceChange5m || 0;
      const buyPressure = tokenData.buysLast5m + tokenData.sellsLast5m > 0
        ? tokenData.buysLast5m / (tokenData.buysLast5m + tokenData.sellsLast5m)
        : 0.5;

      if (pumpScore >= 70 && priceChange5m > 5) {
        analysis = {
          action: 'BUY',
          confidence: 0.85,
          reasoning: `🔥 STRONG PUMP! Score: ${pumpScore}, 5m: +${priceChange5m.toFixed(1)}%`,
          marketSentiment: 'BULLISH',
          riskLevel: 'HIGH',
          scalpingSignal: 'STRONG_BUY',
          urgencyLevel: 'IMMEDIATE'
        };
      } else if (pumpScore >= 50) {
        analysis = {
          action: 'BUY',
          confidence: 0.7,
          reasoning: `📈 Good momentum. Score: ${pumpScore}`,
          marketSentiment: 'BULLISH',
          riskLevel: 'HIGH',
          scalpingSignal: 'BUY',
          urgencyLevel: 'HIGH'
        };
      } else if (pumpScore < 30) {
        analysis = {
          action: 'HOLD',
          confidence: 0.6,
          reasoning: `⏳ Low pump score: ${pumpScore}. Waiting for better entry.`,
          marketSentiment: 'NEUTRAL',
          riskLevel: 'MEDIUM',
          scalpingSignal: 'HOLD',
          urgencyLevel: 'LOW'
        };
      } else {
        analysis = {
          action: 'HOLD',
          confidence: 0.5,
          reasoning: `Monitoring. Score: ${pumpScore}`,
          marketSentiment: 'NEUTRAL',
          riskLevel: 'MEDIUM',
          scalpingSignal: 'HOLD',
          urgencyLevel: 'MEDIUM'
        };
      }
    }

    // Calculate price targets
    const entryPrice = tokenData.currentPrice;
    const priceTarget = analysis.action === 'BUY' ? entryPrice * (1 + takeProfitPercent / 100) : null;
    const stopLossPrice = analysis.action === 'BUY' ? entryPrice * (1 - stopLossPercent / 100) : null;

    // Validate values
    const validActions = ['BUY', 'SELL', 'HOLD'];
    const validSentiments = ['BULLISH', 'BEARISH', 'NEUTRAL'];
    const validRisks = ['LOW', 'MEDIUM', 'HIGH'];
    
    const action = validActions.includes(analysis.action?.toUpperCase()) ? analysis.action.toUpperCase() : 'HOLD';
    const marketSentiment = validSentiments.includes(analysis.marketSentiment?.toUpperCase()) ? analysis.marketSentiment.toUpperCase() : 'NEUTRAL';
    const riskLevel = validRisks.includes(analysis.riskLevel?.toUpperCase()) ? analysis.riskLevel.toUpperCase() : 'HIGH';
    const confidence = Math.min(1, Math.max(0, parseFloat(analysis.confidence) || 0.5));

    // Save decision to database
    const decision = await db.aIDecision.create({
      data: {
        tokenAddress: tokenData.address,
        tokenSymbol: tokenData.symbol,
        tokenName: tokenData.name,
        logoUrl: tokenData.logoUrl,
        action: action as 'BUY' | 'SELL' | 'HOLD',
        confidence,
        reasoning: analysis.reasoning || 'AI analysis',
        marketSentiment,
        riskLevel: riskLevel as 'LOW' | 'MEDIUM' | 'HIGH',
        priceTarget,
        stopLoss: stopLossPrice
      }
    });
    
    return NextResponse.json({
      success: true,
      analysis: {
        id: decision.id,
        tokenAddress: tokenData.address,
        tokenSymbol: tokenData.symbol,
        tokenName: tokenData.name,
        logoUrl: tokenData.logoUrl,
        currentPrice: tokenData.currentPrice,
        pumpScore: tokenData.pumpScore,
        action,
        confidence,
        reasoning: analysis.reasoning,
        marketSentiment,
        riskLevel,
        priceTarget,
        stopLoss: stopLossPrice,
        scalpingSignal: analysis.scalpingSignal || 'HOLD',
        urgencyLevel: analysis.urgencyLevel || 'MEDIUM',
        createdAt: decision.createdAt
      }
    });
  } catch (error) {
    console.error('Analyze route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
