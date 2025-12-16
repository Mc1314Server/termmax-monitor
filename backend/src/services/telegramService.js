const TelegramBot = require('node-telegram-bot-api');
const config = require('../config');

class TelegramService {
  constructor() {
    this.bot = null;
    this.chatIds = new Set();
    this.isEnabled = false;
  }

  initialize() {
    if (!config.telegram.botToken) {
      console.log('Telegram bot token not configured. Notifications disabled.');
      return;
    }

    try {
      this.bot = new TelegramBot(config.telegram.botToken, { polling: true });
      this.isEnabled = true;

      // Add default chat ID if configured
      if (config.telegram.chatId) {
        this.chatIds.add(config.telegram.chatId);
      }

      // Handle /start command
      this.bot.onText(/\/start/, (msg) => {
        const chatId = msg.chat.id;
        this.chatIds.add(chatId.toString());
        this.bot.sendMessage(
          chatId,
          `🚀 *TermMax Monitor Bot Started!*\n\nYour Chat ID: \`${chatId}\`\n\nCommands:\n/status - Get current status\n/prices - Get token prices\n/tvl - Get TVL info\n/alerts - Manage alerts\n/help - Show help`,
          { parse_mode: 'Markdown' }
        );
      });

      // Handle /status command
      this.bot.onText(/\/status/, async (msg) => {
        const chatId = msg.chat.id;
        this.bot.sendMessage(chatId, '⏳ Fetching status...');
      });

      // Handle /prices command
      this.bot.onText(/\/prices/, async (msg) => {
        const chatId = msg.chat.id;
        this.bot.sendMessage(chatId, '⏳ Fetching prices...');
      });

      // Handle /tvl command
      this.bot.onText(/\/tvl/, async (msg) => {
        const chatId = msg.chat.id;
        this.bot.sendMessage(chatId, '⏳ Fetching TVL...');
      });

      // Handle /help command
      this.bot.onText(/\/help/, (msg) => {
        const chatId = msg.chat.id;
        this.bot.sendMessage(
          chatId,
          `📖 *TermMax Monitor Help*\n\n` +
            `Monitor TermMax Dual Investment pools on BSC.\n\n` +
            `*Commands:*\n` +
            `/start - Start the bot\n` +
            `/status - Monitoring status & summary\n` +
            `/pools - List all pools with prices\n` +
            `/prices - Token prices (24h change)\n` +
            `/tvl - TVL information\n` +
            `/alerts - Recent alerts\n` +
            `/watchlist - View your watchlist\n` +
            `/calc <token> <amount> - Calculate expected return\n` +
            `/invest <token> <amount> - Track investment\n` +
            `/report - View investment report\n` +
            `/help - Show this help\n\n` +
            `*Auto Alerts:*\n` +
            `🔴 TVL change > ${config.monitor.tvlChangeThreshold}%\n` +
            `⚠️ Price within 5% of target\n` +
            `📈 Utilization spike > 20%\n` +
            `📊 APY significant change\n\n` +
            `*Custom Alerts:*\n` +
            `Add tokens to watchlist via web UI to receive custom alerts for APY, strike price, TVL changes.`,
          { parse_mode: 'Markdown' }
        );
      });

      console.log('Telegram bot initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Telegram bot:', error.message);
    }
  }

  async sendAlert(message, type = 'info') {
    if (!this.isEnabled || this.chatIds.size === 0) {
      console.log('Telegram alert (not sent):', message);
      return;
    }

    const emoji = {
      info: 'ℹ️',
      warning: '⚠️',
      danger: '🚨',
      success: '✅',
      price: '💰',
      tvl: '📊',
    };

    const formattedMessage = `${emoji[type] || 'ℹ️'} *TermMax Alert*\n\n${message}`;

    for (const chatId of this.chatIds) {
      try {
        await this.bot.sendMessage(chatId, formattedMessage, {
          parse_mode: 'Markdown',
        });
      } catch (error) {
        console.error(`Failed to send message to ${chatId}:`, error.message);
      }
    }
  }

  async sendTvlAlert(data) {
    const message =
      `*TVL Change Alert*\n\n` +
      `📊 Current TVL: $${this.formatNumber(data.currentTvl)}\n` +
      `📉 Previous TVL: $${this.formatNumber(data.oldTvl)}\n` +
      `📈 Change: ${data.changePercent.toFixed(2)}%\n` +
      `⏱️ Period: ${data.period} minutes`;

    await this.sendAlert(message, data.changePercent < 0 ? 'danger' : 'warning');
  }

  async sendPriceAlert(data) {
    const message =
      `*Price Alert*\n\n` +
      `🪙 Token: ${data.symbol}\n` +
      `💵 Current Price: $${this.formatNumber(data.currentPrice)}\n` +
      `📊 Change: ${data.changePercent.toFixed(2)}%\n` +
      `⏱️ Period: ${data.period} minutes`;

    await this.sendAlert(message, 'price');
  }

  async sendPoolAlert(data) {
    const message =
      `*Pool Alert*\n\n` +
      `🏊 Pool: ${data.symbol || data.poolId}\n` +
      `📊 TVL: $${this.formatNumber(data.currentTvl)} (${data.tvlChangePercent.toFixed(2)}%)\n` +
      `💹 APY: ${data.currentApy?.toFixed(2)}% (${data.apyChange > 0 ? '+' : ''}${data.apyChange?.toFixed(2)}%)\n` +
      `⏱️ Period: ${data.period} minutes`;

    await this.sendAlert(message, Math.abs(data.tvlChangePercent) > 20 ? 'danger' : 'warning');
  }

  async sendStatusUpdate(status) {
    const message =
      `*Status Update*\n\n` +
      `📊 Total TVL: $${this.formatNumber(status.tvl)}\n` +
      `🏊 Active Pools: ${status.poolCount}\n` +
      `⏰ Last Update: ${new Date().toLocaleString()}`;

    await this.sendAlert(message, 'info');
  }

  formatNumber(num) {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num?.toFixed(2) || '0';
  }

  // Register command handlers from external services
  registerCommandHandler(command, handler) {
    if (this.bot) {
      this.bot.onText(new RegExp(`/${command}`), handler);
    }
  }

  addChatId(chatId) {
    this.chatIds.add(chatId.toString());
  }
}

module.exports = new TelegramService();
