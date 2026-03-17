import { PublicKey, VersionedTransaction } from '@solana/web3.js'
import { connection, getWallet } from './solana-wallet'

const JUPITER_API_KEY = process.env.JUPITER_API_KEY
const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6'

interface QuoteResponse {
  inputMint: string
  inAmount: string
  outputMint: string
  outAmount: string
  otherAmountThreshold: string
  swapMode: string
  slippageBps: number
  priceImpactPct: string
  routePlan: Array<{
    swapInfo: {
      ammKey: string
      label: string
      inputMint: string
      outputMint: string
      inAmount: string
      outAmount: string
      feeAmount: string
      feeMint: string
    }
    percent: number
  }>
}

interface SwapResponse {
  swapTransaction: string
  lastValidBlockHeight: number
  prioritizationFeeLamports: number
}

// SOL mint address (native)
export const SOL_MINT = 'So11111111111111111111111111111111111111112'

// Get quote for swap
export async function getQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number = 500 // 5% default slippage
): Promise<QuoteResponse | null> {
  try {
    // Convert amount to lamports if it's SOL
    const amountInLamports = inputMint === SOL_MINT 
      ? Math.floor(amount * 1e9)
      : Math.floor(amount)
    
    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount: amountInLamports.toString(),
      slippageBps: slippageBps.toString(),
    })

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }
    
    if (JUPITER_API_KEY) {
      headers['x-api-key'] = JUPITER_API_KEY
    }

    const response = await fetch(`${JUPITER_QUOTE_API}/quote?${params}`, {
      headers,
    })

    if (!response.ok) {
      console.error('Quote API error:', await response.text())
      return null
    }

    return await response.json()
  } catch (error) {
    console.error('Error getting quote:', error)
    return null
  }
}

// Get swap transaction
export async function getSwapTransaction(
  quoteResponse: QuoteResponse,
  userPublicKey: string
): Promise<SwapResponse | null> {
  try {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }
    
    if (JUPITER_API_KEY) {
      headers['x-api-key'] = JUPITER_API_KEY
    }

    const response = await fetch(`${JUPITER_QUOTE_API}/swap`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        quoteResponse,
        userPublicKey,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 'auto',
      }),
    })

    if (!response.ok) {
      console.error('Swap API error:', await response.text())
      return null
    }

    return await response.json()
  } catch (error) {
    console.error('Error getting swap transaction:', error)
    return null
  }
}

// Execute swap
export async function executeSwap(
  swapTransaction: string
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const wallet = getWallet()
    
    // Deserialize transaction
    const swapTransactionBuf = Buffer.from(swapTransaction, 'base64')
    const transaction = VersionedTransaction.deserialize(swapTransactionBuf)
    
    // Sign transaction
    transaction.sign([wallet])
    
    // Send transaction
    const rawTransaction = transaction.serialize()
    const txHash = await connection.sendRawTransaction(rawTransaction, {
      skipPreflight: true,
      maxRetries: 2,
    })
    
    // Confirm transaction
    const latestBlockHash = await connection.getLatestBlockhash()
    await connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: txHash,
    }, 'confirmed')
    
    return { success: true, txHash }
  } catch (error) {
    console.error('Error executing swap:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

// Buy token with SOL
export async function buyToken(
  tokenMint: string,
  solAmount: number,
  slippageBps: number = 500
): Promise<{ success: boolean; txHash?: string; error?: string; outAmount?: string }> {
  try {
    const wallet = getWallet()
    const publicKey = wallet.publicKey.toBase58()
    
    // Get quote
    const quote = await getQuote(SOL_MINT, tokenMint, solAmount, slippageBps)
    if (!quote) {
      return { success: false, error: 'Failed to get quote' }
    }
    
    // Get swap transaction
    const swap = await getSwapTransaction(quote, publicKey)
    if (!swap) {
      return { success: false, error: 'Failed to get swap transaction' }
    }
    
    // Execute swap
    const result = await executeSwap(swap.swapTransaction)
    
    return {
      ...result,
      outAmount: quote.outAmount,
    }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

// Sell token for SOL
export async function sellToken(
  tokenMint: string,
  tokenAmount: number,
  decimals: number,
  slippageBps: number = 500
): Promise<{ success: boolean; txHash?: string; error?: string; outAmount?: string }> {
  try {
    const wallet = getWallet()
    const publicKey = wallet.publicKey.toBase58()
    
    // Convert to smallest unit
    const amountInSmallestUnit = Math.floor(tokenAmount * Math.pow(10, decimals))
    
    // Get quote (reverse direction)
    const quote = await getQuote(tokenMint, SOL_MINT, amountInSmallestUnit / 1e9, slippageBps)
    if (!quote) {
      return { success: false, error: 'Failed to get quote' }
    }
    
    // Get swap transaction
    const swap = await getSwapTransaction(quote, publicKey)
    if (!swap) {
      return { success: false, error: 'Failed to get swap transaction' }
    }
    
    // Execute swap
    const result = await executeSwap(swap.swapTransaction)
    
    return {
      ...result,
      outAmount: quote.outAmount,
    }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

// Get price for a token in SOL
export async function getTokenPriceInSol(
  tokenMint: string
): Promise<number | null> {
  try {
    const quote = await getQuote(tokenMint, SOL_MINT, 1, 100)
    if (!quote) return null
    
    // Calculate price: outAmount (SOL) for 1 token
    return Number(quote.outAmount) / 1e9
  } catch {
    return null
  }
}
