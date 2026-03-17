import { db } from './db';
import { aiEngine } from './ai-engine';
import { tradingService } from './trading-service';
import { fetchTrendingTokens, fetchTokenData } from './market-data';
import { tokenSecurity, SecurityCheck, EntrySignal } from './token-security';

export interface AutoTraderStatus {
  isRunning: boolean;
  lastScan: Date | null;
  tokensScanned: number;
  signalsGenerated: number;
  tradesExecuted: number;
  tradesRejected: number;
  nextScan: Date | null;
  errors: string[];
  dailyPnL: number;
  positionsCount: number;
}

export interface ScanResult {
  timestamp: Date;
  tokensScanned: number;
  tokensRejected: number;
  signals: Array<{
    tokenAddress: string;
    tokenSymbol: string;
    action: string;
    confidence: number;
    executed?: boolean;
    txHash?: string;
    error?: string;
    securityScore?: number;
    signalStrength?: string;
  }>;
  tradesExecuted: number;
}

interface RiskManagement {
  maxPositions: number;          // Max open positions at once
  maxDailyLoss: number;          // Max daily loss in SOL
  minTimeBetweenTrades: number;  // Cooldown in seconds
  maxTradesPerHour: number;      // Rate limiting
  maxPositionSize: number;       // Max SOL per trade
  minSecurityScore: number;      // Minimum security score to trade
}

const DEFAULT_RISK: RiskManagement = {
  maxPositions: 5,
  maxDailyLoss: 2,       // 2 SOL max daily loss
  minTimeBetweenTrades: 30,  // 30 seconds cooldown
  maxTradesPerHour: 10,
  maxPositionSize: 5,
  minSecurityScore: 40
};

class AutoTrader {
  private isRunning: boolean = false;
  private lastScan: Date | null = null;
  private tokensScanned: number = 0;
  private signalsGenerated: number = 0;
  private tradesExecuted: number = 0;
  private tradesRejected: number = 0;
  private errors: string[] = [];
  private intervalId: NodeJS.Timeout | null = null;
  private lastTradeTime: Date | null = null;
  private hourlyTradeCount: number = 0;
  private hourlyResetTime: Date | null = null;
  private dailyPnL: number = 0;
  private dailyResetTime: Date | null = null;

  /**
   * Start auto-trading loop
   */
  async start(intervalMs: number = 60000): Promise<void> {
    if (this.isRunning) {
      console.log('Auto-trader already running');
      return;
    }

    this.isRunning = true;
    this.resetCounters();
    console.log('🚀 Auto-trader started, scanning every', intervalMs / 1000, 'seconds');

    // Run first scan immediately
    await this.scanAndTrade();

    // Schedule subsequent scans
    this.intervalId = setInterval(async () => {
      await this.scanAndTrade();
    }, intervalMs);
  }

  /**
   * Stop auto-trading loop
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('🛑 Auto-trader stopped');
  }

  /**
   * Get current auto-trader status
   */
  getStatus(): AutoTraderStatus {
    return {
      isRunning: this.isRunning,
      lastScan: this.lastScan,
      tokensScanned: this.tokensScanned,
      signalsGenerated: this.signalsGenerated,
      tradesExecuted: this.tradesExecuted,
      tradesRejected: this.tradesRejected,
      nextScan: this.isRunning && this.lastScan 
        ? new Date(this.lastScan.getTime() + 60000) 
        : null,
      errors: this.errors.slice(-10),
      dailyPnL: this.dailyPnL,
      positionsCount: 0
    };
  }

  /**
   * Reset hourly/daily counters
   */
  private resetCounters(): void {
    const now = new Date();
    
    // Reset hourly counter
    if (!this.hourlyResetTime || now.getTime() - this.hourlyResetTime.getTime() > 3600000) {
      this.hourlyTradeCount = 0;
      this.hourlyResetTime = now;
    }
    
    // Reset daily counter
    if (!this.dailyResetTime || now.getTime() - this.dailyResetTime.getTime() > 86400000) {
      this.dailyPnL = 0;
      this.dailyResetTime = now;
    }
  }

