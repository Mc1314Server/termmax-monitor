const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const http = require('http');

const config = require('./config');
const monitorService = require('./services/monitorService');
const telegramService = require('./services/telegramService');
const priceService = require('./services/priceService');
const tvlService = require('./services/tvlService');
const alertService = require('./services/alertService');
const watchlistService = require('./services/watchlistService');

const app = express();
app.use(cors());
app.use(express.json());

// Create HTTP server
const server = http.createServer(app);

// WebSocket server for real-time updates
const wss = new WebSocketServer({ server });

// Broadcast to all connected clients
function broadcast(data) {
  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
}

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('New WebSocket connection');

  // Send initial data
  ws.send(JSON.stringify({
    type: 'init',
    data: monitorService.getData(),
  }));

  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });
});

// REST API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Get all data
app.get('/api/data', (req, res) => {
  res.json(monitorService.getData());
});

// Get prices
app.get('/api/prices', async (req, res) => {
  try {
    const prices = await priceService.getAllPrices();
    res.json(prices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get TVL
app.get('/api/tvl', async (req, res) => {
  try {
    const tvl = await tvlService.fetchFromDefiLlama();
    res.json(tvl);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get pools
app.get('/api/pools', async (req, res) => {
  try {
    const pools = await tvlService.fetchPoolsData();
    res.json(pools);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get alerts
app.get('/api/alerts', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json(alertService.getAlerts(limit));
});

// Get alert rules
app.get('/api/alerts/rules', (req, res) => {
  res.json(alertService.getRules());
});

// Update alert rule
app.patch('/api/alerts/rules/:id', (req, res) => {
  const rule = alertService.updateRule(req.params.id, req.body);
  if (rule) {
    res.json(rule);
  } else {
    res.status(404).json({ error: 'Rule not found' });
  }
});

// Get monitor status
app.get('/api/status', (req, res) => {
  res.json(monitorService.getStatus());
});

// Start monitor
app.post('/api/monitor/start', (req, res) => {
  monitorService.start();
  res.json({ status: 'started' });
});

// Stop monitor
app.post('/api/monitor/stop', (req, res) => {
  monitorService.stop();
  res.json({ status: 'stopped' });
});

// Manual update trigger
app.post('/api/monitor/update', async (req, res) => {
  try {
    await monitorService.update();
    res.json({ status: 'updated', data: monitorService.getData() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== Watchlist API ==========

// Get all watches
app.get('/api/watchlist', (req, res) => {
  res.json(watchlistService.getAll());
});

// Add watch
app.post('/api/watchlist', (req, res) => {
  try {
    const { poolId, ...rule } = req.body;
    if (!poolId) {
      return res.status(400).json({ error: 'poolId is required' });
    }
    const watch = watchlistService.addWatch(poolId, rule);
    res.json(watch);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update watch conditions
app.patch('/api/watchlist/:poolId', (req, res) => {
  try {
    const { poolId } = req.params;
    const watch = watchlistService.updateConditions(poolId, req.body);
    if (watch) {
      res.json(watch);
    } else {
      res.status(404).json({ error: 'Watch not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle watch
app.patch('/api/watchlist/:poolId/toggle', (req, res) => {
  try {
    const { poolId } = req.params;
    const { enabled } = req.body;
    const watch = watchlistService.toggleWatch(poolId, enabled);
    if (watch) {
      res.json(watch);
    } else {
      res.status(404).json({ error: 'Watch not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove watch
app.delete('/api/watchlist/:poolId', (req, res) => {
  try {
    const { poolId } = req.params;
    const removed = watchlistService.removeWatch(poolId);
    res.json({ removed });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Calculate estimated return for a pool
app.post('/api/calculate-return', (req, res) => {
  try {
    const { poolId, investedAmount } = req.body;
    if (!poolId || !investedAmount) {
      return res.status(400).json({ error: 'poolId and investedAmount are required' });
    }
    
    const data = monitorService.getData();
    const pool = data.termmax?.pools?.find(p => p.optionId === poolId);
    
    if (!pool) {
      return res.status(404).json({ error: 'Pool not found' });
    }
    
    const estimate = watchlistService.calculateEstimatedReturn(pool, parseFloat(investedAmount));
    res.json({
      pool: {
        symbol: pool.symbol,
        underlyingSymbol: pool.underlyingSymbol,
        strikePrice: pool.strikePrice,
        currentPrice: pool.underlyingPrice,
        maturity: pool.maturity,
        totalApy: pool.totalApy,
      },
      estimate,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update investment amount for a watch
app.patch('/api/watchlist/:poolId/investment', (req, res) => {
  try {
    const { poolId } = req.params;
    const { investedAmount } = req.body;
    
    const data = monitorService.getData();
    const pool = data.termmax?.pools?.find(p => p.optionId === poolId);
    
    const watch = watchlistService.updateConditions(poolId, {
      investedAmount: parseFloat(investedAmount) || null,
      investedAt: Date.now(),
      investedPrice: pool?.underlyingPrice || null,
    });
    
    if (watch) {
      // Also calculate estimated return
      let estimate = null;
      if (pool && investedAmount) {
        estimate = watchlistService.calculateEstimatedReturn(pool, parseFloat(investedAmount));
      }
      res.json({ watch, estimate });
    } else {
      res.status(404).json({ error: 'Watch not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Periodic broadcast
setInterval(() => {
  if (wss.clients.size > 0) {
    broadcast({
      type: 'update',
      data: monitorService.getData(),
    });
  }
}, 10000); // Every 10 seconds

const termmaxService = require('./services/termmaxService');

// Helper function to format numbers
function formatNum(num) {
  if (!num) return '0';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toFixed(2);
}

// Initialize and start
async function init() {
  console.log('Initializing TermMax Monitor...');

  // Initialize Telegram bot
  telegramService.initialize();

  // Register Telegram command handlers
  telegramService.registerCommandHandler('status', async (msg) => {
    const status = monitorService.getStatus();
    const data = monitorService.getData();
    const summary = data.termmax?.summary;
    telegramService.bot.sendMessage(
      msg.chat.id,
      `*📊 Monitor Status*\n\n` +
        `🟢 Running: ${status.isRunning}\n` +
        `📈 Updates: ${status.stats.totalUpdates}\n` +
        `⏰ Last: ${status.lastUpdate ? new Date(status.lastUpdate).toLocaleTimeString() : 'Never'}\n\n` +
        `*TermMax Summary:*\n` +
        `💰 Total TVL: $${formatNum(summary?.totalTvl)}\n` +
        `📊 Avg APY: ${summary?.avgApy?.toFixed(1) || 0}%\n` +
        `🏊 Pools: ${summary?.poolCount || 0}`,
      { parse_mode: 'Markdown' }
    );
  });

  telegramService.registerCommandHandler('pools', async (msg) => {
    const data = monitorService.getData();
    const pools = data.termmax?.pools || [];
    
    let message = `*🏊 TermMax Dual Investment (USDT)*\n\n`;
    
    // Sort by distance to strike (closest first = highest risk)
    const sortedPools = [...pools].sort((a, b) => 
      Math.abs(a.priceToTarget || 0) - Math.abs(b.priceToTarget || 0)
    );
    
    sortedPools.slice(0, 8).forEach((pool, i) => {
      const priceToStrike = pool.priceToTarget?.toFixed(1) || '0';
      const risk = Math.abs(pool.priceToTarget) <= 5 ? '🔴' : 
                   Math.abs(pool.priceToTarget) <= 15 ? '🟡' : '🟢';
      message += `${risk} *${pool.underlyingSymbol}* @ $${pool.strikePrice || pool.targetPrice}\n` +
        `   Price: $${pool.underlyingPrice?.toFixed(4)} (${priceToStrike}%)\n` +
        `   TVL: $${formatNum(pool.tvl)} | APY: ${pool.totalApy?.toFixed(1)}%\n\n`;
    });
    
    if (pools.length > 8) {
      message += `_...and ${pools.length - 8} more_`;
    }
    
    telegramService.bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
  });

  telegramService.registerCommandHandler('prices', async (msg) => {
    const data = monitorService.getData();
    const pools = data.termmax?.pools || [];
    
    let message = '*💰 Token Prices (TermMax)*\n\n';
    
    const seen = new Set();
    pools.forEach((pool) => {
      if (!seen.has(pool.underlyingSymbol)) {
        seen.add(pool.underlyingSymbol);
        const change = pool.priceChange24h >= 0 ? `+${pool.priceChange24h?.toFixed(2)}` : pool.priceChange24h?.toFixed(2);
        message += `*${pool.underlyingSymbol}*: $${pool.underlyingPrice?.toFixed(4)} (${change}%)\n`;
      }
    });
    
    telegramService.bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
  });

  telegramService.registerCommandHandler('alerts', async (msg) => {
    const data = monitorService.getData();
    const alerts = data.alerts || [];
    
    if (alerts.length === 0) {
      telegramService.bot.sendMessage(msg.chat.id, '✅ No alerts yet');
      return;
    }
    
    let message = '*🚨 Recent Alerts*\n\n';
    alerts.slice(0, 10).forEach((alert) => {
      const time = new Date(alert.timestamp).toLocaleTimeString();
      message += `• *${alert.title}* (${time})\n`;
    });
    
    telegramService.bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
  });

  telegramService.registerCommandHandler('tvl', async (msg) => {
    const data = monitorService.getData();
    const summary = data.termmax?.summary;
    const tvl = await tvlService.fetchFromDefiLlama();
    
    let message = `*📊 TVL Information*\n\n` +
      `*TermMax (Live):*\n` +
      `💰 Total TVL: $${formatNum(summary?.totalTvl)}\n` +
      `📊 Capacity: $${formatNum(summary?.totalCapacity)}\n` +
      `📈 Avg Utilization: ${summary?.avgUtilization?.toFixed(1)}%\n\n` +
      `*DefiLlama:*\n` +
      `💰 TVL: $${formatNum(tvl?.totalTvl)}`;
    
    telegramService.bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
  });

  telegramService.registerCommandHandler('watchlist', async (msg) => {
    const watchlist = watchlistService.getAll();
    
    if (watchlist.length === 0) {
      telegramService.bot.sendMessage(
        msg.chat.id,
        '📋 *Watchlist Empty*\n\nAdd tokens via web UI to receive custom alerts.',
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    let message = `*📋 Your Watchlist (${watchlist.length})*\n\n`;
    
    watchlist.forEach((watch) => {
      const status = watch.enabled ? '🟢' : '⚪';
      message += `${status} *${watch.underlyingSymbol}* @ $${watch.strikePrice}\n`;
      
      const conditions = [];
      if (watch.conditions.apyBelow) conditions.push(`APY<${watch.conditions.apyBelow}%`);
      if (watch.conditions.apyAbove) conditions.push(`APY>${watch.conditions.apyAbove}%`);
      if (watch.conditions.priceToStrikeBelow) conditions.push(`Strike<${watch.conditions.priceToStrikeBelow}%`);
      if (watch.conditions.tvlBelow) conditions.push(`TVL<$${formatNum(watch.conditions.tvlBelow)}`);
      if (watch.conditions.utilizationAbove) conditions.push(`Util>${watch.conditions.utilizationAbove}%`);
      if (watch.conditions.notifyOnMaturity) conditions.push(`⏰Maturity`);
      
      if (conditions.length > 0) {
        message += `   _${conditions.join(', ')}_\n`;
      }
      message += '\n';
    });
    
    message += '_Manage via web UI_';
    
    telegramService.bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
  });

  // Calculate return command: /calc <token> <amount>
  telegramService.registerCommandHandler('calc', async (msg) => {
    const text = msg.text || '';
    const parts = text.split(/\s+/);
    
    if (parts.length < 3) {
      telegramService.bot.sendMessage(
        msg.chat.id,
        '*📊 Calculate Return*\n\n' +
          'Usage: `/calc <token> <usdt_amount>`\n\n' +
          'Example: `/calc B2 1000`\n' +
          'Example: `/calc ESPORTS 500`',
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    const tokenSymbol = parts[1].toUpperCase();
    const amount = parseFloat(parts[2]);
    
    if (isNaN(amount) || amount <= 0) {
      telegramService.bot.sendMessage(msg.chat.id, '❌ Invalid amount');
      return;
    }
    
    const data = monitorService.getData();
    const pools = data.termmax?.pools || [];
    const pool = pools.find(p => p.underlyingSymbol?.toUpperCase() === tokenSymbol);
    
    if (!pool) {
      telegramService.bot.sendMessage(
        msg.chat.id,
        `❌ Token *${tokenSymbol}* not found.\n\nAvailable: ${[...new Set(pools.map(p => p.underlyingSymbol))].join(', ')}`,
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    const estimate = watchlistService.calculateEstimatedReturn(pool, amount);
    
    if (!estimate) {
      telegramService.bot.sendMessage(msg.chat.id, '❌ Unable to calculate return');
      return;
    }
    
    let message = `*📊 Return Estimate: ${pool.underlyingSymbol}*\n\n` +
      `💰 Investment: ${amount} USDT\n` +
      `📈 APY: ${estimate.apy?.toFixed(1)}%\n` +
      `⏳ Days to Maturity: ${estimate.daysToMaturity}\n` +
      `📅 Maturity: ${estimate.maturityDate}\n\n` +
      `*Scenario 1: Price > Strike*\n` +
      `✅ Return: ${estimate.returnIfNotConverted?.toFixed(2)} USDT\n` +
      `💵 Profit: +${estimate.profitIfNotConverted?.toFixed(2)} USDT (${estimate.profitPercentIfNotConverted?.toFixed(2)}%)\n\n` +
      `*Scenario 2: Price ≤ Strike ($${estimate.strikePrice})*\n` +
      `🔄 Convert to: ${estimate.tokenAmountIfConverted?.toFixed(4)} ${pool.underlyingSymbol}\n` +
      `💱 Break-even: $${estimate.breakEvenPrice?.toFixed(4)}\n\n` +
      `_Current: $${estimate.currentPrice?.toFixed(4)} | Strike: $${estimate.strikePrice}_`;
    
    telegramService.bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
  });

  // Investment tracking command: /invest <token> <amount>
  telegramService.registerCommandHandler('invest', async (msg) => {
    const text = msg.text || '';
    const parts = text.split(/\s+/);
    
    if (parts.length < 3) {
      telegramService.bot.sendMessage(
        msg.chat.id,
        '*💼 Track Investment*\n\n' +
          'Usage: `/invest <token> <usdt_amount>`\n\n' +
          'Example: `/invest B2 1000`\n\n' +
          'This will:\n' +
          '1. Add to watchlist if not exists\n' +
          '2. Track your investment amount\n' +
          '3. Notify actual returns at maturity',
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    const tokenSymbol = parts[1].toUpperCase();
    const amount = parseFloat(parts[2]);
    
    if (isNaN(amount) || amount <= 0) {
      telegramService.bot.sendMessage(msg.chat.id, '❌ Invalid amount');
      return;
    }
    
    const data = monitorService.getData();
    const pools = data.termmax?.pools || [];
    const pool = pools.find(p => p.underlyingSymbol?.toUpperCase() === tokenSymbol);
    
    if (!pool) {
      telegramService.bot.sendMessage(
        msg.chat.id,
        `❌ Token *${tokenSymbol}* not found.`,
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    // Add or update watch with investment amount
    let watch = watchlistService.getWatch(pool.optionId);
    if (!watch) {
      watch = watchlistService.addWatch(pool.optionId, {
        symbol: pool.symbol,
        underlyingSymbol: pool.underlyingSymbol,
        strikePrice: pool.strikePrice,
        notifyOnMaturity: true,
        investedAmount: amount,
        investedAt: Date.now(),
        investedPrice: pool.underlyingPrice,
      });
    } else {
      watch = watchlistService.updateConditions(pool.optionId, {
        investedAmount: amount,
        investedAt: Date.now(),
        investedPrice: pool.underlyingPrice,
        notifyOnMaturity: true,
      });
    }
    
    const estimate = watchlistService.calculateEstimatedReturn(pool, amount);
    
    let message = `*✅ Investment Tracked*\n\n` +
      `Token: *${pool.underlyingSymbol}*\n` +
      `Amount: ${amount} USDT\n` +
      `Strike: $${pool.strikePrice}\n` +
      `Entry Price: $${pool.underlyingPrice?.toFixed(4)}\n` +
      `Maturity: ${estimate?.maturityDate}\n\n` +
      `*Expected Return (if no conversion):*\n` +
      `${estimate?.returnIfNotConverted?.toFixed(2)} USDT (+${estimate?.profitPercentIfNotConverted?.toFixed(2)}%)\n\n` +
      `_You will be notified at maturity with actual results._`;
    
    telegramService.bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
  });

  // Daily report command: /report
  telegramService.registerCommandHandler('report', async (msg) => {
    const data = monitorService.getData();
    const pools = data.termmax?.pools || [];
    const watchlist = watchlistService.getAll();
    
    // Get all watched pools with investments
    const investedWatches = watchlist.filter(w => w.enabled && w.conditions.investedAmount > 0);
    
    if (investedWatches.length === 0) {
      telegramService.bot.sendMessage(
        msg.chat.id,
        '📊 *No Investments Tracked*\n\nUse `/invest <token> <amount>` to track investments.',
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    let totalInvested = 0;
    let totalDailyProfit = 0;
    let message = `📊 *Investment Report*\n\n`;
    
    for (const watch of investedWatches) {
      const pool = pools.find(p => p.optionId === watch.poolId);
      if (!pool) continue;
      
      const amount = watch.conditions.investedAmount;
      const apy = pool.totalApy || 0;
      const dailyRate = apy / 365 / 100;
      const dailyProfit = amount * dailyRate;
      
      totalInvested += amount;
      totalDailyProfit += dailyProfit;
      
      const riskIcon = Math.abs(pool.priceToTarget) <= 5 ? '🔴' : 
                       Math.abs(pool.priceToTarget) <= 15 ? '🟡' : '🟢';
      
      message += `${riskIcon} *${pool.underlyingSymbol}*\n`;
      message += `   💰 ${amount} USDT @ ${apy.toFixed(1)}% APY\n`;
      message += `   📈 Daily: +${dailyProfit.toFixed(4)} USDT\n`;
      message += `   💱 Strike: $${pool.strikePrice} (${pool.priceToTarget?.toFixed(1)}%)\n\n`;
    }
    
    message += `*📊 Summary*\n`;
    message += `Total: ${totalInvested.toFixed(2)} USDT\n`;
    message += `Daily: +${totalDailyProfit.toFixed(4)} USDT\n`;
    message += `Rate: ${((totalDailyProfit / totalInvested) * 100).toFixed(3)}%/day`;
    
    telegramService.bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
  });

  // Start monitor
  await monitorService.start();

  // Start server
  server.listen(config.server.port, () => {
    console.log(`Server running on http://localhost:${config.server.port}`);
    console.log(`WebSocket running on ws://localhost:${config.server.port}`);
  });
}

init().catch(console.error);
