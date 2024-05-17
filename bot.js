require('dotenv').config();
const { Telegraf } = require('telegraf');
const commands = require('./Modules/commands');

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start(commands.start);
bot.help(commands.help);
bot.command('/cashu topwallets', commands.cashuTopWallets);
bot.command('/cashu topmints', commands.cashuTopMints);
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

bot.launch();

console.log('Bot is running...');
