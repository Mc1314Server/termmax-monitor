const priceService = require('./priceService');
const tvlService = require('./tvlService');
const termmaxService = require('./termmaxService');
const alertService = require('./alertService');
const watchlistService = require('./watchlistService');
const poolDetectionService = require('./poolDetectionService');
const config = require('../config');

class MonitorService {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.lastUpdate = null;
    this.stats = {
      totalUpdates: 0,
      totalAlerts: 0,
      startTime: null,
    };
  }

  async start() {
    if (this.isRunning) {
      console.log('Monitor already running');
      return;
    }

    console.log('Starting monitor service...');
    this.isRunning = true;
    this.stats.startTime = Date.now();

    // Initial fetch
    await this.update();

    // Start periodic updates
    this.intervalId = setInterval(async () => {
      await this.update();
    }, config.monitor.interval);

    console.log(`Monitor started. Interval: ${config.monitor.interval}ms`);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('Monitor stopped');
  }

  async update() {
    try {
      console.log(`[${new Date().toISOString()}] Running update...`);

      // Fetch TermMax Alpha pools (Primary data source)
      const termMaxPools = await termmaxService.fetchAlphaPools(56);
      console.log('TermMax pools updated:', termMaxPools.length);

      // Check for new pools and send TG notification
      const newPools = await poolDetectionService.checkNewPools(termMaxPools);
      if (newPools.length > 0) {
        console.log(`Detected ${newPools.length} new pool(s)`);
      }

      // Update price cache from pool data
      priceService.updateFromPools(termMaxPools);
      const prices = await priceService.getAllPrices();
      console.log('Prices updated:', Object.keys(prices).join(', '));

      // Fetch TVL from DefiLlama (secondary)
      const tvl = await tvlService.fetchFromDefiLlama();
      console.log('DefiLlama TVL:', tvl?.totalTvl);

      // Check alerts
      await this.checkAlerts();

      // Check watchlist rules
      const watchAlerts = await watchlistService.checkRules(termMaxPools);
      if (watchAlerts.length > 0) {
        console.log(`Triggered ${watchAlerts.length} watchlist alerts`);
      }

      // Check daily profit report (sends once per day at 8:00 AM)
      const dailyReport = await watchlistService.sendDailyProfitReport(termMaxPools);
      if (dailyReport) {
        console.log(`Daily report sent: ${dailyReport.watches} investments, +${dailyReport.totalDailyProfit.toFixed(4)} USDT`);
      }

      this.lastUpdate = Date.now();
      this.stats.totalUpdates++;

      // Cleanup old alert cooldowns
      alertService.cleanup();
    } catch (error) {
      console.error('Update error:', error.message);
    }
  }

  async checkAlerts() {
    // Check TermMax pool changes
    const termMaxData = termmaxService.getCache();
    for (const pool of termMaxData.pools) {
      const poolChange = termmaxService.getPoolChange(pool.optionId, 60);
      if (poolChange) {
        // Check TVL change
        if (Math.abs(poolChange.tvlChangePercent) >= config.monitor.tvlChangeThreshold) {
          await alertService.checkPoolAlert({
            poolId: pool.optionId,
            symbol: pool.symbol,
            currentTvl: poolChange.current.tvl,
            oldTvl: poolChange.old.tvl,
            tvlChangePercent: poolChange.tvlChangePercent,
            currentApy: poolChange.current.longApy,
            oldApy: poolChange.old.longApy,
            apyChange: poolChange.apyChange,
            period: poolChange.period,
          });
        }

        // Check price approaching target
        if (pool.targetPrice > 0) {
          const priceToTarget = Math.abs(pool.priceToTarget);
          if (priceToTarget <= 5) {
            // Within 5% of target
            await alertService.checkPriceAlert(pool.underlyingSymbol, {
              currentPrice: pool.underlyingPrice,
              targetPrice: pool.targetPrice,
              priceToTarget: pool.priceToTarget,
              changePercent: poolChange.priceChangePercent,
              period: poolChange.period,
              symbol: pool.symbol,
              isNearTarget: true,
            });
          }
        }

        // Check utilization spike
        if (poolChange.utilizationChange > 20) {
          await alertService.addAlert('warning', `${pool.symbol} Utilization Spike`, {
            symbol: pool.symbol,
            currentUtilization: poolChange.current.utilization,
            oldUtilization: poolChange.old.utilization,
            change: poolChange.utilizationChange,
          });
        }
      }
    }

    // Check general TVL change from DefiLlama
    const tvlChange = tvlService.getTvlChange(60);
    if (tvlChange && Math.abs(tvlChange.changePercent) >= config.monitor.tvlChangeThreshold) {
      await alertService.checkTvlAlert(tvlChange);
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      lastUpdate: this.lastUpdate,
      stats: this.stats,
      uptime: this.stats.startTime
        ? Date.now() - this.stats.startTime
        : 0,
    };
  }

  getData() {
    const termMaxData = termmaxService.getCache();
    const summary = termmaxService.getSummary();
    const watchlist = watchlistService.getAll();

    // Mark pools that are being watched
    const poolsWithWatchStatus = termMaxData.pools.map(pool => ({
      ...pool,
      isWatching: watchlistService.isWatching(pool.optionId),
      watchRule: watchlistService.getWatch(pool.optionId),
    }));

    return {
      termmax: {
        pools: poolsWithWatchStatus,
        summary,
        lastUpdate: termMaxData.lastUpdate,
      },
      watchlist,
      prices: priceService.getCache(),
      tvl: tvlService.getCache(),
      alerts: alertService.getAlerts(20),
      status: this.getStatus(),
    };
  }
}

// Export watchlistService for API routes
module.exports.watchlistService = watchlistService;

module.exports = new MonitorService();
