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
import { ArrowUpRight, ArrowDownRight, RefreshCw, Clock, CheckCircle, XCircle, Bot } from 'lucide-react'

interface Trade {
  id: string
  type: string
  tokenSymbol: string
  tokenName: string
  amount: number
  price: number
  totalValue: number
  status: string
  txHash: string | null
  createdAt: string
}

export function TradingTab() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/trading/history')
      
      if (response.ok) {
        const data = await response.json()
        setTrades(data.trades || [])
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(value)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString()
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="w-4 h-4 text-profit" />
      case 'PENDING':
        return <Clock className="w-4 h-4 text-warning" />
      case 'FAILED':
        return <XCircle className="w-4 h-4 text-loss" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-profit/10 text-profit'
      case 'PENDING':
        return 'bg-warning/10 text-warning'
      case 'FAILED':
        return 'bg-loss/10 text-loss'
      default:
        return ''
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Trade History</h2>
          <p className="text-muted-foreground">All trades executed by AI Agent</p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Info Card */}
      <Card className="bg-card border-border border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">AI Auto-Trading Mode</p>
              <p className="text-sm text-muted-foreground">
                Trades are executed automatically by the AI agent based on market analysis and signals. 
                Enable auto-trading in Settings to allow the agent to trade on your behalf.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trade History */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Trade History</CardTitle>
          <CardDescription>All executed trades by the AI agent</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : trades.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No trades yet</p>
              <p className="text-sm">The AI agent will execute trades automatically when auto-trading is enabled</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Total Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trades.map((trade) => (
                  <TableRow key={trade.id}>
                    <TableCell>
                      <Badge className={
                        trade.type === 'BUY' 
                          ? 'bg-profit/10 text-profit' 
                          : 'bg-loss/10 text-loss'
                      }>
                        {trade.type === 'BUY' ? (
                          <ArrowDownRight className="w-3 h-3 mr-1" />
                        ) : (
                          <ArrowUpRight className="w-3 h-3 mr-1" />
                        )}
                        {trade.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{trade.tokenSymbol}</p>
                        <p className="text-xs text-muted-foreground">{trade.tokenName}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {trade.amount.toFixed(4)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ${trade.price.toFixed(8)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(trade.totalValue)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(trade.status)}
                        <Badge className={getStatusColor(trade.status)}>
                          {trade.status}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(trade.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
