const DEXSCREENER_API = 'https://api.dexscreener.com/latest'

export interface TokenData {
  chainId: string
  pairAddress: string
  baseToken: {
    address: string
    name: string
    symbol: string
  }
  quoteToken: {
    address: string
    name: string
    symbol: string
  }
  priceNative: string
  priceUsd: string
  txns: {
    h24: { buys: number; sells: number }
  }
  volume: {
    h24: number
    h6: number
    h1: number
    m5: number
  }
  priceChange: {
    h24: number
    h6: number
    h1: number
    m5: number
  }
  liquidity?: {
    usd: number
    base: number
    quote: number
  }
  marketCap?: number
  fdv?: number
  pairCreatedAt?: number
  info?: {
    imageUrl?: string
    websites?: Array<{ url: string }>
    socials?: Array<{ type: string; url: string }>
  }
}

export interface TrendingToken {
  pairAddress: string
  baseToken: {
    address: string
    name: string
    symbol: string
  }
  priceUsd: string
  priceChange: {
    h24: number
    h6: number
    h1: number
    m5: number
  }
  volume: {
    h24: number
  }
  liquidity?: {
    usd: number
  }
  marketCap?: number
  txns?: {
    h24: { buys: number; sells: number }
  }
  pairCreatedAt?: number
  info?: {
    imageUrl?: string
  }
}

// Get token data by address
export async function getTokenData(tokenAddress: string): Promise<TokenData | null> {
  try {
    const response = await fetch(`${DEXSCREENER_API}/dex/tokens/${tokenAddress}`)
    
    if (!response.ok) {
      console.error('DexScreener API error:', await response.text())
      return null
    }
    
    const data = await response.json()
    
    if (data.pairs && data.pairs.length > 0) {
      // Return the SOL pair if available, otherwise first pair
      const solPair = data.pairs.find(
        (pair: TokenData) => pair.quoteToken.symbol === 'SOL' && pair.chainId === 'solana'
      )
      return solPair || data.pairs[0]
    }
    
    return null
  } catch (error) {
    console.error('Error fetching token data:', error)
    return null
  }
}

