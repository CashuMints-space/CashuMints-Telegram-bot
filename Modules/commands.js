const axios = require('axios');
const { CashuMint, CashuWallet, getEncodedToken } = require('@cashu/cashu-ts');
const messages = require('../messages');
const { saveData, loadData } = require('./dataCache');
require('dotenv').config();

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
        console.error(`Error fetching data from ${url}:`, error);
        return null;
    }
};

const formatMintMessage = (mint) => {
    return `*Mint Name:* ${mint.post_title}\n*Mint URL:* ${mint.guid}\n*Likes:* ${mint.likes || 0}`;
};

const commands = {
    cashuTopMints: async (bot, msg) => {
        const chatId = msg.chat.id;
        const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;
        console.log(`[INFO] ${username} requested top mints.`);

        const mints = await fetchData('https://cashumints.space/wp-json/public/top-liked-public/', 'mints.json');
        if (mints) {
            const topMints = mints.slice(0, 4);
            console.log(`[DEBUG] Top 4 mints: ${JSON.stringify(topMints)}`);
            topMints.forEach(mint => {
                bot.sendMessage(chatId, formatMintMessage(mint), {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'More info', url: mint.guid }]
                        ]
                    }
                });
            });
        } else {
            bot.sendMessage(chatId, messages.errorMessage);
        }
    },

    cashuTopWallets: async (bot, msg) => {
        const chatId = msg.chat.id;
        const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;
        console.log(`[INFO] ${username} requested top wallets.`);

        const wallets = await fetchData('https://cashumints.space/wp-json/public/top-liked-public/', 'wallets.json');
        if (wallets) {
            const topWallets = wallets.slice(0, 4);
            console.log(`[DEBUG] Top 4 wallets: ${JSON.stringify(topWallets)}`);
            topWallets.forEach(wallet => {
                bot.sendMessage(chatId, formatMintMessage(wallet), {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'More info', url: wallet.guid }]
                        ]
                    }
                });
            });
        } else {
            bot.sendMessage(chatId, messages.errorMessage);
        }
    },

    decodeToken: async (bot, msg) => {
        const chatId = msg.chat.id;
        const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;
        console.log(`[INFO] ${username} requested to decode a token.`);

        const token = msg.text.split(' ')[1]; // Extract the token from the command
        if (!token) {
            bot.sendMessage(chatId, 'Please provide a token to decode.');
            return;
        }
        try {
            const decoded = wallet.decodeToken(token);
            console.log(`[DEBUG] Token decoded: ${JSON.stringify(decoded, null, 2)}`);
            bot.sendMessage(chatId, `Decoded Token: ${JSON.stringify(decoded, null, 2)}`);
        } catch (error) {
            console.error('Error decoding token:', error);
            bot.sendMessage(chatId, messages.errorMessage);
        }
    },

    help: (bot, msg) => {
        const chatId = msg.chat.id;
        const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;
        console.log(`[INFO] ${username} requested help.`);
        bot.sendMessage(chatId, messages.helpMessage, { parse_mode: 'Markdown' });
    },

    start: (bot, msg) => {
        const chatId = msg.chat.id;
        const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;
        console.log(`[INFO] ${username} started the bot.`);
        bot.sendMessage(chatId, messages.startMessage, { parse_mode: 'Markdown' });
    }
};

module.exports = commands;
