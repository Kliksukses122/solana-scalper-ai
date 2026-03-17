import ZAI from 'z-ai-web-dev-sdk'
import { TokenData, TrendingToken } from './market-data'

export interface AIAnalysis {
  action: 'BUY' | 'SELL' | 'HOLD'
  confidence: number
  reasoning: string
  marketSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  priceTarget?: number
  stopLoss?: number
}

// Analyze a single token
export async function analyzeToken(
  tokenData: TokenData | TrendingToken,
  additionalContext?: string
): Promise<AIAnalysis> {
  try {
    const zai = await ZAI.create()
    
    const prompt = `You are an expert Solana memecoin trader specializing in scalp trading. Analyze the following token and provide trading recommendations.

Token Information:
- Name: ${tokenData.baseToken.name}
- Symbol: ${tokenData.baseToken.symbol}
- Address: ${tokenData.baseToken.address}
- Price USD: $${tokenData.priceUsd}
- 24h Price Change: ${tokenData.priceChange?.h24 || 0}%
- 6h Price Change: ${tokenData.priceChange?.h6 || 0}%
- 1h Price Change: ${tokenData.priceChange?.h1 || 0}%
- 5m Price Change: ${tokenData.priceChange?.m5 || 0}%
- 24h Volume: $${formatNumber(tokenData.volume?.h24 || 0)}
${tokenData.liquidity ? `- Liquidity: $${formatNumber(tokenData.liquidity.usd)}` : ''}
${tokenData.marketCap ? `- Market Cap: $${formatNumber(tokenData.marketCap)}` : ''}
${tokenData.txns ? `- 24h Transactions: ${tokenData.txns.h24.buys + tokenData.txns.h24.sells} (${tokenData.txns.h24.buys} buys, ${tokenData.txns.h24.sells} sells)` : ''}
${additionalContext ? `\nAdditional Context: ${additionalContext}` : ''}

Analyze this token for a short-term scalp trade opportunity. Consider:
1. Momentum indicators (price changes across timeframes)
2. Volume and liquidity for entry/exit
3. Risk factors (rug pull indicators, low liquidity)
4. Market sentiment

Respond in JSON format with these fields:
{
  "action": "BUY" | "SELL" | "HOLD",
  "confidence": <number 0-100>,
  "reasoning": "<detailed explanation>",
  "marketSentiment": "BULLISH" | "BEARISH" | "NEUTRAL",
  "riskLevel": "LOW" | "MEDIUM" | "HIGH",
  "priceTarget": <optional number>,
  "stopLoss": <optional number>
}

Focus on providing actionable scalp trading advice. Be conservative with BUY recommendations - only suggest BUY for tokens with clear momentum and reasonable liquidity.`

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are a professional crypto trading analyst specializing in Solana memecoins. Always respond with valid JSON only, no markdown formatting.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 1000,
    })

    const responseText = completion.choices[0]?.message?.content || ''
    
    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        action: parsed.action || 'HOLD',
        confidence: Math.min(100, Math.max(0, parsed.confidence || 50)),
        reasoning: parsed.reasoning || 'Unable to analyze',
        marketSentiment: parsed.marketSentiment || 'NEUTRAL',
        riskLevel: parsed.riskLevel || 'MEDIUM',
        priceTarget: parsed.priceTarget,
        stopLoss: parsed.stopLoss,
      }
    }
    
    return getDefaultAnalysis()
  } catch (error) {
    console.error('AI analysis error:', error)
    return getDefaultAnalysis()
  }
}

// Analyze market conditions for multiple tokens
export async function analyzeMarket(
  tokens: TrendingToken[]
): Promise<{
  overallSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
  topPick?: TrendingToken
  recommendations: Array<{
    token: TrendingToken
    analysis: AIAnalysis
  }>
}> {
  try {
    const zai = await ZAI.create()
    
    const tokenSummaries = tokens.slice(0, 10).map(t => 
      `${t.baseToken.symbol}: ${t.priceChange?.h24 || 0}% 24h, $${formatNumber(t.volume?.h24 || 0)} vol`
    ).join('\n')
    
    const prompt = `Analyze the current Solana memecoin market conditions:

${tokenSummaries}

Provide:
1. Overall market sentiment assessment
2. Which token looks best for a scalp trade right now and why
3. Brief analysis of each token

Respond in JSON format:
{
  "overallSentiment": "BULLISH" | "BEARISH" | "NEUTRAL",
  "topPickSymbol": "<symbol of best opportunity>",
  "analysis": "<brief market analysis>"
}`

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are a crypto market analyst. Always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.4,
      max_tokens: 500,
    })

    const responseText = completion.choices[0]?.message?.content || ''
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    
    let overallSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL'
    let topPickSymbol = ''
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      overallSentiment = parsed.overallSentiment || 'NEUTRAL'
      topPickSymbol = parsed.topPickSymbol || ''
    }
    
    // Find top pick
    const topPick = tokens.find(t => 
      t.baseToken.symbol.toLowerCase() === topPickSymbol.toLowerCase()
    )
    
    // Analyze top 5 tokens
    const recommendations = []
    for (const token of tokens.slice(0, 5)) {
      const analysis = await analyzeToken(token)
      recommendations.push({ token, analysis })
    }
    
    return {
      overallSentiment,
      topPick,
      recommendations,
    }
  } catch (error) {
    console.error('Market analysis error:', error)
    return {
      overallSentiment: 'NEUTRAL',
      recommendations: [],
    }
  }
}

// Generate trading signal explanation
export async function generateSignalExplanation(
  token: TrendingToken,
  action: 'BUY' | 'SELL' | 'HOLD',
  technicals: {
    rsi?: number
    macd?: string
    volume24h: number
    priceChange24h: number
  }
): Promise<string> {
  try {
    const zai = await ZAI.create()
    
    const prompt = `Explain why ${action} signal was generated for ${token.baseToken.symbol}:

Token: ${token.baseToken.name} (${token.baseToken.symbol})
Price: $${token.priceUsd}
24h Change: ${technicals.priceChange24h}%
24h Volume: $${formatNumber(technicals.volume24h)}
${technicals.rsi ? `RSI: ${technicals.rsi}` : ''}
${technicals.macd ? `MACD: ${technicals.macd}` : ''}

Provide a brief, clear explanation (2-3 sentences) for the ${action} signal.`

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are a trading signal analyst. Be concise and clear.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 150,
    })

    return completion.choices[0]?.message?.content || `${action} signal generated based on technical indicators.`
  } catch {
    return `${action} signal generated based on technical indicators.`
  }
}

// Helper function to format large numbers
function formatNumber(num: number): string {
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B'
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M'
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K'
  return num.toFixed(2)
}

// Default analysis for error cases
function getDefaultAnalysis(): AIAnalysis {
  return {
    action: 'HOLD',
    confidence: 50,
    reasoning: 'Unable to complete analysis. Please try again.',
    marketSentiment: 'NEUTRAL',
    riskLevel: 'MEDIUM',
  }
}
