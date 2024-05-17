require('dotenv').config();
const { Telegraf } = require('telegraf');
const commands = require('./Modules/commands');

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start(commands.start);
bot.help(commands.help);
bot.command('/Cashu_topwallets', commands.cashuTopWallets);
bot.command('/Cashu_topmints', commands.cashuTopMints);
bot.command('/cashu_decode', commands.decodeToken);
bot.command('/cashu_encode', commands.encodeToken);
bot.command('/request_mint', commands.requestMint);
bot.command('/check_invoice', commands.checkInvoice);

bot.action(/^show_qr_(.+)$/, async (ctx) => {
  const url = ctx.match[1];
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(url)}&size=150x150`;
  ctx.replyWithPhoto(qrCodeUrl, { caption: `Mint URL: ${url}` });
});

bot.launch();

console.log('Bot is running...');
