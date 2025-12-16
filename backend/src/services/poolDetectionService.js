const fs = require('fs');
const path = require('path');
const telegramService = require('./telegramService');

const DATA_FILE = path.join(__dirname, '../../data/known_pools.json');

class PoolDetectionService {
  constructor() {
    this.knownPools = new Set();
    this.loadKnownPools();
  }

  loadKnownPools() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        this.knownPools = new Set(data.poolIds || []);
        console.log(`Loaded ${this.knownPools.size} known pools`);
      }
    } catch (error) {
      console.error('Error loading known pools:', error.message);
      this.knownPools = new Set();
    }
  }

  saveKnownPools() {
    try {
      const dir = path.dirname(DATA_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(
        DATA_FILE,
        JSON.stringify({ poolIds: [...this.knownPools], lastUpdate: Date.now() }, null, 2)
      );
    } catch (error) {
      console.error('Error saving known pools:', error.message);
    }
  }

  async checkNewPools(pools) {
    if (!pools || pools.length === 0) return [];

    const newPools = [];

    for (const pool of pools) {
      const poolId = pool.optionId;
      if (!poolId) continue;

      if (!this.knownPools.has(poolId)) {
        newPools.push(pool);
        this.knownPools.add(poolId);
      }
    }

    if (newPools.length > 0) {
      this.saveKnownPools();
      await this.notifyNewPools(newPools);
    }

    return newPools;
  }

  async notifyNewPools(newPools) {
    for (const pool of newPools) {
      const message = this.formatNewPoolMessage(pool);
      await telegramService.sendAlert(message, 'success');
      console.log(`New pool detected and notified: ${pool.underlyingSymbol} @ $${pool.strikePrice || pool.targetPrice}`);
    }
  }

  formatNewPoolMessage(pool) {
    const strikePrice = pool.strikePrice || pool.targetPrice || 0;
    const maturityDate = pool.maturity ? new Date(pool.maturity).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }) : 'Unknown';

    const priceDistance = pool.priceToTarget?.toFixed(1) || '0';
    const riskIcon = Math.abs(pool.priceToTarget) <= 5 ? '🔴' : 
                     Math.abs(pool.priceToTarget) <= 15 ? '🟡' : '🟢';

    return `*🆕 New Pool Launched!*\n\n` +
      `${riskIcon} *${pool.underlyingSymbol}/USDT*\n` +
      `📍 Strike: $${strikePrice}\n` +
      `💰 Current: $${pool.underlyingPrice?.toFixed(4) || '0'} (${priceDistance}%)\n` +
      `📈 APY: ${pool.totalApy?.toFixed(1) || '0'}%\n` +
      `📊 TVL: $${this.formatNumber(pool.tvl || 0)}\n` +
      `📅 Maturity: ${maturityDate}\n` +
      `🏷️ Symbol: ${pool.symbol || 'N/A'}`;
  }

  formatNumber(num) {
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num?.toFixed(2) || '0';
  }

  getKnownPoolsCount() {
    return this.knownPools.size;
  }

  isKnownPool(poolId) {
    return this.knownPools.has(poolId);
  }

  clearKnownPools() {
    this.knownPools.clear();
    this.saveKnownPools();
  }
}

module.exports = new PoolDetectionService();
