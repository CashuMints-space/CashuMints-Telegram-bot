require('dotenv').config();
const { Telegraf } = require('telegraf');
const commands = require('./Modules/commands');
const { handleMessage } = require('./Modules/cashuchecker');
const messages = require('./messages');

const bot = new Telegraf(process.env.BOT_TOKEN);
const cashuApiUrl = process.env.CASHU_API_URL;
const claimedDisposeTiming = parseInt(process.env.CLAIMED_DISPOSE_TIMING) || 10;

bot.start(commands.start);
bot.help(commands.help);
bot.command('/cashumints top', commands.cashuTopMints);
bot.command('/cashuwallets top', commands.cashuTopWallets);
bot.command('/cashudecode', commands.decodeToken);
bot.command('/cashuencode', commands.encodeToken);
bot.command('/request mint', commands.requestMint);
bot.command('/check invoice', commands.checkInvoice);

bot.action(/^show_qr_(.+)$/, async (ctx) => {
  const url = ctx.match[1];
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(url)}&size=150x150`;
  console.log(`[INFO] Generating QR code for URL: ${url}`);
  ctx.replyWithPhoto(qrCodeUrl, { caption: `Mint URL: ${url}` });
});

bot.on('message', async (msg) => {
  try {
    if (msg.text && msg.text.startsWith('cashu')) {
      console.log(`[INFO] Received message from ${msg.from.username}: ${msg.text}`);
      await handleMessage(bot, msg, cashuApiUrl, claimedDisposeTiming);
    } else {
      console.log(`[INFO] Ignoring non-cashu message from ${msg.from.username}`);
    }
  } catch (error) {
    console.error(`[ERROR] Error handling message: ${error.message}`, error);
  }
});

bot.launch()
  .then(() => console.log('Bot is running...'))
  .catch(error => console.error(`[ERROR] Error launching bot: ${error.message}`, error));
