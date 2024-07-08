require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const commands = require('./Modules/commands');
const { handleMessage } = require('./Modules/cashuchecker');
const messages = require('./messages');
const { getDecodedToken } = require('@cashu/cashu-ts');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const cashuApiUrl = process.env.CASHU_API_URL;
const claimedDisposeTiming = parseInt(process.env.CLAIMED_DISPOSE_TIMING) || 10;
const checkIntervalSeconds = parseInt(process.env.CHECK_INTERVAL_SECONDS) || 5;
const debugMode = process.env.DEBUG_MODE === 'true';

const logInfo = (message) => {
    if (debugMode) {
        console.log(`[INFO] ${message}`);
    }
};

const logError = (message, error) => {
    console.error(`[ERROR] ${message}: ${error.message}`, error);
};

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;
    logInfo(`${username} started the bot.`);
    bot.sendMessage(chatId, messages.startMessage, { parse_mode: 'Markdown' });
});

bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;
    logInfo(`${username} requested help.`);
    bot.sendMessage(chatId, messages.helpMessage, { parse_mode: 'Markdown' });
});

bot.onText(/\/cashumints top/, (msg) => commands.cashuTopMints(bot, msg));
bot.onText(/\/cashuwallets top/, (msg) => commands.cashuTopWallets(bot, msg));
bot.onText(/\/cashudecode/, (msg) => commands.decodeToken(bot, msg));

bot.on('message', async (msg) => {
    try {
        const chatId = msg.chat.id;
        const text = msg.text;
        const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;

        logInfo(`Received message from ${username}: ${text}`);

        if (text && text.startsWith('/')) {
            logInfo(`Handling command: ${text}`);
            return; // Commands are already handled by bot.onText()
        }

        if (text && text.startsWith('cashuA')) {
            try {
                const decodedToken = getDecodedToken(text);
                logInfo(`Detected Cashu token from ${username}`);
                await handleMessage(bot, msg, cashuApiUrl, claimedDisposeTiming);
            } catch (error) {
                logInfo(`No valid Cashu token detected in the message from ${username}`);
                if (msg.chat.type === 'private') {
                    logInfo(`Sending help message to ${username}`);
                    await bot.sendMessage(chatId, messages.helpMessage, { parse_mode: 'Markdown' });
                }
            }
        } else if (msg.chat.type === 'private') {
            logInfo(`No valid Cashu token and not a command. Sending help message to ${username}`);
            await bot.sendMessage(chatId, messages.helpMessage, { parse_mode: 'Markdown' });
        }
    } catch (error) {
        logError('Error handling message', error);
    }
});

// Handle polling errors
bot.on('polling_error', (error) => {
    logError('Polling error', error);
});

// Handle webhook errors
bot.on('webhook_error', (error) => {
    logError('Webhook error', error);
});

// Handle unexpected errors
bot.on('error', (error) => {
    logError('Unexpected error', error);
});

console.log('Bot is running...');
