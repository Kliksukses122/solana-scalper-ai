import ZAI from 'z-ai-web-dev-sdk';
import { db } from './db';
import type { RiskTolerance, TradeAction, RiskLevel } from '@prisma/client';

export interface MarketData {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  logoUrl?: string | null;
  currentPrice: number;
  priceChange24h: number;
  priceChange7d: number;
  volume24h: number;
  volumeChange24h: number;
  marketCap: number;
  liquidity: number;
  holders: number;
  transactions24h: number;
  buyPressure: number;
  socialMentions: number;
  sentiment: number;
}

export interface ScalperData extends MarketData {
  priceChange1h: number;
  priceChange5m: number;
  age: string;
  isNew: boolean;
  pumpScore: number;
  volumeToMcap: number;
  buysLast5m: number;
  sellsLast5m: number;
  logoUrl?: string | null;
}

export interface AIDecisionResult {
  action: TradeAction;
  confidence: number;
  reasoning: string;
  marketSentiment: string;
  riskLevel: RiskLevel;
  priceTarget: number | null;
  stopLoss: number | null;
  positionSize: number;
  scalpingSignal: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  entryPrice: number | null;
  exitTarget: number | null;
  urgencyLevel: 'IMMEDIATE' | 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface PortfolioContext {
  totalValue: number;
  positions: Array<{
    tokenAddress: string;
    tokenSymbol: string;
    balance: number;
    avgBuyPrice: number;
    currentPrice: number;
    pnl: number;
    allocation: number;
  }>;
  riskTolerance: RiskTolerance;
  maxPositionSize: number;
}

export class AIEngine {
  private zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;

  async initialize() {
    if (!this.zai) {
      this.zai = await ZAI.create();
    }
    return this.zai;
  }

  async analyzeToken(marketData: MarketData): Promise<AIDecisionResult> {
    const zai = await this.initialize();
    
    const config = await db.agentConfig.findFirst();
    const riskTolerance = config?.riskTolerance || 'HIGH';
    const maxPositionSize = config?.maxPositionSize || 5;
    const stopLossPercent = config?.stopLossPercent || 3;
    const takeProfitPercent = config?.takeProfitPercent || 10;

    const portfolio = await this.getPortfolioContext();

    // Check if this is scalper data
    const scalperData = marketData as ScalperData;
    const isScalperMode = scalperData.priceChange5m !== undefined;

    const prompt = `You are an expert SCALPER AI trading agent specializing in Solana memecoins. Your focus is on QUICK PROFITS from new tokens with high pump potential.

TOKEN DATA:
- Symbol: ${marketData.tokenSymbol}
- Name: ${marketData.tokenName}
- Current Price: $${marketData.currentPrice.toFixed(10)}
- 24h Price Change: ${marketData.priceChange24h.toFixed(2)}%
- 7d Price Change: ${marketData.priceChange7d.toFixed(2)}%
- 24h Volume: $${(marketData.volume24h).toLocaleString()}
- Volume Change 24h: ${marketData.volumeChange24h.toFixed(2)}%
- Market Cap: $${(marketData.marketCap).toLocaleString()}
- Liquidity: $${(marketData.liquidity).toLocaleString()}
- Holders: ${marketData.holders}
- 24h Transactions: ${marketData.transactions24h}
- Buy Pressure: ${(marketData.buyPressure * 100).toFixed(1)}%
- Social Mentions (24h): ${marketData.socialMentions}
- Social Sentiment: ${marketData.sentiment.toFixed(2)}

${isScalperMode ? `
SCALPER METRICS:
- 1h Price Change: ${scalperData.priceChange1h?.toFixed(2)}%
- 5m Price Change: ${scalperData.priceChange5m?.toFixed(2)}%
- Token Age: ${scalperData.age || 'Unknown'}
- Is New Token: ${scalperData.isNew ? 'YES' : 'NO'}
- Pump Score: ${scalperData.pumpScore?.toFixed(1)}/100
- Volume to Market Cap Ratio: ${scalperData.volumeToMcap?.toFixed(3)}
- Buys Last 5m: ${scalperData.buysLast5m}
- Sells Last 5m: ${scalperData.sellsLast5m}
` : ''}

PORTFOLIO CONTEXT:
- Total Portfolio Value: $${portfolio.totalValue.toFixed(2)}
- Current Positions: ${portfolio.positions.length}
- Risk Tolerance: ${riskTolerance}
- Max Position Size: ${maxPositionSize} SOL

SCALPING PARAMETERS:
- Stop Loss: ${stopLossPercent}%
- Take Profit: ${takeProfitPercent}%

SCALPING ANALYSIS RULES:
1. Prioritize NEW tokens (< 24h old) with high pump scores
2. Look for 5m price changes > 5% as entry signals
3. Check buy/sell ratio in last 5 minutes
4. Volume to market cap ratio should be > 0.1 for good liquidity
5. Pump score > 70 = STRONG BUY opportunity
6. Pump score 50-70 = BUY opportunity
7. Pump score < 30 = AVOID or SELL
8. If 5m change is negative and > -5%, consider exit

Respond in JSON format only with this structure:
{
  "action": "BUY" | "SELL" | "HOLD",
  "confidence": 0.0-1.0,
  "reasoning": "Brief scalping-focused explanation",
  "marketSentiment": "BULLISH" | "BEARISH" | "NEUTRAL",
  "riskLevel": "LOW" | "MEDIUM" | "HIGH",
  "priceTarget": number or null,
  "stopLossPrice": number or null,
  "suggestedPositionSize": number (in SOL),
  "scalpingSignal": "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL",
  "entryPrice": number or null,
  "exitTarget": number or null (take profit price),
  "urgencyLevel": "IMMEDIATE" | "HIGH" | "MEDIUM" | "LOW"
}`;

    try {
      const completion = await zai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: 'You are a professional scalper AI. Always respond with valid JSON only, no markdown formatting. Focus on quick profits and risk management.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.5,
        max_tokens: 800
      });

