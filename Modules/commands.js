const axios = require('axios');
const { CashuMint, CashuWallet, getEncodedToken } = require('@cashu/cashu-ts');
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

module.exports = {
  cashuMints: async (ctx) => {
    const mints = await fetchData('https://cashumints.space/cashu-mint/rss');
    if (mints) {
      ctx.reply(messages.topMintsMessage(mints));
    } else {
      ctx.reply(messages.errorMessage);
    }
  },

  cashuWallets: async (ctx) => {
    const wallets = await fetchData('https://cashumints.space/wp-json/public/top-liked-public/');
    if (wallets) {
      ctx.reply(messages.topWalletsMessage(wallets));
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
    const amount = 200; // Example amount, you can customize this or make it dynamic
    const hash = 'YOUR_HASH_HERE'; // Replace with the actual hash from the mint request

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
  }
};
