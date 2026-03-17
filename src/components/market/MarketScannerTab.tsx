'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TrendingUp, TrendingDown, Search, RefreshCw, Flame, Zap, Clock, AlertTriangle, Loader2, Sparkles, Star } from 'lucide-react'
import { toast } from 'sonner'

interface Token {
  address: string
  symbol: string
  name: string
  currentPrice: number
  priceChange24h: number
  priceChange1h: number
  priceChange5m: number
  volume24h: number
  marketCap: number
  liquidity: number
  isVerified: boolean
  logoUrl: string | null
  age: string
  isNew: boolean
  pumpScore: number
  volumeToMcap: number
  buysLast5m: number
  sellsLast5m: number
}

export function MarketScannerTab() {
  const [tokens, setTokens] = useState<Token[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [analyzingToken, setAnalyzingToken] = useState<string | null>(null)
  const [filterMode, setFilterMode] = useState<'all' | 'new' | 'hot'>('hot')

  const fetchTokens = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/market/trending?filter=${filterMode}`)
      if (response.ok) {
        const data = await response.json()
        setTokens(data.tokens || [])
      }
    } catch (error) {
      console.error('Error fetching tokens:', error)
      toast.error('Failed to fetch tokens')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTokens()
  }, [filterMode])

  const handleQuickAnalyze = async (token: Token) => {
    setAnalyzingToken(token.address)
    try {
      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenAddress: token.address,
          tokenSymbol: token.symbol
        })
      })

      const data = await response.json()
      
      if (data.success) {
        toast.success(`Scalper analysis completed for ${token.symbol}!`)
      } else {
        toast.error(data.error || 'Analysis failed')
      }
    } catch (error) {
      toast.error('Failed to analyze token')
    } finally {
      setAnalyzingToken(null)
    }
  }

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(2)}K`
    }
    return `$${value.toFixed(2)}`
  }

  const formatPrice = (price: number) => {
    if (price < 0.00001) {
      return `$${price.toExponential(2)}`
    }
    return `$${price.toFixed(10)}`
  }

  const filteredTokens = tokens.filter(token => {
    const symbol = token.symbol || ''
    const name = token.name || ''
    const matchesSearch = 
      symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      name.toLowerCase().includes(searchQuery.toLowerCase())
    
    if (!matchesSearch) return false
    
    if (filterMode === 'new') return token.isNew
    if (filterMode === 'hot') return token.pumpScore >= 50
    
    return true
  }).sort((a, b) => b.pumpScore - a.pumpScore)

  // Stats
  const hotTokens = tokens.filter(t => t.pumpScore >= 70).length
  const newTokens = tokens.filter(t => t.isNew).length
  const avgPumpScore = tokens.length > 0 
    ? tokens.reduce((sum, t) => sum + t.pumpScore, 0) / tokens.length 
    : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6 text-warning" />
            Scalper Scanner
          </h2>
          <p className="text-muted-foreground">Find new tokens with high pump potential</p>
        </div>
        <Button onClick={fetchTokens} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Scan
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-loss/20 flex items-center justify-center">
                <Flame className="w-5 h-5 text-loss" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">🔥 Hot Tokens</p>
                <p className="text-2xl font-bold text-loss">{hotTokens}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Star className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">✨ New (&lt;24h)</p>
                <p className="text-2xl font-bold text-primary">{newTokens}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">📊 Avg Pump Score</p>
                <p className="text-2xl font-bold text-accent">{avgPumpScore.toFixed(0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">⚡ Scanning</p>
                <p className="text-2xl font-bold text-warning">{tokens.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        <Button
          variant={filterMode === 'hot' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterMode('hot')}
          className={filterMode === 'hot' ? 'bg-loss hover:bg-loss/80' : ''}
        >
          <Flame className="w-4 h-4 mr-2" />
          Hot Pumps
        </Button>
        <Button
          variant={filterMode === 'new' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterMode('new')}
          className={filterMode === 'new' ? 'bg-primary hover:bg-primary/80' : ''}
        >
          <Star className="w-4 h-4 mr-2" />
          New Tokens
        </Button>
        <Button
          variant={filterMode === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterMode('all')}
        >
          All Tokens
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search tokens..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-card border-border"
        />
      </div>

      {/* Token List */}
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="w-6 h-6 mx-auto animate-spin mb-2" />
              Scanning for pumps...
            </div>
          ) : filteredTokens.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="w-6 h-6 mx-auto mb-2" />
              {tokens.length === 0 ? (
                <>
                  <p className="font-medium">No tokens found</p>
                  <p className="text-sm mt-1">
                    {filterMode === 'new' 
                      ? 'No new token listings available. Try "Hot Pumps" or check back later.' 
                      : 'API may be rate limited. Try refreshing in a moment.'}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium">No matching tokens</p>
                  <p className="text-sm mt-1">Try adjusting your search or filter</p>
                </>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-xs">Token</TableHead>
                  <TableHead className="text-xs text-center">Pump Score</TableHead>
                  <TableHead className="text-xs text-right">5m</TableHead>
                  <TableHead className="text-xs text-right">1h</TableHead>
                  <TableHead className="text-xs text-right">24h</TableHead>
                  <TableHead className="text-xs text-right">Volume</TableHead>
                  <TableHead className="text-xs text-right">MCap</TableHead>
                  <TableHead className="text-xs text-center">Age</TableHead>
                  <TableHead className="text-xs text-center">Buys/5m</TableHead>
                  <TableHead className="text-xs text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTokens.map((token) => (
                  <TableRow key={token.address} className="border-border hover:bg-secondary/30">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {token.logoUrl ? (
                          <img 
                            src={token.logoUrl} 
                            alt={token.symbol}
                            className="w-8 h-8 rounded-full"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <div className={`w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xs font-bold ${token.logoUrl ? 'hidden' : ''}`}>
                          {(token.symbol || '??').slice(0, 2)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1">
                            <span className="font-medium text-sm">{token.symbol}</span>
                            {token.isNew && (
                              <Badge className="bg-primary/20 text-primary text-[10px] px-1 py-0">
                                NEW
                              </Badge>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground max-w-[100px] truncate">{token.name}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${
                        token.pumpScore >= 70 ? 'bg-loss/20 text-loss' :
                        token.pumpScore >= 50 ? 'bg-warning/20 text-warning' :
                        token.pumpScore >= 30 ? 'bg-accent/20 text-accent' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {token.pumpScore >= 70 && <Flame className="w-3 h-3" />}
                        {token.pumpScore.toFixed(0)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`text-xs font-mono font-bold ${token.priceChange5m >= 0 ? 'text-profit' : 'text-loss'}`}>
                        {token.priceChange5m >= 0 ? '+' : ''}{token.priceChange5m?.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`text-xs font-mono font-bold ${token.priceChange1h >= 0 ? 'text-profit' : 'text-loss'}`}>
                        {token.priceChange1h >= 0 ? '+' : ''}{token.priceChange1h?.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`text-xs font-mono ${token.priceChange24h >= 0 ? 'text-profit' : 'text-loss'}`}>
                        {token.priceChange24h >= 0 ? '+' : ''}{token.priceChange24h?.toFixed(0)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono">
                      {formatCurrency(token.volume24h)}
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono">
                      {formatCurrency(token.marketCap)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-[10px]">
                        <Clock className="w-2 h-2 mr-1" />
                        {token.age}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-profit text-xs font-bold">{token.buysLast5m}</span>
                        <span className="text-muted-foreground text-xs">/</span>
                        <span className="text-loss text-xs">{token.sellsLast5m}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant={token.pumpScore >= 70 ? 'default' : 'outline'}
                        onClick={() => handleQuickAnalyze(token)}
                        disabled={analyzingToken === token.address}
                        className={token.pumpScore >= 70 ? 'bg-loss hover:bg-loss/80' : ''}
                      >
                        {analyzingToken === token.address ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Sparkles className="w-3 h-3" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="bg-warning/10 border-warning/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-warning">Scalper Mode Active</p>
              <p className="text-muted-foreground mt-1">
                Focus on tokens with pump score <span className="text-loss font-bold">≥70</span> for best entries. 
                Use tight stop-loss (3-5%) and quick take-profit (10-20%). 
                New tokens (&lt;24h) are high risk/reward - use smaller position sizes.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
