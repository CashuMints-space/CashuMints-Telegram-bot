require('dotenv').config();
const { Telegraf } = require('telegraf');
const commands = require('./Modules/commands');

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.command('/cashu_mints', commands.cashuMints);
bot.command('/cashu_wallets', commands.cashuWallets);
bot.command('/request_mint', commands.requestMint);
bot.command('/check_invoice', commands.checkInvoice);

bot.launch();

console.log('Bot is running...');
