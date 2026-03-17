/**
 * Token Security Service
 * Checks for potential scams, honeypots, and rug pull indicators
 */

export interface SecurityCheck {
  score: number           // 0-100, higher = safer
  isHoneypot: boolean
  hasMintAuthority: boolean
  hasFreezeAuthority: boolean
  sellTax: number
  buyTax: number
  liquidityLocked: boolean
  topHolderPercentage: number
  isVerified: boolean
  ageInHours: number
  warnings: string[]
}

export interface EntrySignal {
  shouldEnter: boolean
  confidence: number
  signalStrength: 'STRONG' | 'MODERATE' | 'WEAK' | 'NONE'
  reasons: string[]
  suggestedEntry?: number
  stopLoss?: number
  takeProfit?: number
}

export interface QuickRejectResult {
  rejected: boolean
  reason?: string
}

// Risk thresholds
const RISK_THRESHOLDS = {
  maxSellTax: 25,           // Max sell tax allowed (%)
  maxTopHolder: 50,         // Max % one wallet can hold
  minLiquidity: 10000,      // Min $ liquidity
  maxRiskScore: 60,         // Max risk score to trade
}

class TokenSecurityService {

  /**
   * Quick reject check - fast filter before detailed analysis
   */
  quickReject(token: any): QuickRejectResult {
    // Reject if liquidity too low
    if (token.liquidity && token.liquidity < RISK_THRESHOLDS.minLiquidity) {
      return { rejected: true, reason: 'Liquidity too low' }
    }

    // Reject if extreme negative price action
    if (token.priceChange5m && token.priceChange5m < -20) {
      return { rejected: true, reason: 'Crashing (>20% in 5m)' }
    }

    // Reject if no buy pressure
    if (token.buysLast5m === 0 && token.sellsLast5m > 10) {
      return { rejected: true, reason: 'No buyers, heavy selling' }
    }

    // Reject if pump too extreme (likely top)
    if (token.priceChange1h && token.priceChange1h > 500) {
      return { rejected: true, reason: 'Overextended (+500% 1h)' }
    }

    return { rejected: false }
  }

