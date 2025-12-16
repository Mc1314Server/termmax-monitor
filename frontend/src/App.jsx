import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:3001';

// Return Calculator Component
function ReturnCalculator({ pool }) {
  const [amount, setAmount] = useState('');
  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(false);

  const calculateReturn = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/api/calculate-return`, {
        poolId: pool.optionId,
        investedAmount: parseFloat(amount),
      });
      setEstimate(response.data.estimate);
    } catch (err) {
      console.error('Failed to calculate return:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-dark-700 rounded-lg">
      <div className="text-sm font-medium text-white mb-3">📊 Return Calculator</div>
      <div className="flex gap-2 mb-3">
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="USDT Amount"
          className="flex-1 px-3 py-2 bg-dark-600 border border-dark-500 rounded-lg text-white text-sm focus:border-primary focus:outline-none"
        />
        <button
          onClick={calculateReturn}
          disabled={loading || !amount}
          className="px-4 py-2 bg-primary hover:bg-primary/80 rounded-lg text-white text-sm font-medium transition disabled:opacity-50"
        >
          {loading ? '...' : 'Calculate'}
        </button>
      </div>
      
      {estimate && (
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2 p-2 bg-dark-600 rounded">
            <div>
              <div className="text-xs text-gray-400">Days to Maturity</div>
              <div className="text-white font-medium">{estimate.daysToMaturity}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">APY</div>
              <div className="text-green-400 font-medium">{estimate.apy?.toFixed(1)}%</div>
            </div>
          </div>
          
          <div className="p-2 bg-green-900/20 border border-green-500/30 rounded">
            <div className="text-xs text-green-400 mb-1">✅ If Price &gt; Strike</div>
            <div className="text-white">
              Return: <span className="font-bold">{estimate.returnIfNotConverted?.toFixed(2)} USDT</span>
            </div>
            <div className="text-green-400 text-xs">
              +{estimate.profitIfNotConverted?.toFixed(2)} USDT ({estimate.profitPercentIfNotConverted?.toFixed(2)}%)
            </div>
          </div>
          
          <div className="p-2 bg-yellow-900/20 border border-yellow-500/30 rounded">
            <div className="text-xs text-yellow-400 mb-1">⚠️ If Price ≤ Strike (${estimate.strikePrice})</div>
            <div className="text-white">
              Convert to: <span className="font-bold">{estimate.tokenAmountIfConverted?.toFixed(4)} {pool.underlyingSymbol}</span>
            </div>
            <div className="text-yellow-400 text-xs">
              Break-even: ${estimate.breakEvenPrice?.toFixed(4)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Watch Rule Modal Component
function WatchRuleModal({ pool, existingRule, onClose, onSave }) {
  const [conditions, setConditions] = useState({
    apyBelow: existingRule?.conditions?.apyBelow ?? '',
    apyAbove: existingRule?.conditions?.apyAbove ?? '',
    priceToStrikeBelow: existingRule?.conditions?.priceToStrikeBelow ?? '',
    priceToStrikeAbove: existingRule?.conditions?.priceToStrikeAbove ?? '',
    tvlBelow: existingRule?.conditions?.tvlBelow ?? '',
    utilizationAbove: existingRule?.conditions?.utilizationAbove ?? '',
    notifyOnMaturity: existingRule?.conditions?.notifyOnMaturity ?? false,
    investedAmount: existingRule?.conditions?.investedAmount ?? '',
  });
  const [cooldownMinutes, setCooldownMinutes] = useState(existingRule?.cooldownMinutes ?? 30);
  const [saving, setSaving] = useState(false);
  const [estimate, setEstimate] = useState(null);

  // Calculate estimated return when amount changes
  const calculateEstimate = async (amount) => {
    if (!amount || parseFloat(amount) <= 0) {
      setEstimate(null);
      return;
    }
    try {
      const response = await axios.post(`${API_BASE}/api/calculate-return`, {
        poolId: pool.optionId,
        investedAmount: parseFloat(amount),
      });
      setEstimate(response.data.estimate);
    } catch (err) {
      console.error('Failed to calculate return:', err);
    }
  };

  const handleAmountChange = (value) => {
    setConditions({ ...conditions, investedAmount: value });
    if (value) {
      calculateEstimate(value);
    } else {
      setEstimate(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        poolId: pool.optionId,
        symbol: pool.symbol,
        underlyingSymbol: pool.underlyingSymbol,
        strikePrice: pool.strikePrice || pool.targetPrice,
        cooldownMinutes,
        apyBelow: conditions.apyBelow === '' ? null : parseFloat(conditions.apyBelow),
        apyAbove: conditions.apyAbove === '' ? null : parseFloat(conditions.apyAbove),
        priceToStrikeBelow: conditions.priceToStrikeBelow === '' ? null : parseFloat(conditions.priceToStrikeBelow),
        priceToStrikeAbove: conditions.priceToStrikeAbove === '' ? null : parseFloat(conditions.priceToStrikeAbove),
        tvlBelow: conditions.tvlBelow === '' ? null : parseFloat(conditions.tvlBelow),
        utilizationAbove: conditions.utilizationAbove === '' ? null : parseFloat(conditions.utilizationAbove),
        notifyOnMaturity: conditions.notifyOnMaturity,
        investedAmount: conditions.investedAmount === '' ? null : parseFloat(conditions.investedAmount),
      };

      if (existingRule) {
        await axios.patch(`${API_BASE}/api/watchlist/${pool.optionId}`, {
          apyBelow: payload.apyBelow,
          apyAbove: payload.apyAbove,
          priceToStrikeBelow: payload.priceToStrikeBelow,
          priceToStrikeAbove: payload.priceToStrikeAbove,
          tvlBelow: payload.tvlBelow,
          utilizationAbove: payload.utilizationAbove,
          notifyOnMaturity: payload.notifyOnMaturity,
          investedAmount: payload.investedAmount,
          investedAt: payload.investedAmount ? Date.now() : null,
          investedPrice: payload.investedAmount ? pool.underlyingPrice : null,
        });
      } else {
        await axios.post(`${API_BASE}/api/watchlist`, payload);
      }
      onSave();
    } catch (err) {
      console.error('Failed to save watch rule:', err);
      alert('Failed to save watch rule');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 rounded-xl p-6 w-full max-w-md border border-dark-600">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-white">
            {existingRule ? 'Edit' : 'Add'} Watch Rule
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
        </div>

        <div className="mb-4 p-3 bg-dark-700 rounded-lg">
          <div className="text-white font-medium">{pool.underlyingSymbol} / {pool.assetSymbol || 'USDT'}</div>
          <div className="text-sm text-gray-400">
            Strike: ${pool.strikePrice || pool.targetPrice} | Current APY: {pool.totalApy?.toFixed(1)}%
          </div>
        </div>

        <div className="space-y-4">
          <div className="text-sm text-gray-300 font-medium">Alert Conditions (leave empty to disable)</div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">APY Below (%)</label>
              <input
                type="number"
                value={conditions.apyBelow}
                onChange={(e) => setConditions({ ...conditions, apyBelow: e.target.value })}
                placeholder="e.g. 20"
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">APY Above (%)</label>
              <input
                type="number"
                value={conditions.apyAbove}
                onChange={(e) => setConditions({ ...conditions, apyAbove: e.target.value })}
                placeholder="e.g. 100"
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Strike Distance Below (%)</label>
              <input
                type="number"
                value={conditions.priceToStrikeBelow}
                onChange={(e) => setConditions({ ...conditions, priceToStrikeBelow: e.target.value })}
                placeholder="e.g. 5"
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm focus:border-primary focus:outline-none"
              />
              <div className="text-xs text-gray-500 mt-1">Alert when price is close to strike</div>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Strike Distance Above (%)</label>
              <input
                type="number"
                value={conditions.priceToStrikeAbove}
                onChange={(e) => setConditions({ ...conditions, priceToStrikeAbove: e.target.value })}
                placeholder="e.g. 50"
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">TVL Below ($)</label>
              <input
                type="number"
                value={conditions.tvlBelow}
                onChange={(e) => setConditions({ ...conditions, tvlBelow: e.target.value })}
                placeholder="e.g. 10000"
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Utilization Above (%)</label>
              <input
                type="number"
                value={conditions.utilizationAbove}
                onChange={(e) => setConditions({ ...conditions, utilizationAbove: e.target.value })}
                placeholder="e.g. 90"
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-dark-700 rounded-lg">
            <div>
              <div className="text-sm text-white font-medium">Notify on Maturity</div>
              <div className="text-xs text-gray-500">Alert when pool expires</div>
            </div>
            <button
              type="button"
              onClick={() => setConditions({ ...conditions, notifyOnMaturity: !conditions.notifyOnMaturity })}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                conditions.notifyOnMaturity ? 'bg-primary' : 'bg-dark-500'
              }`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                conditions.notifyOnMaturity ? 'left-6' : 'left-1'
              }`} />
            </button>
          </div>

          {/* Investment Amount & Return Estimate */}
          <div className="p-3 bg-dark-700 rounded-lg border border-primary/30">
            <div className="text-sm text-primary font-medium mb-2">💰 Investment Tracking</div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Invested USDT Amount</label>
              <input
                type="number"
                value={conditions.investedAmount}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="e.g. 1000"
                className="w-full px-3 py-2 bg-dark-600 border border-dark-500 rounded-lg text-white text-sm focus:border-primary focus:outline-none"
              />
              <div className="text-xs text-gray-500 mt-1">Track investment & receive daily profit updates</div>
            </div>
            
            {/* Estimated Return Display */}
            {estimate && (
              <div className="mt-3 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-dark-600 rounded">
                    <div className="text-gray-400">Days to Maturity</div>
                    <div className="text-white font-medium">{estimate.daysToMaturity}</div>
                  </div>
                  <div className="p-2 bg-dark-600 rounded">
                    <div className="text-gray-400">Expected APY</div>
                    <div className="text-green-400 font-medium">{estimate.apy?.toFixed(1)}%</div>
                  </div>
                </div>
                
                <div className="p-2 bg-green-900/20 border border-green-500/30 rounded text-xs">
                  <div className="text-green-400 mb-1">✅ If Price &gt; Strike:</div>
                  <div className="text-white">
                    Return: <span className="font-bold">{estimate.returnIfNotConverted?.toFixed(2)} USDT</span>
                    <span className="text-green-400 ml-2">
                      (+{estimate.profitIfNotConverted?.toFixed(2)} / {estimate.profitPercentIfNotConverted?.toFixed(2)}%)
                    </span>
                  </div>
                </div>
                
                <div className="p-2 bg-yellow-900/20 border border-yellow-500/30 rounded text-xs">
                  <div className="text-yellow-400 mb-1">⚠️ If Price ≤ ${estimate.strikePrice}:</div>
                  <div className="text-white">
                    Convert: <span className="font-bold">{estimate.tokenAmountIfConverted?.toFixed(4)} {pool.underlyingSymbol}</span>
                    <span className="text-yellow-400 ml-2">(Break-even: ${estimate.breakEvenPrice?.toFixed(4)})</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Alert Cooldown (minutes)</label>
            <input
              type="number"
              value={cooldownMinutes}
              onChange={(e) => setCooldownMinutes(parseInt(e.target.value) || 30)}
              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm focus:border-primary focus:outline-none"
            />
            <div className="text-xs text-gray-500 mt-1">Minimum time between repeated alerts</div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-dark-600 hover:bg-dark-500 rounded-lg text-white font-medium transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-primary hover:bg-primary/80 rounded-lg text-white font-medium transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Rule'}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatNumber(num) {
  if (!num) return '0';
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toFixed(2);
}

function formatPrice(num) {
  if (!num) return '$0';
  if (num < 0.01) return '$' + num.toFixed(6);
  return '$' + num.toFixed(4);
}

function formatPercent(num) {
  if (!num) return '0%';
  const sign = num >= 0 ? '+' : '';
  return sign + num.toFixed(2) + '%';
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function StatusBadge({ isRunning }) {
  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
      isRunning ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
    }`}>
      {isRunning ? '● Running' : '○ Stopped'}
    </span>
  );
}