  /**
   * Main scanning and trading logic with enhanced security
   */
  async scanAndTrade(): Promise<ScanResult> {
    const result: ScanResult = {
      timestamp: new Date(),
      tokensScanned: 0,
      tokensRejected: 0,
      signals: [],
      tradesExecuted: 0
    };

    try {
      this.resetCounters();

      // Check if auto-trade is enabled
      const config = await db.agentConfig.findFirst();
      if (!config?.autoTradeEnabled) {
        console.log('Auto-trade is disabled, skipping scan');
        return result;
      }

      // Get current positions for risk management
      const positions = await tradingService.getPortfolio();
      const positionCount = positions.length;

      // Check risk limits
      if (positionCount >= DEFAULT_RISK.maxPositions) {
        console.log(`⏸️ Max positions reached (${positionCount}/${DEFAULT_RISK.maxPositions})`);
        return result;
      }

      if (this.dailyPnL <= -DEFAULT_RISK.maxDailyLoss) {
        console.log(`⏸️ Daily loss limit reached: ${this.dailyPnL.toFixed(2)} SOL`);
        return result;
      }

      if (this.hourlyTradeCount >= DEFAULT_RISK.maxTradesPerHour) {
        console.log(`⏸️ Hourly trade limit reached: ${this.hourlyTradeCount}`);
        return result;
      }

      console.log('🔍 Scanning for trading opportunities...');

      // Fetch trending tokens
      const trending = await fetchTrendingTokens();
      result.tokensScanned = trending.length;
      this.tokensScanned += trending.length;

      if (trending.length === 0) {
        console.log('No trending tokens found');
        this.lastScan = new Date();
        return result;
      }

      // Filter and analyze tokens
      const candidates: Array<{
        token: any;
        security: SecurityCheck;
        signal: EntrySignal;
      }> = [];

      // Quick filter and security check
      for (const token of trending) {
        // Quick reject check
        const quickCheck = tokenSecurity.quickReject(token);
        if (quickCheck.rejected) {
          result.tokensRejected++;
          this.tradesRejected++;
          continue;
        }

        // Security analysis
        const security = await tokenSecurity.checkToken(token.address, token);
        
        // Skip if security score too low
        if (security.score < DEFAULT_RISK.minSecurityScore) {
          result.tokensRejected++;
          this.tradesRejected++;
          continue;
        }

        // Generate entry signal
        const signal = tokenSecurity.generateEntrySignal(token, security);

        if (signal.shouldEnter && signal.signalStrength !== 'NONE') {
          candidates.push({ token, security, signal });
        }
      }

      // Sort by confidence (highest first)
      candidates.sort((a, b) => b.signal.confidence - a.signal.confidence);

      // Process top candidates (max 3 per scan)
      const topCandidates = candidates.slice(0, 3);

      for (const { token, security, signal } of topCandidates) {
        // Check cooldown
        if (this.lastTradeTime) {
          const timeSinceLastTrade = (Date.now() - this.lastTradeTime.getTime()) / 1000;
          if (timeSinceLastTrade < DEFAULT_RISK.minTimeBetweenTrades) {
            console.log(`⏸️ Cooldown active (${DEFAULT_RISK.minTimeBetweenTrades - timeSinceLastTrade.toFixed(0)}s remaining)`);
            break;
          }
        }

        // Check position limit again
        const currentPositions = await tradingService.getPortfolio();
        if (currentPositions.length >= DEFAULT_RISK.maxPositions) {
          console.log(`⏸️ Position limit reached during processing`);
          break;
        }

        const signalRecord = {
          tokenAddress: token.address,
          tokenSymbol: token.symbol,
          action: 'BUY',
          confidence: signal.confidence,
          securityScore: security.score,
          signalStrength: signal.signalStrength
        };

        console.log(`\n💎 EXECUTING TRADE for ${token.symbol}`);
        console.log(`   Security Score: ${security.score}/100`);
        console.log(`   Signal Strength: ${signal.signalStrength}`);
        console.log(`   Confidence: ${(signal.confidence * 100).toFixed(0)}%`);
        console.log(`   Reasons: ${signal.reasons.slice(0, 3).join(', ')}`);

        // Execute the trade
        const tradeResult = await this.executeTrade(token, signal, config, security);

        signalRecord.executed = tradeResult.success;
        signalRecord.txHash = tradeResult.txHash;
        signalRecord.error = tradeResult.error;

        if (tradeResult.success) {
          result.tradesExecuted++;
          this.tradesExecuted++;
          this.hourlyTradeCount++;
          this.lastTradeTime = new Date();
          console.log(`✅ Trade executed: ${tradeResult.txHash}`);

          // Save AI decision for record
          await db.aIDecision.create({
            data: {
              tokenAddress: token.address,
              tokenSymbol: token.symbol,
              tokenName: token.name,
              logoUrl: token.logoUrl,
              action: 'BUY',
              confidence: signal.confidence,
              reasoning: signal.reasons.join(' | '),
              marketSentiment: signal.signalStrength,
              riskLevel: security.score >= 70 ? 'LOW' : security.score >= 50 ? 'MEDIUM' : 'HIGH',
              priceTarget: token.currentPrice * 1.2,
              stopLoss: token.currentPrice * 0.95
            }
          });
        } else {
          console.log(`❌ Trade failed: ${tradeResult.error}`);
          this.errors.push(`${token.symbol}: ${tradeResult.error}`);
        }

        result.signals.push(signalRecord);
      }

      // Also check exit signals for existing positions
      await this.checkExitSignals(positions);

      this.lastScan = new Date();
      console.log(`\n📊 Scan complete: ${result.tokensScanned} scanned, ${result.tokensRejected} rejected, ${result.tradesExecuted} trades executed`);

    } catch (error) {
      console.error('Auto-trader scan error:', error);
      this.errors.push(`Scan error: ${error}`);
    }

    return result;
  }

