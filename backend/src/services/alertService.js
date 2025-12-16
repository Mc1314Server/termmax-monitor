const config = require('../config');
const telegramService = require('./telegramService');

class AlertService {
  constructor() {
    this.alerts = [];
    this.alertRules = [
      {
        id: 'tvl_drop',
        name: 'TVL Drop Alert',
        enabled: true,
        threshold: config.monitor.tvlChangeThreshold,
        type: 'tvl',
        condition: 'decrease',
      },
      {
        id: 'tvl_surge',
        name: 'TVL Surge Alert',
        enabled: true,
        threshold: config.monitor.tvlChangeThreshold,
        type: 'tvl',
        condition: 'increase',
      },
      {
        id: 'price_change',
        name: 'Price Change Alert',
        enabled: true,
        threshold: config.monitor.priceAlertThreshold,
        type: 'price',
        condition: 'change',
      },
      {
        id: 'apy_change',
        name: 'APY Change Alert',
        enabled: true,
        threshold: 10, // 10% APY change
        type: 'apy',
        condition: 'change',
      },
    ];
    this.lastAlerts = new Map(); // Prevent spam
  }

  async checkTvlAlert(tvlChange) {
    if (!tvlChange) return;

    const absChange = Math.abs(tvlChange.changePercent);

    // Check TVL drop
    if (
      tvlChange.changePercent < 0 &&
      absChange >= config.monitor.tvlChangeThreshold
    ) {
      const alertKey = `tvl_drop_${Math.floor(Date.now() / 300000)}`; // 5 min cooldown
      if (!this.lastAlerts.has(alertKey)) {
        await telegramService.sendTvlAlert(tvlChange);
        this.addAlert('danger', 'TVL Drop', tvlChange);
        this.lastAlerts.set(alertKey, Date.now());
      }
    }

    // Check TVL surge
    if (
      tvlChange.changePercent > 0 &&
      absChange >= config.monitor.tvlChangeThreshold
    ) {
      const alertKey = `tvl_surge_${Math.floor(Date.now() / 300000)}`;
      if (!this.lastAlerts.has(alertKey)) {
        await telegramService.sendTvlAlert(tvlChange);
        this.addAlert('warning', 'TVL Surge', tvlChange);
        this.lastAlerts.set(alertKey, Date.now());
      }
    }
  }

  async checkPriceAlert(symbol, priceChange) {
    if (!priceChange) return;

    const absChange = Math.abs(priceChange.changePercent);

    if (absChange >= config.monitor.priceAlertThreshold) {
      const alertKey = `price_${symbol}_${Math.floor(Date.now() / 300000)}`;
      if (!this.lastAlerts.has(alertKey)) {
        await telegramService.sendPriceAlert({
          symbol,
          ...priceChange,
        });
        this.addAlert('price', `${symbol} Price Change`, priceChange);
        this.lastAlerts.set(alertKey, Date.now());
      }
    }
  }

  async checkPoolAlert(poolChange) {
    if (!poolChange) return;

    const tvlChange = Math.abs(poolChange.tvlChangePercent);
    const apyChange = Math.abs(poolChange.apyChange);

    // Check for significant TVL change in pool
    if (tvlChange >= config.monitor.tvlChangeThreshold) {
      const alertKey = `pool_tvl_${poolChange.poolId}_${Math.floor(Date.now() / 300000)}`;
      if (!this.lastAlerts.has(alertKey)) {
        await telegramService.sendPoolAlert(poolChange);
        this.addAlert('pool', `Pool ${poolChange.poolId} TVL Change`, poolChange);
        this.lastAlerts.set(alertKey, Date.now());
      }
    }

    // Check for significant APY change
    if (apyChange >= 10) {
      const alertKey = `pool_apy_${poolChange.poolId}_${Math.floor(Date.now() / 300000)}`;
      if (!this.lastAlerts.has(alertKey)) {
        await telegramService.sendPoolAlert(poolChange);
        this.addAlert('apy', `Pool ${poolChange.poolId} APY Change`, poolChange);
        this.lastAlerts.set(alertKey, Date.now());
      }
    }
  }

  addAlert(type, title, data) {
    const alert = {
      id: Date.now(),
      type,
      title,
      data,
      timestamp: new Date().toISOString(),
    };

    this.alerts.unshift(alert);

    // Keep last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts.pop();
    }

    console.log(`Alert: ${title}`, data);
  }

  getAlerts(limit = 50) {
    return this.alerts.slice(0, limit);
  }

  getRules() {
    return this.alertRules;
  }

  updateRule(ruleId, updates) {
    const rule = this.alertRules.find((r) => r.id === ruleId);
    if (rule) {
      Object.assign(rule, updates);
    }
    return rule;
  }

  // Clean up old alert cooldowns
  cleanup() {
    const now = Date.now();
    for (const [key, timestamp] of this.lastAlerts.entries()) {
      if (now - timestamp > 600000) {
        // 10 minutes
        this.lastAlerts.delete(key);
      }
    }
  }
}

module.exports = new AlertService();
