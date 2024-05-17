require('dotenv').config();
const { Telegraf } = require('telegraf');
const commands = require('./Modules/commands');
const { handleMessage, checkTokenStatus } = require('./Modules/cashuchecker');
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
    const chatId = msg.chat.id;
    const text = msg.text;
    const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;

    console.log(`[INFO] Received message from ${username}: ${text}`);

    if (text.startsWith('/')) {
      // Handle command messages
      console.log(`[INFO] Handling command: ${text}`);
      return; // Commands are already handled by Telegraf's bot.command() method
    }

    // Try to decode the token to see if it contains a valid Cashu token
    try {
      const decodedToken = getDecodedToken(text);
      console.log(`[INFO] Detected Cashu token from ${username}`);
      await handleMessage(bot, msg, cashuApiUrl, claimedDisposeTiming);
    } catch (error) {
      // If decoding fails, it means the message is not a Cashu token
      console.log(`[INFO] No valid Cashu token detected in the message from ${username}`);
      if (msg.chat.type === 'private') {
        // Send help message in private chat
        console.log(`[INFO] Sending help message to ${username}`);
        await bot.sendMessage(chatId, messages.helpMessage);
      }
    }
  } catch (error) {
    console.error(`[ERROR] Error handling message: ${error.message}`, error);
  }
});

bot.launch()
  .then(() => console.log('Bot is running...'))
  .catch(error => console.error(`[ERROR] Error launching bot: ${error.message}`, error));
