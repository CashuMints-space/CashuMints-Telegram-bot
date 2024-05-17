const axios = require('axios');
const { CashuMint, CashuWallet, getEncodedToken } = require('@cashu/cashu-ts');
const { Markup } = require('telegraf');
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
  cashuTopMints: async (ctx) => {
    const username = ctx.message.from.username;
    console.log(`[INFO] ${username} requested top mints.`);
    
    const mints = await fetchData('https://cashumints.space/wp-json/public/top-liked-public/', 'mints.json');
    if (mints) {
      const topMints = mints.slice(0, 4);
      console.log(`[DEBUG] Top 4 mints: ${JSON.stringify(topMints)}`);
      topMints.forEach(mint => {
        ctx.replyWithMarkdown(messages.topMintsMessage(mint),
          Markup.inlineKeyboard([
            Markup.button.callback('Show Mint QR', `show_qr_${mint.url}`),
            Markup.button.url('More info', `https://cashumints.space/mint/${mint.id}`)
          ])
        );
      });
    } else {
      ctx.reply(messages.errorMessage);
    }
  },

  cashuTopWallets: async (ctx) => {
    const username = ctx.message.from.username;
    console.log(`[INFO] ${username} requested top wallets.`);
    
    const wallets = await fetchData('https://cashumints.space/wp-json/public/top-liked-public/', 'wallets.json');
    if (wallets) {
      const topWallets = wallets.slice(0, 4);
      console.log(`[DEBUG] Top 4 wallets: ${JSON.stringify(topWallets)}`);
      topWallets.forEach(wallet => {
        ctx.replyWithMarkdown(messages.topWalletsMessage(wallet),
          Markup.inlineKeyboard([
            Markup.button.callback('Show Wallet QR', `show_qr_${wallet.url}`),
            Markup.button.url('More info', `https://cashumints.space/wallet/${wallet.id}`)
          ])
        );
      });
    } else {
      ctx.reply(messages.errorMessage);
    }
  },

  requestMint: async (ctx) => {
    const username = ctx.message.from.username;
    console.log(`[INFO] ${username} requested minting.`);
    
    const amount = 200; // Example amount, you can customize this or make it dynamic
    try {
      const { pr, hash } = await wallet.requestMint(amount);
      console.log(`[DEBUG] Mint request successful: PR=${pr}, Hash=${hash}`);
      ctx.reply(messages.mintRequestMessage(pr, hash));
    } catch (error) {
      console.error('Error requesting mint:', error);
      ctx.reply(messages.errorMessage);
    }
  },

  checkInvoice: async (ctx) => {
    const username = ctx.message.from.username;
    console.log(`[INFO] ${username} requested to check invoice.`);
    
    const hash = ctx.message.text.split(' ')[1]; // Extract the hash from the command

    if (!hash) {
      ctx.reply(messages.requestHashMessage);
      return;
    }

    const amount = 200; // Example amount, you can customize this or make it dynamic

    try {
      const { proofs } = await wallet.requestTokens(amount, hash);
      const encoded = getEncodedToken({
        token: [{ mint: MINT_URL, proofs }]
      });
      console.log(`[DEBUG] Invoice checked, tokens received: ${encoded}`);
      ctx.reply(messages.tokenMessage(encoded));
    } catch (error) {
      console.error('Error checking invoice or getting tokens:', error);
      ctx.reply(messages.errorMessage);
    }
  },

  decodeToken: async (ctx) => {
    const username = ctx.message.from.username;
    console.log(`[INFO] ${username} requested to decode a token.`);
    
    const token = ctx.message.text.split(' ')[1]; // Extract the token from the command
    if (!token) {
      ctx.reply('Please provide a token to decode.');
      return;
    }
    try {
      const decoded = wallet.decodeToken(token);
      console.log(`[DEBUG] Token decoded: ${JSON.stringify(decoded, null, 2)}`);
      ctx.reply(`Decoded Token: ${JSON.stringify(decoded, null, 2)}`);
    } catch (error) {
      console.error('Error decoding token:', error);
      ctx.reply(messages.errorMessage);
    }
  },

  encodeToken: async (ctx) => {
    const username = ctx.message.from.username;
    console.log(`[INFO] ${username} requested to encode a token.`);
    
    const tokenData = ctx.message.text.split(' ')[1]; // Extract the token data from the command
    if (!tokenData) {
      ctx.reply('Please provide token data to encode.');
      return;
    }
    try {
      const encoded = getEncodedToken(JSON.parse(tokenData));
      console.log(`[DEBUG] Token encoded: ${encoded}`);
      ctx.reply(`Encoded Token: ${encoded}`);
    } catch (error) {
      console.error('Error encoding token:', error);
      ctx.reply(messages.errorMessage);
    }
  },

  help: (ctx) => {
    const username = ctx.message.from.username;
    console.log(`[INFO] ${username} requested help.`);
    ctx.reply(messages.helpMessage);
  },

  start: (ctx) => {
    const username = ctx.message.from.username;
    console.log(`[INFO] ${username} started the bot.`);
    ctx.reply(messages.startMessage);
  }
};

module.exports = commands;
