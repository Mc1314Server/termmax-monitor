const axios = require('axios');
const config = require('../config');

const TERMMAX_API_BASE = 'https://api.termmax.ts.finance';

class TermMaxService {
  constructor() {
    this.poolsCache = [];
    this.vaultsCache = new Map();
    this.poolsHistory = new Map();
    this.lastUpdate = null;
  }

  // Parse strike price from vault name (e.g., "B2/USDT@24DEC2025-0.5P" -> 0.5)
  parseStrikePrice(vaultName) {
    if (!vaultName) return 0;
    // Match pattern like "-0.5P" or "-0.195P" or "-0.04P"
    const match = vaultName.match(/-(\d+\.?\d*)P$/i);
    if (match) {
      return parseFloat(match[1]);
    }
    // Also try pattern like "-50C" for calls (price in cents/whole numbers)
    const callMatch = vaultName.match(/-(\d+\.?\d*)C$/i);
    if (callMatch) {
      return parseFloat(callMatch[1]);
    }
    return 0;
  }

  // Fetch vault details (APY, TVL)
  async fetchVaultDetails(chainId, vaultAddress) {
    try {
      const response = await axios.get(`${TERMMAX_API_BASE}/vault/item`, {
        params: { chainId, vaultAddress },
        timeout: 10000,
      });
      return response.data.data;
    } catch (error) {
      console.error(`Error fetching vault ${vaultAddress}:`, error.message);
      return null;
    }
  }

  async fetchAlphaPools(chainId = 56) {
    try {
      const response = await axios.get(`${TERMMAX_API_BASE}/v2/alpha/list`, {
        params: {
          chainId,
          tags: 'alpha',
          includeInactive: false,
          sortBy: 'capacity',
          sortDirection: 'desc',
        },
        timeout: 30000,
      });

      const data = response.data.data;
      const pools = this.parseAlphaPools(data);

      // Fetch vault details for each pool to get accurate APY/TVL
      const vaultAddresses = [...new Set(pools.map(p => p.vaultAddress).filter(Boolean))];
      
      console.log(`Fetching ${vaultAddresses.length} vault details...`);
      
      // Fetch vault details in parallel (max 5 concurrent)
      const vaultDetails = await Promise.all(
        vaultAddresses.map(addr => this.fetchVaultDetails(chainId, addr))
      );

      // Map vault details
      const vaultMap = new Map();
      vaultDetails.forEach((vault, i) => {
        if (vault) {
          vaultMap.set(vaultAddresses[i].toLowerCase(), vault);
          this.vaultsCache.set(vaultAddresses[i].toLowerCase(), vault);
        }
      });

      // Enrich pools with vault data
      const enrichedPools = pools.map(pool => {
        const vault = vaultMap.get(pool.vaultAddress?.toLowerCase());
        if (vault) {
          // Parse strike price from vault name (e.g., "B2/USDT@24DEC2025-0.5P" -> 0.5)
          const strikePrice = this.parseStrikePrice(vault.name);
          
          return {
            ...pool,
            // Override with accurate vault data
            tvl: parseFloat(vault.tvl) || pool.tvl,
            tvlUsd: parseFloat(vault.tvl) || pool.tvlUsd,
            totalApy: (vault.apy || 0) * 100, // Convert to percentage
            apr: (vault.apr || 0) * 100,
            capacity: parseFloat(vault.capacityValue) || pool.capacity,
            capacityUsd: parseFloat(vault.capacityValue) || pool.capacityUsd,
            utilization: vault.capacityValue > 0 
              ? (parseFloat(vault.tvl) / parseFloat(vault.capacityValue)) * 100 
              : pool.utilization,
            idleFunds: parseFloat(vault.idleFunds) / 1e18 || 0,
            totalAssets: parseFloat(vault.totalAssets) / 1e18 || 0,
            // Strike price from vault name
            strikePrice,
            targetPrice: strikePrice, // Use strikePrice as targetPrice for display
            priceToTarget: strikePrice > 0 
              ? ((pool.underlyingPrice - strikePrice) / strikePrice) * 100 
              : 0,
            // Vault metadata
            vaultName: vault.name,
            vaultSymbol: vault.symbol,
            assetSymbol: vault.asset?.symbol || 'USDT',
            collateralSymbol: vault.whitelistCollaterals?.[0]?.symbol,
            curator: vault.curator?.name,
            apyInfo: vault.apyInfo,
            incentiveData: vault.incentiveData,
          };
        }
        return pool;
      });

      // Update cache
      this.poolsCache = enrichedPools;
      this.lastUpdate = Date.now();

      // Update history for each pool
      enrichedPools.forEach((pool) => {
        if (!this.poolsHistory.has(pool.optionId)) {
          this.poolsHistory.set(pool.optionId, []);
        }
        const history = this.poolsHistory.get(pool.optionId);
        history.push({
          timestamp: Date.now(),
          tvl: pool.tvl,
          capacity: pool.capacity,
          utilization: pool.utilization,
          totalApy: pool.totalApy,
          underlyingPrice: pool.underlyingPrice,
          targetPrice: pool.targetPrice,
        });
        // Keep last 1000 data points
        if (history.length > 1000) {
          history.shift();
        }
      });

      return enrichedPools;
    } catch (error) {
      console.error('Error fetching TermMax pools:', error.message);
      return this.poolsCache;
    }
  }

