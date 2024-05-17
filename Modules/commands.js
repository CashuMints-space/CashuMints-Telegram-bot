const axios = require('axios');
const { CashuMint, CashuWallet, getEncodedToken } = require('@cashu/cashu-ts');
const { Markup } = require('telegraf');
const messages = require('../messages');
require('dotenv').config();

const MINT_URL = process.env.MINT_URL;
const wallet = new CashuWallet(new CashuMint(MINT_URL));

// Helper function to fetch data from an API endpoint
const fetchData = async (url) => {
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error(`Error fetching data from ${url}:`, error);
    return null;
  }
};

const commands = {
  cashuTopMints: async (ctx) => {
    const mints = await fetchData('https://cashumints.space/cashu-mint/rss');
    if (mints) {
      const topMints = mints.slice(0, 4);
      topMints.forEach(mint => {
        ctx.replyWithMarkdown(`*Mint:* ${mint.name}\n*URL:* ${mint.url}`, 
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
    const wallets = await fetchData('https://cashumints.space/wp-json/public/top-liked-public/');
    if (wallets) {
      const topWallets = wallets.slice(0, 4);
      topWallets.forEach(wallet => {
        ctx.replyWithMarkdown(`*Wallet:* ${wallet.name}\n*URL:* ${wallet.url}`, 
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
    const amount = 200; // Example amount, you can customize this or make it dynamic
    try {
      const { pr, hash } = await wallet.requestMint(amount);
      ctx.reply(messages.mintRequestMessage(pr, hash));
    } catch (error) {
      console.error('Error requesting mint:', error);
      ctx.reply(messages.errorMessage);
    }
  },

  checkInvoice: async (ctx) => {
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
      ctx.reply(messages.tokenMessage(encoded));
    } catch (error) {
      console.error('Error checking invoice or getting tokens:', error);
      ctx.reply(messages.errorMessage);
    }
  },

  decodeToken: async (ctx) => {
    const token = ctx.message.text.split(' ')[1]; // Extract the token from the command
    if (!token) {
      ctx.reply('Please provide a token to decode.');
      return;
    }
    try {
      const decoded = wallet.decodeToken(token);
      ctx.reply(`Decoded Token: ${JSON.stringify(decoded, null, 2)}`);
    } catch (error) {
      console.error('Error decoding token:', error);
      ctx.reply(messages.errorMessage);
    }
  },

  encodeToken: async (ctx) => {
    const tokenData = ctx.message.text.split(' ')[1]; // Extract the token data from the command
    if (!tokenData) {
      ctx.reply('Please provide token data to encode.');
      return;
    }
    try {
      const encoded = getEncodedToken(JSON.parse(tokenData));
      ctx.reply(`Encoded Token: ${encoded}`);
    } catch (error) {
      console.error('Error encoding token:', error);
      ctx.reply(messages.errorMessage);
    }
  },

  help: (ctx) => {
    ctx.reply(messages.helpMessage);
  },

  start: (ctx) => {
    ctx.reply(messages.startMessage);
  }
};

module.exports = commands;
