require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const commands = require('./Modules/commands');
const { handleMessage, checkPendingTokens } = require('./Modules/cashuchecker');
const messages = require('./messages');
const { getDecodedToken } = require('@cashu/cashu-ts');
const logger = require('./logger');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const cashuApiUrl = process.env.CASHU_API_URL;
const claimedDisposeTiming = parseInt(process.env.CLAIMED_DISPOSE_TIMING) || 10;
const checkIntervalSeconds = parseInt(process.env.CHECK_INTERVAL_SECONDS) || 5;

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;
    logger.info(`${username} started the bot.`);
    bot.sendMessage(chatId, messages.startMessage);
});

bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;
    logger.info(`${username} requested help.`);
    bot.sendMessage(chatId, messages.helpMessage);
});

bot.onText(/\/cashumints/, (msg) => commands.cashuTopMints(bot, msg));
bot.onText(/\/cashuwallets top/, (msg) => commands.cashuTopWallets(bot, msg));
bot.onText(/\/cashudecode/, (msg) => commands.decodeToken(bot, msg));

bot.on('message', async (msg) => {
    try {
        const chatId = msg.chat.id;
        const text = msg.text;
        const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;

        logger.info(`Received message from ${username}: ${text}`);

        // Only respond to commands or Cashu tokens
        if (text.startsWith('/') || text.startsWith('cashuA')) {
            if (text.startsWith('cashuA')) {
                try {
                    const decodedToken = getDecodedToken(text);
                    logger.info(`Detected Cashu token from ${username}`);
                    await handleMessage(bot, msg, cashuApiUrl, claimedDisposeTiming);
                } catch (error) {
                    logger.info(`No valid Cashu token detected in the message from ${username}`);
                    if (msg.chat.type === 'private') {
                        logger.info(`Sending help message to ${username}`);
                        await bot.sendMessage(chatId, messages.helpMessage);
                    }
                }
            }
        } else if (msg.chat.type === 'private') {
            logger.info(`No valid Cashu token and not a command. Sending help message to ${username}`);
            await bot.sendMessage(chatId, messages.helpMessage);
        }
    } catch (error) {
        logger.error('Error handling message', error);
    }
});

// Handle polling errors
bot.on('polling_error', (error) => {
    logger.error('Polling error', error);
});

// Handle webhook errors
bot.on('webhook_error', (error) => {
    logger.error('Webhook error', error);
});

// Handle unexpected errors
bot.on('error', (error) => {
    logger.error('Unexpected error', error);
});

// Check pending tokens on startup
(async () => {
    await checkPendingTokens(bot);
})();

bot.on('callback_query', async (callbackQuery) => {
    const { data, message } = callbackQuery;
    const chatId = message.chat.id;

    if (data.startsWith('mint_')) {
        const index = parseInt(data.split('_')[1], 10);
        const mints = await getTopMints();

        if (mints && mints[index]) {
            const mint = mints[index];
            const messageText = formatMintMessage(mint);
            const inlineKeyboard = mints.map((mint, idx) => [
                { text: `Mint ${idx + 1}`, callback_data: `mint_${idx}` }
            ]);

            await bot.editMessageText(messageText, {
                chat_id: chatId,
                message_id: message.message_id,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: inlineKeyboard
                }
            });
        }
    }
});

logger.info('Bot is running...');