function PoolCard({ pool, onWatch }) {
  const daysToMaturity = Math.ceil((new Date(pool.maturity) - new Date()) / (1000 * 60 * 60 * 24));
  const priceToStrike = Math.abs(pool.priceToTarget);
  const isNearStrike = priceToStrike <= 15;
  const isDanger = priceToStrike <= 5;
  const isHighApy = pool.totalApy >= 50;

  return (
    <div className={`stat-card border ${
      pool.isWatching ? 'border-primary/50 ring-1 ring-primary/30' :
      isDanger ? 'border-red-500/50' :
      isNearStrike ? 'border-yellow-500/50' : 
      isHighApy ? 'border-green-500/30' : 
      'border-dark-600'
    }`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <span className="font-semibold text-white text-lg">{pool.underlyingSymbol}</span>
          <span className="text-gray-400 text-sm ml-2">/ {pool.assetSymbol || 'USDT'}</span>
        </div>
        <div className="flex gap-1 items-center">
          {pool.isWatching && <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary">Watching</span>}
          {isDanger && <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">Risk</span>}
          {isNearStrike && !isDanger && <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400">Near</span>}
          <span className={`text-xs px-2 py-0.5 rounded ${
            daysToMaturity <= 3 ? 'bg-red-500/20 text-red-400' :
            daysToMaturity <= 7 ? 'bg-yellow-500/20 text-yellow-400' :
            'bg-gray-500/20 text-gray-400'
          }`}>
            {daysToMaturity}D
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <div className="text-xs text-gray-400">Current Price</div>
          <div className="text-lg font-semibold text-white">{formatPrice(pool.underlyingPrice)}</div>
          <div className={`text-xs ${pool.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatPercent(pool.priceChange24h)} (24h)
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-400">Strike Price</div>
          <div className="text-lg font-semibold text-white">{formatPrice(pool.strikePrice || pool.targetPrice)}</div>
          <div className={`text-xs ${
            Math.abs(pool.priceToTarget) <= 5 ? 'text-red-400 font-medium' : 
            Math.abs(pool.priceToTarget) <= 15 ? 'text-yellow-400' :
            'text-green-400'
          }`}>
            {formatPercent(pool.priceToTarget)} to strike
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-dark-600">
        <div>
          <div className="text-xs text-gray-400">TVL</div>
          <div className="text-sm font-medium text-white">${formatNumber(pool.tvl)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-400">APY</div>
          <div className={`text-sm font-medium ${pool.totalApy >= 100 ? 'text-green-300' : 'text-green-400'}`}>
            {pool.totalApy?.toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-400">Capacity</div>
          <div className="text-sm font-medium text-white">${formatNumber(pool.capacity)}</div>
        </div>
      </div>

      {/* Utilization bar */}
      <div className="mt-2">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-500">Utilization</span>
          <span className="text-gray-400">{pool.utilization?.toFixed(2)}%</span>
        </div>
        <div className="h-1.5 bg-dark-600 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              pool.utilization >= 90 ? 'bg-red-500' :
              pool.utilization >= 70 ? 'bg-yellow-500' :
              'bg-green-500'
            }`}
            style={{ width: `${Math.min(pool.utilization || 0, 100)}%` }}
          />
        </div>
      </div>

      <div className="mt-3 flex justify-between items-center text-xs text-gray-500">
        <span>Maturity: {formatDate(pool.maturity)}</span>
        <button
          onClick={() => onWatch(pool)}
          className={`px-2 py-1 rounded text-xs font-medium transition ${
            pool.isWatching
              ? 'bg-primary/20 text-primary hover:bg-primary/30'
              : 'bg-dark-600 text-gray-300 hover:bg-dark-500'
          }`}
        >
          {pool.isWatching ? 'Edit Rule' : '+ Watch'}
        </button>
      </div>
    </div>
  );
}

function AlertItem({ alert }) {
  const typeColors = {
    danger: 'border-l-red-500 bg-red-900/20',
    warning: 'border-l-yellow-500 bg-yellow-900/20',
    info: 'border-l-blue-500 bg-blue-900/20',
    price: 'border-l-purple-500 bg-purple-900/20',
    pool: 'border-l-cyan-500 bg-cyan-900/20',
    apy: 'border-l-green-500 bg-green-900/20',
  };

  return (
    <div className={`p-3 rounded-lg border-l-4 ${typeColors[alert.type] || typeColors.info}`}>
      <div className="flex justify-between items-start">
        <span className="font-medium text-white text-sm">{alert.title}</span>
        <span className="text-xs text-gray-400">
          {new Date(alert.timestamp).toLocaleTimeString()}
        </span>
      </div>
      {alert.data && (
        <div className="text-xs text-gray-400 mt-1">
          {alert.data.changePercent !== undefined && (
            <span className={alert.data.changePercent < 0 ? 'text-red-400' : 'text-green-400'}>
              {formatPercent(alert.data.changePercent)}
            </span>
          )}
          {alert.data.symbol && <span className="ml-2">{alert.data.symbol}</span>}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ title, value, subtitle, trend }) {
  return (
    <div className="stat-card">
      <div className="text-gray-400 text-sm mb-1">{title}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {subtitle && (
        <div className={`text-xs mt-1 ${
          trend === 'up' ? 'text-green-400' :
          trend === 'down' ? 'text-red-400' :
          'text-gray-400'
        }`}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);
  const [filter, setFilter] = useState('all');
  const [watchModal, setWatchModal] = useState({ open: false, pool: null });
  const [activeTab, setActiveTab] = useState('pools'); // 'pools' | 'watchlist'

  const fetchData = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/data`);
      setData(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to connect to backend. Make sure the server is running.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Connect WebSocket
    let websocket;
    try {
      websocket = new WebSocket(`ws://localhost:3001`);

      websocket.onopen = () => {
        console.log('WebSocket connected');
        setConnected(true);
      };

      websocket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'init' || message.type === 'update') {
          setData(message.data);
        }
      };

      websocket.onclose = () => {
        console.log('WebSocket disconnected');
        setConnected(false);
      };

      websocket.onerror = () => {
        setConnected(false);
      };
    } catch (e) {
      console.error('WebSocket error:', e);
    }

    // Polling fallback
    const interval = setInterval(fetchData, 30000);

    return () => {
      if (websocket) websocket.close();
      clearInterval(interval);
    };
  }, [fetchData]);

  const handleStartMonitor = async () => {
    try {
      await axios.post(`${API_BASE}/api/monitor/start`);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleStopMonitor = async () => {
    try {
      await axios.post(`${API_BASE}/api/monitor/stop`);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenWatch = (pool) => {
    setWatchModal({ open: true, pool });
  };

  const handleCloseWatch = () => {
    setWatchModal({ open: false, pool: null });
  };

  const handleSaveWatch = () => {
    setWatchModal({ open: false, pool: null });
    fetchData();
  };

  const handleRemoveWatch = async (poolId) => {
    if (!window.confirm('Remove this watch rule?')) return;
    try {
      await axios.delete(`${API_BASE}/api/watchlist/${poolId}`);
      fetchData();
    } catch (err) {
      console.error('Failed to remove watch:', err);
    }
  };

  const handleToggleWatch = async (poolId, enabled) => {
    try {
      await axios.patch(`${API_BASE}/api/watchlist/${poolId}/toggle`, { enabled });
      fetchData();
    } catch (err) {
      console.error('Failed to toggle watch:', err);
    }
  };

  const handleManualUpdate = async () => {
    try {
      await axios.post(`${API_BASE}/api/monitor/update`);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-900">
        <div className="text-center">
          <div className="text-xl text-gray-400 mb-2">Loading...</div>
          <div className="text-sm text-gray-500">Connecting to monitor service</div>
        </div>
      </div>
    );
  }

  const pools = data?.termmax?.pools || [];
  const summary = data?.termmax?.summary || {};
  const alerts = data?.alerts || [];
  const watchlist = data?.watchlist || [];

  // Filter pools
  const filteredPools = pools.filter(pool => {
    const priceToStrike = Math.abs(pool.priceToTarget);
    if (filter === 'all') return true;
    if (filter === 'danger') return priceToStrike <= 5;
    if (filter === 'nearStrike') return priceToStrike <= 15;
    if (filter === 'highApy') return pool.totalApy >= 50;
    if (filter === 'safe') return priceToStrike > 30;
    if (filter === 'watching') return pool.isWatching;
    return true;
  });

  return (
    <div className="min-h-screen bg-dark-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">TermMax Monitor</h1>
            <p className="text-gray-400 mt-1">Dual Investment Pool Monitoring</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-sm ${connected ? 'text-green-400' : 'text-red-400'}`}>
              {connected ? '● Live' : '○ Offline'}
            </span>
            <StatusBadge isRunning={data?.status?.isRunning} />
          </div>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 mb-6">
            <div className="font-medium text-red-400">Connection Error</div>
            <div className="text-sm text-red-300 mt-1">{error}</div>
          </div>
        )}

        {/* Controls */}
        <div className="card mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleStartMonitor}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white font-medium transition text-sm"
            >
              Start
            </button>
            <button
              onClick={handleStopMonitor}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white font-medium transition text-sm"
            >
              Stop
            </button>
            <button
              onClick={handleManualUpdate}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium transition text-sm"
            >
              Refresh
            </button>
            <div className="ml-auto text-xs text-gray-400">
              Last: {data?.status?.lastUpdate
                ? new Date(data.status.lastUpdate).toLocaleTimeString()
                : 'Never'}
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <SummaryCard
            title="Total TVL"
            value={`$${formatNumber(summary.totalTvl)}`}
            subtitle={`${pools.length} pools`}
          />
          <SummaryCard
            title="Avg APY"
            value={`${summary.avgApy?.toFixed(1) || 0}%`}
            trend="up"
          />
          <SummaryCard
            title="Avg Utilization"
            value={`${summary.avgUtilization?.toFixed(1) || 0}%`}
          />
          <SummaryCard
            title="Watching"
            value={watchlist.length}
            subtitle="active rules"
          />
          <SummaryCard
            title="Updates"
            value={data?.status?.stats?.totalUpdates || 0}
          />
        </div>

        {/* Pool Filters */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {[
            { key: 'all', label: 'All Pools' },
            { key: 'watching', label: `Watching (${watchlist.length})` },
            { key: 'danger', label: 'Near Strike (<5%)' },
            { key: 'nearStrike', label: 'Watch (<15%)' },
            { key: 'highApy', label: 'High APY (>50%)' },
            { key: 'safe', label: 'Safe (>30%)' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition ${
                filter === f.key
                  ? 'bg-primary text-white'
                  : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pools - 2 columns */}
          <div className="lg:col-span-2">
            <div className="card">
              <h2 className="text-xl font-semibold text-white mb-4">
                Dual Investment Pools
                <span className="text-sm text-gray-400 ml-2">({filteredPools.length})</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-2">
                {filteredPools.length > 0 ? (
                  filteredPools.map((pool) => (
                    <PoolCard key={pool.optionId} pool={pool} onWatch={handleOpenWatch} />
                  ))
                ) : (
                  <div className="text-gray-400 text-center py-8 col-span-2">
                    No pools match the filter
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Alerts & Watchlist - 1 column */}
          <div className="space-y-6">
            {/* Watchlist Panel */}
            {watchlist.length > 0 && (
              <div className="card">
                <h2 className="text-xl font-semibold text-white mb-4">
                  Watchlist
                  <span className="text-sm text-gray-400 ml-2">({watchlist.length})</span>
                </h2>
                <div className="space-y-2 max-h-[250px] overflow-y-auto">
                  {watchlist.map((watch) => (
                    <div key={watch.poolId} className={`p-3 rounded-lg border ${watch.enabled ? 'border-primary/30 bg-primary/5' : 'border-dark-600 bg-dark-700/50'}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-medium text-white">{watch.underlyingSymbol}</span>
                          <span className="text-gray-400 text-sm ml-1">@ ${watch.strikePrice}</span>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleToggleWatch(watch.poolId, !watch.enabled)}
                            className={`px-2 py-0.5 rounded text-xs ${watch.enabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}
                          >
                            {watch.enabled ? 'ON' : 'OFF'}
                          </button>
                          <button
                            onClick={() => {
                              const pool = pools.find(p => p.optionId === watch.poolId);
                              if (pool) handleOpenWatch(pool);
                            }}
                            className="px-2 py-0.5 rounded text-xs bg-dark-600 text-gray-300 hover:bg-dark-500"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleRemoveWatch(watch.poolId)}
                            className="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30"
                          >
                            X
                          </button>
                        </div>
                      </div>
                      {watch.conditions.investedAmount && (
                        <div className="text-xs text-primary mt-1">
                          💰 Invested: {watch.conditions.investedAmount} USDT
                        </div>
                      )}
                      <div className="text-xs text-gray-500 mt-1">
                        {watch.conditions.apyBelow && <span className="mr-2">APY&lt;{watch.conditions.apyBelow}%</span>}
                        {watch.conditions.priceToStrikeBelow && <span className="mr-2">Strike&lt;{watch.conditions.priceToStrikeBelow}%</span>}
                        {watch.conditions.tvlBelow && <span className="mr-2">TVL&lt;${formatNumber(watch.conditions.tvlBelow)}</span>}
                        {watch.conditions.utilizationAbove && <span className="mr-2">Util&gt;{watch.conditions.utilizationAbove}%</span>}
                        {watch.conditions.notifyOnMaturity && <span className="text-yellow-400">Maturity</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Alerts Panel */}
            <div className="card">
              <h2 className="text-xl font-semibold text-white mb-4">
                Alerts
                <span className="text-sm text-gray-400 ml-2">({alerts.length})</span>
              </h2>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {alerts.length > 0 ? (
                  alerts.map((alert) => (
                    <AlertItem key={alert.id} alert={alert} />
                  ))
                ) : (
                  <div className="text-gray-400 text-center py-8">
                    No alerts yet
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Watch Rule Modal */}
        {watchModal.open && watchModal.pool && (
          <WatchRuleModal
            pool={watchModal.pool}
            existingRule={watchModal.pool.watchRule}
            onClose={handleCloseWatch}
            onSave={handleSaveWatch}
          />
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>TermMax Dual Investment Monitor v1.0 | BSC Chain</p>
          <p className="mt-1">
            Telegram: Configure bot token in backend/.env, then send /start
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
