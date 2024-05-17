module.exports = {
  topMintsMessage: (mint) => `*Mint:* ${mint.name}\n*URL:* ${mint.url}`,
  topWalletsMessage: (wallet) => `*Wallet:* ${wallet.name}\n*URL:* ${wallet.url}`,
  mintRequestMessage: (pr, hash) => `Payment request: ${pr}\nHash: ${hash}`,
  tokenMessage: (encoded) => `Encoded Token: ${encoded}`,
  errorMessage: 'Sorry, there was an error processing your request.',
  requestHashMessage: 'Please provide the hash from the mint request.',
  helpMessage: 'Available commands:\n' +
               '/cashu topwallets - Show top wallets\n' +
               '/cashu topmints - Show top mints\n' +
               '/cashudecode - Decode a token\n' +
               '/cashuencode - Encode a token\n' +
               '/request mint - Request minting tokens\n' +
               '/check invoice - Check invoice status and get tokens\n' +
               '/help - Show this help message',
  startMessage: 'Welcome to the CashuMints bot! Use /help to see available commands.'
};
