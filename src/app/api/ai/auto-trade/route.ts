import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      enabled, 
      tradingEnabled,
      riskTolerance,
      maxPositionSize,
      stopLossPercent,
      takeProfitPercent,
      autoTradeEnabled 
    } = body;
    
    const config = await db.agentConfig.findFirst();
    
    const updateData: Record<string, unknown> = {};
    
    if (typeof enabled === 'boolean') {
      updateData.autoTradeEnabled = enabled;
    }
    if (typeof autoTradeEnabled === 'boolean') {
      updateData.autoTradeEnabled = autoTradeEnabled;
    }
    if (typeof tradingEnabled === 'boolean') {
      updateData.tradingEnabled = tradingEnabled;
    }
    if (riskTolerance) {
      updateData.riskTolerance = riskTolerance;
    }
    if (typeof maxPositionSize === 'number') {
      updateData.maxPositionSize = maxPositionSize;
    }
    if (typeof stopLossPercent === 'number') {
      updateData.stopLossPercent = stopLossPercent;
    }
    if (typeof takeProfitPercent === 'number') {
      updateData.takeProfitPercent = takeProfitPercent;
    }
    
    if (config) {
      await db.agentConfig.update({
        where: { id: config.id },
        data: updateData
      });
    } else {
      await db.agentConfig.create({
        data: {
          autoTradeEnabled: typeof enabled === 'boolean' ? enabled : (typeof autoTradeEnabled === 'boolean' ? autoTradeEnabled : false),
          tradingEnabled: typeof tradingEnabled === 'boolean' ? tradingEnabled : true,
          riskTolerance: riskTolerance || 'MEDIUM',
          maxPositionSize: maxPositionSize || 10,
          stopLossPercent: stopLossPercent || 5,
          takeProfitPercent: takeProfitPercent || 20
        }
      });
    }
    
    return NextResponse.json({
      success: true,
      config: updateData
    });
  } catch (error) {
    console.error('Auto-trade route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const config = await db.agentConfig.findFirst();
    
    return NextResponse.json({
      success: true,
      autoTradeEnabled: config?.autoTradeEnabled ?? false,
      tradingEnabled: config?.tradingEnabled ?? true,
      riskTolerance: config?.riskTolerance ?? 'MEDIUM',
      maxPositionSize: config?.maxPositionSize ?? 10,
      stopLossPercent: config?.stopLossPercent ?? 5,
      takeProfitPercent: config?.takeProfitPercent ?? 20
    });
  } catch (error) {
    console.error('Auto-trade GET route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
