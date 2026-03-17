import { NextRequest, NextResponse } from 'next/server';
import { tradingService } from '@/lib/trading-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { type, tokenAddress, amount, slippageBps } = body;
    
    if (!type || !tokenAddress || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: type, tokenAddress, amount' },
        { status: 400 }
      );
    }

    if (type !== 'BUY' && type !== 'SELL') {
      return NextResponse.json(
        { error: 'Type must be BUY or SELL' },
        { status: 400 }
      );
    }

    const quote = await tradingService.getQuote(
      type,
      tokenAddress,
      parseFloat(amount),
      slippageBps || 100
    );

    if (!quote) {
      return NextResponse.json(
        { error: 'Failed to get quote from Jupiter' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      quote: {
        inputAmount: quote.inputAmount,
        outputAmount: quote.outputAmount,
        priceImpact: quote.priceImpact,
        route: quote.route,
        minimumOutput: quote.minimumOutput
      }
    });
  } catch (error) {
    console.error('Quote route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
