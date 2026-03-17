import { NextRequest, NextResponse } from 'next/server';
import { fetchTrendingTokens, fetchNewTokens, initializeMemecoins } from '@/lib/market-data';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'hot'; // hot, new, all
    
    // Initialize memecoins in database if needed (fetches real data)
    await initializeMemecoins();
    
    let tokens;
    
    if (filter === 'new') {
      // Fetch new token listings
      tokens = await fetchNewTokens();
    } else {
      // Fetch trending/hot tokens
      tokens = await fetchTrendingTokens();
    }
    
    return NextResponse.json({
      success: true,
      tokens,
      filter
    });
  } catch (error) {
    console.error('Trending route error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch tokens', tokens: [] },
      { status: 500 }
    );
  }
}
