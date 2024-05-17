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
        bot.sendMessage(chatId, messages.topMintsMessage(mint), {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Show Mint QR', callback_data: `show_qr_${mint.url}` }],
              [{ text: 'More info', url: `https://cashumints.space/mint/${mint.id}` }]
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
        bot.sendMessage(chatId, messages.topWalletsMessage(wallet), {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Show Wallet QR', callback_data: `show_qr_${wallet.url}` }],
              [{ text: 'More info', url: `https://cashumints.space/wallet/${wallet.id}` }]
            ]
          }
        });
      });
    } else {
      bot.sendMessage(chatId, messages.errorMessage);
    }
  },

  requestMint: async (bot, msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;
    console.log(`[INFO] ${username} requested minting.`);
    
    const amount = 200; // Example amount, you can customize this or make it dynamic
    try {
      const { pr, hash } = await wallet.requestMint(amount);
      console.log(`[DEBUG] Mint request successful: PR=${pr}, Hash=${hash}`);
      bot.sendMessage(chatId, messages.mintRequestMessage(pr, hash));
    } catch (error) {
      console.error('Error requesting mint:', error);
      bot.sendMessage(chatId, messages.errorMessage);
    }
  },

  checkInvoice: async (bot, msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;
    console.log(`[INFO] ${username} requested to check invoice.`);
    
    const hash = msg.text.split(' ')[1]; // Extract the hash from the command

    if (!hash) {
      bot.sendMessage(chatId, messages.requestHashMessage);
      return;
    }

    const amount = 200; // Example amount, you can customize this or make it dynamic

    try {
      const { proofs } = await wallet.requestTokens(amount, hash);
      const encoded = getEncodedToken({
        token: [{ mint: MINT_URL, proofs }]
      });
      console.log(`[DEBUG] Invoice checked, tokens received: ${encoded}`);
      bot.sendMessage(chatId, messages.tokenMessage(encoded));
    } catch (error) {
      console.error('Error checking invoice or getting tokens:', error);
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

  encodeToken: async (bot, msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;
    console.log(`[INFO] ${username} requested to encode a token.`);
    
    const tokenData = msg.text.split(' ')[1]; // Extract the token data from the command
    if (!tokenData) {
      bot.sendMessage(chatId, 'Please provide token data to encode.');
      return;
    }
    try {
      const encoded = getEncodedToken(JSON.parse(tokenData));
      console.log(`[DEBUG] Token encoded: ${encoded}`);
      bot.sendMessage(chatId, `Encoded Token: ${encoded}`);
    } catch (error) {
      console.error('Error encoding token:', error);
      bot.sendMessage(chatId, messages.errorMessage);
    }
  },

  help: (bot, msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;
    console.log(`[INFO] ${username} requested help.`);
    bot.sendMessage(chatId, messages.helpMessage);
  },

  start: (bot, msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;
    console.log(`[INFO] ${username} started the bot.`);
    bot.sendMessage(chatId, messages.startMessage);
  }
};

module.exports = commands;
