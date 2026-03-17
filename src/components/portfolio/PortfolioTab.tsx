'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TrendingUp, TrendingDown, RefreshCw, Wallet, PieChart } from 'lucide-react'

interface Position {
  tokenAddress: string
  tokenSymbol: string
  tokenName: string
  balance: number
  avgBuyPrice: number
  currentPrice: number
  pnl: number
  pnlPercent: number
  value: number
}

export function PortfolioTab() {
  const [positions, setPositions] = useState<Position[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchPortfolio = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/portfolio')
      if (response.ok) {
        const data = await response.json()
        setPositions(data.portfolio || [])
      }
    } catch (error) {
      console.error('Error fetching portfolio:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchPortfolio()
  }, [])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(value)
  }

  const formatNumber = (value: number, decimals: number = 2) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(value)
  }

  const totalValue = positions.reduce((sum, p) => sum + p.value, 0)
  const totalPnl = positions.reduce((sum, p) => sum + p.pnl, 0)

  // Calculate allocation for pie chart
  const allocationData = positions.map(p => ({
    symbol: p.tokenSymbol,
    value: p.value,
    percentage: totalValue > 0 ? (p.value / totalValue) * 100 : 0,
    color: `hsl(${Math.random() * 360}, 70%, 50%)`
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Portfolio Overview</h2>
          <p className="text-muted-foreground">Your current holdings and performance</p>
        </div>
        <Button onClick={fetchPortfolio} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Value</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total PnL</CardTitle>
            {totalPnl >= 0 ? (
              <TrendingUp className="h-4 w-4 text-profit" />
            ) : (
              <TrendingDown className="h-4 w-4 text-loss" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
              {totalPnl >= 0 ? '+' : ''}{formatCurrency(totalPnl)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Positions</CardTitle>
            <PieChart className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{positions.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Holdings Table */}
        <Card className="lg:col-span-2 bg-card border-border">
          <CardHeader>
            <CardTitle>Holdings</CardTitle>
            <CardDescription>Your token positions</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : positions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No positions yet. Start trading to build your portfolio.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Token</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Avg Price</TableHead>
                    <TableHead className="text-right">Current</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="text-right">PnL</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positions.map((position) => (
                    <TableRow key={position.tokenAddress}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xs font-bold">
                            {position.tokenSymbol.slice(0, 2)}
                          </div>
                          <div>
                            <p className="font-medium">{position.tokenSymbol}</p>
                            <p className="text-xs text-muted-foreground">{position.tokenName}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatNumber(position.balance, 4)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${formatNumber(position.avgBuyPrice, 8)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${formatNumber(position.currentPrice, 8)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(position.value)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className={`flex items-center justify-end gap-1 ${position.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                          {position.pnl >= 0 ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          <div>
                            <p className="font-mono">{position.pnl >= 0 ? '+' : ''}{formatCurrency(position.pnl)}</p>
                            <p className="text-xs">({position.pnlPercent >= 0 ? '+' : ''}{position.pnlPercent.toFixed(2)}%)</p>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Allocation Chart */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Allocation</CardTitle>
            <CardDescription>Portfolio distribution</CardDescription>
          </CardHeader>
          <CardContent>
            {positions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No allocation data
              </div>
            ) : (
              <div className="space-y-4">
                {/* Simple visual representation */}
                <div className="h-4 rounded-full overflow-hidden flex">
                  {allocationData.map((item, i) => (
                    <div
                      key={item.symbol}
                      className="h-full transition-all hover:opacity-80"
                      style={{
                        width: `${item.percentage}%`,
                        backgroundColor: `hsl(${(i * 137.5) % 360}, 70%, 50%)`
                      }}
                    />
                  ))}
                </div>

                {/* Legend */}
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {allocationData.map((item, i) => (
                    <div key={item.symbol} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: `hsl(${(i * 137.5) % 360}, 70%, 50%)` }}
                        />
                        <span className="text-sm font-medium">{item.symbol}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm text-muted-foreground">{item.percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
