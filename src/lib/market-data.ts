import { db } from './db';

// Real-time token data from multiple APIs
// Primary: DexScreener API (free, reliable)
// Secondary: Birdeye API (requires API key)

export interface RealTokenData {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl: string | null;
  marketCap: number;
  volume24h: number;
  priceChange24h: number;
  priceChange1h: number;
  priceChange5m: number;
  currentPrice: number;
  liquidity: number;
  isVerified: boolean;
  age: string;
  isNew: boolean;
  pumpScore: number;
  volumeToMcap: number;
  buysLast5m: number;
  sellsLast5m: number;
  holderCount: number;
}

/**
 * Fetch trending Solana tokens from DexScreener
 * Using boosted tokens + top pairs by volume
 */
export async function fetchTrendingTokens(): Promise<RealTokenData[]> {
  try {
    // Fetch from DexScreener - get tokens by volume
    const response = await fetch(
      'https://api.dexscreener.com/token-boosts/top/v1',
      { cache: 'no-store' }
    );

    const tokens: RealTokenData[] = [];

    if (response.ok) {
      const data = await response.json();
      
      // Filter Solana tokens
      const solanaTokens = (data || [])
        .filter((t: { chainId?: string }) => t.chainId === 'solana')
        .slice(0, 25);

      // Fetch detailed data for each token
      for (const t of solanaTokens) {
        const tokenData = await fetchTokenFromDexScreener(t.tokenAddress);
        if (tokenData) {
          tokens.push(tokenData);
        }
      }
    }

    // Also fetch top Solana pairs by volume
    const pairsResponse = await fetch(
      'https://api.dexscreener.com/latest/dex/pairs/solana',
      { cache: 'no-store' }
    );

    if (pairsResponse.ok) {
      const pairsData = await pairsResponse.json();
      
      const topPairs = (pairsData.pairs || [])
        .filter((p: { volume?: { h24?: number } }) => (p.volume?.h24 || 0) > 100000)
        .slice(0, 30);

      for (const pair of topPairs) {
        const address = pair.baseToken?.address;
        if (address && !tokens.find(t => t.address === address)) {
          const tokenData = await fetchTokenFromDexScreener(address);
          if (tokenData) {
            tokens.push(tokenData);
          }
        }
      }
    }

    // Sort by pump score and return top 20
    return tokens
      .sort((a, b) => b.pumpScore - a.pumpScore)
      .slice(0, 20);

  } catch (error) {
    console.error('Error fetching trending tokens:', error);
    return [];
  }
}

/**
 * Fetch new token listings
 */
export async function fetchNewTokens(): Promise<RealTokenData[]> {
  try {
    // Get latest token boosts (new tokens pay for visibility)
    const response = await fetch(
      'https://api.dexscreener.com/token-boosts/latest/v1',
      { cache: 'no-store' }
    );

    const tokens: RealTokenData[] = [];

    if (response.ok) {
      const data = await response.json();
      
      const solanaTokens = (data || [])
        .filter((t: { chainId?: string }) => t.chainId === 'solana')
        .slice(0, 20);

      for (const t of solanaTokens) {
        const tokenData = await fetchTokenFromDexScreener(t.tokenAddress);
        if (tokenData && tokenData.isNew) {
          tokens.push(tokenData);
        }
      }
    }

    return tokens.sort((a, b) => b.pumpScore - a.pumpScore);

  } catch (error) {
    console.error('Error fetching new tokens:', error);
    return [];
  }
}

/**
 * Fetch token data from DexScreener by address
 */
async function fetchTokenFromDexScreener(address: string): Promise<RealTokenData | null> {
  try {
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${address}`,
      { cache: 'no-store' }
    );

    if (!response.ok) return null;

    const data = await response.json();
    
    // Get the main pair (highest liquidity)
    const pairs = (data.pairs || [])
      .filter((p: { chainId?: string }) => p.chainId === 'solana')
      .sort((a: { liquidity?: { usd?: number } }, b: { liquidity?: { usd?: number } }) => 
        (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
      );

    if (pairs.length === 0) return null;

    const token = pairs[0];
    const ageMs = Date.now() - (token.pairCreatedAt || Date.now());

    return {
      address: token.baseToken?.address || address,
      symbol: token.baseToken?.symbol || 'UNKNOWN',
      name: token.baseToken?.name || 'Unknown Token',
      decimals: 9,
      logoUrl: token.info?.imageUrl || null,
      marketCap: token.fdv || 0,
      volume24h: token.volume?.h24 || 0,
      priceChange24h: token.priceChange?.h24 || 0,
      priceChange1h: token.priceChange?.h1 || 0,
      priceChange5m: token.priceChange?.m5 || 0,
      currentPrice: parseFloat(token.priceUsd || '0'),
      liquidity: token.liquidity?.usd || 0,
      isVerified: false,
      age: formatAge(ageMs),
      isNew: ageMs < 24 * 60 * 60 * 1000,
      pumpScore: calculatePumpScore(
        token.priceChange?.h24 || 0, 
        token.volume?.h24 || 0, 
        token.fdv || 0,
        token.priceChange?.h1 || 0
      ),
      volumeToMcap: token.fdv ? (token.volume?.h24 || 0) / token.fdv : 0,
      buysLast5m: token.txns?.m5?.buys || 0,
      sellsLast5m: token.txns?.m5?.sells || 0,
      holderCount: 0,
    };
  } catch (error) {
    console.error(`Error fetching token ${address}:`, error);
    return null;
  }
}

/**
 * Fetch detailed token data by address
 */
export async function fetchTokenData(address: string): Promise<RealTokenData | null> {
  return fetchTokenFromDexScreener(address);
}

/**
 * Search tokens by name/symbol
 */
export async function searchTokens(query: string): Promise<RealTokenData[]> {
  try {
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`,
      { cache: 'no-store' }
    );
    
    if (!response.ok) return [];
    
    const data = await response.json();
    
    const tokens: RealTokenData[] = [];
    
    const pairs = (data.pairs || [])
      .filter((p: { chainId?: string }) => p.chainId === 'solana')
      .slice(0, 15);

    for (const pair of pairs) {
      const address = pair.baseToken?.address;
      if (address) {
        const tokenData = await fetchTokenFromDexScreener(address);
        if (tokenData) {
          tokens.push(tokenData);
        }
      }
    }

    return tokens;
  } catch (error) {
    console.error('Error searching tokens:', error);
    return [];
  }
}

