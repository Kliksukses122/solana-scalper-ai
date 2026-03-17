import { NextRequest, NextResponse } from 'next/server';
import { tradingService } from '@/lib/trading-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { tokenAddress, tokenSymbol, tokenName, amount, price } = body;
    
    if (!tokenAddress || !tokenSymbol || !amount || !price) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const result = await tradingService.executeTrade({
      type: 'BUY',
      tokenAddress,
      tokenSymbol,
      tokenName: tokenName || tokenSymbol,
      amount: parseFloat(amount),
      price: parseFloat(price)
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        tradeId: result.tradeId,
        txHash: result.txHash
      });
    } else {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Buy route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
