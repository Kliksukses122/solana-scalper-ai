import { db } from './db';
import type { TradeType, TradeStatus } from '@prisma/client';
import * as jupiter from './jupiter-api';
import * as wallet from './solana-wallet';

export interface TradeRequest {
  type: 'BUY' | 'SELL';
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  amount: number; // in SOL for BUY, token amount for SELL
  price: number;
  slippageBps?: number;
}

export interface TradeResult {
  success: boolean;
  tradeId?: string;
  txHash?: string;
  inputAmount?: string;
  outputAmount?: string;
  priceImpact?: number;
  route?: string[];
  error?: string;
}

export interface Position {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  balance: number;
  avgBuyPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  value: number;
  valueInSol: number;
}

export class TradingService {
  
  /**
   * Execute a trade via Jupiter DEX aggregator
   * BUY: Swap SOL for token
   * SELL: Swap token for SOL
   */
  async executeTrade(request: TradeRequest): Promise<TradeResult> {
    try {
      // Check if trading is enabled
      const config = await db.agentConfig.findFirst();
      if (config && !config.tradingEnabled) {
        return { success: false, error: 'Trading is currently disabled' };
      }

      // Validate request
      if (!request.tokenAddress || !request.amount || !request.price) {
        return { success: false, error: 'Invalid trade parameters' };
      }

      if (request.amount <= 0 || request.price <= 0) {
        return { success: false, error: 'Amount and price must be positive' };
      }

      // Calculate total value
      const totalValue = request.amount * request.price;

      // Check position size limit
      const maxPosition = config?.maxPositionSize || 5;
      if (request.type === 'BUY' && totalValue > maxPosition) {
        return { success: false, error: `Position size exceeds maximum of ${maxPosition} SOL` };
      }

      // Check if wallet is configured
      if (!wallet.isWalletConfigured()) {
        // Create trade record with PENDING status - waiting for wallet setup
        const trade = await db.trade.create({
          data: {
            type: request.type,
            tokenAddress: request.tokenAddress,
            tokenSymbol: request.tokenSymbol,
            tokenName: request.tokenName,
            amount: request.amount,
            price: request.price,
            totalValue: totalValue,
            status: 'PENDING'
          }
        });

        return {
          success: false,
          tradeId: trade.id,
          error: 'Wallet not configured. Set WALLET_PRIVATE_KEY in environment.'
        };
      }

      // Check wallet balance for BUY orders
      if (request.type === 'BUY') {
        try {
          const solBalance = await wallet.getSolBalance();
          if (solBalance < request.amount) {
            return {
              success: false,
              error: `Insufficient SOL balance. Have: ${solBalance.toFixed(4)} SOL, Need: ${request.amount} SOL`
            };
          }
        } catch (error) {
          console.error('Error checking balance:', error);
        }
      }

      // Get slippage from config or use default
      const slippageBps = request.slippageBps || config?.slippageBps || 100; // 1% default

      // Execute swap via Jupiter
      const swapResult = await this.executeJupiterSwap(request, slippageBps);

      // Create trade record
      const trade = await db.trade.create({
        data: {
          type: request.type,
          tokenAddress: request.tokenAddress,
          tokenSymbol: request.tokenSymbol,
          tokenName: request.tokenName,
          amount: request.amount,
          price: request.price,
          totalValue: totalValue,
          status: swapResult.success ? 'COMPLETED' : 'FAILED',
          txHash: swapResult.txHash
        }
      });

      // Update portfolio if successful
      if (swapResult.success) {
        await this.updatePortfolio({
          type: request.type,
          tokenAddress: request.tokenAddress,
          tokenSymbol: request.tokenSymbol,
          tokenName: request.tokenName,
          amount: request.amount,
          price: request.price
        });
      }

      return {
        success: swapResult.success,
        tradeId: trade.id,
        txHash: swapResult.txHash,
        inputAmount: swapResult.inputAmount,
        outputAmount: swapResult.outputAmount,
        priceImpact: swapResult.priceImpact,
        route: swapResult.route,
        error: swapResult.error
      };
      
    } catch (error) {
      console.error('Trade execution error:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Execute swap via Jupiter API with real wallet signing
   */
  private async executeJupiterSwap(
    request: TradeRequest,
    slippageBps: number
  ): Promise<{
    success: boolean;
    txHash?: string;
    inputAmount?: string;
    outputAmount?: string;
    priceImpact?: number;
    route?: string[];
    error?: string;
  }> {
    try {
      const solMint = jupiter.SOL_MINT;
      const tokenMint = request.tokenAddress;

      // For BUY: swap SOL -> Token
      // For SELL: swap Token -> SOL
      const inputMint = request.type === 'BUY' ? solMint : tokenMint;
      const outputMint = request.type === 'BUY' ? tokenMint : solMint;

      // Convert amount to smallest unit
      // For BUY: amount is in SOL (9 decimals)
      // For SELL: amount is in token units (assume 9 decimals for memecoins)
      const inputAmount = jupiter.parseTokenAmount(request.amount, 9);

      // Get quote from Jupiter
      const quote = await jupiter.getQuote(inputMint, outputMint, inputAmount, slippageBps);

      if (!quote) {
        return {
          success: false,
          error: 'Failed to get quote from Jupiter'
        };
      }

      // Check price impact
      const priceImpact = parseFloat(quote.priceImpactPct);
      if (priceImpact > 5) {
        return {
          success: false,
          inputAmount: quote.inAmount,
          outputAmount: quote.outAmount,
          priceImpact,
          route: quote.routePlan.map(r => r.swapInfo.label),
          error: `Price impact too high: ${priceImpact.toFixed(2)}%. Consider smaller amount.`
        };
      }

      // Get wallet public key
      const walletPublicKey = wallet.getWalletPublicKey();

      // Get swap transaction from Jupiter with HIGH priority for memecoins
      const swapTx = await jupiter.getSwapTransaction(quote, walletPublicKey, true, 'high');

      if (!swapTx) {
        return {
          success: false,
          inputAmount: quote.inAmount,
          outputAmount: quote.outAmount,
          priceImpact,
          route: quote.routePlan.map(r => r.swapInfo.label),
          error: 'Failed to create swap transaction'
        };
      }

      // Sign and send the transaction
      console.log(`Signing and sending ${request.type} transaction for ${request.tokenSymbol}...`);
      
      const result = await wallet.signAndSendWithRetry(
        Buffer.from(swapTx.swapTransaction, 'base64'),
        3
      );

      if (result.status === 'confirmed') {
        console.log(`✅ Transaction confirmed: ${result.signature}`);
        
        return {
          success: true,
          txHash: result.signature,
          inputAmount: quote.inAmount,
          outputAmount: quote.outAmount,
          priceImpact,
          route: quote.routePlan.map(r => r.swapInfo.label),
        };
      } else {
        console.error(`❌ Transaction failed: ${result.error}`);
        
        return {
          success: false,
          inputAmount: quote.inAmount,
          outputAmount: quote.outAmount,
          priceImpact,
          route: quote.routePlan.map(r => r.swapInfo.label),
          error: result.error || 'Transaction failed'
        };
      }
    } catch (error) {
      console.error('Jupiter swap error:', error);
      return {
        success: false,
        error: String(error)
      };
    }
  }

  /**
   * Get quote for a potential trade (preview)
   */
  async getQuote(
    type: 'BUY' | 'SELL',
    tokenAddress: string,
    amount: number,
    slippageBps: number = 100
  ): Promise<{
    inputAmount: string;
    outputAmount: string;
    priceImpact: number;
    route: string[];
    minimumOutput: string;
  } | null> {
    try {
      const solMint = jupiter.SOL_MINT;
      const inputMint = type === 'BUY' ? solMint : tokenAddress;
      const outputMint = type === 'BUY' ? tokenAddress : solMint;

      const inputAmount = jupiter.parseTokenAmount(amount, 9);
      const quote = await jupiter.getQuote(inputMint, outputMint, inputAmount, slippageBps);

      if (!quote) {
        return null;
      }

      return {
        inputAmount: quote.inAmount,
        outputAmount: quote.outAmount,
        priceImpact: parseFloat(quote.priceImpactPct),
        route: quote.routePlan.map(r => r.swapInfo.label),
        minimumOutput: jupiter.calculateMinimumOutput(quote.outAmount, slippageBps)
      };
    } catch (error) {
      console.error('Error getting quote:', error);
      return null;
    }
  }

  /**
   * Get wallet info
   */
  async getWalletInfo(): Promise<{
    publicKey: string;
    solBalance: number;
    tokenCount: number;
  } | null> {
    try {
      if (!wallet.isWalletConfigured()) {
        return null;
      }
      return await wallet.getWalletInfo();
    } catch (error) {
      console.error('Error getting wallet info:', error);
      return null;
    }
  }

  // Update trade status after blockchain confirmation
  async updateTradeStatus(tradeId: string, status: TradeStatus, txHash?: string): Promise<void> {
    await db.trade.update({
      where: { id: tradeId },
      data: {
        status,
        txHash: txHash || null
      }
    });

    // If completed, update portfolio
    if (status === 'COMPLETED') {
      const trade = await db.trade.findUnique({ where: { id: tradeId } });
      if (trade) {
        await this.updatePortfolio({
          type: trade.type as 'BUY' | 'SELL',
          tokenAddress: trade.tokenAddress,
          tokenSymbol: trade.tokenSymbol,
          tokenName: trade.tokenName,
          amount: trade.amount,
          price: trade.price
        });
      }
    }
  }

  private async updatePortfolio(request: TradeRequest): Promise<void> {
    const existingPosition = await db.portfolio.findUnique({
      where: { tokenAddress: request.tokenAddress }
    });

    if (request.type === 'BUY') {
      if (existingPosition) {
        // Update existing position with weighted average
        const newTotal = existingPosition.balance + request.amount;
        const newAvgPrice = (
          (existingPosition.balance * existingPosition.avgBuyPrice) +
          (request.amount * request.price)
        ) / newTotal;

        await db.portfolio.update({
          where: { tokenAddress: request.tokenAddress },
          data: {
            balance: newTotal,
            avgBuyPrice: newAvgPrice,
            currentPrice: request.price
          }
        });
      } else {
        // Create new position
        await db.portfolio.create({
          data: {
            tokenAddress: request.tokenAddress,
            tokenSymbol: request.tokenSymbol,
            tokenName: request.tokenName,
            balance: request.amount,
            avgBuyPrice: request.price,
            currentPrice: request.price,
            pnl: 0
          }
        });
      }
    } else if (request.type === 'SELL') {
      if (existingPosition) {
        const newBalance = existingPosition.balance - request.amount;
        
        if (newBalance <= 0.00000001) {
          // Close position
          await db.portfolio.delete({
            where: { tokenAddress: request.tokenAddress }
          });
        } else {
          // Update position
          await db.portfolio.update({
            where: { tokenAddress: request.tokenAddress },
            data: {
              balance: newBalance,
              currentPrice: request.price
            }
          });
        }
      }
    }
  }

  async getPortfolio(): Promise<Position[]> {
    const positions = await db.portfolio.findMany();
    
    return positions.map(p => {
      const value = p.balance * p.currentPrice;
      const pnl = (p.currentPrice - p.avgBuyPrice) * p.balance;
      const pnlPercent = p.avgBuyPrice > 0 
        ? ((p.currentPrice - p.avgBuyPrice) / p.avgBuyPrice) * 100 
        : 0;

      return {
        tokenAddress: p.tokenAddress,
        tokenSymbol: p.tokenSymbol,
        tokenName: p.tokenName,
        balance: p.balance,
        avgBuyPrice: p.avgBuyPrice,
        currentPrice: p.currentPrice,
        pnl,
        pnlPercent,
        value,
        valueInSol: value // Assuming price is in SOL
      };
    });
  }

  async getPortfolioValue(): Promise<{
    totalValue: number;
    totalPnl: number;
    totalPnlPercent: number;
    positions: number;
  }> {
    const positions = await this.getPortfolio();
    
    const totalValue = positions.reduce((sum, p) => sum + p.value, 0);
    const totalPnl = positions.reduce((sum, p) => sum + p.pnl, 0);
    const totalCost = positions.reduce((sum, p) => sum + (p.balance * p.avgBuyPrice), 0);
    const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

    return {
      totalValue,
      totalPnl,
      totalPnlPercent,
      positions: positions.length
    };
  }

  async getTradeHistory(limit: number = 50): Promise<Array<{
    id: string;
    type: string;
    tokenSymbol: string;
    tokenName: string;
    amount: number;
    price: number;
    totalValue: number;
    status: string;
    txHash: string | null;
    createdAt: Date;
  }>> {
    const trades = await db.trade.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return trades.map(t => ({
      id: t.id,
      type: t.type,
      tokenSymbol: t.tokenSymbol,
      tokenName: t.tokenName,
      amount: t.amount,
      price: t.price,
      totalValue: t.totalValue,
      status: t.status,
      txHash: t.txHash,
      createdAt: t.createdAt
    }));
  }

  async getAgentStatus(): Promise<{
    tradingEnabled: boolean;
    autoTradeEnabled: boolean;
    riskTolerance: string;
    maxPositionSize: number;
    stopLossPercent: number;
    takeProfitPercent: number;
    totalTrades: number;
    successfulTrades: number;
    pendingTrades: number;
  }> {
    const config = await db.agentConfig.findFirst();
    const trades = await db.trade.findMany();
    
    const successfulTrades = trades.filter(t => t.status === 'COMPLETED').length;
    const pendingTrades = trades.filter(t => t.status === 'PENDING').length;

    return {
      tradingEnabled: config?.tradingEnabled ?? true,
      autoTradeEnabled: config?.autoTradeEnabled ?? false,
      riskTolerance: config?.riskTolerance ?? 'HIGH',
      maxPositionSize: config?.maxPositionSize ?? 5,
      stopLossPercent: config?.stopLossPercent ?? 3,
      takeProfitPercent: config?.takeProfitPercent ?? 10,
      totalTrades: trades.length,
      successfulTrades,
      pendingTrades
    };
  }

  async updatePrice(tokenAddress: string, newPrice: number): Promise<void> {
    const position = await db.portfolio.findUnique({
      where: { tokenAddress }
    });

    if (position) {
      const pnl = (newPrice - position.avgBuyPrice) * position.balance;
      
      await db.portfolio.update({
        where: { tokenAddress },
        data: {
          currentPrice: newPrice,
          pnl
        }
      });
    }
  }
}

export const tradingService = new TradingService();
