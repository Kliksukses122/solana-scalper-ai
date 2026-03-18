import { NextResponse } from 'next/server';
import { getWalletAddress, getSolBalance, getTokenAccounts } from '@/lib/solana-wallet';

export async function GET() {
  try {
    const publicKey = getWalletAddress();
    const balance = await getSolBalance();
    const tokenAccounts = await getTokenAccounts();

    return NextResponse.json({
      success: true,
      publicKey,
      balance,
      tokens: tokenAccounts.map(t => ({
        mint: t.mint,
        amount: t.uiAmount
      }))
    });
  } catch (error: any) {
    console.error('Wallet API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error?.message || 'Failed to get wallet info'
      },
      { status: 500 }
    );
  }
}
