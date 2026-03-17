import { NextRequest, NextResponse } from 'next/server';
import { autoTrader } from '@/lib/auto-trader';
import { db } from '@/lib/db';

// Cron secret to prevent unauthorized access
const CRON_SECRET = process.env.CRON_SECRET || 'solana-scalper-secret';

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const urlSecret = request.nextUrl.searchParams.get('secret');
    
    if (authHeader !== `Bearer ${CRON_SECRET}` && urlSecret !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if auto-trade is enabled
    const config = await db.agentConfig.findFirst();
    
    if (!config?.autoTradeEnabled) {
      return NextResponse.json({
        success: true,
        message: 'Auto-trade is disabled',
        status: autoTrader.getStatus()
      });
    }

    // Run the scan
    const result = await autoTrader.scanAndTrade();

    // Also check exit signals (stop-loss/take-profit)
    await autoTrader.checkExitSignals();

    return NextResponse.json({
      success: true,
      result,
      status: autoTrader.getStatus()
    });

  } catch (error) {
    console.error('Cron auto-trade error:', error);
    return NextResponse.json({
      success: false,
      error: String(error)
    }, { status: 500 });
  }
}

// Manual trigger endpoint
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action, secret } = body;

    // Verify secret
    if (secret !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (action === 'start') {
      // Start continuous scanning (every 60 seconds)
      autoTrader.start(60000);
      return NextResponse.json({
        success: true,
        message: 'Auto-trader started',
        status: autoTrader.getStatus()
      });
    }

    if (action === 'stop') {
      autoTrader.stop();
      return NextResponse.json({
        success: true,
        message: 'Auto-trader stopped',
        status: autoTrader.getStatus()
      });
    }

    if (action === 'scan') {
      // Single scan
      const result = await autoTrader.scanAndTrade();
      await autoTrader.checkExitSignals();
      return NextResponse.json({
        success: true,
        result,
        status: autoTrader.getStatus()
      });
    }

    if (action === 'status') {
      return NextResponse.json({
        success: true,
        status: autoTrader.getStatus()
      });
    }

    return NextResponse.json({
      error: 'Invalid action. Use: start, stop, scan, status'
    }, { status: 400 });

  } catch (error) {
    console.error('Auto-trade action error:', error);
    return NextResponse.json({
      success: false,
      error: String(error)
    }, { status: 500 });
  }
}
