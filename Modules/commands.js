const axios = require('axios');
const { CashuMint, CashuWallet, getEncodedToken } = require('@cashu/cashu-ts');
const messages = require('../messages');
const { getTopMints } = require('./cashumints');
const { saveData, loadData } = require('./dataCache');
require('dotenv').config();
const logger = require('../logger');

const MINT_URL = process.env.MINT_URL;
const wallet = new CashuWallet(new CashuMint(MINT_URL));

const fetchData = async (url, cacheFilename) => {
    const cachedData = loadData(cacheFilename);
    if (cachedData) {
        return cachedData;
    }

    try {
        const response = await axios.get(url);
        saveData(cacheFilename, response.data);
        return response.data;
    } catch (error) {
        logger.error(`Error fetching data from ${url}:`, error);
        return null;
    }
};

const formatMintMessage = (mint) => {
    return `*Mint Name:* [${mint.post_title}](${mint.guid})\n*Likes:* ${mint.likes}\n*Dislikes:* ${mint.dislikes}`;
};

const commands = {
    cashuTopMints: async (bot, msg) => {
        const chatId = msg.chat.id;
        const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;
        if (process.env.DEBUG_MODE === 'true') {
            logger.info(`${username} requested top mints.`);
        }

        const mints = await getTopMints();
        if (mints) {
            const topMints = mints.slice(0, 5);
            const formattedMints = topMints.map(formatMintMessage).join('\n\n');
            const message = `*Top 5 Cashu Mints:*\n\n${formattedMints}`;

            await bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown'
            });
        } else {
            bot.sendMessage(chatId, messages.errorMessage);
        }
    },

    decodeToken: async (bot, msg) => {
        const chatId = msg.chat.id;
        const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;
        if (process.env.DEBUG_MODE === 'true') {
            logger.info(`${username} requested to decode a token.`);
        }

        const token = msg.text.split(' ')[1]; // Extract the token from the command
        if (!token) {
            bot.sendMessage(chatId, 'Please provide a token to decode.');
            return;
        }
        try {
            const decoded = wallet.decodeToken(token);
            if (process.env.DEBUG_MODE === 'true') {
                logger.debug(`Token decoded: ${JSON.stringify(decoded, null, 2)}`);
            }
            bot.sendMessage(chatId, `Decoded Token: ${JSON.stringify(decoded, null, 2)}`);
        } catch (error) {
            logger.error('Error decoding token:', error);
            bot.sendMessage(chatId, messages.errorMessage);
        }
    },

    help: (bot, msg) => {
        const chatId = msg.chat.id;
        const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;
        if (process.env.DEBUG_MODE === 'true') {
            logger.info(`${username} requested help.`);
        }
        bot.sendMessage(chatId, messages.helpMessage, { parse_mode: 'Markdown' });
    },

    start: (bot, msg) => {
        const chatId = msg.chat.id;
        const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;
        if (process.env.DEBUG_MODE === 'true') {
            logger.info(`${username} started the bot.`);
        }
        bot.sendMessage(chatId, messages.startMessage, { parse_mode: 'Markdown' });
    }
};

module.exports = commands;
