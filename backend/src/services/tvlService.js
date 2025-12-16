const axios = require('axios');
const { ethers } = require('ethers');
const config = require('../config');

class TVLService {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.rpc.bsc);
    this.tvlCache = null;
    this.tvlHistory = [];
    this.poolsData = new Map();
  }

  async fetchFromDefiLlama() {
    try {
      // Fetch TermMax TVL from DefiLlama
      const response = await axios.get('https://api.llama.fi/protocol/termmax');
      const data = response.data;

      const tvlData = {
        totalTvl: data.tvl?.[data.tvl.length - 1]?.totalLiquidityUSD || 0,
        chainTvls: data.chainTvls || {},
        timestamp: Date.now(),
      };

      this.tvlCache = tvlData;
      this.tvlHistory.push(tvlData);

      // Keep last 1000 data points
      if (this.tvlHistory.length > 1000) {
        this.tvlHistory.shift();
      }

      return tvlData;
    } catch (error) {
      console.error('Error fetching TVL from DefiLlama:', error.message);
      return this.tvlCache;
    }
  }

  async fetchPoolsData() {
    try {
      // Fetch pools data from DefiLlama yields API
      const response = await axios.get('https://yields.llama.fi/pools');
      const pools = response.data.data;

      // Filter for TermMax pools
      const termMaxPools = pools.filter(
        (pool) => pool.project?.toLowerCase() === 'termmax'
      );

      const poolsInfo = termMaxPools.map((pool) => ({
        poolId: pool.pool,
        chain: pool.chain,
        symbol: pool.symbol,
        tvlUsd: pool.tvlUsd,
        apy: pool.apy,
        apyBase: pool.apyBase,
        apyReward: pool.apyReward,
        timestamp: Date.now(),
      }));

      // Update cache
      poolsInfo.forEach((pool) => {
        const existing = this.poolsData.get(pool.poolId);
        if (existing) {
          // Track history for each pool
          if (!existing.history) existing.history = [];
          existing.history.push({
            tvlUsd: pool.tvlUsd,
            apy: pool.apy,
            timestamp: pool.timestamp,
          });
          if (existing.history.length > 1000) {
            existing.history.shift();
          }
        }
        this.poolsData.set(pool.poolId, {
          ...pool,
          history: existing?.history || [],
        });
      });

      return poolsInfo;
    } catch (error) {
      console.error('Error fetching pools data:', error.message);
      return Array.from(this.poolsData.values());
    }
  }

  getTvlChange(minutes = 60) {
    if (this.tvlHistory.length < 2) {
      return null;
    }

    const now = Date.now();
    const cutoff = now - minutes * 60 * 1000;
    const oldData = this.tvlHistory.find((d) => d.timestamp >= cutoff);

    if (!oldData) {
      return null;
    }

    const currentTvl = this.tvlHistory[this.tvlHistory.length - 1].totalTvl;
    const changePercent = ((currentTvl - oldData.totalTvl) / oldData.totalTvl) * 100;

    return {
      currentTvl,
      oldTvl: oldData.totalTvl,
      changePercent,
      period: minutes,
    };
  }

  getPoolTvlChange(poolId, minutes = 60) {
    const pool = this.poolsData.get(poolId);
    if (!pool || !pool.history || pool.history.length < 2) {
      return null;
    }

    const now = Date.now();
    const cutoff = now - minutes * 60 * 1000;
    const oldData = pool.history.find((d) => d.timestamp >= cutoff);

    if (!oldData) {
      return null;
    }

    const current = pool.history[pool.history.length - 1];
    const tvlChangePercent = ((current.tvlUsd - oldData.tvlUsd) / oldData.tvlUsd) * 100;
    const apyChange = current.apy - oldData.apy;

    return {
      poolId,
      currentTvl: current.tvlUsd,
      oldTvl: oldData.tvlUsd,
      tvlChangePercent,
      currentApy: current.apy,
      oldApy: oldData.apy,
      apyChange,
      period: minutes,
    };
  }

  getCache() {
    return {
      tvl: this.tvlCache,
      pools: Array.from(this.poolsData.values()),
    };
  }
}

module.exports = new TVLService();