  /**
   * Execute trade with calculated position size
   */
  private async executeTrade(
    token: any,
    signal: EntrySignal,
    config: any,
    security: SecurityCheck
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      // Calculate position size based on confidence and security
      const basePosition = config.maxPositionSize || DEFAULT_RISK.maxPositionSize;
      
      // Reduce position for lower security scores
      const securityMultiplier = security.score / 100;
      
      // Adjust based on signal strength
      const strengthMultiplier = signal.signalStrength === 'STRONG' ? 1 
        : signal.signalStrength === 'MODERATE' ? 0.7 
        : 0.5;

      const positionSize = basePosition * securityMultiplier * strengthMultiplier * signal.confidence;
      
      // Ensure within limits
      const amount = Math.max(0.05, Math.min(positionSize, basePosition, DEFAULT_RISK.maxPositionSize));

      // Dynamic slippage based on volatility
      const volatility = Math.abs(token.priceChange5m || 0);
      const slippageBps = volatility > 20 ? 1000  // 10% for high volatility
        : volatility > 10 ? 700   // 7% for medium
        : 500;  // 5% default

      const tradeResult = await tradingService.executeTrade({
        type: 'BUY',
        tokenAddress: token.address,
        tokenSymbol: token.symbol,
        tokenName: token.name,
        amount,
        price: token.currentPrice,
        slippageBps
      });

      return {
        success: tradeResult.success,
        txHash: tradeResult.txHash,
        error: tradeResult.error
      };

    } catch (error) {
      return {
        success: false,
        error: String(error)
      };
    }
  }

  /**
   * Enhanced exit signal checking with trailing stop
   */
  async checkExitSignals(positions: any[]): Promise<void> {
    try {
      const config = await db.agentConfig.findFirst();
      if (!config?.autoTradeEnabled) return;

      const stopLossPercent = config.stopLossPercent || 5;
      const takeProfitPercent = config.takeProfitPercent || 20;
      const trailingStopPercent = 3; // Trailing stop at 3% from peak

      for (const position of positions) {
        const tokenData = await fetchTokenData(position.tokenAddress);
        if (!tokenData) continue;

        const currentPrice = tokenData.currentPrice;
        const entryPrice = position.avgBuyPrice;
        const pnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100;

        let shouldSell = false;
        let sellReason = '';

        // 1. Hard Stop Loss
        if (pnlPercent <= -stopLossPercent) {
          shouldSell = true;
          sellReason = `🛑 Stop-loss triggered: ${pnlPercent.toFixed(1)}%`;
        }
        
        // 2. Take Profit
        else if (pnlPercent >= takeProfitPercent) {
          shouldSell = true;
          sellReason = `🎯 Take-profit triggered: +${pnlPercent.toFixed(1)}%`;
        }
        
        // 3. Trailing Stop (if in profit)
        else if (pnlPercent > 5) {
          // Check if price dropped from peak by trailing percent
          // This is simplified - in production you'd track the actual peak
          const priceChange5m = tokenData.priceChange5m || 0;
          if (priceChange5m < -trailingStopPercent) {
            shouldSell = true;
            sellReason = `📉 Trailing stop: ${priceChange5m.toFixed(1)}% drop (locking ${pnlPercent.toFixed(1)}% profit)`;
          }
        }

        // 4. Security Alert (if token becomes risky)
        const currentSecurity = await tokenSecurity.checkToken(position.tokenAddress, tokenData);
        if (currentSecurity.score < 30) {
          shouldSell = true;
          sellReason = `🚨 Security alert: Score dropped to ${currentSecurity.score}`;
        }

        // 5. Exit on extreme dump
        if (tokenData.priceChange5m < -20) {
          shouldSell = true;
          sellReason = `🔥 Emergency exit: 5m drop ${tokenData.priceChange5m.toFixed(1)}%`;
        }

        if (shouldSell) {
          console.log(`${sellReason} for ${position.tokenSymbol}`);
          
          const tradeResult = await tradingService.executeTrade({
            type: 'SELL',
            tokenAddress: position.tokenAddress,
            tokenSymbol: position.tokenSymbol,
            tokenName: position.tokenName,
            amount: position.balance,
            price: currentPrice,
            slippageBps: 800 // Higher slippage for exit
          });

          if (tradeResult.success) {
            // Update daily PnL
            const pnl = (currentPrice - entryPrice) * position.balance;
            this.dailyPnL += pnl;
            console.log(`✅ Exit executed: ${tradeResult.txHash}`);
          }
        }

        // Update price
        await tradingService.updatePrice(position.tokenAddress, currentPrice);
      }
    } catch (error) {
      console.error('Error checking exit signals:', error);
    }
  }
}

// Singleton instance
export const autoTrader = new AutoTrader();
