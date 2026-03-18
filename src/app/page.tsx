'use client';

import { useState, useEffect } from 'react';

interface TokenAnalysis {
  token: {
    address: string;
    symbol: string;
    name: string;
    priceUsd: string;
    logoUrl?: string;
  };
  analysis: {
    action: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    reasoning: string;
    marketSentiment: string;
    riskLevel: string;
    stopLoss: number | null;
    takeProfit: number | null;
  };
  metrics: {
    priceChange24h: number;
    priceChange1h: number;
    priceChange5m: number;
    volume24h: number;
    liquidityUsd: number;
    buyPressure: string;
  };
}

interface WalletInfo {
  publicKey: string;
  balance: number;
}

export default function Home() {
  const [tokenAddress, setTokenAddress] = useState('');
  const [analysis, setAnalysis] = useState<TokenAnalysis | null>(null);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch wallet info on mount
  useEffect(() => {
    fetch('/api/wallet')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setWallet({
            publicKey: data.publicKey,
            balance: data.balance
          });
        }
      })
      .catch(console.error);
  }, []);

  const analyzeToken = async () => {
    if (!tokenAddress.trim()) return;
    
    setLoading(true);
    setError('');
    setAnalysis(null);

    try {
      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenAddress: tokenAddress.trim() })
      });

      const data = await response.json();

      if (data.success) {
        setAnalysis(data);
      } else {
        setError(data.error || 'Analysis failed');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent mb-4">
            Solana Memecoin Scalper
          </h1>
          <p className="text-gray-400 text-lg">AI-Powered Trading Agent</p>
        </div>

        {/* Wallet Info */}
        {wallet && (
          <div className="bg-gray-800/50 backdrop-blur rounded-xl p-6 mb-8 border border-gray-700">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-sm text-gray-400 mb-1">Wallet Address</p>
                <p className="font-mono text-sm text-purple-400 break-all">
                  {wallet.publicKey}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-400 mb-1">Balance</p>
                <p className="text-2xl font-bold text-green-400">{wallet.balance.toFixed(4)} SOL</p>
              </div>
            </div>
          </div>
        )}

        {/* Token Analysis Section */}
        <div className="bg-gray-800/50 backdrop-blur rounded-xl p-6 mb-8 border border-gray-700">
          <h2 className="text-xl font-semibold mb-4">Token Analysis</h2>
          
          <div className="flex gap-4 flex-wrap">
            <input
              type="text"
              value={tokenAddress}
              onChange={(e) => setTokenAddress(e.target.value)}
              placeholder="Enter token address..."
              className="flex-1 min-w-[300px] bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500 transition"
            />
            <button
              onClick={analyzeToken}
              disabled={loading || !tokenAddress.trim()}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-semibold hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* Analysis Results */}
        {analysis && (
          <div className="bg-gray-800/50 backdrop-blur rounded-xl p-6 border border-gray-700">
            {/* Token Info */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-xl font-bold">
                {analysis.token.symbol.charAt(0)}
              </div>
              <div>
                <h3 className="text-2xl font-bold">{analysis.token.symbol}</h3>
                <p className="text-gray-400">{analysis.token.name}</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-2xl font-bold">${parseFloat(analysis.token.priceUsd).toFixed(8)}</p>
              </div>
            </div>

            {/* Signal Badge */}
            <div className="flex items-center gap-4 mb-6">
              <div className={`px-6 py-3 rounded-xl font-bold text-lg ${
                analysis.analysis.action === 'BUY' ? 'bg-green-500/20 text-green-400 border border-green-500' :
                analysis.analysis.action === 'SELL' ? 'bg-red-500/20 text-red-400 border border-red-500' :
                'bg-yellow-500/20 text-yellow-400 border border-yellow-500'
              }`}>
                {analysis.analysis.action}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">Confidence:</span>
                  <span className="font-bold">{analysis.analysis.confidence}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2 mt-1">
                  <div 
                    className={`h-2 rounded-full ${
                      analysis.analysis.confidence >= 70 ? 'bg-green-500' :
                      analysis.analysis.confidence >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${analysis.analysis.confidence}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Reasoning */}
            <div className="bg-gray-900/50 rounded-lg p-4 mb-6">
              <p className="text-gray-300">{analysis.analysis.reasoning}</p>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-900/50 rounded-lg p-4">
                <p className="text-gray-400 text-sm">24h Change</p>
                <p className={`text-xl font-bold ${analysis.metrics.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {analysis.metrics.priceChange24h >= 0 ? '+' : ''}{analysis.metrics.priceChange24h.toFixed(2)}%
                </p>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-4">
                <p className="text-gray-400 text-sm">1h Change</p>
                <p className={`text-xl font-bold ${analysis.metrics.priceChange1h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {analysis.metrics.priceChange1h >= 0 ? '+' : ''}{analysis.metrics.priceChange1h.toFixed(2)}%
                </p>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-4">
                <p className="text-gray-400 text-sm">24h Volume</p>
                <p className="text-xl font-bold">${(analysis.metrics.volume24h / 1e6).toFixed(2)}M</p>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-4">
                <p className="text-gray-400 text-sm">Liquidity</p>
                <p className="text-xl font-bold">${(analysis.metrics.liquidityUsd / 1e3).toFixed(0)}K</p>
              </div>
            </div>

            {/* Risk Level */}
            <div className="mt-6 flex items-center gap-4">
              <span className="text-gray-400">Risk Level:</span>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                analysis.analysis.riskLevel === 'LOW' ? 'bg-green-500/20 text-green-400' :
                analysis.analysis.riskLevel === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-red-500/20 text-red-400'
              }`}>
                {analysis.analysis.riskLevel}
              </span>
              <span className="text-gray-400">|</span>
              <span className="text-gray-400">Sentiment:</span>
              <span className={`font-semibold ${
                analysis.analysis.marketSentiment === 'BULLISH' ? 'text-green-400' :
                analysis.analysis.marketSentiment === 'BEARISH' ? 'text-red-400' :
                'text-yellow-400'
              }`}>
                {analysis.analysis.marketSentiment}
              </span>
            </div>

            {/* Stop Loss / Take Profit */}
            {analysis.analysis.action === 'BUY' && (
              <div className="mt-4 flex gap-6">
                {analysis.analysis.stopLoss && (
                  <div>
                    <span className="text-gray-400 text-sm">Stop Loss: </span>
                    <span className="text-red-400 font-mono">${analysis.analysis.stopLoss.toFixed(8)}</span>
                  </div>
                )}
                {analysis.analysis.takeProfit && (
                  <div>
                    <span className="text-gray-400 text-sm">Take Profit: </span>
                    <span className="text-green-400 font-mono">${analysis.analysis.takeProfit.toFixed(8)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 bg-gray-800/30 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold mb-3">How to Use</h3>
          <ol className="list-decimal list-inside space-y-2 text-gray-400">
            <li>Enter a Solana token address (e.g., from DexScreener or Birdeye)</li>
            <li>Click "Analyze" to get AI-powered trading signals</li>
            <li>Review the confidence, risk level, and reasoning</li>
            <li>Use stop-loss and take-profit levels for risk management</li>
          </ol>
        </div>
      </div>
    </main>
  );
}
