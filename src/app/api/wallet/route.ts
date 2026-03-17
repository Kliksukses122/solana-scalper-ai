import { NextResponse } from 'next/server';
import { tradingService } from '@/lib/trading-service';

export async function GET() {
  try {
    const walletInfo = await tradingService.getWalletInfo();
    
    if (!walletInfo) {
      return NextResponse.json({
        success: false,
        configured: false,
        message: 'Wallet not configured. Set WALLET_PRIVATE_KEY in environment.'
      });
    }

    return NextResponse.json({
      success: true,
      configured: true,
      wallet: {
        publicKey: walletInfo.publicKey,
        solBalance: walletInfo.solBalance,
        tokenCount: walletInfo.tokenCount
      }
    });
  } catch (error) {
    console.error('Wallet route error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get wallet info' },
      { status: 500 }
    );
  }
}
