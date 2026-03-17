import { NextRequest, NextResponse } from 'next/server';
import { getTokenPrices } from '@/lib/market-data';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const addresses = searchParams.get('addresses');
    
    if (!addresses) {
      return NextResponse.json(
        { error: 'Token addresses are required (comma-separated)' },
        { status: 400 }
      );
    }

    const addressList = addresses.split(',').map(a => a.trim());
    const prices = await getTokenPrices(addressList);
    
    return NextResponse.json({
      success: true,
      prices
    });
  } catch (error) {
    console.error('Prices route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
