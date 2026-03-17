import { createServer } from 'http'
import { Server } from 'socket.io'

const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// Types for trading events
interface PriceUpdate {
  tokenAddress: string
  tokenSymbol: string
  price: number
  change24h: number
  timestamp: Date
}

interface TradeNotification {
  tradeId: string
  type: 'BUY' | 'SELL'
  tokenSymbol: string
  amount: number
  price: number
  totalValue: number
  txHash: string
  timestamp: Date
}

interface AIAlert {
  tokenAddress: string
  tokenSymbol: string
  action: 'BUY' | 'SELL' | 'HOLD'
  confidence: number
  reasoning: string
  timestamp: Date
}

interface PortfolioUpdate {
  totalValue: number
  totalPnl: number
  positions: number
  timestamp: Date
}

// Mock token addresses for simulation
const TOKENS = [
  { address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', symbol: 'BONK', basePrice: 0.000015 },
  { address: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', symbol: 'POPCAT', basePrice: 0.00045 },
  { address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', symbol: 'WIF', basePrice: 0.00085 },
  { address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', symbol: 'JUP', basePrice: 0.00072 },
  { address: 'MEW1gBAS1Aqi5KMKJWxv7RgEvmVvVWCEvqBKrLd5x6v', symbol: 'MEW', basePrice: 0.000025 },
]

// Store current prices
const currentPrices = new Map<string, { price: number; change24h: number }>()
TOKENS.forEach(t => {
  currentPrices.set(t.address, { 
    price: t.basePrice, 
    change24h: (Math.random() - 0.5) * 20 
  })
})

// Simulate price updates
function simulatePriceUpdate() {
  TOKENS.forEach(token => {
    const current = currentPrices.get(token.address)!
    const volatility = 0.02 // 2% volatility
    const change = (Math.random() - 0.5) * 2 * volatility
    const newPrice = current.price * (1 + change)
    const newChange24h = current.change24h + (Math.random() - 0.5) * 2
    
    currentPrices.set(token.address, {
      price: newPrice,
      change24h: newChange24h
    })

    const update: PriceUpdate = {
      tokenAddress: token.address,
      tokenSymbol: token.symbol,
      price: newPrice,
      change24h: newChange24h,
      timestamp: new Date()
    }

    io.emit('price-update', update)
  })
}

// Simulate random AI alerts
function simulateAIAlert() {
  const randomToken = TOKENS[Math.floor(Math.random() * TOKENS.length)]
  const actions: ('BUY' | 'SELL' | 'HOLD')[] = ['BUY', 'SELL', 'HOLD']
  const randomAction = actions[Math.floor(Math.random() * actions.length)]
  
  const alert: AIAlert = {
    tokenAddress: randomToken.address,
    tokenSymbol: randomToken.symbol,
    action: randomAction,
    confidence: 0.5 + Math.random() * 0.5,
    reasoning: generateMockReasoning(randomAction, randomToken.symbol),
    timestamp: new Date()
  }

  io.emit('ai-alert', alert)
  console.log(`AI Alert: ${randomAction} ${randomToken.symbol} (Confidence: ${(alert.confidence * 100).toFixed(1)}%)`)
}

function generateMockReasoning(action: string, symbol: string): string {
  const reasons = {
    BUY: [
      `${symbol} showing strong bullish momentum with increasing volume`,
      `Positive sentiment surge detected for ${symbol}, recommend accumulation`,
      `${symbol} breakout pattern detected, potential upside target reached`,
      `Whale activity detected in ${symbol}, smart money accumulating`,
    ],
    SELL: [
      `${symbol} showing signs of distribution, recommend taking profits`,
      `Bearish divergence detected for ${symbol}, risk of pullback`,
      `${symbol} hitting resistance levels, consider reducing position`,
      `Negative sentiment building for ${symbol}, protective sell advised`,
    ],
    HOLD: [
      `${symbol} consolidating, waiting for clear direction`,
      `Mixed signals for ${symbol}, recommend holding current position`,
      `${symbol} in accumulation range, patience recommended`,
      `Market uncertainty for ${symbol}, maintain current exposure`,
    ]
  }
  
  const actionReasons = reasons[action as keyof typeof reasons]
  return actionReasons[Math.floor(Math.random() * actionReasons.length)]
}

// Connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`)

  // Send current prices on connect
  const priceUpdates: PriceUpdate[] = TOKENS.map(token => {
    const current = currentPrices.get(token.address)!
    return {
      tokenAddress: token.address,
      tokenSymbol: token.symbol,
      price: current.price,
      change24h: current.change24h,
      timestamp: new Date()
    }
  })
  
  socket.emit('initial-prices', priceUpdates)

  // Handle manual trade execution
  socket.on('execute-trade', (data: {
    type: 'BUY' | 'SELL'
    tokenAddress: string
    tokenSymbol: string
    amount: number
  }) => {
    console.log(`Trade request: ${data.type} ${data.amount} ${data.tokenSymbol}`)
    
    // Simulate trade execution
    setTimeout(() => {
      const current = currentPrices.get(data.tokenAddress) || { price: 0.001, change24h: 0 }
      const notification: TradeNotification = {
        tradeId: Math.random().toString(36).substr(2, 9),
        type: data.type,
        tokenSymbol: data.tokenSymbol,
        amount: data.amount,
        price: current.price,
        totalValue: data.amount * current.price,
        txHash: generateTxHash(),
        timestamp: new Date()
      }
      
      io.emit('trade-executed', notification)
      console.log(`Trade executed: ${data.type} ${data.amount} ${data.tokenSymbol}`)
    }, 500 + Math.random() * 1000)
  })

  // Handle portfolio subscription
  socket.on('subscribe-portfolio', () => {
    console.log(`Client ${socket.id} subscribed to portfolio updates`)
    socket.join('portfolio-updates')
  })

  // Handle AI signal request
  socket.on('request-signal', async (data: { tokenAddress: string }) => {
    const token = TOKENS.find(t => t.address === data.tokenAddress)
    if (token) {
      const current = currentPrices.get(token.address)!
      const actions: ('BUY' | 'SELL' | 'HOLD')[] = ['BUY', 'SELL', 'HOLD']
      
      // Bias towards random action based on price change
      let action = actions[Math.floor(Math.random() * 3)]
      if (current.change24h > 10) action = 'BUY'
      if (current.change24h < -10) action = 'SELL'
      
      socket.emit('signal-response', {
        tokenAddress: token.address,
        tokenSymbol: token.symbol,
        action,
        confidence: 0.5 + Math.random() * 0.5,
        reasoning: generateMockReasoning(action, token.symbol),
        currentPrice: current.price,
        timestamp: new Date()
      })
    }
  })

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`)
  })

  socket.on('error', (error) => {
    console.error(`Socket error (${socket.id}):`, error)
  })
})

function generateTxHash(): string {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  let result = ''
  for (let i = 0; i < 88; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// Start price simulation
const priceInterval = setInterval(simulatePriceUpdate, 3000)

// Start AI alert simulation (less frequent)
const alertInterval = setInterval(simulateAIAlert, 15000)

const PORT = 3003
httpServer.listen(PORT, () => {
  console.log(`Trading WebSocket server running on port ${PORT}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM signal, shutting down server...')
  clearInterval(priceInterval)
  clearInterval(alertInterval)
  httpServer.close(() => {
    console.log('WebSocket server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('Received SIGINT signal, shutting down server...')
  clearInterval(priceInterval)
  clearInterval(alertInterval)
  httpServer.close(() => {
    console.log('WebSocket server closed')
    process.exit(0)
  })
})
