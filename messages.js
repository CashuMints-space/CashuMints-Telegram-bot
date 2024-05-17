module.exports = {
  topMintsMessage: (mints) => `Top Mints:\n${JSON.stringify(mints, null, 2)}`,
  topWalletsMessage: (wallets) => `Top Wallets:\n${JSON.stringify(wallets, null, 2)}`,
  mintRequestMessage: (pr, hash) => `Payment request: ${pr}\nHash: ${hash}`,
  tokenMessage: (encoded) => `Encoded Token: ${encoded}`,
  errorMessage: 'Sorry, there was an error processing your request.'
};
