// Simplified price service - prices are fetched from TermMax API via termmaxService
class PriceService {
  constructor() {
    this.priceCache = new Map();
  }

  // Update price cache from TermMax pool data
  updateFromPools(pools) {
    for (const pool of pools) {
      if (pool.underlyingSymbol && pool.underlyingPrice) {
        this.priceCache.set(pool.underlyingSymbol, {
          price: pool.underlyingPrice,
          change24h: pool.priceChange24h || 0,
          timestamp: Date.now(),
        });
      }
    }
  }

  // Get all cached prices
  async getAllPrices() {
    const prices = {};
    for (const [symbol, data] of this.priceCache.entries()) {
      prices[symbol] = data;
    }
    return prices;
  }

  getCache() {
    const result = {};
    for (const [symbol, data] of this.priceCache.entries()) {
      result[symbol] = data;
    }
    return result;
  }
}

module.exports = new PriceService();
