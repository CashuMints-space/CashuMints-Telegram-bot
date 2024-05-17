module.exports = {
  topMintsMessage: (mints) => `Top Mints:\n${JSON.stringify(mints, null, 2)}`,
  topWalletsMessage: (wallets) => `Top Wallets:\n${JSON.stringify(wallets, null, 2)}`,
  mintRequestMessage: (pr, hash) => `Payment request: ${pr}\nHash: ${hash}`,
  tokenMessage: (encoded) => `Encoded Token: ${encoded}`,
  errorMessage: 'Sorry, there was an error processing your request.',
  requestHashMessage: 'Please provide the hash from the mint request.',
  helpMessage: 'Available commands:\n' +
               '/cashu_topwallets - Show top wallets\n' +
               '/cashu_topmints - Show top mints\n' +
               '/cashudecode - Decode a token\n' +
               '/cashuencode - Encode a token\n' +
               '/help - Show this help message',
  startMessage: 'Welcome to the CashuMints bot! Use /help to see available commands.'
};
