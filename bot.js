const TelegramBot = require('node-telegram-bot-api');
const { handleMessage } = require('./Modules/cashuchecker');
require('dotenv').config();
const messages = require('./messages');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

bot.on('message', async (msg) => {
    if (msg.text && msg.text.startsWith('/')) return;
    try {
        await handleMessage(bot, msg, process.env.CASHU_API_URL, parseInt(process.env.CLAIMED_DISPOSE_TIMING));
    } catch (error) {
        console.error('[ERROR] Error handling message:', error);
    }
});

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, messages.startMessage);
});

bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, messages.helpMessage);
});

console.log('Bot is running...');