  /**
   * Comprehensive security check
   */
  async checkToken(tokenAddress: string, tokenData?: any): Promise<SecurityCheck> {
    const warnings: string[] = []
    let score = 100 // Start with perfect score, deduct for risks

    const result: SecurityCheck = {
      score: 100,
      isHoneypot: false,
      hasMintAuthority: false,
      hasFreezeAuthority: false,
      sellTax: 0,
      buyTax: 0,
      liquidityLocked: false,
      topHolderPercentage: 0,
      isVerified: false,
      ageInHours: tokenData?.age ? this.parseAgeToHours(tokenData.age) : 24,
      warnings: []
    }

    try {
      // 1. Check Birdeye security data
      const birdeyeSecurity = await this.checkBirdeyeSecurity(tokenAddress)
      
      if (birdeyeSecurity) {
        result.hasMintAuthority = birdeyeSecurity.mintAuthority || false
        result.hasFreezeAuthority = birdeyeSecurity.freezeAuthority || false
        result.sellTax = birdeyeSecurity.sellTax || 0
        result.buyTax = birdeyeSecurity.buyTax || 0
        result.isVerified = birdeyeSecurity.isVerified || false
        result.liquidityLocked = birdeyeSecurity.liquidityLocked || false
        result.topHolderPercentage = birdeyeSecurity.topHolderPercentage || 0
      }

      // 2. Check for honeypot
      const honeypotCheck = await this.checkHoneypot(tokenAddress)
      result.isHoneypot = honeypotCheck.isHoneypot
      if (honeypotCheck.sellTax !== undefined && honeypotCheck.sellTax > result.sellTax) {
        result.sellTax = honeypotCheck.sellTax
      }

      // 3. Calculate security score
      
      // Honeypot = instant fail
      if (result.isHoneypot) {
        score = 0
        warnings.push('🚨 HONEYPOT - Cannot sell!')
      }

      // Mint authority = dev can print tokens
      if (result.hasMintAuthority) {
        score -= 25
        warnings.push('⚠️ Mint authority enabled')
      }

      // Freeze authority = dev can freeze your tokens
      if (result.hasFreezeAuthority) {
        score -= 20
        warnings.push('⚠️ Freeze authority enabled')
      }

      // High sell tax = scam indicator
      if (result.sellTax > 30) {
        score -= 40
        warnings.push(`🚨 Extreme sell tax: ${result.sellTax}%`)
      } else if (result.sellTax > 15) {
        score -= 20
        warnings.push(`⚠️ High sell tax: ${result.sellTax}%`)
      } else if (result.sellTax > 5) {
        score -= 5
        warnings.push(`Sell tax: ${result.sellTax}%`)
      }

      // Top holder concentration
      if (result.topHolderPercentage > 70) {
        score -= 30
        warnings.push(`🚨 Whale holds ${result.topHolderPercentage}%`)
      } else if (result.topHolderPercentage > 50) {
        score -= 15
        warnings.push(`⚠️ Top holder: ${result.topHolderPercentage}%`)
      }

      // Unverified token
      if (!result.isVerified) {
        score -= 10
        warnings.push('Unverified token')
      }

      // Unlocked liquidity
      if (!result.liquidityLocked) {
        score -= 15
        warnings.push('⚠️ Liquidity not locked')
      }

      // Very new token
      if (result.ageInHours < 1) {
        score -= 10
        warnings.push('🆕 Brand new token (<1h)')
      } else if (result.ageInHours < 6) {
        score -= 5
        warnings.push('New token (<6h)')
      }

      // Bonus for verified tokens
      if (result.isVerified) {
        score += 10
      }

      // Bonus for locked liquidity
      if (result.liquidityLocked) {
        score += 10
      }

      result.score = Math.max(0, Math.min(100, score))
      result.warnings = warnings

    } catch (error) {
      console.error('Security check error:', error)
      result.score = 30 // Default to low score if can't verify
      result.warnings.push('❓ Could not fully verify')
    }

    return result
  }

  /**
   * Generate entry signal based on token data and security
   */
  generateEntrySignal(token: any, security: SecurityCheck): EntrySignal {
    const reasons: string[] = []
    let confidence = 0
    let strength: 'STRONG' | 'MODERATE' | 'WEAK' | 'NONE' = 'NONE'

    // Skip if security too low
    if (security.score < 40) {
      return {
        shouldEnter: false,
        confidence: 0,
        signalStrength: 'NONE',
        reasons: ['Security score too low']
      }
    }

    // Skip if honeypot
    if (security.isHoneypot) {
      return {
        shouldEnter: false,
        confidence: 0,
        signalStrength: 'NONE',
        reasons: ['Honeypot detected']
      }
    }

    // Analyze entry signals
    const pumpScore = token.pumpScore || 0
    const priceChange5m = token.priceChange5m || 0
    const priceChange1h = token.priceChange1h || 0
    const buyPressure = token.buysLast5m + token.sellsLast5m > 0 
      ? token.buysLast5m / (token.buysLast5m + token.sellsLast5m) 
      : 0.5

    // Strong signals
    if (pumpScore >= 80 && buyPressure > 0.7) {
      confidence = 0.85
      strength = 'STRONG'
      reasons.push(`🔥 Strong pump (${pumpScore} score)`)
      reasons.push(`High buy pressure (${(buyPressure * 100).toFixed(0)}%)`)
    }
    // Good pump + security
    else if (pumpScore >= 60 && security.score >= 60 && buyPressure > 0.6) {
      confidence = 0.70
      strength = 'MODERATE'
      reasons.push(`Good pump score (${pumpScore})`)
      reasons.push(`Security score: ${security.score}`)
    }
    // Moderate signals
    else if (pumpScore >= 50 && priceChange5m > 2) {
      confidence = 0.55
      strength = 'WEAK'
      reasons.push(`Moderate pump (${pumpScore})`)
      reasons.push(`5m change: +${priceChange5m.toFixed(1)}%`)
    }
    // Price momentum
    else if (priceChange1h > 20 && priceChange5m > 0) {
      confidence = 0.50
      strength = 'WEAK'
      reasons.push(`1h momentum: +${priceChange1h.toFixed(0)}%`)
    }
    // Not enough signal
    else {
      return {
        shouldEnter: false,
        confidence: 0,
        signalStrength: 'NONE',
        reasons: ['No strong entry signal']
      }
    }

    // Adjust confidence based on security
    const securityMultiplier = security.score / 100
    confidence *= securityMultiplier

    // Calculate entry, stop loss, take profit
    const entry = token.currentPrice
    const stopLoss = entry * 0.95  // 5% stop loss
    const takeProfit = entry * 1.15  // 15% take profit

    return {
      shouldEnter: confidence >= 0.5,
      confidence,
      signalStrength: strength,
      reasons,
      suggestedEntry: entry,
      stopLoss,
      takeProfit
    }
  }

