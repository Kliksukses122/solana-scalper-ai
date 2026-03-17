/**
 * Solana Wallet Service
 * Handles wallet operations for trading
 */

import { 
  Connection, 
  Keypair, 
  PublicKey, 
  VersionedTransaction,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import bs58 from 'bs58';

let connection: Connection | null = null;
let keypair: Keypair | null = null;

/**
 * Get Solana RPC connection
 */
export function getConnection(): Connection {
  if (!connection) {
    const rpcUrl = process.env.HELIUS_RPC_URL || process.env.NEXT_PUBLIC_HELIUS_RPC_URL;
    if (!rpcUrl) {
      throw new Error('HELIUS_RPC_URL not configured');
    }
    connection = new Connection(rpcUrl, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000,
    });
  }
  return connection;
}

/**
 * Get wallet keypair from private key
 */
export function getWallet(): Keypair {
  if (!keypair) {
    const privateKey = process.env.WALLET_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('WALLET_PRIVATE_KEY not configured');
    }
    
    // Parse private key (can be base58 or array format)
    try {
      // Try as base58 string first
      const secretKey = bs58.decode(privateKey);
      if (secretKey.length === 64) {
        keypair = Keypair.fromSecretKey(secretKey);
      } else {
        throw new Error('Invalid key length');
      }
    } catch (e) {
      // Try as JSON array
      try {
        const parsed = JSON.parse(privateKey);
        const secretKey = Uint8Array.from(parsed);
        if (secretKey.length === 64) {
          keypair = Keypair.fromSecretKey(secretKey);
        } else {
          throw new Error('Invalid key length');
        }
      } catch {
        throw new Error(`Invalid private key format: ${e}`);
      }
    }
  }
  return keypair;
}

/**
 * Get wallet public key as string
 */
export function getWalletPublicKey(): string {
  const wallet = getWallet();
  return wallet.publicKey.toBase58();
}

/**
 * Get wallet SOL balance
 */
export async function getSolBalance(): Promise<number> {
  const conn = getConnection();
  const wallet = getWallet();
  const balance = await conn.getBalance(wallet.publicKey);
  return balance / LAMPORTS_PER_SOL;
}

/**
 * Get wallet SPL token accounts
 */
export async function getTokenAccounts(): Promise<Array<{
  mint: string;
  address: string;
  balance: bigint;
  decimals: number;
}>> {
  const conn = getConnection();
  const wallet = getWallet();
  
  const tokenAccounts = await conn.getParsedTokenAccountsByOwner(
    wallet.publicKey,
    { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
  );
  
  return tokenAccounts.value.map(acc => ({
    mint: acc.account.data.parsed.info.mint,
    address: acc.pubkey.toBase58(),
    balance: BigInt(acc.account.data.parsed.info.tokenAmount.amount),
    decimals: acc.account.data.parsed.info.tokenAmount.decimals,
  }));
}

/**
 * Sign and send a versioned transaction
 */
export async function signAndSendTransaction(
  serializedTransaction: Buffer | Uint8Array
): Promise<string> {
  const conn = getConnection();
  const wallet = getWallet();
  
  // Deserialize the transaction
  const transaction = VersionedTransaction.deserialize(serializedTransaction);
  
  // Sign the transaction
  transaction.sign([wallet]);
  
  // Send the transaction
  const signature = await conn.sendTransaction(transaction, {
    skipPreflight: true,
    maxRetries: 3,
  });
  
  console.log(`Transaction sent: ${signature}`);
  
  // Confirm the transaction
  const latestBlockhash = await conn.getLatestBlockhash();
  
  const confirmation = await conn.confirmTransaction(
    {
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    },
    'confirmed'
  );
  
  if (confirmation.value.err) {
    throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
  }
  
  console.log(`Transaction confirmed: ${signature}`);
  return signature;
}

/**
 * Sign and send transaction with retry
 */
export async function signAndSendWithRetry(
  serializedTransaction: Buffer | Uint8Array,
  maxRetries: number = 3
): Promise<{ signature: string; status: 'confirmed' | 'failed'; error?: string }> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const signature = await signAndSendTransaction(serializedTransaction);
      return { signature, status: 'confirmed' };
    } catch (error) {
      lastError = error as Error;
      console.error(`Attempt ${attempt + 1} failed:`, error);
      
      // Wait before retry
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
      }
    }
  }
  
  return { 
    signature: '', 
    status: 'failed', 
    error: lastError?.message || 'Unknown error' 
  };
}

/**
 * Check if wallet is configured
 */
export function isWalletConfigured(): boolean {
  return !!process.env.WALLET_PRIVATE_KEY;
}

/**
 * Get wallet info
 */
export async function getWalletInfo(): Promise<{
  publicKey: string;
  solBalance: number;
  tokenCount: number;
}> {
  const publicKey = getWalletPublicKey();
  const solBalance = await getSolBalance();
  const tokenAccounts = await getTokenAccounts();
  
  return {
    publicKey,
    solBalance,
    tokenCount: tokenAccounts.length,
  };
}
