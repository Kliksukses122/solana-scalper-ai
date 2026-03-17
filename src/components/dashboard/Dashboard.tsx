'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { 
  TrendingUp, TrendingDown, Wallet, Bot, Activity, 
  BarChart3, Settings, Zap, DollarSign, Percent,
  ArrowUpRight, ArrowDownRight, Clock, Target, Flame,
  Copy, Check, QrCode, ArrowDownToLine, Play, Square
} from 'lucide-react'
import { toast } from 'sonner'
import { QRCodeSVG } from 'qrcode.react'
import { PortfolioTab } from '@/components/portfolio/PortfolioTab'
import { TradingTab } from '@/components/trading/TradingTab'
import { AIAnalysisTab } from '@/components/ai/AIAnalysisTab'
import { MarketScannerTab } from '@/components/market/MarketScannerTab'
import { SettingsTab } from '@/components/settings/SettingsTab'

interface PortfolioValue {
  totalValue: number
  totalPnl: number
  totalPnlPercent: number
  positions: number
}

interface AgentStatus {
  tradingEnabled: boolean
  autoTradeEnabled: boolean
  riskTolerance: string
  maxPositionSize: number
  stopLossPercent: number
  takeProfitPercent: number
  totalTrades: number
  successfulTrades: number
  pendingTrades: number
}

interface AutoTraderStatus {
  isRunning: boolean
  lastScan: Date | null
  tokensScanned: number
  signalsGenerated: number
  tradesExecuted: number
}

interface RecentDecision {
  id: string
  tokenSymbol: string
  action: string
  confidence: number
  createdAt: string
}

interface WalletInfo {
  configured: boolean
  publicKey?: string
  solBalance?: number
  tokenCount?: number
}

