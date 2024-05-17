require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const commands = require('./Modules/commands');
const { handleMessage, checkTokenStatus } = require('./Modules/cashuchecker');
const messages = require('./messages');
const { getDecodedToken } = require('@cashu/cashu-ts');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const cashuApiUrl = process.env.CASHU_API_URL;
const claimedDisposeTiming = parseInt(process.env.CLAIMED_DISPOSE_TIMING) || 10;

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;
  console.log(`[INFO] ${username} started the bot.`);
  bot.sendMessage(chatId, messages.startMessage);
});

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;
  console.log(`[INFO] ${username} requested help.`);
  bot.sendMessage(chatId, messages.helpMessage);
});

bot.onText(/\/cashumints top/, (msg) => commands.cashuTopMints(bot, msg));
bot.onText(/\/cashuwallets top/, (msg) => commands.cashuTopWallets(bot, msg));
bot.onText(/\/cashudecode/, (msg) => commands.decodeToken(bot, msg));
bot.onText(/\/cashuencode/, (msg) => commands.encodeToken(bot, msg));
bot.onText(/\/request mint/, (msg) => commands.requestMint(bot, msg));
bot.onText(/\/check invoice/, (msg) => commands.checkInvoice(bot, msg));

bot.on('message', async (msg) => {
  try {
    const chatId = msg.chat.id;
    const text = msg.text;
    const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;

    console.log(`[INFO] Received message from ${username}: ${text}`);

    if (text.startsWith('/')) {
      // Handle command messages
      console.log(`[INFO] Handling command: ${text}`);
      return; // Commands are already handled by bot.onText()
    }

    // Check if the message starts with "cashuA" indicating it might be a Cashu token
    if (text.startsWith('cashuA')) {
      try {
        // Try to decode the token to see if it contains a valid Cashu token
        const decodedToken = getDecodedToken(text);
        console.log(`[INFO] Detected Cashu token from ${username}`);
        await handleMessage(bot, msg, cashuApiUrl, claimedDisposeTiming);
      } catch (error) {
        // If decoding fails, it means the message is not a valid Cashu token
        console.log(`[INFO] No valid Cashu token detected in the message from ${username}`);
        if (msg.chat.type === 'private') {
          // Send help message in private chat
          console.log(`[INFO] Sending help message to ${username}`);
          await bot.sendMessage(chatId, messages.helpMessage);
        }
      }
    } else if (msg.chat.type === 'private') {
      // If not a valid token and in private chat, send help message
      console.log(`[INFO] No valid Cashu token and not a command. Sending help message to ${username}`);
      await bot.sendMessage(chatId, messages.helpMessage);
    }
  } catch (error) {
    console.error(`[ERROR] Error handling message: ${error.message}`, error);
  }
});

// Handle polling errors
bot.on('polling_error', (error) => {
  console.error(`[POLLING_ERROR] ${error.code}: ${error.message}`, error);
});

// Handle webhook errors
bot.on('webhook_error', (error) => {
  console.error(`[WEBHOOK_ERROR] ${error.code}: ${error.message}`, error);
});

// Handle unexpected errors
bot.on('error', (error) => {
  console.error(`[ERROR] ${error.code}: ${error.message}`, error);
});

console.log('Bot is running...');