/**
 * Get real-time prices for multiple tokens
 */
export async function getTokenPrices(addresses: string[]): Promise<Record<string, { price: number; change24h: number }>> {
  const result: Record<string, { price: number; change24h: number }> = {};
  
  for (const address of addresses) {
    const token = await fetchTokenFromDexScreener(address);
    if (token) {
      result[address] = {
        price: token.currentPrice,
        change24h: token.priceChange24h
      };
    }
  }
  
  return result;
}

/**
 * Format age from milliseconds
 */
function formatAge(ageMs: number): string {
  const hours = ageMs / (1000 * 60 * 60);
  const days = hours / 24;
  
  if (hours < 1) return `${Math.floor(hours * 60)}m`;
  if (hours < 24) return `${Math.floor(hours)}h`;
  if (days < 7) return `${Math.floor(days)}d`;
  if (days < 30) return `${Math.floor(days)}d`;
  return `${Math.floor(days / 30)}mo`;
}

/**
 * Calculate pump score (0-100)
 */
function calculatePumpScore(priceChange24h: number, volume24h: number, marketCap: number, priceChange1h: number): number {
  let score = 50; // Start at neutral
  
  // 24h Price momentum (max 25 points)
  if (priceChange24h > 100) score += 25;
  else if (priceChange24h > 50) score += 18;
  else if (priceChange24h > 20) score += 12;
  else if (priceChange24h > 10) score += 6;
  else if (priceChange24h > 0) score += 3;
  else if (priceChange24h < -30) score -= 15;
  else if (priceChange24h < -15) score -= 10;
  else if (priceChange24h < -5) score -= 5;
  
  // 1h Price momentum for scalping (max 20 points)
  if (priceChange1h > 30) score += 20;
  else if (priceChange1h > 15) score += 15;
  else if (priceChange1h > 5) score += 10;
  else if (priceChange1h > 0) score += 5;
  else if (priceChange1h < -10) score -= 10;
  
  // Volume relative to market cap (max 25 points)
  if (marketCap > 0) {
    const volRatio = volume24h / marketCap;
    if (volRatio > 1) score += 25;
    else if (volRatio > 0.5) score += 18;
    else if (volRatio > 0.2) score += 12;
    else if (volRatio > 0.1) score += 6;
  }
  
  // Market cap tier (favor smaller caps for pumps)
  if (marketCap < 100000) score += 10;
  else if (marketCap < 500000) score += 7;
  else if (marketCap < 2000000) score += 4;
  else if (marketCap > 20000000) score -= 5;
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

// Legacy exports for backward compatibility
export async function getTrendingMemecoins(): Promise<RealTokenData[]> {
  return fetchTrendingTokens();
}

export async function getTokenMarketData(address: string): Promise<RealTokenData | null> {
  return fetchTokenData(address);
}

export async function initializeMemecoins(): Promise<void> {
  const count = await db.memecoin.count();
  
  if (count === 0) {
    const tokens = await fetchTrendingTokens();
    
    if (tokens.length > 0) {
      // Insert one by one to handle duplicates
      for (const t of tokens.slice(0, 10)) {
        try {
          await db.memecoin.create({
            data: {
              address: t.address,
              symbol: t.symbol,
              name: t.name,
              decimals: t.decimals,
              logoUrl: t.logoUrl,
              marketCap: t.marketCap,
              volume24h: t.volume24h,
              priceChange24h: t.priceChange24h,
              isVerified: t.isVerified
            }
          });
        } catch (e) {
          // Skip duplicates
        }
      }
    }
  }
}

export async function initializeAgentConfig(): Promise<void> {
  const count = await db.agentConfig.count();
  
  if (count === 0) {
    await db.agentConfig.create({
      data: {
        riskTolerance: 'HIGH',
        maxPositionSize: 5,
        stopLossPercent: 3,
        takeProfitPercent: 10,
        tradingEnabled: true,
        autoTradeEnabled: false
      }
    });
  }
}