  /**
   * Check security via Birdeye API
   */
  private async checkBirdeyeSecurity(tokenAddress: string): Promise<{
    mintAuthority?: boolean
    freezeAuthority?: boolean
    sellTax?: number
    buyTax?: number
    isVerified?: boolean
    liquidityLocked?: boolean
    topHolderPercentage?: number
  } | null> {
    try {
      const apiKey = process.env.BIRDEYE_API_KEY
      if (!apiKey) {
        console.log('No Birdeye API key, skipping detailed security check')
        return null
      }

      const response = await fetch(
        `https://public-api.birdeye.so/defi/token_security?address=${tokenAddress}`,
        {
          headers: {
            'X-API-KEY': apiKey
          }
        }
      )

      if (!response.ok) return null

      const data = await response.json()
      
      if (data.success && data.data) {
        return {
          mintAuthority: data.data.mintAuthority === true || data.data.mintAuthority === 'true',
          freezeAuthority: data.data.freezeAuthority === true || data.data.freezeAuthority === 'true',
          sellTax: parseFloat(data.data.sellTax) || 0,
          buyTax: parseFloat(data.data.buyTax) || 0,
          isVerified: data.data.isVerified || false,
          liquidityLocked: data.data.lpLocked || false,
          topHolderPercentage: parseFloat(data.data.topHolderPercent) || 0
        }
      }

      return null
    } catch (error) {
      console.error('Birdeye security check error:', error)
      return null
    }
  }

  /**
   * Check for honeypot
   */
  private async checkHoneypot(tokenAddress: string): Promise<{
    isHoneypot: boolean
    sellTax?: number
  }> {
    try {
      const response = await fetch(
        `https://api.honeypot.is/v2/IsHoneypot?address=${tokenAddress}&chain=solana`,
        {
          headers: { 'Accept': 'application/json' }
        }
      )

      if (!response.ok) {
        return { isHoneypot: false }
      }

      const data = await response.json()

      return {
        isHoneypot: data.honeypot?.isHoneypot || data.isHoneypot || false,
        sellTax: data.honeypot?.sellTax || data.sellTax
      }
    } catch (error) {
      return { isHoneypot: false }
    }
  }

  /**
   * Parse age string to hours
   */
  private parseAgeToHours(age: string): number {
    if (!age) return 24
    
    const match = age.match(/(\d+)\s*(minute|hour|day|week)/i)
    if (!match) return 24

    const value = parseInt(match[1])
    const unit = match[2].toLowerCase()

    switch (unit) {
      case 'minute': return value / 60
      case 'hour': return value
      case 'day': return value * 24
      case 'week': return value * 168
      default: return 24
    }
  }
}

export const tokenSecurity = new TokenSecurityService()
