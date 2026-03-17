'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Bot, Brain, TrendingUp, TrendingDown, Minus, Loader2, Sparkles, Target, Shield, AlertTriangle, RefreshCw, Zap, Flame, Clock, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'

interface AIDecision {
  id: string
  tokenAddress: string
  tokenSymbol: string
  tokenName?: string | null
  logoUrl?: string | null
  action: string
  confidence: number
  reasoning: string
  marketSentiment: string
  riskLevel: string
  priceTarget: number | null
  stopLoss: number | null
  createdAt: string
}

interface TokenInfo {
  [address: string]: {
    name: string
    logoUrl: string | null
  }
}

interface Token {
  address: string
  symbol: string
  name: string
  pumpScore?: number
  isNew?: boolean
}

export function AIAnalysisTab() {
  const [decisions, setDecisions] = useState<AIDecision[]>([])
  const [tokenInfo, setTokenInfo] = useState<TokenInfo>({})
  const [tokens, setTokens] = useState<Token[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [selectedToken, setSelectedToken] = useState<string>('')

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const [decisionsRes, marketRes] = await Promise.all([
        fetch('/api/ai/decisions?limit=20'),
        fetch('/api/market/trending')
      ])
      
      if (decisionsRes.ok) {
        const data = await decisionsRes.json()
        const decisionsData = data.decisions || []
        setDecisions(decisionsData)
        
        // Fetch token info for decisions that don't have name/logo
        const needTokenInfo = decisionsData.filter((d: AIDecision) => !d.tokenName || !d.logoUrl)
        if (needTokenInfo.length > 0) {
          const addresses = [...new Set(needTokenInfo.map((d: AIDecision) => d.tokenAddress))]
          
          // Fetch token data for each address
          const tokenInfoMap: TokenInfo = {}
          for (const address of addresses.slice(0, 10)) { // Limit to 10 to avoid rate limits
            try {
              const tokenRes = await fetch(`/api/market/token?address=${address}`)
              if (tokenRes.ok) {
                const tokenData = await tokenRes.json()
                if (tokenData.token) {
                  tokenInfoMap[address] = {
                    name: tokenData.token.name,
                    logoUrl: tokenData.token.logoUrl
                  }
                }
              }
            } catch (e) {
              console.error('Error fetching token info:', e)
            }
          }
          setTokenInfo(tokenInfoMap)
        }
      }
      
      if (marketRes.ok) {
        const data = await marketRes.json()
        setTokens((data.tokens || []).map((t: Token) => ({
          address: t.address,
          symbol: t.symbol,
          name: t.name,
          pumpScore: t.pumpScore,
          isNew: t.isNew
        })))
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleAnalyze = async () => {
    if (!selectedToken) {
      toast.error('Please select a token to analyze')
      return
    }

    const token = tokens.find(t => t.address === selectedToken)
    if (!token) return

    setIsAnalyzing(true)
    try {
      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenAddress: selectedToken,
          tokenSymbol: token.symbol
        })
      })

      const data = await response.json()
      
      if (data.success) {
        toast.success('Scalper analysis completed!')
        fetchData()
      } else {
        toast.error(data.error || 'Analysis failed')
      }
    } catch (error) {
      toast.error('Failed to analyze token')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleScanHot = async () => {
    setIsAnalyzing(true)
    try {
      const response = await fetch('/api/ai/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await response.json()
      
      if (data.success) {
        toast.success('Hot tokens scanned!')
        fetchData()
      } else {
        toast.error(data.error || 'Scan failed')
      }
    } catch (error) {
      toast.error('Failed to scan tokens')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'BUY':
        return <TrendingUp className="w-4 h-4 text-profit" />
      case 'SELL':
        return <TrendingDown className="w-4 h-4 text-loss" />
      default:
        return <Minus className="w-4 h-4 text-warning" />
    }
  }

  const getActionColor = (action: string) => {
    switch (action) {
      case 'BUY':
        return 'bg-profit/10 text-profit border-profit/20'
      case 'SELL':
        return 'bg-loss/10 text-loss border-loss/20'
      default:
        return 'bg-warning/10 text-warning border-warning/20'
    }
  }

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment?.toUpperCase()) {
      case 'BULLISH':
        return 'text-profit'
      case 'BEARISH':
        return 'text-loss'
      default:
        return 'text-warning'
    }
  }

  const getRiskColor = (risk: string) => {
    switch (risk?.toUpperCase()) {
      case 'LOW':
        return 'bg-profit/10 text-profit'
      case 'MEDIUM':
        return 'bg-warning/10 text-warning'
      case 'HIGH':
        return 'bg-loss/10 text-loss'
      default:
        return ''
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString()
  }

  const formatPrice = (price: number | null) => {
    if (!price) return 'N/A'
    return `$${price.toFixed(10)}`
  }

  // Stats from decisions
  const buyCount = decisions.filter(d => d.action === 'BUY').length
  const sellCount = decisions.filter(d => d.action === 'SELL').length
  const holdCount = decisions.filter(d => d.action === 'HOLD').length
  const avgConfidence = decisions.length > 0 
    ? decisions.reduce((sum, d) => sum + d.confidence, 0) / decisions.length 
    : 0

  // Hot tokens (high pump score)
  const hotTokens = tokens.filter(t => (t.pumpScore || 0) >= 70)

  // Sorted tokens by pump score (memoized to avoid re-sorting on each render)
  const sortedTokens = useMemo(() => {
    return [...tokens].sort((a, b) => (b.pumpScore || 0) - (a.pumpScore || 0))
  }, [tokens])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6 text-warning" />
            Scalper Signals
          </h2>
          <p className="text-muted-foreground">AI-powered scalping entry/exit signals</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchData} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleScanHot} disabled={isAnalyzing} className="bg-loss hover:bg-loss/80">
            {isAnalyzing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Flame className="w-4 h-4 mr-2" />
            )}
            Scan Hot Tokens
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-profit/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-profit" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Buy Signals</p>
                <p className="text-2xl font-bold text-profit">{buyCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-loss/20 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-loss" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Sell Signals</p>
                <p className="text-2xl font-bold text-loss">{sellCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Flame className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Hot Tokens</p>
                <p className="text-2xl font-bold text-primary">{hotTokens.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                <Brain className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg Confidence</p>
                <p className="text-2xl font-bold text-accent">{(avgConfidence * 100).toFixed(0)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Analysis */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Quick Scalper Analysis
          </CardTitle>
          <CardDescription>Analyze a token for scalping opportunity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Select value={selectedToken} onValueChange={setSelectedToken}>
              <SelectTrigger className="flex-1 bg-secondary border-border">
                <SelectValue placeholder="Select token to analyze" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {sortedTokens.map(token => (
                  <SelectItem key={token.address} value={token.address}>
                    <div className="flex items-center gap-2">
                      <span>{token.symbol}</span>
                      {token.pumpScore && token.pumpScore >= 70 && (
                        <Badge className="bg-loss/20 text-loss text-[10px]">🔥 {token.pumpScore.toFixed(0)}</Badge>
                      )}
                      {token.isNew && (
                        <Badge className="bg-primary/20 text-primary text-[10px]">NEW</Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAnalyze} disabled={isAnalyzing || !selectedToken}>
              {isAnalyzing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Bot className="w-4 h-4 mr-2" />
              )}
              Analyze
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Decision History */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-accent" />
            Signal History
          </CardTitle>
          <CardDescription>Past scalper signals with entry/exit targets</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="w-6 h-6 mx-auto animate-spin mb-2" />
              Loading signals...
            </div>
          ) : decisions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Zap className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No signals yet</p>
              <p className="text-sm">Click "Scan Hot Tokens" to find scalping opportunities</p>
            </div>
          ) : (
            <div className="space-y-4">
              {decisions.map((decision) => {
                // Get token info from state if not in decision
                const displayName = decision.tokenName || tokenInfo[decision.tokenAddress]?.name || 'Unknown Token'
                const displayLogo = decision.logoUrl || tokenInfo[decision.tokenAddress]?.logoUrl
                
                return (
                <Card key={decision.id} className={`bg-secondary/30 border-border ${
                  decision.action === 'BUY' ? 'border-l-2 border-l-profit' :
                  decision.action === 'SELL' ? 'border-l-2 border-l-loss' : ''
                }`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {displayLogo ? (
                          <img 
                            src={displayLogo} 
                            alt={decision.tokenSymbol}
                            className="w-10 h-10 rounded-lg object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                              e.currentTarget.nextElementSibling?.classList.remove('hidden')
                            }}
                          />
                        ) : null}
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          decision.action === 'BUY' ? 'bg-profit/20' :
                          decision.action === 'SELL' ? 'bg-loss/20' : 'bg-warning/20'
                        } ${displayLogo ? 'hidden' : ''}`}>
                          {getActionIcon(decision.action)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-lg">{decision.tokenSymbol}</span>
                            <Badge className={getActionColor(decision.action)}>
                              {decision.action}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {displayName}
                          </p>
                          <p className="text-xs text-muted-foreground/70 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(decision.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Confidence</p>
                        <p className="text-xl font-bold">{(decision.confidence * 100).toFixed(0)}%</p>
                        <Progress value={decision.confidence * 100} className="w-24 h-2 mt-1" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                      <div className="p-2 rounded bg-secondary/50">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          Sentiment
                        </p>
                        <p className={`font-bold ${getSentimentColor(decision.marketSentiment)}`}>
                          {decision.marketSentiment || 'NEUTRAL'}
                        </p>
                      </div>
                      <div className="p-2 rounded bg-secondary/50">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Shield className="w-3 h-3" />
                          Risk
                        </p>
                        <Badge className={getRiskColor(decision.riskLevel)}>
                          {decision.riskLevel || 'HIGH'}
                        </Badge>
                      </div>
                      <div className="p-2 rounded bg-secondary/50">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Target className="w-3 h-3" />
                          Target
                        </p>
                        <p className="font-mono text-sm text-profit">{formatPrice(decision.priceTarget)}</p>
                      </div>
                      <div className="p-2 rounded bg-secondary/50">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Stop Loss
                        </p>
                        <p className="font-mono text-sm text-loss">{formatPrice(decision.stopLoss)}</p>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                      <p className="text-sm">
                        {decision.reasoning}
                      </p>
                    </div>

                    {/* Entry/Exit Visualization */}
                    {decision.action === 'BUY' && decision.priceTarget && decision.stopLoss && (
                      <div className="mt-3 flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Entry</span>
                        <ArrowRight className="w-3 h-3 text-muted-foreground" />
                        <Badge variant="outline" className="font-mono">Market</Badge>
                        <ArrowRight className="w-3 h-3 text-muted-foreground" />
                        <span className="text-muted-foreground">Target:</span>
                        <span className="text-profit font-mono">{formatPrice(decision.priceTarget)}</span>
                        <span className="text-muted-foreground mx-2">|</span>
                        <span className="text-muted-foreground">Stop:</span>
                        <span className="text-loss font-mono">{formatPrice(decision.stopLoss)}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )})}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
