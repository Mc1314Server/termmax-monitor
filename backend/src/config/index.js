require('dotenv').config();

module.exports = {
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
  },
  rpc: {
    bsc: process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org',
  },
  monitor: {
    interval: parseInt(process.env.MONITOR_INTERVAL) || 60000,
    tvlChangeThreshold: parseFloat(process.env.TVL_CHANGE_THRESHOLD) || 20,
    priceAlertThreshold: parseFloat(process.env.PRICE_ALERT_THRESHOLD) || 5,
  },
  server: {
    port: parseInt(process.env.PORT) || 3001,
  },
};
