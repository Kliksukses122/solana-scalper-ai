/**
 * Birdeye API Service
 * Comprehensive Solana token data for scalper trading
 * API Docs: https://public-api.birdeye.so/
 */

export interface BirdeyeTokenData {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUri?: string;
  price: number;
  priceChange24h: number;
  priceChange1h: number;
  priceChange5m?: number;
  volume24h: number;
  marketCap: number;
  liquidity: number;
  supply: number;
  holderCount: number;
  txns24h: number;
  isNew: boolean;
  age: string;
}

export interface BirdeyeTrendingToken {
  address: string;
  symbol: string;
  name: string;
  logoUri?: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  liquidity: number;
}

export interface TokenSecurity {
  mintAuthority: boolean;
  freezeAuthority: boolean;
  top10HolderPercent: number;
  isRugPull: boolean;
  isScam: boolean;
  holderCount: number;
}

const BIRDEYE_BASE_URL = 'https://public-api.birdeye.so/defi';

function getApiKey(): string {
  return process.env.BIRDEYE_API_KEY || '';
}

/**
 * Fetch trending/new tokens on Solana
 */
export async function fetchTrendingTokens(limit: number = 20): Promise<BirdeyeTokenData[]> {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    console.warn('BIRDEYE_API_KEY not configured, falling back to DexScreener');
    return [];
  }

  try {
    // Get tokens sorted by volume (good for scalping)
    const response = await fetch(
      `${BIRDEYE_BASE_URL}/token/trending?chain=solana&limit=${limit}&sort_by=v24hUSD&sort_type=desc`,
      {
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      console.error(`Birdeye API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    if (!data.success || !data.data?.tokens) {
      return [];
    }

    return data.data.tokens.map((t: {
      address: string;
      symbol: string;
      name: string;
      logoUri?: string;
      price?: number;
      priceChange24h?: number;
      volume24h?: number;
      marketCap?: number;
      liquidity?: number;
      holder?: number;
      txns24h?: number;
    }) => ({
      address: t.address,
      symbol: t.symbol || 'UNKNOWN',
      name: t.name || 'Unknown Token',
      decimals: 9,
      logoUri: t.logoUri,
      price: t.price || 0,
      priceChange24h: t.priceChange24h || 0,
      priceChange1h: 0, // Will be fetched separately if needed
      volume24h: t.volume24h || 0,
      marketCap: t.marketCap || 0,
      liquidity: t.liquidity || 0,
      supply: 0,
      holderCount: t.holder || 0,
      txns24h: t.txns24h || 0,
      isNew: (t.marketCap || 0) < 1000000,
      age: 'Unknown',
    }));
  } catch (error) {
    console.error('Error fetching trending tokens from Birdeye:', error);
    return [];
  }
}

/**
 * Fetch new token listings on Solana
 */
export async function fetchNewTokens(limit: number = 20): Promise<BirdeyeTokenData[]> {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    return [];
  }

  try {
    // Get newly created tokens
    const response = await fetch(
      `${BIRDEYE_BASE_URL}/token/new_listing?chain=solana&limit=${limit}`,
      {
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      console.error(`Birdeye new tokens API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    if (!data.success || !data.data?.tokens) {
      return [];
    }

    return data.data.tokens.map((t: {
      address: string;
      symbol: string;
      name: string;
      logoUri?: string;
      price?: number;
      priceChange24h?: number;
      volume24h?: number;
      marketCap?: number;
      liquidity?: number;
      holder?: number;
    }) => ({
      address: t.address,
      symbol: t.symbol || 'UNKNOWN',
      name: t.name || 'Unknown Token',
      decimals: 9,
      logoUri: t.logoUri,
      price: t.price || 0,
      priceChange24h: t.priceChange24h || 0,
      priceChange1h: 0,
      volume24h: t.volume24h || 0,
      marketCap: t.marketCap || 0,
      liquidity: t.liquidity || 0,
      supply: 0,
      holderCount: t.holder || 0,
      txns24h: 0,
      isNew: true,
      age: 'New',
    }));
  } catch (error) {
    console.error('Error fetching new tokens from Birdeye:', error);
    return [];
  }
}

/**
 * Fetch detailed token data by address
 */
export async function fetchTokenData(address: string): Promise<BirdeyeTokenData | null> {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch(
      `${BIRDEYE_BASE_URL}/token_overview?address=${address}`,
      {
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    if (!data.success || !data.data) {
      return null;
    }

    const t = data.data;
    
    return {
      address: t.address,
      symbol: t.symbol || 'UNKNOWN',
      name: t.name || 'Unknown Token',
      decimals: t.decimals || 9,
      logoUri: t.logoUri,
      price: t.price || 0,
      priceChange24h: t.priceChange24h || 0,
      priceChange1h: t.priceChange1h || 0,
      priceChange5m: t.priceChange5m,
      volume24h: t.volume24h || 0,
      marketCap: t.marketCap || 0,
      liquidity: t.liquidity || 0,
      supply: t.supply || 0,
      holderCount: t.holderCount || 0,
      txns24h: t.txns24h || 0,
      isNew: (t.marketCap || 0) < 1000000,
      age: formatAge(t.creationTime),
    };
  } catch (error) {
    console.error('Error fetching token data from Birdeye:', error);
    return null;
  }
}

/**
 * Fetch token security information
 */
export async function fetchTokenSecurity(address: string): Promise<TokenSecurity | null> {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch(
      `${BIRDEYE_BASE_URL}/token_security?address=${address}`,
      {
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    if (!data.success || !data.data) {
      return null;
    }

    return {
      mintAuthority: data.data.mintAuthority || false,
      freezeAuthority: data.data.freezeAuthority || false,
      top10HolderPercent: data.data.top10HolderPercent || 0,
      isRugPull: data.data.isRugPull || false,
      isScam: data.data.isScam || false,
      holderCount: data.data.holderCount || 0,
    };
  } catch (error) {
    console.error('Error fetching token security from Birdeye:', error);
    return null;
  }
}

/**
 * Fetch OHLCV data for charting
 */
export async function fetchTokenOHLCV(
  address: string, 
  timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' = '5m',
  limit: number = 100
): Promise<{ time: number; open: number; high: number; low: number; close: number; volume: number }[]> {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    return [];
  }

  try {
    const response = await fetch(
      `${BIRDEYE_BASE_URL}/ohlcv?address=${address}&type=${timeframe}&time_from=${Math.floor(Date.now() / 1000) - 86400}&time_to=${Math.floor(Date.now() / 1000)}`,
      {
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    
    if (!data.success || !data.data?.items) {
      return [];
    }

    return data.data.items.slice(-limit).map((item: {
      unixTime: number;
      o: number;
      h: number;
      l: number;
      c: number;
      v: number;
    }) => ({
      time: item.unixTime,
      open: item.o,
      high: item.h,
      low: item.l,
      close: item.c,
      volume: item.v,
    }));
  } catch (error) {
    console.error('Error fetching OHLCV from Birdeye:', error);
    return [];
  }
}

/**
 * Search tokens by symbol or name
 */
export async function searchTokens(query: string, limit: number = 10): Promise<BirdeyeTokenData[]> {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    return [];
  }

  try {
    const response = await fetch(
      `${BIRDEYE_BASE_URL}/search?keyword=${encodeURIComponent(query)}&chain=solana`,
      {
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    
    if (!data.success || !data.data?.tokens) {
      return [];
    }

    return data.data.tokens.slice(0, limit).map((t: {
      address: string;
      symbol: string;
      name: string;
      logoUri?: string;
      price?: number;
      priceChange24h?: number;
      volume24h?: number;
      marketCap?: number;
      liquidity?: number;
    }) => ({
      address: t.address,
      symbol: t.symbol || 'UNKNOWN',
      name: t.name || 'Unknown Token',
      decimals: 9,
      logoUri: t.logoUri,
      price: t.price || 0,
      priceChange24h: t.priceChange24h || 0,
      priceChange1h: 0,
      volume24h: t.volume24h || 0,
      marketCap: t.marketCap || 0,
      liquidity: t.liquidity || 0,
      supply: 0,
      holderCount: 0,
      txns24h: 0,
      isNew: (t.marketCap || 0) < 1000000,
      age: 'Unknown',
    }));
  } catch (error) {
    console.error('Error searching tokens from Birdeye:', error);
    return [];
  }
}

/**
 * Get real-time price for multiple tokens
 */
export async function getMultipleTokenPrices(addresses: string[]): Promise<Record<string, { price: number; change24h: number }>> {
  const apiKey = getApiKey();
  const result: Record<string, { price: number; change24h: number }> = {};
  
  if (!apiKey || addresses.length === 0) {
    return result;
  }

  try {
    // Birdeye supports batch requests
    const response = await fetch(
      `${BIRDEYE_BASE_URL}/v3/token/multi-price?addresses=${addresses.join(',')}`,
      {
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      return result;
    }

    const data = await response.json();
    
    if (!data.success || !data.data) {
      return result;
    }

    for (const address of addresses) {
      const tokenData = data.data[address];
      if (tokenData) {
        result[address] = {
          price: tokenData.price || 0,
          change24h: tokenData.priceChange24h || 0,
        };
      }
    }

    return result;
  } catch (error) {
    console.error('Error fetching multiple prices from Birdeye:', error);
    return result;
  }
}

/**
 * Format age from timestamp
 */
function formatAge(creationTime?: number): string {
  if (!creationTime) return 'Unknown';
  
  const ageMs = Date.now() - creationTime * 1000;
  const hours = ageMs / (1000 * 60 * 60);
  const days = hours / 24;
  
  if (hours < 1) return `${Math.floor(hours * 60)}m`;
  if (hours < 24) return `${Math.floor(hours)}h`;
  if (days < 7) return `${Math.floor(days)}d`;
  if (days < 30) return `${Math.floor(days)}d`;
  return `${Math.floor(days / 30)}mo`;
}
