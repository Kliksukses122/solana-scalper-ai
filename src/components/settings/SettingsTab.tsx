'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Shield, Zap, Target, Save, RefreshCw, AlertTriangle, CheckCircle, Loader2, Power, Play, Square, Radio, Activity } from 'lucide-react'
import { toast } from 'sonner'

interface AgentConfig {
  riskTolerance: string
  maxPositionSize: number
  stopLossPercent: number
  takeProfitPercent: number
  tradingEnabled: boolean
  autoTradeEnabled: boolean
}

interface AutoTraderStatus {
  isRunning: boolean
  lastScan: Date | null
  tokensScanned: number
  signalsGenerated: number
  tradesExecuted: number
  nextScan: Date | null
  errors: string[]
}

interface SettingsTabProps {
  onUpdate?: () => void
}

const CRON_SECRET = 'solana-scalper-secret'

export function SettingsTab({ onUpdate }: SettingsTabProps) {
  const [config, setConfig] = useState<AgentConfig>({
    riskTolerance: 'HIGH',
    maxPositionSize: 5,
    stopLossPercent: 3,
    takeProfitPercent: 10,
    tradingEnabled: true,
    autoTradeEnabled: false
  })
  const [autoTraderStatus, setAutoTraderStatus] = useState<AutoTraderStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [isStarting, setIsStarting] = useState(false)

  const fetchConfig = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/trading/status')
      if (response.ok) {
        const data = await response.json()
        setConfig({
          riskTolerance: data.status.riskTolerance || 'HIGH',
          maxPositionSize: data.status.maxPositionSize || 5,
          stopLossPercent: data.status.stopLossPercent || 3,
          takeProfitPercent: data.status.takeProfitPercent || 10,
          tradingEnabled: data.status.tradingEnabled ?? true,
          autoTradeEnabled: data.status.autoTradeEnabled ?? false
        })
      }
    } catch (error) {
      console.error('Error fetching config:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchAutoTraderStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/cron/auto-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status', secret: CRON_SECRET })
      })
      if (response.ok) {
        const data = await response.json()
        setAutoTraderStatus(data.status)
      }
    } catch (error) {
      console.error('Error fetching auto-trader status:', error)
    }
  }, [])

  useEffect(() => {
    fetchConfig()
    fetchAutoTraderStatus()
    
    // Poll status every 10 seconds
    const interval = setInterval(fetchAutoTraderStatus, 10000)
    return () => clearInterval(interval)
  }, [fetchAutoTraderStatus])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/ai/auto-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })

      const data = await response.json()
      
      if (data.success) {
        toast.success('Settings saved successfully!')
        onUpdate?.()
      } else {
        toast.error(data.error || 'Failed to save settings')
      }
    } catch (error) {
      toast.error('Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  const handleStartAutoTrader = async () => {
    // Check if wallet has minimum balance
    try {
      const walletRes = await fetch('/api/wallet')
      const walletData = await walletRes.json()
      const balance = walletData.wallet?.solBalance || 0
      
      if (balance < 0.1) {
        toast.error('⚠️ Minimum 0.1 SOL required to start trading!')
        return
      }
    } catch (e) {
      console.error('Failed to check balance:', e)
    }
    
    setIsStarting(true)
    try {
      // First enable auto-trade in config
      await fetch('/api/ai/auto-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoTradeEnabled: true })
      })

      // Then start the auto-trader
      const response = await fetch('/api/cron/auto-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', secret: CRON_SECRET })
      })

      const data = await response.json()
      
      if (data.success) {
        toast.success('🚀 Auto-trader started! Scanning every 60 seconds...')
        setConfig(prev => ({ ...prev, autoTradeEnabled: true }))
        fetchAutoTraderStatus()
        onUpdate?.()
      } else {
        toast.error(data.error || 'Failed to start auto-trader')
      }
    } catch (error) {
      toast.error('Failed to start auto-trader')
    } finally {
      setIsStarting(false)
    }
  }

  const handleStopAutoTrader = async () => {
    setIsStarting(true)
    try {
      // Stop the auto-trader
      const response = await fetch('/api/cron/auto-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop', secret: CRON_SECRET })
      })

      const data = await response.json()
      
      if (data.success) {
        toast.success('Auto-trader stopped')
        fetchAutoTraderStatus()
        onUpdate?.()
      } else {
        toast.error(data.error || 'Failed to stop auto-trader')
      }
    } catch (error) {
      toast.error('Failed to stop auto-trader')
    } finally {
      setIsStarting(false)
    }
  }

  const handleManualScan = async () => {
    setIsScanning(true)
    try {
      const response = await fetch('/api/cron/auto-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scan', secret: CRON_SECRET })
      })

      const data = await response.json()
      
      if (data.success) {
        const result = data.result
        toast.success(`✅ Scan complete! ${result?.tokensScanned || 0} tokens, ${result?.signals?.length || 0} signals, ${result?.tradesExecuted || 0} trades`)
        fetchAutoTraderStatus()
        onUpdate?.()
      } else {
        toast.error(data.error || 'Scan failed')
      }
    } catch (error) {
      toast.error('Scan failed')
    } finally {
      setIsScanning(false)
    }
  }

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'LOW': return 'text-green-400'
      case 'MEDIUM': return 'text-yellow-400'
      case 'HIGH': return 'text-red-400'
      default: return ''
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Settings</h2>
          <p className="text-muted-foreground">Configure your AI trading agent</p>
        </div>
        <Button onClick={fetchConfig} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Reset
        </Button>
      </div>

      {/* Auto-Trading Status & Controls */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className={`w-5 h-5 ${autoTraderStatus?.isRunning ? 'text-green-400 animate-pulse' : 'text-gray-400'}`} />
            Auto-Trading Status
          </CardTitle>
          <CardDescription>Real-time status of the auto-trading engine</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status Indicator */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${autoTraderStatus?.isRunning ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`} />
              <div>
                <p className="font-medium">
                  {autoTraderStatus?.isRunning ? '🟢 Auto-Trading Active' : '⚪ Auto-Trading Inactive'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {autoTraderStatus?.isRunning 
                    ? `Next scan in ~${autoTraderStatus.nextScan ? Math.max(0, Math.round((new Date(autoTraderStatus.nextScan).getTime() - Date.now()) / 1000)) : '?'}s`
                    : 'Click Start to begin automatic trading'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {autoTraderStatus?.isRunning ? (
                <Button 
                  variant="destructive" 
                  onClick={handleStopAutoTrader}
                  disabled={isStarting}
                >
                  <Square className="w-4 h-4 mr-2" />
                  Stop
                </Button>
              ) : (
                <Button 
                  onClick={handleStartAutoTrader}
                  disabled={isStarting}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isStarting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 mr-2" />
                  )}
                  Start Auto-Trade
                </Button>
              )}
              <Button 
                variant="outline" 
                onClick={handleManualScan}
                disabled={isScanning}
              >
                {isScanning ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Activity className="w-4 h-4 mr-2" />
                )}
                Scan Now
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 rounded-lg bg-secondary/30 text-center">
              <p className="text-xs text-muted-foreground">Tokens Scanned</p>
              <p className="text-xl font-bold text-primary">{autoTraderStatus?.tokensScanned || 0}</p>
            </div>
            <div className="p-3 rounded-lg bg-secondary/30 text-center">
              <p className="text-xs text-muted-foreground">Signals Generated</p>
              <p className="text-xl font-bold text-accent">{autoTraderStatus?.signalsGenerated || 0}</p>
            </div>
            <div className="p-3 rounded-lg bg-secondary/30 text-center">
              <p className="text-xs text-muted-foreground">Trades Executed</p>
              <p className="text-xl font-bold text-green-400">{autoTraderStatus?.tradesExecuted || 0}</p>
            </div>
            <div className="p-3 rounded-lg bg-secondary/30 text-center">
              <p className="text-xs text-muted-foreground">Last Scan</p>
              <p className="text-sm font-bold">
                {autoTraderStatus?.lastScan 
                  ? new Date(autoTraderStatus.lastScan).toLocaleTimeString()
                  : 'Never'}
              </p>
            </div>
          </div>

          {/* Errors */}
          {autoTraderStatus?.errors && autoTraderStatus.errors.length > 0 && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-sm font-medium text-red-400 mb-2">Recent Errors:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                {autoTraderStatus.errors.slice(-3).map((error, i) => (
                  <li key={i}>• {error}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trading Controls */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Power className="w-5 h-5 text-primary" />
            Trading Controls
          </CardTitle>
          <CardDescription>Enable or disable trading functionality</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Trading Enabled</Label>
              <p className="text-sm text-muted-foreground">
                Allow the agent to execute trades
              </p>
            </div>
            <Switch
              checked={config.tradingEnabled}
              onCheckedChange={(checked) => 
                setConfig({ ...config, tradingEnabled: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-yellow-500/20">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Label className="text-base">Auto-Trading</Label>
                <Badge variant="outline" className="text-yellow-400 border-yellow-400">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Advanced
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Let AI automatically execute trades based on signals
              </p>
            </div>
            <Switch
              checked={config.autoTradeEnabled}
              onCheckedChange={(checked) => 
                setConfig({ ...config, autoTradeEnabled: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Risk Management */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-accent" />
            Risk Management
          </CardTitle>
          <CardDescription>Configure risk parameters for trading</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Risk Tolerance */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Risk Tolerance</Label>
              <Badge className={getRiskColor(config.riskTolerance)}>
                {config.riskTolerance}
              </Badge>
            </div>
            <Select
              value={config.riskTolerance}
              onValueChange={(value) => setConfig({ ...config, riskTolerance: value })}
            >
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="LOW">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    Low Risk - Conservative trading
                  </div>
                </SelectItem>
                <SelectItem value="MEDIUM">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-yellow-400" />
                    Medium Risk - Balanced approach
                  </div>
                </SelectItem>
                <SelectItem value="HIGH">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-red-400" />
                    High Risk - Aggressive trading
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Scalper mode: HIGH risk for quick profits from new tokens
            </p>
          </div>

          {/* Max Position Size */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Max Position Size (SOL)</Label>
              <span className="text-lg font-bold text-primary">{config.maxPositionSize}</span>
            </div>
            <Slider
              value={[config.maxPositionSize]}
              onValueChange={([value]) => setConfig({ ...config, maxPositionSize: value })}
              min={0.1}
              max={50}
              step={0.1}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Maximum SOL amount per single trade
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Profit & Loss Management */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Profit & Loss Management
          </CardTitle>
          <CardDescription>Set stop-loss and take-profit levels</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stop Loss */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Stop Loss (%)</Label>
              <span className="text-lg font-bold text-red-400">{config.stopLossPercent}%</span>
            </div>
            <Slider
              value={[config.stopLossPercent]}
              onValueChange={([value]) => setConfig({ ...config, stopLossPercent: value })}
              min={1}
              max={20}
              step={0.5}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Automatically sell if price drops by this percentage
            </p>
          </div>

          {/* Take Profit */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Take Profit (%)</Label>
              <span className="text-lg font-bold text-green-400">{config.takeProfitPercent}%</span>
            </div>
            <Slider
              value={[config.takeProfitPercent]}
              onValueChange={([value]) => setConfig({ ...config, takeProfitPercent: value })}
              min={5}
              max={100}
              step={5}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Automatically sell if price rises by this percentage
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Current Settings Summary */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            Current Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="p-3 rounded-lg bg-secondary/30">
              <p className="text-xs text-muted-foreground">Risk Level</p>
              <p className={`text-lg font-bold ${getRiskColor(config.riskTolerance)}`}>
                {config.riskTolerance}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-secondary/30">
              <p className="text-xs text-muted-foreground">Max Position</p>
              <p className="text-lg font-bold text-primary">{config.maxPositionSize} SOL</p>
            </div>
            <div className="p-3 rounded-lg bg-secondary/30">
              <p className="text-xs text-muted-foreground">Stop Loss</p>
              <p className="text-lg font-bold text-red-400">{config.stopLossPercent}%</p>
            </div>
            <div className="p-3 rounded-lg bg-secondary/30">
              <p className="text-xs text-muted-foreground">Take Profit</p>
              <p className="text-lg font-bold text-green-400">{config.takeProfitPercent}%</p>
            </div>
            <div className="p-3 rounded-lg bg-secondary/30">
              <p className="text-xs text-muted-foreground">Trading</p>
              <Badge variant={config.tradingEnabled ? "default" : "secondary"}>
                {config.tradingEnabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
            <div className="p-3 rounded-lg bg-secondary/30">
              <p className="text-xs text-muted-foreground">Auto-Trade</p>
              <Badge variant={config.autoTradeEnabled ? "default" : "secondary"}>
                {config.autoTradeEnabled ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving} size="lg" className="bg-gradient-to-r from-primary to-accent">
          {isSaving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  )
}