  parseAlphaPools(data) {
    if (!data || !data.alphaCollections) {
      return [];
    }

    return data.alphaCollections.map((collection) => {
      const longOrder = collection.longOrder;
      const shortOrder = collection.shortOrder;
      const vaultConfig = collection.vaultConfig;

      // Parse underlying token info
      const underlyingPriceInfo = longOrder?.priceInfos?.find(
        (p) => p.type === 'BASIC' && p.symbol !== 'USDT'
      );

      // Get vault addresses - there can be longVault and shortVault
      const longVaultAddress = collection.longVaultAddress || 
                               vaultConfig?.longVaultAddress ||
                               vaultConfig?.vaultInfo?.vaultAddress;
      const shortVaultAddress = collection.shortVaultAddress || 
                                vaultConfig?.shortVaultAddress;
      // Use short vault as primary (usually the sell high vault with USDT TVL)
      const vaultAddress = shortVaultAddress || longVaultAddress;

      // Calculate initial TVL and capacity from vaultConfig
      const vaultInfo = vaultConfig?.vaultInfo;
      const totalAssets = vaultInfo?.totalAssets
        ? parseFloat(vaultInfo.totalAssets) / 1e18
        : 0;
      const maxCapacity = vaultInfo?.maxCapacity
        ? parseFloat(vaultInfo.maxCapacity) / 1e18
        : 0;

      // Get APY info from vaultConfig (will be overridden by vault API)
      const apyInfo = vaultConfig?.apyInfo;
      const totalApy = apyInfo?.totalApy || 0;

      // Parse price info
      const underlyingPrice = underlyingPriceInfo
        ? parseFloat(underlyingPriceInfo.price) / Math.pow(10, underlyingPriceInfo.priceDecimals)
        : 0;
      const targetPrice = underlyingPriceInfo?.thirdPartyPrice
        ? parseFloat(underlyingPriceInfo.thirdPartyPrice) / Math.pow(10, underlyingPriceInfo.thirdPartyPriceDecimals || 8)
        : 0;

      // Price metadata (24h change etc)
      const priceMetadata = underlyingPriceInfo?.metadata || {};

      return {
        optionId: collection.optionId,
        symbol: collection.symbol,
        maturity: collection.maturity,
        maturityTimestamp: new Date(collection.maturity).getTime(),

        // Underlying token
        underlyingSymbol: underlyingPriceInfo?.symbol || 'Unknown',
        underlyingAddress: underlyingPriceInfo?.assetAddress,
        underlyingPrice,
        targetPrice,
        priceToTarget: targetPrice > 0 ? ((underlyingPrice - targetPrice) / targetPrice) * 100 : 0,

        // 24h price change
        priceChange24h: parseFloat(priceMetadata.priceChangePercent) || 0,
        highPrice24h: parseFloat(priceMetadata.highPrice) || 0,
        lowPrice24h: parseFloat(priceMetadata.lowPrice) || 0,
        volume24h: parseFloat(priceMetadata.volume) || 0,

        // TVL and capacity (initial, will be overridden by vault API)
        tvl: totalAssets,
        tvlUsd: totalAssets,
        capacity: maxCapacity,
        capacityUsd: maxCapacity,
        utilization: maxCapacity > 0 ? (totalAssets / maxCapacity) * 100 : 0,

        // APY (initial, will be overridden by vault API)
        totalApy,

        // Contract addresses
        longMarketAddress: collection.longMarketAddress,
        shortMarketAddress: collection.shortMarketAddress,
        vaultAddress,
        longVaultAddress,
        shortVaultAddress,

        // Tags
        tags: longOrder?.orderConfig?.tags || [],

        // Timestamps
        timestamp: Date.now(),
      };
    });
  }

  getPoolChange(optionId, minutes = 60) {
    const history = this.poolsHistory.get(optionId);
    if (!history || history.length < 2) {
      return null;
    }

    const now = Date.now();
    const cutoff = now - minutes * 60 * 1000;
    const oldData = history.find((d) => d.timestamp >= cutoff);

    if (!oldData) {
      return null;
    }

    const current = history[history.length - 1];

    return {
      optionId,
      tvlChange: current.tvl - oldData.tvl,
      tvlChangePercent: oldData.tvl > 0 ? ((current.tvl - oldData.tvl) / oldData.tvl) * 100 : 0,
      utilizationChange: current.utilization - oldData.utilization,
      apyChange: current.longApy - oldData.longApy,
      priceChange: current.underlyingPrice - oldData.underlyingPrice,
      priceChangePercent: oldData.underlyingPrice > 0
        ? ((current.underlyingPrice - oldData.underlyingPrice) / oldData.underlyingPrice) * 100
        : 0,
      period: minutes,
      current,
      old: oldData,
    };
  }

  getCache() {
    return {
      pools: this.poolsCache,
      lastUpdate: this.lastUpdate,
      poolCount: this.poolsCache.length,
    };
  }

  // Get summary statistics
  getSummary() {
    const pools = this.poolsCache;
    if (pools.length === 0) {
      return null;
    }

    const totalTvl = pools.reduce((sum, p) => sum + (p.tvlUsd || 0), 0);
    const totalCapacity = pools.reduce((sum, p) => sum + (p.capacityUsd || 0), 0);
    const avgApy = pools.reduce((sum, p) => sum + (p.totalApy || 0), 0) / pools.length;
    const avgUtilization = pools.reduce((sum, p) => sum + (p.utilization || 0), 0) / pools.length;

    return {
      totalTvl,
      totalCapacity,
      avgApy,
      avgUtilization,
      poolCount: pools.length,
      lastUpdate: this.lastUpdate,
    };
  }
}

module.exports = new TermMaxService();