export function Dashboard() {
  const [portfolioValue, setPortfolioValue] = useState<PortfolioValue>({
    totalValue: 0,
    totalPnl: 0,
    totalPnlPercent: 0,
    positions: 0
  })
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null)
  const [recentDecisions, setRecentDecisions] = useState<RecentDecision[]>([])
  const [pnlHistory, setPnlHistory] = useState<{ time: string; value: number }[]>([])
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null)
  const [autoTraderStatus, setAutoTraderStatus] = useState<AutoTraderStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showDepositDialog, setShowDepositDialog] = useState(false)
  const [copied, setCopied] = useState(false)

  const fetchDashboardData = useCallback(async () => {
    try {
      const [portfolioRes, statusRes, decisionsRes, walletRes, autoTraderRes] = await Promise.all([
        fetch('/api/portfolio/value'),
        fetch('/api/trading/status'),
        fetch('/api/ai/decisions?limit=5'),
        fetch('/api/wallet'),
        fetch('/api/cron/auto-trade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'status', secret: 'solana-scalper-secret' })
        })
      ])

      if (portfolioRes.ok) {
        const portfolioData = await portfolioRes.json()
        setPortfolioValue(portfolioData)
      }

      if (statusRes.ok) {
        const statusData = await statusRes.json()
        setAgentStatus(statusData.status)
      }

      if (decisionsRes.ok) {
        const decisionsData = await decisionsRes.json()
        setRecentDecisions(decisionsData.decisions || [])
      }

      if (walletRes.ok) {
        const walletData = await walletRes.json()
        // API returns {success, configured, wallet: {publicKey, solBalance, tokenCount}}
        if (walletData.wallet) {
          setWalletInfo({
            configured: walletData.configured,
            publicKey: walletData.wallet.publicKey,
            solBalance: walletData.wallet.solBalance,
            tokenCount: walletData.wallet.tokenCount
          })
        } else {
          setWalletInfo(walletData)
        }
      }

      if (autoTraderRes.ok) {
        const autoTraderData = await autoTraderRes.json()
        setAutoTraderStatus(autoTraderData.status)
      }

      // Generate mock PnL history
      const mockPnlHistory = Array.from({ length: 24 }, (_, i) => ({
        time: `${i}:00`,
        value: 1000 + Math.random() * 500 + i * 10
      }))
      setPnlHistory(mockPnlHistory)

    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboardData()
    const interval = setInterval(fetchDashboardData, 30000)
    return () => clearInterval(interval)
  }, [fetchDashboardData])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)
  }

  const getActionColor = (action: string) => {
    switch (action) {
      case 'BUY': return 'text-green-400 bg-green-400/10'
      case 'SELL': return 'text-red-400 bg-red-400/10'
      default: return 'text-yellow-400 bg-yellow-400/10'
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('Address copied to clipboard!')
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      toast.error('Failed to copy')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading Trading Dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold gradient-text">Solana Scalper Agent</h1>
                <p className="text-xs text-muted-foreground">AI-Powered Memecoin Scalping</p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              {/* Wallet Info */}
              {walletInfo?.configured && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Wallet Balance</p>
                  <p className="text-lg font-bold text-primary">{walletInfo.solBalance?.toFixed(4) || '0.0000'} SOL</p>
                </div>
              )}

              {/* Portfolio Value */}
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Portfolio Value</p>
                <p className="text-lg font-bold">{formatCurrency(portfolioValue.totalValue)}</p>
              </div>

              {/* PnL */}
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Total PnL</p>
                <div className="flex items-center gap-1">
                  {portfolioValue.totalPnl >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-profit" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-loss" />
                  )}
                  <span className={`font-bold ${portfolioValue.totalPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {portfolioValue.totalPnl >= 0 ? '+' : ''}{formatCurrency(portfolioValue.totalPnl)}
                    <span className="text-xs ml-1">
                      ({portfolioValue.totalPnlPercent >= 0 ? '+' : ''}{portfolioValue.totalPnlPercent.toFixed(2)}%)
                    </span>
                  </span>
                </div>
              </div>

              {/* Agent Status */}
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  !walletInfo?.configured ? 'bg-red-400' : 
                  autoTraderStatus?.isRunning ? 'bg-green-400 animate-pulse' : 
                  'bg-yellow-400'
                }`} />
                <span className="text-sm text-muted-foreground">
                  {!walletInfo?.configured ? 'Wallet Not Configured' : 
                   autoTraderStatus?.isRunning ? '🟢 Auto-Trading Running' : 
                   agentStatus?.autoTradeEnabled ? '⏸️ Auto-Trade Paused (click Start in Settings)' : 
                   '⚪ Trading Paused'}
                </span>
              </div>

              {/* Deposit Button */}
              {walletInfo?.configured && (
                <Button 
                  onClick={() => setShowDepositDialog(true)}
                  className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
                >
                  <ArrowDownToLine className="w-4 h-4 mr-2" />
                  Deposit
                </Button>
              )}

              {/* Quick Auto-Trade Toggle */}
              {walletInfo?.configured && (
                <Button 
                  onClick={async () => {
                    // Check balance before starting
                    if (!autoTraderStatus?.isRunning && (!walletInfo?.solBalance || walletInfo.solBalance < 0.1)) {
                      toast.error('⚠️ Minimum 0.1 SOL required to start trading!')
                      setShowDepositDialog(true)
                      return
                    }
                    
                    const action = autoTraderStatus?.isRunning ? 'stop' : 'start'
                    try {
                      const res = await fetch('/api/cron/auto-trade', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action, secret: 'solana-scalper-secret' })
                      })
                      if (res.ok) {
                        if (action === 'start') {
                          toast.success('🚀 Auto-trading started! Scanning every 60 seconds...')
                        } else {
                          toast.info('Auto-trading stopped')
                        }
                        fetchDashboardData()
                      }
                    } catch (e) {
                      console.error(e)
                      toast.error('Failed to start auto-trading')
                    }
                  }}
                  variant={autoTraderStatus?.isRunning ? "destructive" : "default"}
                  className={autoTraderStatus?.isRunning ? "" : "bg-green-600 hover:bg-green-700"}
                >
                  {autoTraderStatus?.isRunning ? (
                    <>
                      <Square className="w-4 h-4 mr-2" />
                      Stop
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Start AI
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Zero Balance Alert */}
        {walletInfo?.configured && walletInfo.solBalance === 0 && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/20 border border-red-500/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/30 flex items-center justify-center">
                <span className="text-2xl">⚠️</span>
              </div>
              <div>
                <p className="font-bold text-red-400">Your SOL Balance is Empty!</p>
                <p className="text-sm text-muted-foreground">
                  Deposit SOL first to start trading. Minimum 0.1 SOL required.
                </p>
              </div>
            </div>
            <Button 
              onClick={() => setShowDepositDialog(true)}
              className="bg-green-600 hover:bg-green-700"
            >
              <ArrowDownToLine className="w-4 h-4 mr-2" />
              Deposit Now
            </Button>
          </div>
        )}

        {/* Low Balance Warning */}
        {walletInfo?.configured && walletInfo.solBalance && walletInfo.solBalance > 0 && walletInfo.solBalance < 0.1 && (
          <div className="mb-6 p-4 rounded-lg bg-yellow-500/20 border border-yellow-500/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-500/30 flex items-center justify-center">
                <span className="text-2xl">⚡</span>
              </div>
              <div>
                <p className="font-bold text-yellow-400">Low SOL Balance!</p>
                <p className="text-sm text-muted-foreground">
                  Your balance: {walletInfo.solBalance.toFixed(4)} SOL. Add more for optimal trading.
                </p>
              </div>
            </div>
            <Button 
              onClick={() => setShowDepositDialog(true)}
              variant="outline"
              className="border-yellow-500 text-yellow-400 hover:bg-yellow-500/20"
            >
              <ArrowDownToLine className="w-4 h-4 mr-2" />
              Add Deposit
            </Button>
          </div>
        )}

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="dashboard" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Activity className="w-4 h-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="portfolio" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Wallet className="w-4 h-4 mr-2" />
              Portfolio
            </TabsTrigger>
            <TabsTrigger value="trading" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <BarChart3 className="w-4 h-4 mr-2" />
              Trading
            </TabsTrigger>
            <TabsTrigger value="ai" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Bot className="w-4 h-4 mr-2" />
              AI Analysis
            </TabsTrigger>
            <TabsTrigger value="market" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Flame className="w-4 h-4 mr-2" />
              Scalp Scanner
            </TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-card border-border hover:border-primary/50 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Value</CardTitle>
                  <DollarSign className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(portfolioValue.totalValue)}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {portfolioValue.positions} active positions
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-card border-border hover:border-primary/50 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total PnL</CardTitle>
                  {portfolioValue.totalPnl >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-profit" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-loss" />
                  )}
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${portfolioValue.totalPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {portfolioValue.totalPnl >= 0 ? '+' : ''}{formatCurrency(portfolioValue.totalPnl)}
                  </div>
                  <p className={`text-xs mt-1 ${portfolioValue.totalPnlPercent >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {portfolioValue.totalPnlPercent >= 0 ? '+' : ''}{portfolioValue.totalPnlPercent.toFixed(2)}%
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-card border-border hover:border-primary/50 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Trades</CardTitle>
                  <Activity className="h-4 w-4 text-accent" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{agentStatus?.totalTrades || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {agentStatus?.successfulTrades || 0} successful
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-card border-border hover:border-primary/50 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Risk Level</CardTitle>
                  <Target className="h-4 w-4 text-warning" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold capitalize">{agentStatus?.riskTolerance?.toLowerCase() || 'Medium'}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Max: {agentStatus?.maxPositionSize || 10} SOL
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Charts and Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* PnL Chart */}
              <Card className="lg:col-span-2 bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    Portfolio Performance (24h)
                  </CardTitle>
                  <CardDescription>Value change over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-48 flex items-end gap-1">
                    {pnlHistory.map((item, i) => (
                      <div
                        key={i}
                        className="flex-1 bg-gradient-to-t from-primary to-accent rounded-t opacity-80 hover:opacity-100 transition-opacity"
                        style={{ height: `${(item.value / 1500) * 100}%` }}
                        title={`${item.time}: ${formatCurrency(item.value)}`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                    <span>00:00</span>
                    <span>12:00</span>
                    <span>23:00</span>
                  </div>
                </CardContent>
              </Card>

              {/* Recent AI Signals */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-accent" />
                    Recent AI Signals
                  </CardTitle>
                  <CardDescription>Latest trading recommendations</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 max-h-64 overflow-y-auto">
                  {recentDecisions.length > 0 ? (
                    recentDecisions.map((decision) => (
                      <div key={decision.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/50">
                        <div className="flex items-center gap-2">
                          <Badge className={getActionColor(decision.action)}>
                            {decision.action}
                          </Badge>
                          <span className="font-medium">{decision.tokenSymbol}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{(decision.confidence * 100).toFixed(0)}%</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(decision.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground py-4">
                      No recent signals
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Agent Status */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-primary" />
                  Agent Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Trading</p>
                    <Badge variant={agentStatus?.tradingEnabled ? "default" : "secondary"}>
                      {agentStatus?.tradingEnabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Auto-Trade</p>
                    <Badge variant={agentStatus?.autoTradeEnabled ? "default" : "secondary"}>
                      {agentStatus?.autoTradeEnabled ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Stop Loss</p>
                    <div className="flex items-center gap-1">
                      <Percent className="w-3 h-3 text-muted-foreground" />
                      <span className="font-medium">{agentStatus?.stopLossPercent || 5}%</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Take Profit</p>
                    <div className="flex items-center gap-1">
                      <Percent className="w-3 h-3 text-muted-foreground" />
                      <span className="font-medium">{agentStatus?.takeProfitPercent || 20}%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Portfolio Tab */}
          <TabsContent value="portfolio">
            <PortfolioTab />
          </TabsContent>

          {/* Trading Tab */}
          <TabsContent value="trading">
            <TradingTab />
          </TabsContent>

          {/* AI Analysis Tab */}
          <TabsContent value="ai">
            <AIAnalysisTab />
          </TabsContent>

          {/* Market Scanner Tab */}
          <TabsContent value="market">
            <MarketScannerTab />
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <SettingsTab onUpdate={fetchDashboardData} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Deposit Dialog */}
      <Dialog open={showDepositDialog} onOpenChange={setShowDepositDialog}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownToLine className="w-5 h-5 text-primary" />
              Deposit SOL
            </DialogTitle>
            <DialogDescription>
              Send SOL to your trading wallet address below
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Balance */}
            <div className="text-center p-4 rounded-lg bg-secondary/50">
              <p className="text-sm text-muted-foreground">Current Balance</p>
              <p className="text-3xl font-bold text-primary">
                {walletInfo?.solBalance?.toFixed(4) || '0.0000'} SOL
              </p>
            </div>

            {/* Wallet Address - Large Display */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-center block">Your Wallet Address</label>
              <div className="p-4 rounded-lg bg-primary/10 border border-primary/30 text-center">
                <p className="font-mono text-sm break-all text-primary font-bold">
                  {walletInfo?.publicKey || 'Loading...'}
                </p>
              </div>
              <Button 
                className="w-full"
                onClick={() => copyToClipboard(walletInfo?.publicKey || '')}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-2 text-green-400" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Address
                  </>
                )}
              </Button>
            </div>

            {/* QR Code - Real QR */}
            <div className="flex justify-center">
              <div className="p-4 bg-white rounded-lg shadow-lg">
                {walletInfo?.publicKey ? (
                  <QRCodeSVG 
                    value={walletInfo.publicKey}
                    size={180}
                    level="H"
                    includeMargin={true}
                    bgColor="#ffffff"
                    fgColor="#000000"
                  />
                ) : (
                  <div className="w-44 h-44 flex items-center justify-center text-gray-400">
                    Loading...
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              📱 Scan QR code with Phantom, Solflare, or any Solana wallet
            </p>

            {/* Instructions */}
            <div className="p-4 rounded-lg bg-secondary/50 border border-border">
              <p className="text-sm font-medium mb-2">📋 How to Deposit:</p>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Copy address or scan QR code above</li>
                <li>Open your wallet (Phantom, Solflare, Exchange)</li>
                <li>Send SOL to this address</li>
                <li>Wait ~30 seconds for confirmation</li>
              </ol>
            </div>

            {/* Warning */}
            <div className="p-3 rounded-lg bg-loss/10 border border-loss/20">
              <p className="text-xs text-loss text-center font-medium">
                ⚠️ ONLY send SOL! Other tokens will be lost.
              </p>
            </div>

            {/* Recommended Amount */}
            <div className="text-center p-3 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-sm text-muted-foreground">
                💰 Minimum deposit: <span className="text-primary font-bold text-lg">0.1 SOL</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Recommended: <span className="text-accent font-bold">0.5+ SOL</span> for multiple trades
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