      const responseContent = completion.choices[0]?.message?.content || '';
      
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      const action = this.validateAction(parsed.action);
      const riskLevel = this.validateRiskLevel(parsed.riskLevel);
      
      return {
        action,
        confidence: Math.min(1, Math.max(0, parseFloat(parsed.confidence) || 0.5)),
        reasoning: parsed.reasoning || 'Scalping analysis',
        marketSentiment: parsed.marketSentiment || 'NEUTRAL',
        riskLevel,
        priceTarget: parsed.priceTarget ? parseFloat(parsed.priceTarget) : null,
        stopLoss: parsed.stopLossPrice ? parseFloat(parsed.stopLossPrice) : null,
        positionSize: Math.min(maxPositionSize, Math.max(0.1, parseFloat(parsed.suggestedPositionSize) || 1)),
        scalpingSignal: this.validateScalpingSignal(parsed.scalpingSignal),
        entryPrice: parsed.entryPrice ? parseFloat(parsed.entryPrice) : marketData.currentPrice,
        exitTarget: parsed.exitTarget ? parseFloat(parsed.exitTarget) : null,
        urgencyLevel: this.validateUrgency(parsed.urgencyLevel)
      };
    } catch (error) {
      console.error('AI Analysis error:', error);
      return this.generateScalperFallbackDecision(marketData as ScalperData, stopLossPercent, takeProfitPercent);
    }
  }

  async generateTradingSignal(tokens: MarketData[]): Promise<AIDecisionResult[]> {
    const results: AIDecisionResult[] = [];
    
    for (const token of tokens) {
      const decision = await this.analyzeToken(token);
      results.push(decision);
      
      await db.aIDecision.create({
        data: {
          tokenAddress: token.tokenAddress,
          tokenSymbol: token.tokenSymbol,
          tokenName: token.tokenName,
          logoUrl: token.logoUrl,
          action: decision.action,
          confidence: decision.confidence,
          reasoning: decision.reasoning,
          marketSentiment: decision.marketSentiment,
          riskLevel: decision.riskLevel,
          priceTarget: decision.priceTarget,
          stopLoss: decision.stopLoss
        }
      });
    }
    
    return results;
  }

  private async getPortfolioContext(): Promise<PortfolioContext> {
    const config = await db.agentConfig.findFirst();
    const positions = await db.portfolio.findMany();
    
    const totalValue = positions.reduce((sum, p) => sum + (p.balance * p.currentPrice), 0);
    
    return {
      totalValue,
      positions: positions.map(p => ({
        tokenAddress: p.tokenAddress,
        tokenSymbol: p.tokenSymbol,
        balance: p.balance,
        avgBuyPrice: p.avgBuyPrice,
        currentPrice: p.currentPrice,
        pnl: p.pnl,
        allocation: totalValue > 0 ? (p.balance * p.currentPrice) / totalValue : 0
      })),
      riskTolerance: config?.riskTolerance || 'HIGH',
      maxPositionSize: config?.maxPositionSize || 5
    };
  }

  private validateAction(action: string): TradeAction {
    const validActions: TradeAction[] = ['BUY', 'SELL', 'HOLD'];
    const upper = action?.toUpperCase();
    return validActions.includes(upper as TradeAction) ? upper as TradeAction : 'HOLD';
  }

  private validateRiskLevel(level: string): RiskLevel {
    const validLevels: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH'];
    const upper = level?.toUpperCase();
    return validLevels.includes(upper as RiskLevel) ? upper as RiskLevel : 'HIGH';
  }

  private validateScalpingSignal(signal: string): 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL' {
    const validSignals = ['STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL'];
    const upper = signal?.toUpperCase();
    return validSignals.includes(upper) ? upper as typeof validSignals[number] : 'HOLD';
  }

  private validateUrgency(urgency: string): 'IMMEDIATE' | 'HIGH' | 'MEDIUM' | 'LOW' {
    const validLevels = ['IMMEDIATE', 'HIGH', 'MEDIUM', 'LOW'];
    const upper = urgency?.toUpperCase();
    return validLevels.includes(upper) ? upper as typeof validLevels[number] : 'MEDIUM';
  }

  private generateScalperFallbackDecision(data: ScalperData, stopLossPercent: number, takeProfitPercent: number): AIDecisionResult {
    let action: TradeAction = 'HOLD';
    let confidence = 0.5;
    let reasoning = 'Scalper analysis - monitoring for entry';
    let marketSentiment = 'NEUTRAL';
    let riskLevel: RiskLevel = 'HIGH';
    let scalpingSignal: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL' = 'HOLD';
    let urgencyLevel: 'IMMEDIATE' | 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';

    const pumpScore = data.pumpScore || 0;
    const priceChange5m = data.priceChange5m || 0;
    const priceChange1h = data.priceChange1h || 0;
    const buyPressure = data.buyPressure || 0.5;
    const isNew = data.isNew;

    // Scalper logic based on pump score
    if (pumpScore >= 70 && priceChange5m > 5 && buyPressure > 0.6) {
      action = 'BUY';
      scalpingSignal = 'STRONG_BUY';
      confidence = 0.85;
      reasoning = `🔥 STRONG PUMP DETECTED! Pump score: ${pumpScore.toFixed(0)}, 5m: +${priceChange5m.toFixed(1)}%, 1h: +${priceChange1h.toFixed(1)}%. High buy pressure (${(buyPressure * 100).toFixed(0)}%). ${isNew ? 'NEW TOKEN - ' : ''}Entry opportunity!`;
      marketSentiment = 'BULLISH';
      riskLevel = 'HIGH';
      urgencyLevel = 'IMMEDIATE';
    } else if (pumpScore >= 50 && priceChange5m > 2 && buyPressure > 0.55) {
      action = 'BUY';
      scalpingSignal = 'BUY';
      confidence = 0.7;
      reasoning = `📈 Good pump momentum. Pump score: ${pumpScore.toFixed(0)}, 5m: +${priceChange5m.toFixed(1)}%. Watch for continuation.`;
      marketSentiment = 'BULLISH';
      riskLevel = 'HIGH';
      urgencyLevel = 'HIGH';
    } else if (pumpScore >= 30 && priceChange1h > 10) {
      action = 'HOLD';
      scalpingSignal = 'HOLD';
      confidence = 0.6;
      reasoning = `⚠️ Moderate pump (${pumpScore.toFixed(0)} score). Wait for better entry or confirmation.`;
      marketSentiment = 'NEUTRAL';
      riskLevel = 'MEDIUM';
      urgencyLevel = 'MEDIUM';
    } else if (priceChange5m < -5 || buyPressure < 0.35) {
      action = 'SELL';
      scalpingSignal = 'SELL';
      confidence = 0.75;
      reasoning = `📉 Dump detected! 5m: ${priceChange5m.toFixed(1)}%, Buy pressure: ${(buyPressure * 100).toFixed(0)}%. Exit recommended.`;
      marketSentiment = 'BEARISH';
      riskLevel = 'HIGH';
      urgencyLevel = 'IMMEDIATE';
    } else if (pumpScore < 30 && priceChange1h < 0) {
      action = 'SELL';
      scalpingSignal = 'STRONG_SELL';
      confidence = 0.8;
      reasoning = `❌ Pump exhausted. Score: ${pumpScore.toFixed(0)}, 1h: ${priceChange1h.toFixed(1)}%. Take profits or cut losses.`;
      marketSentiment = 'BEARISH';
      riskLevel = 'MEDIUM';
      urgencyLevel = 'HIGH';
    } else {
      action = 'HOLD';
      scalpingSignal = 'HOLD';
      confidence = 0.5;
      reasoning = `⏳ Monitoring. Pump score: ${pumpScore.toFixed(0)}, 5m: ${priceChange5m.toFixed(1)}%. No clear signal yet.`;
      marketSentiment = 'NEUTRAL';
      riskLevel = 'MEDIUM';
      urgencyLevel = 'LOW';
    }

    const entryPrice = data.currentPrice;
    const exitTarget = action === 'BUY' ? entryPrice * (1 + takeProfitPercent / 100) : null;

    return {
      action,
      confidence,
      reasoning,
      marketSentiment,
      riskLevel,
      priceTarget: exitTarget,
      stopLoss: action === 'BUY' ? entryPrice * (1 - stopLossPercent / 100) : null,
      positionSize: isNew ? 0.5 : 1, // Smaller position for new/risky tokens
      scalpingSignal,
      entryPrice,
      exitTarget,
      urgencyLevel
    };
  }

  async assessRisk(marketData: MarketData, portfolio: PortfolioContext): Promise<{
    riskScore: number;
    factors: string[];
    recommendation: string;
  }> {
    const factors: string[] = [];
    let riskScore = 0;

    const scalperData = marketData as ScalperData;

    // New token risk (high for scalping)
    if (scalperData.isNew) {
      riskScore += 15;
      factors.push('⚠️ NEW token - extreme volatility expected');
    }

    // Pump exhaustion risk
    if (scalperData.priceChange1h > 100) {
      riskScore += 20;
      factors.push('🚨 Extreme 1h pump - potential exhaustion');
    }

    // Liquidity risk
    if (marketData.liquidity < 50000) {
      riskScore += 25;
      factors.push('💧 Low liquidity - high slippage risk');
    }

    // Volume/MCap ratio
    const volToMcap = scalperData.volumeToMcap || (marketData.volume24h / marketData.marketCap);
    if (volToMcap > 0.5) {
      riskScore += 10;
      factors.push('📊 High volume relative to mcap - check for wash trading');
    }

    // Buy pressure extreme
    if (marketData.buyPressure > 0.85) {
      riskScore += 10;
      factors.push('🔥 Extreme buy pressure - FOMO warning');
    } else if (marketData.buyPressure < 0.35) {
      riskScore += 15;
      factors.push('📉 Low buy pressure - distribution phase');
    }

    riskScore = Math.min(100, riskScore);

    let recommendation = 'Proceed with small position';
    if (riskScore > 70) {
      recommendation = '⛔ Very high risk - consider skipping';
    } else if (riskScore > 50) {
      recommendation = '⚠️ High risk - use tight stop-loss';
    } else if (riskScore > 30) {
      recommendation = '⚡ Moderate risk - standard position size';
    }

    return { riskScore, factors, recommendation };
  }
}

export const aiEngine = new AIEngine();
