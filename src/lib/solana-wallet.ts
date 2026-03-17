import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import bs58 from 'bs58'

const HELIUS_RPC_URL = process.env.HELIUS_RPC_URL!

if (!HELIUS_RPC_URL) {
  throw new Error('HELIUS_RPC_URL is not set')
}

// Create connection
export const connection = new Connection(HELIUS_RPC_URL, 'confirmed')

// Load wallet from private key
export function getWallet(): Keypair {
  const privateKey = process.env.WALLET_PRIVATE_KEY
  
  if (!privateKey) {
    throw new Error('WALLET_PRIVATE_KEY is not set')
  }
  
  // Decode base58 private key
  const secretKey = bs58.decode(privateKey)
  return Keypair.fromSecretKey(secretKey)
}

// Get wallet public key
export function getWalletPublicKey(): PublicKey {
  const wallet = getWallet()
  return wallet.publicKey
}

// Get wallet address as string
export function getWalletAddress(): string {
  return getWalletPublicKey().toBase58()
}

// Get SOL balance
export async function getSolBalance(): Promise<number> {
  const publicKey = getWalletPublicKey()
  const balance = await connection.getBalance(publicKey)
  return balance / LAMPORTS_PER_SOL
}

// Get all token accounts for the wallet
export async function getTokenAccounts(): Promise<Array<{
  mint: string
  amount: bigint
  decimals: number
  uiAmount: number
}>> {
  const publicKey = getWalletPublicKey()
  
  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
    programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
  })

  return tokenAccounts.value.map(account => {
    const info = account.account.data.parsed.info
    const amount = BigInt(info.tokenAmount.amount)
    const decimals = info.tokenAmount.decimals
    const uiAmount = Number(amount) / Math.pow(10, decimals)
    
    return {
      mint: info.mint,
      amount,
      decimals,
      uiAmount,
    }
  }).filter(account => account.uiAmount > 0)
}

// Check if wallet has sufficient balance
export async function hasSufficientBalance(amount: number): Promise<boolean> {
  const balance = await getSolBalance()
  // Reserve some SOL for fees
  return balance >= amount + 0.01
}