// Get multiple tokens data
export async function getMultipleTokensData(
  tokenAddresses: string[]
): Promise<Map<string, TokenData>> {
  const result = new Map<string, TokenData>()
  
  // DexScreener allows up to 30 tokens per request
  const chunks = chunkArray(tokenAddresses, 30)
  
  for (const chunk of chunks) {
    try {
      const response = await fetch(`${DEXSCREENER_API}/dex/tokens/${chunk.join(',')}`)
      
      if (response.ok) {
        const data = await response.json()
        
        if (data.pairs) {
          for (const pair of data.pairs) {
            if (!result.has(pair.baseToken.address)) {
              result.set(pair.baseToken.address, pair)
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching multiple tokens:', error)
    }
  }
  
  return result
}

// Get trending tokens on Solana
export async function getTrendingTokens(): Promise<TrendingToken[]> {
  try {
    // Get top tokens by volume on Solana
    const response = await fetch(`${DEXSCREENER_API}/dex/search?q=`, {
      headers: {
        'Accept': 'application/json',
      },
    })
    
    if (!response.ok) {
      return getFallbackTrendingTokens()
    }
    
    const data = await response.json()
    
    if (data.pairs) {
      const solanaPairs = data.pairs
        .filter((pair: TokenData) => pair.chainId === 'solana')
        .sort((a: TokenData, b: TokenData) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))
        .slice(0, 50)
      
      return solanaPairs.map((pair: TokenData) => ({
        pairAddress: pair.pairAddress,
        baseToken: pair.baseToken,
        priceUsd: pair.priceUsd,
        priceChange: pair.priceChange,
        volume: pair.volume,
        liquidity: pair.liquidity,
        marketCap: pair.marketCap,
        txns: pair.txns,
        pairCreatedAt: pair.pairCreatedAt,
        info: pair.info,
      }))
    }
    
    return getFallbackTrendingTokens()
  } catch (error) {
    console.error('Error fetching trending tokens:', error)
    return getFallbackTrendingTokens()
  }
}

// Get boosted/new tokens for scalp trading
export async function getScalpTokens(): Promise<TrendingToken[]> {
  try {
    const response = await fetch(`${DEXSCREENER_API}/dex/tokens/So11111111111111111111111111111111111111112`)
    
    if (!response.ok) {
      return getFallbackTrendingTokens()
    }
    
    const data = await response.json()
    
    if (data.pairs) {
      // Filter for new pairs with high volatility
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
      const scalpCandidates = data.pairs
        .filter((pair: TokenData) => 
          pair.chainId === 'solana' &&
          pair.quoteToken?.symbol === 'SOL' &&
          pair.pairCreatedAt && pair.pairCreatedAt > oneDayAgo &&
          (pair.priceChange?.h1 || 0) > 5 && // At least 5% change in 1h
          (pair.volume?.h24 || 0) > 10000 // At least $10k volume
        )
        .sort((a: TokenData, b: TokenData) => 
          (b.priceChange?.h1 || 0) - (a.priceChange?.h1 || 0)
        )
        .slice(0, 20)
      
      return scalpCandidates.map((pair: TokenData) => ({
        pairAddress: pair.pairAddress,
        baseToken: pair.baseToken,
        priceUsd: pair.priceUsd,
        priceChange: pair.priceChange,
        volume: pair.volume,
        liquidity: pair.liquidity,
        marketCap: pair.marketCap,
        txns: pair.txns,
        pairCreatedAt: pair.pairCreatedAt,
        info: pair.info,
      }))
    }
    
    return getFallbackTrendingTokens()
  } catch (error) {
    console.error('Error fetching scalp tokens:', error)
    return getFallbackTrendingTokens()
  }
}

// Fallback trending tokens for demo
function getFallbackTrendingTokens(): TrendingToken[] {
  return [
    {
      pairAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      baseToken: {
        address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        name: 'Bonk',
        symbol: 'BONK',
      },
      priceUsd: '0.00002847',
      priceChange: { h24: 12.5, h6: 5.2, h1: 2.1, m5: 0.5 },
      volume: { h24: 15000000 },
      liquidity: { usd: 25000000 },
      marketCap: 1500000000,
    },
    {
      pairAddress: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
      baseToken: {
        address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
        name: 'Bonfida',
        symbol: 'FIDA',
      },
      priceUsd: '0.3521',
      priceChange: { h24: -5.3, h6: -2.1, h1: 1.5, m5: -0.3 },
      volume: { h24: 5200000 },
      liquidity: { usd: 8500000 },
      marketCap: 45000000,
    },
    {
      pairAddress: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
      baseToken: {
        address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
        name: 'Jupiter',
        symbol: 'JUP',
      },
      priceUsd: '1.25',
      priceChange: { h24: 8.2, h6: 3.5, h1: 1.8, m5: 0.2 },
      volume: { h24: 25000000 },
      liquidity: { usd: 50000000 },
      marketCap: 1700000000,
    },
    {
      pairAddress: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
      baseToken: {
        address: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
        name: 'Popcat',
        symbol: 'POPCAT',
      },
      priceUsd: '0.85',
      priceChange: { h24: 25.3, h6: 12.1, h1: 5.5, m5: 1.2 },
      volume: { h24: 45000000 },
      liquidity: { usd: 12000000 },
      marketCap: 850000000,
    },
    {
      pairAddress: 'MEW1gQWJ3nEXg2qgERiKu7AVFfuwkKmBVJQKBiWqgYq',
      baseToken: {
        address: 'MEW1gQWJ3nEXg2qgERiKu7AVFfuwkKmBVJQKBiWqgYq',
        name: 'cat in a dogs world',
        symbol: 'MEW',
      },
      priceUsd: '0.0089',
      priceChange: { h24: 15.7, h6: 8.2, h1: 3.1, m5: 0.8 },
      volume: { h24: 18000000 },
      liquidity: { usd: 8500000 },
      marketCap: 750000000,
    },
    {
      pairAddress: 'HEGgYVfxT7zY2SqkKwRnK9tCzT4qSKNfv7X4qPfNPn1K',
      baseToken: {
        address: 'HEGgYVfxT7zY2SqkKwRnK9tCzT4qSKNfv7X4qPfNPn1K',
        name: 'Myro',
        symbol: 'MYRO',
      },
      priceUsd: '0.185',
      priceChange: { h24: -3.2, h6: 1.5, h1: -0.8, m5: 0.1 },
      volume: { h24: 8500000 },
      liquidity: { usd: 6500000 },
      marketCap: 185000000,
    },
    {
      pairAddress: 'LH1i7DQYxKHN4W5NQy2sKqFqH8W1Q7MZvjP7GvZQqGz',
      baseToken: {
        address: 'LH1i7DQYxKHN4W5NQy2sKqFqH8W1Q7MZvjP7GvZQqGz',
        name: 'Wen',
        symbol: 'WEN',
      },
      priceUsd: '0.00021',
      priceChange: { h24: 6.8, h6: 2.9, h1: 1.2, m5: -0.2 },
      volume: { h24: 12000000 },
      liquidity: { usd: 9500000 },
      marketCap: 210000000,
    },
    {
      pairAddress: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
      baseToken: {
        address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
        name: 'dogwifhat',
        symbol: 'WIF',
      },
      priceUsd: '2.85',
      priceChange: { h24: 18.5, h6: 9.2, h1: 4.1, m5: 0.9 },
      volume: { h24: 85000000 },
      liquidity: { usd: 45000000 },
      marketCap: 2850000000,
    },
  ]
}

// Helper function to chunk array
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}
