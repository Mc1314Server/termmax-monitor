const fs = require('fs');
const path = require('path');
const telegramService = require('./telegramService');

const DATA_FILE = path.join(__dirname, '../../data/watchlist.json');

class WatchlistService {
  constructor() {
    this.watchlist = new Map(); // poolId -> WatchRule
    this.lastTriggered = new Map(); // ruleKey -> timestamp (cooldown)
    this.lastDailyReport = null; // Last daily report timestamp
    this.priceHistory = new Map(); // poolId -> { date: price }
    this.loadFromFile();
  }

  // Ensure data directory exists
  ensureDataDir() {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Load watchlist from file
  loadFromFile() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        this.watchlist = new Map(Object.entries(data));
        console.log(`Loaded ${this.watchlist.size} watch rules`);
      }
    } catch (error) {
      console.error('Error loading watchlist:', error.message);
    }
  }

  // Save watchlist to file
  saveToFile() {
    try {
      this.ensureDataDir();
      const data = Object.fromEntries(this.watchlist);
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error saving watchlist:', error.message);
    }
  }

  // Add or update watch rule
  addWatch(poolId, rule) {
    const watchRule = {
      poolId,
      symbol: rule.symbol,
      underlyingSymbol: rule.underlyingSymbol,
      strikePrice: rule.strikePrice,
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      // Alert conditions
      conditions: {
        // APY alerts
        apyBelow: rule.apyBelow || null, // Alert when APY drops below this %
        apyAbove: rule.apyAbove || null, // Alert when APY rises above this %
        // Price to strike alerts
        priceToStrikeBelow: rule.priceToStrikeBelow || null, // Alert when distance to strike < this %
        priceToStrikeAbove: rule.priceToStrikeAbove || null, // Alert when distance to strike > this %
        // TVL alerts
        tvlBelow: rule.tvlBelow || null, // Alert when TVL drops below this $
        tvlDropPercent: rule.tvlDropPercent || null, // Alert when TVL drops by this % in 1h
        // Utilization alerts
        utilizationAbove: rule.utilizationAbove || null, // Alert when utilization > this %
        // Maturity alerts
        notifyOnMaturity: rule.notifyOnMaturity || false, // Alert when pool matures
        maturityNotified: false, // Track if maturity notification was sent
        // Investment tracking
        investedAmount: rule.investedAmount || null, // USDT amount invested
        investedAt: rule.investedAt || null, // Timestamp when investment was made
        investedPrice: rule.investedPrice || null, // Underlying price at investment time
      },
      // Cooldown in minutes (prevent spam)
      cooldownMinutes: rule.cooldownMinutes || 30,
    };

    this.watchlist.set(poolId, watchRule);
    this.saveToFile();
    return watchRule;
  }

  // Remove watch
  removeWatch(poolId) {
    const existed = this.watchlist.has(poolId);
    this.watchlist.delete(poolId);
    this.saveToFile();
    return existed;
  }

  // Toggle watch enabled/disabled
  toggleWatch(poolId, enabled) {
    const rule = this.watchlist.get(poolId);
    if (rule) {
      rule.enabled = enabled;
      rule.updatedAt = Date.now();
      this.saveToFile();
    }
    return rule;
  }

  // Update watch conditions
  updateConditions(poolId, conditions) {
    const rule = this.watchlist.get(poolId);
    if (rule) {
      rule.conditions = { ...rule.conditions, ...conditions };
      rule.updatedAt = Date.now();
      this.saveToFile();
    }
    return rule;
  }

  // Get all watches
  getAll() {
    return Array.from(this.watchlist.values());
  }

  // Get watch by poolId
  getWatch(poolId) {
    return this.watchlist.get(poolId);
  }

  // Check if pool is being watched
  isWatching(poolId) {
    return this.watchlist.has(poolId);
  }

  // Check cooldown
  isInCooldown(ruleKey, cooldownMinutes) {
    const lastTime = this.lastTriggered.get(ruleKey);
    if (!lastTime) return false;
    return Date.now() - lastTime < cooldownMinutes * 60 * 1000;
  }

  // Set cooldown
  setCooldown(ruleKey) {
    this.lastTriggered.set(ruleKey);
  }

  // Calculate estimated return at maturity
  calculateEstimatedReturn(pool, investedAmount) {
    if (!pool || !investedAmount || investedAmount <= 0) {
      return null;
    }

    const currentPrice = pool.underlyingPrice || 0;
    const strikePrice = pool.strikePrice || 0;
    const apy = pool.totalApy || 0;
    const maturityDate = new Date(pool.maturity);
    const now = new Date();
    
    // Calculate days until maturity
    const daysToMaturity = Math.max(0, (maturityDate - now) / (1000 * 60 * 60 * 24));
    
    // Calculate expected interest (prorated APY)
    const interestRate = (apy / 100) * (daysToMaturity / 365);
    const expectedInterest = investedAmount * interestRate;
    
    // If price stays above strike: return USDT + interest
    const returnIfNotConverted = investedAmount + expectedInterest;
    
    // If price drops to strike: convert to token
    const tokenAmount = strikePrice > 0 ? investedAmount / strikePrice : 0;
    const tokenValueAtStrike = tokenAmount * strikePrice;
    
    return {
      investedAmount,
      currentPrice,
      strikePrice,
      apy,
      daysToMaturity: Math.round(daysToMaturity),
      maturityDate: maturityDate.toLocaleDateString(),
      // Scenario 1: Price stays above strike
      returnIfNotConverted,
      profitIfNotConverted: expectedInterest,
      profitPercentIfNotConverted: interestRate * 100,
      // Scenario 2: Price drops to/below strike
      tokenAmountIfConverted: tokenAmount,
      tokenValueAtStrike,
      // Break-even price (where converted tokens equal original investment)
      breakEvenPrice: tokenAmount > 0 ? investedAmount / tokenAmount : 0,
    };
  }

  // Calculate actual return at maturity
  calculateMaturityReturn(pool, investedAmount, investedPrice) {
    const currentPrice = pool.underlyingPrice || 0;
    const strikePrice = pool.strikePrice || 0;
    const apy = pool.totalApy || 0;
    
    // Assume investment was for full period, calculate approximate interest
    const interestRate = apy / 100 * (30 / 365); // Estimate 30 days
    
    // Check if converted (price at or below strike)
    const isConverted = currentPrice <= strikePrice;
    
    if (isConverted) {
      // Converted to underlying token
      const tokenAmount = strikePrice > 0 ? investedAmount / strikePrice : 0;
      const tokenValueUsd = tokenAmount * currentPrice;
      const loss = investedAmount - tokenValueUsd;
      const netReturnPercent = ((tokenValueUsd - investedAmount) / investedAmount) * 100;
      
      return {
        isConverted: true,
        tokenAmount,
        tokenValueUsd,
        loss,
        netReturnPercent,
        finalPrice: currentPrice,
        strikePrice,
      };
    } else {
      // Return USDT with interest
      const interest = investedAmount * interestRate;
      const returnAmount = investedAmount + interest;
      
      return {
        isConverted: false,
        returnAmount,
        profit: interest,
        profitPercent: interestRate * 100,
        finalPrice: currentPrice,
        strikePrice,
      };
    }
  }

  // Get estimated return for a pool
  getEstimatedReturn(poolId, investedAmount) {
    const rule = this.watchlist.get(poolId);
    return {
      poolId,
      investedAmount,
      rule,
    };
  }

  // Record price for daily tracking
  recordPriceHistory(pools) {
    const today = new Date().toISOString().split('T')[0];
    for (const pool of pools) {
      if (!this.priceHistory.has(pool.optionId)) {
        this.priceHistory.set(pool.optionId, {});
      }
      const history = this.priceHistory.get(pool.optionId);
      history[today] = {
        price: pool.underlyingPrice,
        apy: pool.totalApy,
        timestamp: Date.now(),
      };
      // Keep only last 30 days
      const dates = Object.keys(history).sort();
      if (dates.length > 30) {
        delete history[dates[0]];
      }
    }
  }

  // Calculate daily profit for a watched pool
  calculateDailyProfit(pool, investedAmount) {
    if (!pool || !investedAmount || investedAmount <= 0) return null;
    
    const apy = pool.totalApy || 0;
    const dailyRate = apy / 365 / 100;
    const dailyProfit = investedAmount * dailyRate;
    
    // Get yesterday's price if available
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const history = this.priceHistory.get(pool.optionId);
    const yesterdayData = history?.[yesterday];
    
    let priceChange = 0;
    let priceChangePercent = 0;
    if (yesterdayData) {
      priceChange = pool.underlyingPrice - yesterdayData.price;
      priceChangePercent = (priceChange / yesterdayData.price) * 100;
    }
    
    return {
      investedAmount,
      dailyProfit,
      dailyProfitPercent: dailyRate * 100,
      apy,
      currentPrice: pool.underlyingPrice,
      priceChange,
      priceChangePercent,
      strikePrice: pool.strikePrice,
      priceToStrike: pool.priceToTarget,
    };
  }

  // Generate and send daily profit report
  async sendDailyProfitReport(pools) {
    const now = new Date();
    const currentHour = now.getHours();
    const today = now.toISOString().split('T')[0];
    
    // Only send report once per day at 8:00 AM
    if (currentHour !== 8 || this.lastDailyReport === today) {
      return;
    }
    
    // Record current prices
    this.recordPriceHistory(pools);
    
    // Get all watched pools with investments
    const investedWatches = [];
    for (const [poolId, rule] of this.watchlist) {
      if (rule.enabled && rule.conditions.investedAmount > 0) {
        const pool = pools.find(p => p.optionId === poolId);
        if (pool) {
          const profit = this.calculateDailyProfit(pool, rule.conditions.investedAmount);
          if (profit) {
            investedWatches.push({
              rule,
              pool,
              profit,
            });
          }
        }
      }
    }
    
    if (investedWatches.length === 0) {
      return;
    }
    
    // Calculate totals
    let totalInvested = 0;
    let totalDailyProfit = 0;
    
    let message = `📊 *Daily Profit Report*\n`;
    message += `📅 ${now.toLocaleDateString()}\n\n`;
    
    for (const { rule, pool, profit } of investedWatches) {
      totalInvested += profit.investedAmount;
      totalDailyProfit += profit.dailyProfit;
      
      const riskIcon = Math.abs(profit.priceToStrike) <= 5 ? '🔴' : 
                       Math.abs(profit.priceToStrike) <= 15 ? '🟡' : '🟢';
      
      message += `${riskIcon} *${pool.underlyingSymbol}*\n`;
      message += `   Invested: ${profit.investedAmount} USDT\n`;
      message += `   Daily: +${profit.dailyProfit.toFixed(4)} USDT (${profit.dailyProfitPercent.toFixed(3)}%)\n`;
      message += `   Price: $${profit.currentPrice?.toFixed(4)}`;
      if (profit.priceChange !== 0) {
        message += ` (${profit.priceChange >= 0 ? '+' : ''}${profit.priceChangePercent.toFixed(2)}%)`;
      }
      message += `\n`;
      message += `   Strike: $${profit.strikePrice} (${profit.priceToStrike?.toFixed(1)}%)\n\n`;
    }
    
    message += `*📈 Summary*\n`;
    message += `Total Invested: ${totalInvested.toFixed(2)} USDT\n`;
    message += `Daily Profit: +${totalDailyProfit.toFixed(4)} USDT\n`;
    message += `Avg Daily: ${((totalDailyProfit / totalInvested) * 100).toFixed(3)}%`;
    
    await telegramService.sendAlert(message, 'info');
    this.lastDailyReport = today;
    
    return {
      totalInvested,
      totalDailyProfit,
      watches: investedWatches.length,
    };
  }

  // Check all rules against current pool data
  async checkRules(pools) {
    const triggeredAlerts = [];

    for (const pool of pools) {
      const rule = this.watchlist.get(pool.optionId);
      if (!rule || !rule.enabled) continue;

      const conditions = rule.conditions;
      const cooldown = rule.cooldownMinutes;

      // Check APY below
      if (conditions.apyBelow !== null && pool.totalApy < conditions.apyBelow) {
        const ruleKey = `${pool.optionId}_apy_below`;
        if (!this.isInCooldown(ruleKey, cooldown)) {
          const alert = {
            type: 'apy_below',
            pool,
            rule,
            message: `📉 *APY Alert*\n\n` +
              `*${pool.underlyingSymbol}* APY dropped!\n` +
              `Current: ${pool.totalApy?.toFixed(1)}%\n` +
              `Threshold: < ${conditions.apyBelow}%\n` +
              `Strike: $${pool.strikePrice}`,
          };
          triggeredAlerts.push(alert);
          this.lastTriggered.set(ruleKey, Date.now());
        }
      }

      // Check APY above
      if (conditions.apyAbove !== null && pool.totalApy > conditions.apyAbove) {
        const ruleKey = `${pool.optionId}_apy_above`;
        if (!this.isInCooldown(ruleKey, cooldown)) {
          const alert = {
            type: 'apy_above',
            pool,
            rule,
            message: `📈 *APY Alert*\n\n` +
              `*${pool.underlyingSymbol}* APY spiked!\n` +
              `Current: ${pool.totalApy?.toFixed(1)}%\n` +
              `Threshold: > ${conditions.apyAbove}%\n` +
              `Strike: $${pool.strikePrice}`,
          };
          triggeredAlerts.push(alert);
          this.lastTriggered.set(ruleKey, Date.now());
        }
      }

      // Check price to strike below (DANGER - close to strike)
      const priceToStrike = Math.abs(pool.priceToTarget);
      if (conditions.priceToStrikeBelow !== null && priceToStrike < conditions.priceToStrikeBelow) {
        const ruleKey = `${pool.optionId}_strike_below`;
        if (!this.isInCooldown(ruleKey, cooldown)) {
          const alert = {
            type: 'strike_danger',
            pool,
            rule,
            message: `🚨 *Strike Price Alert*\n\n` +
              `*${pool.underlyingSymbol}* approaching strike!\n` +
              `Current: $${pool.underlyingPrice?.toFixed(4)}\n` +
              `Strike: $${pool.strikePrice}\n` +
              `Distance: ${pool.priceToTarget?.toFixed(1)}%\n` +
              `Threshold: < ${conditions.priceToStrikeBelow}%`,
          };
          triggeredAlerts.push(alert);
          this.lastTriggered.set(ruleKey, Date.now());
        }
      }

      // Check TVL below
      if (conditions.tvlBelow !== null && pool.tvl < conditions.tvlBelow) {
        const ruleKey = `${pool.optionId}_tvl_below`;
        if (!this.isInCooldown(ruleKey, cooldown)) {
          const alert = {
            type: 'tvl_low',
            pool,
            rule,
            message: `💰 *TVL Alert*\n\n` +
              `*${pool.underlyingSymbol}* TVL is low!\n` +
              `Current: $${pool.tvl?.toFixed(0)}\n` +
              `Threshold: < $${conditions.tvlBelow}`,
          };
          triggeredAlerts.push(alert);
          this.lastTriggered.set(ruleKey, Date.now());
        }
      }

      // Check utilization above
      if (conditions.utilizationAbove !== null && pool.utilization > conditions.utilizationAbove) {
        const ruleKey = `${pool.optionId}_util_above`;
        if (!this.isInCooldown(ruleKey, cooldown)) {
          const alert = {
            type: 'utilization_high',
            pool,
            rule,
            message: `📊 *Utilization Alert*\n\n` +
              `*${pool.underlyingSymbol}* high utilization!\n` +
              `Current: ${pool.utilization?.toFixed(1)}%\n` +
              `Threshold: > ${conditions.utilizationAbove}%`,
          };
          triggeredAlerts.push(alert);
          this.lastTriggered.set(ruleKey, Date.now());
        }
      }

      // Check maturity notification
      if (conditions.notifyOnMaturity && !conditions.maturityNotified && pool.maturity) {
        const maturityDate = new Date(pool.maturity);
        const now = new Date();
        if (now >= maturityDate) {
          // Calculate actual returns if investment was tracked
          let profitInfo = '';
          if (conditions.investedAmount && conditions.investedAmount > 0) {
            const result = this.calculateMaturityReturn(pool, conditions.investedAmount, conditions.investedPrice);
            profitInfo = `\n\n*💰 Investment Result:*\n` +
              `Invested: ${conditions.investedAmount} USDT\n` +
              `${result.isConverted ? 
                `Converted to: ${result.tokenAmount.toFixed(4)} ${pool.underlyingSymbol}\n` +
                `Token Value: $${result.tokenValueUsd.toFixed(2)}\n` +
                `Net Return: ${result.netReturnPercent >= 0 ? '+' : ''}${result.netReturnPercent.toFixed(2)}%` :
                `Returned: ${result.returnAmount.toFixed(2)} USDT\n` +
                `Profit: +${result.profit.toFixed(2)} USDT (${result.profitPercent.toFixed(2)}%)`
              }`;
          }
          
          const alert = {
            type: 'maturity',
            pool,
            rule,
            message: `⏰ *Maturity Alert*\n\n` +
              `*${pool.underlyingSymbol}* has matured!\n` +
              `Strike: $${pool.strikePrice}\n` +
              `Final Price: $${pool.underlyingPrice?.toFixed(4)}\n` +
              `Maturity: ${maturityDate.toLocaleDateString()}` +
              profitInfo,
          };
          triggeredAlerts.push(alert);
          // Mark as notified to prevent repeated alerts
          rule.conditions.maturityNotified = true;
          this.saveToFile();
        }
      }
    }

    // Send alerts via Telegram
    for (const alert of triggeredAlerts) {
      await telegramService.sendAlert(alert.message, alert.type);
    }

    return triggeredAlerts;
  }
}

module.exports = new WatchlistService();
