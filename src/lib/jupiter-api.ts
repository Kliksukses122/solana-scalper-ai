/**
 * Jupiter API Service
 * DEX aggregator for Solana - best swap routes across all DEXes
 * API Docs: https://station.jup.ag/docs/apis/swap-api
 */

export interface JupiterQuote {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee: null | {
    amount: string;
    feeBps: number;
  };
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
  contextSlot: number;
  timeTaken: number;
}

export interface JupiterSwapResponse {
  swapTransaction: string;
  lastValidBlockHeight: number;
  prioritizationFeeLamports: number;
}

export interface SwapResult {
  success: boolean;
  txHash?: string;
  inputAmount: string;
  outputAmount: string;
  priceImpact: number;
  route: string[];
  error?: string;
}

// SOL mint address (native)
export const SOL_MINT = 'So11111111111111111111111111111111111111112';

// USDC mint address
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6';
const JUPITER_SWAP_API = 'https://quote-api.jup.ag/v6';

function getApiKey(): string {
  return process.env.JUPITER_API_KEY || '';
}

/**
 * Get swap quote from Jupiter
 */
export async function getQuote(
  inputMint: string,
  outputMint: string,
  amount: string,
  slippageBps: number = 100 // 1% default slippage
): Promise<JupiterQuote | null> {
  const apiKey = getApiKey();
  
  try {
    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount,
      slippageBps: slippageBps.toString(),
      onlyDirectRoutes: 'false',
      asLegacyTransaction: 'false',
    });

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }

    const response = await fetch(`${JUPITER_QUOTE_API}/quote?${params}`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error(`Jupiter quote API error: ${response.status}`);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting Jupiter quote:', error);
    return null;
  }
}

/**
 * Get swap transaction from Jupiter
 * Note: This returns serialized transaction that needs to be signed by wallet
 */
export async function getSwapTransaction(
  quoteResponse: JupiterQuote,
  userPublicKey: string,
  wrapAndUnwrapSol: boolean = true,
  priorityFee?: 'auto' | 'low' | 'medium' | 'high' | 'veryHigh'
): Promise<JupiterSwapResponse | null> {
  const apiKey = getApiKey();
  
  try {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }

    // Priority fee levels (in lamports)
    // higher = faster inclusion in block
    const priorityFeeValue = priorityFee || 'auto';

    const response = await fetch(`${JUPITER_SWAP_API}/swap`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        quoteResponse,
        userPublicKey,
        wrapAndUnwrapSol,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: priorityFeeValue,
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error(`Jupiter swap API error: ${response.status}`);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting Jupiter swap transaction:', error);
    return null;
  }
}

/**
 * Execute a swap (requires wallet private key for signing)
 * This is the main function for trading
 */
export async function executeSwap(
  inputMint: string,
  outputMint: string,
  amount: string,
  walletPublicKey: string,
  slippageBps: number = 100
): Promise<SwapResult> {
  try {
    // Get quote
    const quote = await getQuote(inputMint, outputMint, amount, slippageBps);
    
    if (!quote) {
      return {
        success: false,
        inputAmount: amount,
        outputAmount: '0',
        priceImpact: 0,
        route: [],
        error: 'Failed to get quote',
      };
    }

    // Get swap transaction
    const swapTx = await getSwapTransaction(quote, walletPublicKey);
    
    if (!swapTx) {
      return {
        success: false,
        inputAmount: amount,
        outputAmount: '0',
        priceImpact: parseFloat(quote.priceImpactPct),
        route: quote.routePlan.map(r => r.swapInfo.label),
        error: 'Failed to create swap transaction',
      };
    }

    // Note: At this point, the transaction needs to be signed and sent
    // This requires wallet integration (Phantom, Solflare, or private key)
    
    return {
      success: true,
      inputAmount: quote.inAmount,
      outputAmount: quote.outAmount,
      priceImpact: parseFloat(quote.priceImpactPct),
      route: quote.routePlan.map(r => r.swapInfo.label),
      // txHash would be set after actual signing and sending
    };
  } catch (error) {
    console.error('Error executing swap:', error);
    return {
      success: false,
      inputAmount: amount,
      outputAmount: '0',
      priceImpact: 0,
      route: [],
      error: String(error),
    };
  }
}

/**
 * Get price for a token pair
 */
export async function getTokenPrice(
  inputMint: string,
  outputMint: string,
  amount: string = '1000000' // 1 unit with 6 decimals default
): Promise<{ price: number; priceImpact: number } | null> {
  try {
    const quote = await getQuote(inputMint, outputMint, amount);
    
    if (!quote) {
      return null;
    }

    const inAmount = parseFloat(quote.inAmount);
    const outAmount = parseFloat(quote.outAmount);
    const price = outAmount / inAmount;

    return {
      price,
      priceImpact: parseFloat(quote.priceImpactPct),
    };
  } catch (error) {
    console.error('Error getting token price:', error);
    return null;
  }
}

/**
 * Get multiple token prices in SOL
 */
export async function getMultipleTokenPricesInSol(
  tokenMints: string[]
): Promise<Record<string, { priceInSol: number; priceImpact: number }>> {
  const result: Record<string, { priceInSol: number; priceImpact: number }> = {};

  // Process in batches to avoid rate limits
  const batchSize = 5;
  
  for (let i = 0; i < tokenMints.length; i += batchSize) {
    const batch = tokenMints.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async (mint) => {
      const priceData = await getTokenPrice(mint, SOL_MINT);
      if (priceData) {
        result[mint] = {
          priceInSol: priceData.price,
          priceImpact: priceData.priceImpact,
        };
      }
    }));
    
    // Small delay between batches
    if (i + batchSize < tokenMints.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return result;
}

/**
 * Calculate minimum output amount for a swap
 */
export function calculateMinimumOutput(
  outputAmount: string,
  slippageBps: number
): string {
  const output = parseFloat(outputAmount);
  const slippageMultiplier = 1 - (slippageBps / 10000);
  return (output * slippageMultiplier).toFixed(0);
}

/**
 * Format token amount with decimals
 */
export function formatTokenAmount(amount: string, decimals: number = 9): number {
  return parseFloat(amount) / Math.pow(10, decimals);
}

/**
 * Parse token amount to smallest unit
 */
export function parseTokenAmount(amount: number, decimals: number = 9): string {
  return Math.floor(amount * Math.pow(10, decimals)).toString();
}
